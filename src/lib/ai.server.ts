/**
 * Gemini API client (replaces the Lovable AI gateway). Raw REST, no SDK —
 * confirmed against ai.google.dev's own docs (generateContent, image output
 * via inlineData/responseModalities, Veo via predictLongRunning) rather
 * than assumed, since model names and exact field shapes drift.
 *
 * Model IDs are env-driven with conservative defaults (see .env.example).
 * Verify current model availability at
 * https://generativelanguage.googleapis.com/v1beta/models before relying on
 * a default in production — Google's naming has moved fast; treat these as
 * a starting point, not gospel.
 */
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";

const TEXT_MODEL_FAST = process.env["GEMINI_TEXT_MODEL_FAST"] || "gemini-2.5-flash";
const TEXT_MODEL_QUALITY = process.env["GEMINI_TEXT_MODEL_QUALITY"] || "gemini-2.5-pro";
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

export function getApiKey(): string {
  const key = process.env["GEMINI_API_KEY"];
  if (!key) {
    throw new AiError("Geração por IA temporariamente indisponível.", {
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
  return { "Content-Type": "application/json", "x-goog-api-key": getApiKey() };
}

async function callGemini(model: string, body: unknown, timeoutMs: number): Promise<unknown> {
  const response = await fetch(`${GEMINI_BASE}/models/${model}:generateContent`, {
    method: "POST",
    signal: AbortSignal.timeout(timeoutMs),
    headers: geminiHeaders(),
    body: JSON.stringify(body),
  }).catch((err) => {
    throw new AiError("Não foi possível conectar ao serviço de IA.", { cause: err });
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    console.error(`[ai] Gemini ${model} error [${response.status}]:`, text.slice(0, 2000));
    if (isRetryable(response.status)) throw new RetryableAiError(`gemini ${response.status}`);
    throw new AiError("O serviço de IA não conseguiu processar o pedido agora.");
  }
  return response.json();
}

/**
 * Gemini's responseSchema is a subset of OpenAPI 3.0 Schema — it doesn't
 * recognize `additionalProperties` (an OpenAI-strict-mode-specific field
 * these schemas were originally written with). Strip it recursively rather
 * than maintaining two parallel schema definitions per route.
 */
function toGeminiSchema(schema: unknown): unknown {
  if (Array.isArray(schema)) return schema.map(toGeminiSchema);
  if (schema && typeof schema === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(schema as Record<string, unknown>)) {
      if (key === "additionalProperties") continue;
      out[key] = toGeminiSchema(value);
    }
    return out;
  }
  return schema;
}

type GenerateContentResponse = {
  candidates?: {
    content?: { parts?: { text?: string; inlineData?: { data?: string; mimeType?: string } }[] };
  }[];
};

/**
 * Structured JSON generation. `tier` picks the model: "fast" (gemini-2.5-flash
 * by default) for routine drafts — plans, carousel outlines, storyboards,
 * onboarding research — and "quality" (gemini-2.5-pro) for the one
 * client-facing artifact worth the extra cost/latency, the diagnostic
 * report. Non-streaming: the original Lovable-gateway version streamed for
 * no real benefit (the caller still waited for the full JSON body before
 * doing anything with it) — this only adds SSE-parsing complexity, so it's
 * gone.
 */
export async function generateJson<T>(options: {
  instructions: string;
  input: string;
  schemaName: string;
  schema: Record<string, unknown>;
  tier?: "fast" | "quality";
  timeoutMs?: number;
}): Promise<T> {
  const model = options.tier === "quality" ? TEXT_MODEL_QUALITY : TEXT_MODEL_FAST;

  const text = await withRetry("generateJson", async () => {
    const json = (await callGemini(
      model,
      {
        systemInstruction: { parts: [{ text: options.instructions }] },
        contents: [{ role: "user", parts: [{ text: options.input }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: toGeminiSchema(options.schema),
        },
      },
      options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    )) as GenerateContentResponse;

    const parts = json.candidates?.[0]?.content?.parts ?? [];
    return parts.map((p) => p.text ?? "").join("");
  });

  if (!text.trim()) throw new AiError("A IA não retornou conteúdo. Tente novamente.");
  try {
    return JSON.parse(text) as T;
  } catch (err) {
    console.error("[ai] generateJson: model output was not valid JSON:", text.slice(0, 2000));
    throw new AiError("A IA retornou uma resposta inesperada. Tente novamente.", { cause: err });
  }
}

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

// --- Veo video generation: async (predictLongRunning) — see src/lib/content-engine/video.ts
// for how this is turned into a poll-able job instead of a blocking call. ---

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
    const text = await response.text().catch(() => "");
    console.error(`[ai] Veo start error [${response.status}]:`, text.slice(0, 2000));
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
    headers: { "x-goog-api-key": getApiKey() },
  }).catch((err) => {
    throw new AiError("Não foi possível verificar o status do vídeo.", { cause: err });
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    console.error(`[ai] Veo poll error [${response.status}]:`, text.slice(0, 2000));
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
  const key = getApiKey();
  const url = `${uri}${uri.includes("?") ? "&" : "?"}key=${encodeURIComponent(key)}`;
  const response = await fetch(url, { signal: AbortSignal.timeout(120_000) }).catch((err) => {
    throw new AiError("Não foi possível baixar o vídeo gerado.", { cause: err });
  });
  if (!response.ok) throw new AiError("Não foi possível baixar o vídeo gerado.");
  return new Uint8Array(await response.arrayBuffer());
}
