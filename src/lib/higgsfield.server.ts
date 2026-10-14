/**
 * Higgsfield video provider: Seedance 2.0 text-to-video through the public API
 * (https://docs.higgsfield.ai). Selected with VIDEO_PROVIDER=higgsfield; the
 * Veo path in ai.server.ts stays the default.
 *
 * Wire facts, each confirmed against the published docs on 2026-10-13:
 *  - POST https://api.higgsfield.ai/bytedance/seedance-2.0/text-to-video
 *    with `Authorization: Key <id>:<secret>`. The schema rejects extra fields.
 *  - The reply is a receipt (`request_id`, `status_url`, `cancel_url`); the
 *    job is then polled at GET /requests/{id}/status until it is terminal.
 *  - Terminal statuses: completed (`video.url`), failed, nsfw, canceled.
 *    Failed and moderated requests are not charged.
 *  - `Idempotency-Key` makes an ambiguous timeout safe to retry: replaying a
 *    key returns the original request without a second charge.
 *  - Output URLs live for at least seven days, so the video is copied into our
 *    own bucket as soon as it completes.
 *
 * The public API documents no `mode` (fast) field for Seedance 2.0, so the
 * cheap "480p fast" test rung from the CLI workflow does not exist here; the
 * cheapest rung is 480p standard.
 */
import { AiError } from "@/lib/ai.server";
import type { Storyboard } from "@/lib/content-engine/types";

const BASE_URL = "https://api.higgsfield.ai";
const MODEL_PATH = "bytedance/seedance-2.0/text-to-video";

/** Stored in content_items.video_operation so the poller knows which provider owns the job. */
export const HIGGSFIELD_OP_PREFIX = "higgsfield:";

export const MIN_DURATION_SECONDS = 4;
export const MAX_DURATION_SECONDS = 15;

/** content-media bucket cap (supabase/migrations/20260925120000_content_media_video.sql). */
export const MAX_VIDEO_BYTES = 52_428_800;

const SUBMIT_TIMEOUT_MS = 30_000;
const STATUS_TIMEOUT_MS = 15_000;
const DOWNLOAD_TIMEOUT_MS = 120_000;
const MAX_ATTEMPTS = 3;

export type VideoProvider = "veo" | "higgsfield";
export type VideoProfile = "draft" | "standard" | "premium";
export type VideoResolution = "480p" | "720p" | "1080p" | "4k";

export const PROFILE_RESOLUTION: Record<VideoProfile, VideoResolution> = {
  draft: "480p",
  standard: "720p",
  premium: "1080p",
};

/**
 * Credits per second of output for Seedance 2.0 standard mode. Source: the
 * Higgsfield CLI's `generate cost` on 2026-10-13, which priced 5 s and 15 s
 * clips at exactly these rates (linear in duration). They are the CLI's
 * numbers; the public API's own estimate endpoint is the authoritative price,
 * so treat these as a budget guard, not a bill.
 */
export const CREDITS_PER_SECOND: Record<VideoResolution, number> = {
  "480p": 3,
  "720p": 4.5,
  "1080p": 9,
  "4k": 22,
};

export function estimateCredits(resolution: VideoResolution, seconds: number): number {
  return Math.round(CREDITS_PER_SECOND[resolution] * seconds * 100) / 100;
}

export function videoProvider(): VideoProvider {
  return process.env["VIDEO_PROVIDER"] === "higgsfield" ? "higgsfield" : "veo";
}

export function configuredProfile(): VideoProfile {
  const value = process.env["HIGGSFIELD_VIDEO_PROFILE"];
  return value === "draft" || value === "premium" ? value : "standard";
}

/** Hard ceiling per render. 70 allows a 15 s 720p clip (67.5) and blocks a 1080p one (135). */
export function maxCreditsPerRender(): number {
  const parsed = Number(process.env["HIGGSFIELD_MAX_CREDITS_PER_RENDER"]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 70;
}

export type RenderSegment = { start: number; end: number; description: string };

export type RenderPlan = {
  profile: VideoProfile;
  resolution: VideoResolution;
  duration: number;
  estimatedCredits: number;
  segments: RenderSegment[];
};

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}

/**
 * Fits the storyboard's blocks into one generation. Seedance renders at most
 * 15 seconds per request while a storyboard runs 15 to 45, so block lengths
 * are scaled proportionally onto the clip and each block becomes a timed,
 * hard-cut segment (2 to 6 blocks is always feasible: duration >= block count).
 * Refuses a plan whose estimated cost exceeds the configured ceiling, so a
 * profile change can never silently multiply spend.
 */
export function planVideoRender(
  storyboard: Storyboard,
  options?: { profile?: VideoProfile; maxCredits?: number },
): RenderPlan {
  const profile = options?.profile ?? configuredProfile();
  const resolution = PROFILE_RESOLUTION[profile];
  const shots = [...storyboard.shots].sort((a, b) => a.ordem - b.ordem);
  if (shots.length === 0) throw new AiError("O roteiro não tem cenas para gerar o vídeo.");

  const lengths = shots.map((shot) => Math.max(1, Math.round(shot.duracao_seg) || 1));
  const total = lengths.reduce((sum, length) => sum + length, 0);
  const duration = clamp(total, MIN_DURATION_SECONDS, MAX_DURATION_SECONDS);

  const segments: RenderSegment[] = [];
  let cumulative = 0;
  let previousEnd = 0;
  shots.forEach((shot, index) => {
    cumulative += lengths[index] ?? 1;
    const isLast = index === shots.length - 1;
    const remainingShots = shots.length - 1 - index;
    const scaled = Math.round((duration * cumulative) / total);
    const end = isLast ? duration : clamp(scaled, previousEnd + 1, duration - remainingShots);
    segments.push({ start: previousEnd, end, description: shot.visual_descricao.trim() });
    previousEnd = end;
  });

  const estimatedCredits = estimateCredits(resolution, duration);
  const ceiling = options?.maxCredits ?? maxCreditsPerRender();
  if (estimatedCredits > ceiling) {
    throw new AiError("Este vídeo excede o limite de custo configurado para uma geração.", {
      cause: new Error(
        `estimated ${estimatedCredits} credits exceeds ceiling ${ceiling} (${profile}, ${duration}s)`,
      ),
    });
  }
  return { profile, resolution, duration, estimatedCredits, segments };
}

function timestamp(seconds: number): string {
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

/**
 * Seedance prompt in the block order the model rewards (context, format mode,
 * timed action, audio, style, locks): positive phrasing only, timed hard cuts,
 * and no narration, because the voice-over is recorded separately and script
 * words must never enter a render prompt.
 */
export function buildSeedancePrompt(anchor: string, plan: RenderPlan): string {
  const lines = plan.segments.map(
    (segment, index) =>
      `[${timestamp(segment.start)}-${timestamp(segment.end)}] SHOT ${index + 1}: ${segment.description}`,
  );
  return [
    "SCENE CONTEXT",
    `Short vertical social video for a small business. ${anchor}`.trim(),
    "",
    "FORMAT MODE",
    `Timed multishot, ${plan.segments.length} shots, ${plan.duration} seconds. HARD CUT at each timestamp; cuts happen only at the specified points, the camera does not cut on its own.`,
    "",
    "TIMED ACTION",
    ...lines,
    "",
    "AUDIO",
    "Natural ambient sound that belongs to each scene. Instrumental silence between sounds.",
    "",
    "STYLE",
    "Photoreal, natural light, fine film grain, calm natural expressions.",
    "",
    "POSITIVE LOCKS",
    "Same people, same location and same lighting in every shot. Clean frame with imagery only, tack sharp.",
  ].join("\n");
}

// --- HTTP ---------------------------------------------------------------

function authorization(): string {
  const id = process.env["HF_API_KEY_ID"];
  const secret = process.env["HF_API_KEY_SECRET"];
  if (!id || !secret) {
    throw new AiError("Geração de vídeo por IA temporariamente indisponível.", {
      cause: new Error("HF_API_KEY_ID / HF_API_KEY_SECRET não configuradas"),
    });
  }
  return `Key ${id}:${secret}`;
}

function retryable(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Sends one request, retrying transient failures. Only call with a request
 * that is safe to repeat: a GET, or a POST carrying an Idempotency-Key.
 */
async function send(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  connectError: string,
): Promise<Response> {
  let lastStatus = 0;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let response: Response | undefined;
    try {
      response = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
    } catch (err) {
      if (attempt === MAX_ATTEMPTS) throw new AiError(connectError, { cause: err });
    }
    if (response) {
      if (response.ok || !retryable(response.status) || attempt === MAX_ATTEMPTS) return response;
      lastStatus = response.status;
    }
    console.warn(`[higgsfield] retrying after transient failure (attempt ${attempt + 1})`, {
      status: lastStatus,
    });
    await sleep(400 * 2 ** (attempt - 1));
  }
  throw new AiError(connectError);
}

function failure(status: number, label: string): AiError {
  console.error(`[higgsfield] ${label} failed`, { status });
  if (status === 402) {
    return new AiError(
      "Os créditos de geração de vídeo acabaram. Avise o administrador antes de tentar de novo.",
    );
  }
  if (status === 401 || status === 403) {
    return new AiError("Geração de vídeo por IA temporariamente indisponível.");
  }
  if (status === 429) {
    return new AiError("O serviço de vídeo está sobrecarregado. Tente novamente em instantes.");
  }
  return new AiError("O serviço de vídeo não conseguiu processar o pedido agora.");
}

/**
 * Submits one render. `idempotencyKey` must be generated once per user action
 * and reused across the retries inside this call (it is), so a timeout after
 * the server accepted the job cannot create, or charge for, a second one.
 */
export async function startHiggsfieldVideo(params: {
  prompt: string;
  plan: RenderPlan;
  aspectRatio: "16:9" | "9:16";
  idempotencyKey: string;
}): Promise<{ operationName: string }> {
  const response = await send(
    `${BASE_URL}/${MODEL_PATH}`,
    {
      method: "POST",
      headers: {
        Authorization: authorization(),
        "Content-Type": "application/json",
        "Idempotency-Key": params.idempotencyKey,
      },
      body: JSON.stringify({
        prompt: params.prompt,
        duration: params.plan.duration,
        resolution: params.plan.resolution,
        aspect_ratio: params.aspectRatio,
        generate_audio: true,
      }),
    },
    SUBMIT_TIMEOUT_MS,
    "Não foi possível conectar ao serviço de vídeo.",
  );
  if (!response.ok) throw failure(response.status, "submit");

  const json = (await response.json().catch(() => ({}))) as { request_id?: string };
  if (!json.request_id) {
    throw new AiError("O serviço de vídeo não retornou um identificador de operação.");
  }
  console.info("[higgsfield] submitted", {
    requestId: json.request_id,
    model: MODEL_PATH,
    profile: params.plan.profile,
    resolution: params.plan.resolution,
    duration: params.plan.duration,
    estimatedCredits: params.plan.estimatedCredits,
  });
  return { operationName: `${HIGGSFIELD_OP_PREFIX}${json.request_id}` };
}

export type HiggsfieldStatus =
  | { status: "rendering" }
  | { status: "ready"; videoUrl: string }
  | { status: "failed"; error: string };

export function requestIdFromOperation(operationName: string): string {
  if (!operationName.startsWith(HIGGSFIELD_OP_PREFIX)) {
    throw new AiError("Identificador de operação inválido.");
  }
  const id = operationName.slice(HIGGSFIELD_OP_PREFIX.length);
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(id)) throw new AiError("Identificador de operação inválido.");
  return id;
}

export async function checkHiggsfieldVideo(operationName: string): Promise<HiggsfieldStatus> {
  const id = requestIdFromOperation(operationName);
  const response = await send(
    `${BASE_URL}/requests/${id}/status`,
    { headers: { Authorization: authorization() } },
    STATUS_TIMEOUT_MS,
    "Não foi possível verificar o status do vídeo.",
  );
  if (!response.ok) throw failure(response.status, "status");

  const json = (await response.json().catch(() => ({}))) as {
    status?: string;
    video?: { url?: string };
    error?: string;
  };
  switch (json.status) {
    case "queued":
    case "in_progress":
      return { status: "rendering" };
    case "completed": {
      const url = json.video?.url;
      if (!url) return { status: "failed", error: "Vídeo gerado sem URL de saída." };
      return { status: "ready", videoUrl: url };
    }
    case "failed":
      return { status: "failed", error: "Falha ao gerar o vídeo." };
    case "nsfw":
      return { status: "failed", error: "O conteúdo foi recusado pela moderação do provedor." };
    case "canceled":
      return { status: "failed", error: "A geração do vídeo foi cancelada." };
    default:
      // An unknown status is not terminal: keep polling rather than failing a paid job.
      console.warn("[higgsfield] unrecognized status", { status: json.status });
      return { status: "rendering" };
  }
}

/** The output URL is public and short-lived (at least 7 days), so it is copied into our bucket. */
export async function downloadHiggsfieldVideo(videoUrl: string): Promise<Uint8Array> {
  let url: URL;
  try {
    url = new URL(videoUrl);
  } catch {
    throw new AiError("Não foi possível baixar o vídeo gerado.");
  }
  if (url.protocol !== "https:") throw new AiError("Não foi possível baixar o vídeo gerado.");

  const response = await send(
    url.toString(),
    {},
    DOWNLOAD_TIMEOUT_MS,
    "Não foi possível baixar o vídeo gerado.",
  );
  if (!response.ok) throw failure(response.status, "download");

  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_VIDEO_BYTES) throw tooLarge(declared);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > MAX_VIDEO_BYTES) throw tooLarge(bytes.byteLength);
  return bytes;
}

function tooLarge(size: number): AiError {
  console.error("[higgsfield] video exceeds the content-media bucket limit", {
    size,
    limit: MAX_VIDEO_BYTES,
  });
  return new AiError("O vídeo gerado é maior que o limite de armazenamento.");
}
