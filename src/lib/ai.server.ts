/**
 * Two providers, split by task:
 *  - Anthropic (Claude) for all text/structured-JSON generation — the
 *    diagnostic report, content plan, carousel outline, storyboard script,
 *    and onboarding research draft. Moved off Gemini per an explicit,
 *    scoped request ("all the text and diagnostic work").
 *  - Gemini stays for image generation (gemini-2.5-flash-image / "Nano
 *    Banana") and Veo video — those weren't in scope for this change.
 *
 * The Gemini REST calls are confirmed against ai.google.dev's own docs
 * (generateContent, image output via inlineData/responseModalities, Veo via
 * predictLongRunning) rather than assumed. Model IDs are env-driven with
 * conservative defaults (see .env.example) — verify current availability at
 * https://generativelanguage.googleapis.com/v1beta/models before relying on
 * a default in production.
 */
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
// The rest of this app validates against plain "zod" (v3 API surface).
// @anthropic-ai/sdk's zodOutputFormat is typed against zod/v4's internals
// specifically (zod 3.25+ ships both APIs in one package) — schemas built
// with plain "zod" don't structurally satisfy it. Callers of generateJson()
// must build their `schema` with `import { z } from "zod/v4"`, not "zod".
import type { z } from "zod/v4";

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";

const TEXT_MODEL = process.env["ANTHROPIC_TEXT_MODEL"] || "claude-sonnet-4-6";
const IMAGE_MODEL = process.env["GEMINI_IMAGE_MODEL"] || "gemini-2.5-flash-image";
const VIDEO_MODEL = process.env["GEMINI_VIDEO_MODEL"] || "veo-3.1-generate-preview";

const DEFAULT_TIMEOUT_MS = 45_000;
const MAX_RETRIES = 1;

/**
 * Thrown by every function in this module. `userMessage` is safe to show a
 * customer (short, generic, Portuguese). The full upstream error is logged
 * server-side via `cause`/`console.error` and MUST NOT be relayed to the
 * client (S-4 in the security review — the Lovable-gateway version of this
 * file used to do exactly that).
 */
export class AiError extends Error {
  readonly userMessage: string;
  constructor(userMessage: string, options?: { cause?: unknown }) {
    super(userMessage, options);
    this.userMessage = userMessage;
    this.name = "AiError";
  }
}

class RetryableAiError extends Error {}

// --- Anthropic (Claude) — text / structured JSON --------------------------

let _anthropic: Anthropic | undefined;
function getAnthropicClient(): Anthropic {
  if (!_anthropic) {
    const apiKey = process.env["ANTHROPIC_API_KEY"];
    if (!apiKey) {
      throw new AiError("Geração de texto por IA temporariamente indisponível.", {
        cause: new Error("ANTHROPIC_API_KEY não configurada"),
      });
    }
    _anthropic = new Anthropic({ apiKey });
  }
  return _anthropic;
}

/**
 * Structured JSON generation via Claude's native structured outputs
 * (`messages.parse` + a Zod schema — see typescript/claude-api/tool-use.md
 * in the claude-api skill). This replaces both the old Gemini responseSchema
 * plumbing AND the hand-written JSON-schema-in-parallel-with-a-TS-type
 * pattern the Gemini version needed: callers now pass one Zod schema and
 * get a fully-typed, already-validated result back — `z.infer` is the
 * return type, no `<T>` generic to keep in sync by hand.
 */
export async function generateJson<S extends z.ZodType>(options: {
  instructions: string;
  input: string;
  schema: S;
}): Promise<z.infer<S>> {
  try {
    const response = await getAnthropicClient().messages.parse({
      model: TEXT_MODEL,
      max_tokens: 16000,
      system: options.instructions,
      messages: [{ role: "user", content: options.input }],
      output_config: { format: zodOutputFormat(options.schema) },
    });

    if (response.stop_reason === "refusal") {
      throw new AiError("A IA não conseguiu processar esse pedido. Tente reformular.");
    }
    if (!response.parsed_output) {
      throw new AiError("A IA retornou uma resposta inesperada. Tente novamente.");
    }
    return response.parsed_output;
  } catch (err) {
    if (err instanceof AiError) throw err;
    // Most-specific-first: the SDK's typed exception chain (never string-match errors).
    if (err instanceof Anthropic.AuthenticationError) {
      console.error("[ai] Anthropic authentication error:", err.message);
      throw new AiError("Geração por IA temporariamente indisponível.", { cause: err });
    }
    if (err instanceof Anthropic.RateLimitError) {
      console.error("[ai] Anthropic rate limited:", err.message);
      throw new AiError("O serviço de IA está sobrecarregado. Tente novamente em instantes.", {
        cause: err,
      });
    }
    if (err instanceof Anthropic.APIError) {
      console.error(`[ai] Anthropic API error [${err.status}]:`, err.message);
      throw new AiError("O serviço de IA não conseguiu processar o pedido agora.", { cause: err });
    }
    console.error("[ai] Anthropic unexpected error:", err);
    throw new AiError("Não foi possível conectar ao serviço de IA.", { cause: err });
  }
}

// --- Gemini — image generation + Veo video ---------------------------------

export function getGeminiApiKey(): string {
  const key = process.env["GEMINI_API_KEY"];
  if (!key) {
    throw new AiError("Geração de imagem/vídeo por IA temporariamente indisponível.", {
      cause: new Error("GEMINI_API_KEY não configurada"),
    });
  }
  return key;
}

function isRetryable(status: number) {
  return status === 429 || status >= 500;
}

async function withRetry<T>(label: string, fn: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (!(err instanceof RetryableAiError) || attempt === MAX_RETRIES) break;
      await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
      console.warn(`[ai] retrying ${label} after transient failure (attempt ${attempt + 2})`);
    }
  }
  throw lastError;
}

function geminiHeaders(): HeadersInit {
  return { "Content-Type": "application/json", "x-goog-api-key": getGeminiApiKey() };
}

async function callGemini(model: string, body: unknown, timeoutMs: number): Promise<unknown> {
  const response = await fetch(`${GEMINI_BASE}/models/${model}:generateContent`, {
    method: "POST",
    signal: AbortSignal.timeout(timeoutMs),
    headers: geminiHeaders(),
    body: JSON.stringify(body),
  }).catch((err) => {
    throw new AiError("Não foi possível conectar ao serviço de imagens.", { cause: err });
  });

  if (!response.ok) {
    console.error("[ai] Gemini image request failed", { model, status: response.status });
    if (response.status === 402)
      throw new AiError(
        "Os créditos de geração do Google acabaram. Avise o administrador ou use a composição local.",
      );
    if (isRetryable(response.status)) throw new RetryableAiError(`gemini ${response.status}`);
    throw new AiError("O serviço de IA não conseguiu processar o pedido agora.");
  }
  return response.json();
}

type GenerateContentResponse = {
  candidates?: {
    content?: { parts?: { text?: string; inlineData?: { data?: string; mimeType?: string } }[] };
  }[];
};

/** Gera uma imagem via Gemini (gemini-2.5-flash-image / "Nano Banana") e devolve os bytes em base64. */
export async function generateImageBase64(
  prompt: string,
  options?: { timeoutMs?: number },
): Promise<string> {
  return withRetry("generateImageBase64", async () => {
    const json = (await callGemini(
      IMAGE_MODEL,
      {
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { responseModalities: ["IMAGE"] },
      },
      options?.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    )) as GenerateContentResponse;

    const parts = json.candidates?.[0]?.content?.parts ?? [];
    const imagePart = parts.find((p) => p.inlineData?.data);
    if (!imagePart?.inlineData?.data)
      throw new AiError("A IA não retornou imagem. Tente novamente.");
    return imagePart.inlineData.data;
  });
}

// --- Veo video generation: async (predictLongRunning) — see
// src/lib/content-engine/index.ts for how this is turned into a poll-able
// job instead of a blocking call. ---

export async function startVideoGeneration(
  prompt: string,
  options?: { aspectRatio?: "16:9" | "9:16" },
): Promise<{ operationName: string }> {
  const response = await fetch(`${GEMINI_BASE}/models/${VIDEO_MODEL}:predictLongRunning`, {
    method: "POST",
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    headers: geminiHeaders(),
    body: JSON.stringify({
      instances: [{ prompt }],
      parameters: { aspectRatio: options?.aspectRatio ?? "9:16" },
    }),
  }).catch((err) => {
    throw new AiError("Não foi possível conectar ao serviço de vídeo.", { cause: err });
  });

  if (!response.ok) {
    console.error("[ai] Veo start request failed", { model: VIDEO_MODEL, status: response.status });
    if (response.status === 402)
      throw new AiError(
        "Os créditos de geração do Google acabaram. Use o vídeo composto com sua peça aprovada.",
      );
    throw new AiError("Não foi possível iniciar a geração do vídeo.");
  }
  const json = (await response.json()) as { name?: string };
  if (!json.name)
    throw new AiError("O serviço de vídeo não retornou um identificador de operação.");
  return { operationName: json.name };
}

export type VeoOperationStatus =
  { done: false } | { done: true; videoUri: string } | { done: true; error: string };

export async function checkVideoOperation(operationName: string): Promise<VeoOperationStatus> {
  const response = await fetch(`${GEMINI_BASE}/${operationName}`, {
    signal: AbortSignal.timeout(15_000),
    headers: { "x-goog-api-key": getGeminiApiKey() },
  }).catch((err) => {
    throw new AiError("Não foi possível verificar o status do vídeo.", { cause: err });
  });

  if (!response.ok) {
    console.error("[ai] Veo status request failed", { status: response.status });
    throw new AiError("Não foi possível verificar o status do vídeo.");
  }

  const json = (await response.json()) as {
    done?: boolean;
    error?: { message?: string };
    response?: {
      generateVideoResponse?: { generatedSamples?: { video?: { uri?: string } }[] };
    };
  };
  if (!json.done) return { done: false };
  if (json.error) return { done: true, error: json.error.message ?? "Falha ao gerar o vídeo." };

  const uri = json.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri;
  if (!uri) return { done: true, error: "Vídeo gerado sem URI de saída." };
  return { done: true, videoUri: uri };
}

/**
 * The operation's video URI is a Google-hosted download link that itself
 * needs the API key — per Google's own docs, as a query param on this
 * specific request (not the `x-goog-api-key` header used everywhere else
 * in this file), because the header doesn't reliably survive the redirect
 * this URI issues.
 */
export async function downloadVideoBytes(uri: string): Promise<Uint8Array> {
  const key = getGeminiApiKey();
  const url = `${uri}${uri.includes("?") ? "&" : "?"}key=${encodeURIComponent(key)}`;
  const response = await fetch(url, { signal: AbortSignal.timeout(120_000) }).catch((err) => {
    throw new AiError("Não foi possível baixar o vídeo gerado.", { cause: err });
  });
  if (!response.ok) throw new AiError("Não foi possível baixar o vídeo gerado.");
  return new Uint8Array(await response.arrayBuffer());
}
