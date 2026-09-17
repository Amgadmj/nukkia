const GATEWAY = "https://ai.gateway.lovable.dev/v1";

const TEXT_MODEL = "openai/gpt-6-astra";
const IMAGE_MODEL = "openai/gpt-image-2.5-sunburst";

const DEFAULT_TIMEOUT_MS = 45_000;
const MAX_RETRIES = 1;

/**
 * Thrown by every function in this module. `userMessage` is safe to show a
 * customer (short, generic, Portuguese). The full upstream error — which
 * can contain gateway internals, quota state, or request IDs — is logged
 * server-side via `cause`/`console.error` and MUST NOT be relayed to the
 * client (S-4 in the security review).
 */
export class AiError extends Error {
  readonly userMessage: string;
  constructor(userMessage: string, options?: { cause?: unknown }) {
    super(userMessage, options);
    this.userMessage = userMessage;
    this.name = "AiError";
  }
}

export function getApiKey() {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key)
    throw new AiError("Geração por IA temporariamente indisponível.", {
      cause: new Error("LOVABLE_API_KEY não configurada"),
    });
  return key;
}

function isRetryable(status: number) {
  return status === 429 || status >= 500;
}

async function withRetry<T>(label: string, fn: (attempt: number) => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn(attempt);
    } catch (err) {
      lastError = err;
      const retryable =
        err instanceof RetryableAiError ||
        (err instanceof AiError && err.cause instanceof RetryableAiError);
      if (!retryable || attempt === MAX_RETRIES) break;
      await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
      console.warn(`[ai] retrying ${label} after transient failure (attempt ${attempt + 2})`);
    }
  }
  throw lastError;
}

class RetryableAiError extends Error {}

/**
 * Structured text generation against the Lovable AI gateway's Responses API
 * (streaming, strict JSON schema). Hardened version of the original:
 *  - full SSE parsing: normalizes CRLF, flushes the final partial frame,
 *    handles multi-line `data:` fields.
 *  - handles response.failed / response.incomplete / error events instead
 *    of silently falling through to "no content returned".
 *  - request timeout via AbortSignal, one retry on 429/5xx.
 *  - never leaks the upstream error body to the caller.
 */
export async function generateJson<T>(options: {
  instructions: string;
  input: string;
  schemaName: string;
  schema: Record<string, unknown>;
  timeoutMs?: number;
}): Promise<T> {
  const text = await withRetry("generateJson", async () => {
    const response = await fetch(`${GATEWAY}/responses`, {
      method: "POST",
      signal: AbortSignal.timeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS),
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": getApiKey(),
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({
        model: TEXT_MODEL,
        instructions: options.instructions,
        input: options.input,
        stream: true,
        store: false,
        reasoning: { effort: "low" },
        text: {
          format: {
            type: "json_schema",
            name: options.schemaName,
            strict: true,
            schema: options.schema,
          },
        },
      }),
    }).catch((err) => {
      throw new AiError("Não foi possível conectar ao serviço de IA.", { cause: err });
    });

    if (!response.ok || !response.body) {
      const body = await response.text().catch(() => "");
      console.error(`[ai] generateJson gateway error [${response.status}]:`, body.slice(0, 2000));
      if (isRetryable(response.status)) throw new RetryableAiError(`gateway ${response.status}`);
      throw new AiError("O serviço de IA não conseguiu processar o pedido agora.");
    }

    return parseResponsesStream(response.body);
  });

  if (!text.trim()) throw new AiError("A IA não retornou conteúdo. Tente novamente.");

  try {
    return JSON.parse(text) as T;
  } catch (err) {
    console.error("[ai] generateJson: model output was not valid JSON:", text.slice(0, 2000));
    throw new AiError("A IA retornou uma resposta inesperada. Tente novamente.", { cause: err });
  }
}

async function parseResponsesStream(body: ReadableStream<Uint8Array>): Promise<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
  let sawCompletion = false;

  const handleFrame = (frame: string) => {
    // A frame is one or more `field: value` lines; data fields can repeat
    // per the SSE spec and should be joined with "\n".
    const dataLines: string[] = [];
    for (const line of frame.split("\n")) {
      if (line.startsWith("data:")) dataLines.push(line.slice(5).trimStart());
    }
    const payload = dataLines.join("\n").trim();
    if (!payload || payload === "[DONE]") return;

    let event: {
      type?: string;
      delta?: string;
      response?: { output_text?: string };
      error?: { message?: string } | string;
      message?: string;
    };
    try {
      event = JSON.parse(payload);
    } catch {
      return; // partial/malformed frame — ignore rather than crash the stream
    }

    switch (event.type) {
      case "response.output_text.delta":
        if (event.delta) text += event.delta;
        break;
      case "response.completed":
        if (event.response?.output_text) text = event.response.output_text;
        sawCompletion = true;
        break;
      case "response.failed":
      case "response.incomplete":
      case "error": {
        const message =
          (typeof event.error === "object" ? event.error?.message : event.error) ??
          event.message ??
          event.type;
        console.error(`[ai] stream reported ${event.type}:`, message);
        throw new AiError("A geração foi interrompida pelo serviço de IA. Tente novamente.");
      }
    }
  };

  const drain = (flushing: boolean) => {
    const frames = buffer.split(/\r?\n\r?\n/);
    buffer = flushing ? "" : (frames.pop() ?? "");
    if (flushing && frames.length && frames[frames.length - 1] === "") frames.pop();
    for (const frame of frames) handleFrame(frame);
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    drain(false);
  }
  buffer += decoder.decode(); // flush any pending multi-byte sequence
  drain(true);

  void sawCompletion; // deltas already accumulate the text; kept for clarity/debugging
  return text;
}

/** Gera uma imagem e devolve os bytes em base64. */
export async function generateImageBase64(
  prompt: string,
  options?: { timeoutMs?: number },
): Promise<string> {
  return withRetry("generateImageBase64", async () => {
    const response = await fetch(`${GATEWAY}/images/generations`, {
      method: "POST",
      signal: AbortSignal.timeout(options?.timeoutMs ?? DEFAULT_TIMEOUT_MS),
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getApiKey()}`,
      },
      body: JSON.stringify({
        model: IMAGE_MODEL,
        prompt,
        size: "1024x1024",
      }),
    }).catch((err) => {
      throw new AiError("Não foi possível conectar ao serviço de imagens.", { cause: err });
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      console.error(
        `[ai] generateImageBase64 gateway error [${response.status}]:`,
        body.slice(0, 2000),
      );
      if (isRetryable(response.status)) throw new RetryableAiError(`gateway ${response.status}`);
      throw new AiError("Não foi possível gerar a imagem agora.");
    }

    const json = (await response.json().catch(() => null)) as {
      data?: { b64_json?: string }[];
    } | null;
    const b64 = json?.data?.[0]?.b64_json;
    if (!b64) throw new AiError("A IA não retornou imagem. Tente novamente.");
    return b64;
  });
}
