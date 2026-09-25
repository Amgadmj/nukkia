import { z } from "zod";
import { collectBrandSite } from "./public-site.server.ts";
import { researchSchema, type BrandResearch } from "./brand-preview.ts";
import { synthesizeBrand } from "./brand-synthesis.server.ts";

const inputSchema = z.object({
  action: z.literal("research"),
  url: z.string().max(2048),
  material: z.string().max(8000),
  stream: z.boolean().default(false),
  siteAuthorized: z.boolean().default(false),
  aiAuthorized: z.boolean().default(false),
});
const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
let active = 0;
let windowStart = Date.now();
let requests = 0;
export function localPreviewAllowed(request: Request, development: boolean) {
  const url = new URL(request.url);
  return (
    development &&
    ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) &&
    request.headers.get("origin") === url.origin
  );
}
async function readBody(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) throw new Error("missing body");
  let length = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > 40000) {
        await reader.cancel();
        throw new Error("body too large");
      }
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
  } finally {
    reader.releaseLock();
  }
}
type Dependencies = { collect: typeof collectBrandSite; synthesize: typeof synthesizeBrand };
export async function handleBrandPreview(
  request: Request,
  development: boolean,
  dependencies: Dependencies = { collect: collectBrandSite, synthesize: synthesizeBrand },
) {
  // This demo is intentionally local-only until tenant authorization, retention
  // and durable worker deployment have been validated for production.
  if (!localPreviewAllowed(request, development))
    return json({ message: "Leitura disponível apenas no ambiente local." }, 403);
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    return json({ message: "Envie JSON." }, 415);
  if (Date.now() - windowStart > 60000) {
    requests = 0;
    windowStart = Date.now();
  }
  if (active >= 2 || requests >= 12)
    return json({ message: "Há uma leitura em andamento. Aguarde um instante." }, 429);
  let raw: unknown;
  try {
    raw = await readBody(request);
  } catch {
    return json({ message: "Pedido inválido ou muito grande." }, 400);
  }
  const parsed = inputSchema.safeParse(raw);
  if (!parsed.success) return json({ message: "Confira os dados enviados." }, 400);
  if (parsed.data.stream && parsed.data.url.trim() && !parsed.data.siteAuthorized)
    return json(
      { message: "Confirme que este é o site da marca e que você pode solicitar sua análise." },
      400,
    );
  active++;
  requests++;
  if (parsed.data.stream) {
    const cancel = new AbortController();
    const signal = AbortSignal.any([request.signal, cancel.signal, AbortSignal.timeout(65000)]);
    const started = Date.now();
    const startedAt = new Date(started).toISOString();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        let research = researchSchema.parse({ status: "loading", phase: "collecting", startedAt });
        const emit = (value: BrandResearch) => {
          if (signal.aborted) return;
          research = researchSchema.parse({ ...value, startedAt, elapsedMs: Date.now() - started });
          controller.enqueue(new TextEncoder().encode(JSON.stringify({ research }) + "\n"));
        };
        const run = async () => {
          emit(research);
          const { url, material, aiAuthorized } = parsed.data;
          try {
            if (url.trim())
              research = researchSchema.parse(
                await dependencies.collect(url.trim(), {
                  maxPages: 8,
                  budgetMs: 9000,
                  signal,
                  onProgress: (partial) =>
                    emit({ ...partial, status: "loading", phase: "collecting" }),
                }),
              );
            if (material.trim())
              research.sources = [
                ...research.sources.slice(0, 15),
                {
                  url: "material:fornecido",
                  title: "Material fornecido por você",
                  text: material.trim(),
                  fetchedAt: new Date().toISOString(),
                },
              ];
            research = {
              ...research,
              status: research.sources.length ? "ready" : "unavailable",
              phase: "synthesizing",
              synthesis: aiAuthorized ? "pending" : "local",
            };
            emit(research);
            if (aiAuthorized && url.trim() && research.sources.length) {
              signal.throwIfAborted();
              try {
                const suggestions = await dependencies.synthesize(research, signal);
                research = { ...research, suggestions, synthesis: "ready" };
              } catch {
                research = {
                  ...research,
                  synthesis: "unavailable",
                  message:
                    "A síntese por IA não está disponível agora. As referências foram preservadas; você pode preencher ou revisar manualmente.",
                };
              }
            }
            emit({ ...research, phase: "deepening" });
            // Keep the request open while onboarding advances. This is a bounded
            // continuation, not a durable job that survives closing the browser.
            if (url.trim() && research.sources.length && !signal.aborted) {
              const previous = research;
              try {
                const deeper = await dependencies.collect(url.trim(), {
                  maxPages: 16,
                  budgetMs: 18000,
                  signal,
                  previous,
                  onProgress: (partial) =>
                    emit({
                      ...partial,
                      suggestions: previous.suggestions,
                      synthesis: previous.synthesis,
                      phase: "deepening",
                    }),
                });
                research = {
                  ...deeper,
                  suggestions: previous.suggestions,
                  synthesis: previous.synthesis,
                  message: previous.message,
                };
                if (
                  deeper.sources.length > previous.sources.length &&
                  previous.synthesis === "ready"
                ) {
                  emit({ ...research, phase: "deepening" });
                  try {
                    signal.throwIfAborted();
                    research = {
                      ...research,
                      suggestions: await dependencies.synthesize(research, signal),
                    };
                  } catch {
                    /* Keep the initial useful synthesis. */
                  }
                }
              } catch {
                research = previous;
              }
            }
            emit({ ...research, phase: "complete" });
          } catch {
            emit({
              ...research,
              status: research.sources.length ? "ready" : "unavailable",
              phase: "complete",
              message:
                "Não foi possível concluir a leitura. Continue manualmente ou tente novamente.",
            });
          } finally {
            active--;
            try {
              controller.close();
            } catch {
              /* Consumer cancelled. */
            }
          }
        };
        void run();
      },
      cancel() {
        cancel.abort();
      },
    });
    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Accel-Buffering": "no",
      },
    });
  }
  try {
    const { url, material } = parsed.data;
    let research: BrandResearch = researchSchema.parse({});
    if (url.trim()) {
      try {
        research = await dependencies.collect(url.trim());
      } catch {
        research.message =
          "Não conseguimos ler esse site. Você pode colar uma apresentação da marca ou preencher os campos.";
      }
    }
    if (material.trim())
      research.sources = [
        ...research.sources.slice(0, 2),
        {
          url: "material:fornecido",
          title: "Material fornecido por você",
          text: material.trim(),
          fetchedAt: new Date().toISOString(),
        },
      ];
    return json({
      research: researchSchema.parse({
        ...research,
        status: research.sources.length ? "ready" : "unavailable",
      }),
    });
  } finally {
    active--;
  }
}
