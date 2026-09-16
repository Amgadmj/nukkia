const GATEWAY = "https://ai.gateway.lovable.dev/v1";

export function getApiKey() {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("LOVABLE_API_KEY não configurada");
  return key;
}

/**
 * Chamada de texto estruturado no gateway de IA (Responses API, streaming obrigatório).
 * Retorna o JSON já validado contra o schema estrito informado.
 */
export async function generateJson<T>(options: {
  instructions: string;
  input: string;
  schemaName: string;
  schema: Record<string, unknown>;
}): Promise<T> {
  const response = await fetch(`${GATEWAY}/responses`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": getApiKey(),
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({
      model: "openai/gpt-6-astra",
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
  });

  if (!response.ok || !response.body) {
    throw new Error(`IA indisponível [${response.status}]: ${await response.text()}`);
  }

  let text = "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? "";
    for (const frame of frames) {
      for (const line of frame.split("\n")) {
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const event = JSON.parse(payload) as {
            type?: string;
            delta?: string;
            response?: { output_text?: string };
          };
          if (event.type === "response.output_text.delta" && event.delta) {
            text += event.delta;
          }
          if (event.type === "response.completed" && event.response?.output_text) {
            text = event.response.output_text;
          }
        } catch {
          // frame parcial — ignora
        }
      }
    }
  }

  if (!text.trim()) throw new Error("A IA não retornou conteúdo.");
  return JSON.parse(text) as T;
}

/** Gera uma imagem e devolve os bytes em base64. */
export async function generateImageBase64(prompt: string): Promise<string> {
  const response = await fetch(`${GATEWAY}/images/generations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getApiKey()}`,
    },
    body: JSON.stringify({
      model: "openai/gpt-image-2.5-sunburst",
      prompt,
      size: "1024x1024",
    }),
  });
  if (!response.ok) {
    throw new Error(`Geração de imagem falhou [${response.status}]: ${await response.text()}`);
  }
  const json = (await response.json()) as { data?: { b64_json?: string }[] };
  const b64 = json.data?.[0]?.b64_json;
  if (!b64) throw new Error("A IA não retornou imagem.");
  return b64;
}
