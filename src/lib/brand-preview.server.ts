import { z } from "zod";
import { collectBrandSite } from "./public-site.server.ts";
import { researchSchema, type BrandResearch } from "./brand-preview.ts";
import { synthesizeBrand } from "./brand-synthesis.server.ts";
import { normalizeWebsite } from "./onboarding.ts";
import { suggestionSchema } from "./brand-preview.ts";
import { prepareSynthesisExcerpts, prepareEvidence } from "./brand-research.ts";
import { userClientFromRequest } from "./supabase-request.server.ts";

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

// Rate limits. In-memory state is per server instance: on Vercel each warm
// function instance keeps its own counters and a cold start resets them, so
// these are a best-effort brake against bursts from one account, not a hard
// quota. A durable limiter (e.g. a Supabase table) is required for a real quota.
export const PREVIEW_LIMITS = {
  /** Concurrent readings across all users on this instance. */
  globalActive: 6,
  /** Concurrent readings per user (a new reading aborts the previous one client-side). */
  userActive: 2,
  /** Readings started per user per window. */
  userRequests: 10,
  windowMs: 60_000,
};
type UserBucket = { windowStart: number; requests: number; active: number };
const buckets = new Map<string, UserBucket>();
let globalActive = 0;
function sweepBuckets(now: number) {
  if (buckets.size < 1000) return;
  for (const [key, bucket] of buckets)
    if (!bucket.active && now - bucket.windowStart > PREVIEW_LIMITS.windowMs) buckets.delete(key);
}
/** Reserves a slot for `key`, or returns null when a limit is reached. */
function acquireSlot(key: string): (() => void) | null {
  const now = Date.now();
  sweepBuckets(now);
  let bucket = buckets.get(key);
  if (!bucket) buckets.set(key, (bucket = { windowStart: now, requests: 0, active: 0 }));
  if (now - bucket.windowStart > PREVIEW_LIMITS.windowMs) {
    bucket.windowStart = now;
    bucket.requests = 0;
  }
  if (
    globalActive >= PREVIEW_LIMITS.globalActive ||
    bucket.active >= PREVIEW_LIMITS.userActive ||
    bucket.requests >= PREVIEW_LIMITS.userRequests
  )
    return null;
  globalActive++;
  bucket.active++;
  bucket.requests++;
  const held = bucket;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    globalActive--;
    held.active--;
  };
}
/** Test helper: clears every in-memory counter. */
export function resetBrandPreviewLimits() {
  buckets.clear();
  globalActive = 0;
}

export function localPreviewAllowed(request: Request, development: boolean) {
  const url = new URL(request.url);
  return (
    development &&
    ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) &&
    request.headers.get("origin") === url.origin
  );
}
// CSRF defense in depth for the authenticated path: the browser's Origin must
// name this host. TLS usually terminates at the platform proxy, so an https
// Origin is accepted for a request the runtime sees as http on the same host.
export function sameOriginRequest(request: Request) {
  const header = request.headers.get("origin");
  if (!header) return false;
  try {
    const origin = new URL(header);
    const url = new URL(request.url);
    return (
      origin.host === url.host && (origin.protocol === url.protocol || origin.protocol === "https:")
    );
  } catch {
    return false;
  }
}
/** Returns the Supabase user id for the request's bearer token, or null. */
export async function verifySupabaseUser(request: Request): Promise<string | null> {
  const client = userClientFromRequest(request);
  if (!client) return null;
  try {
    const { data, error } = await client.auth.getUser();
    return error || !data.user ? null : data.user.id;
  } catch {
    return null;
  }
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
type Dependencies = {
  collect: typeof collectBrandSite;
  synthesize: typeof synthesizeBrand;
  /** Resolves the signed-in user id for the request; defaults to Supabase. */
  verifyUser?: (request: Request) => Promise<string | null>;
};
const STREAM_BUDGET_MS = 65_000;
export async function handleBrandPreview(
  request: Request,
  development: boolean,
  dependencies: Dependencies = { collect: collectBrandSite, synthesize: synthesizeBrand },
) {
  // Local development on localhost keeps working without a session. Everywhere
  // else the reading costs crawler and model time, so it needs a signed-in user
  // and a same-origin browser request.
  let userKey = "local";
  if (!localPreviewAllowed(request, development)) {
    if (!sameOriginRequest(request))
      return json({ message: "Origem da solicitação não permitida." }, 403);
    const userId = await (dependencies.verifyUser ?? verifySupabaseUser)(request);
    if (!userId)
      return json(
        {
          code: "auth-required",
          message:
            "Entre na sua conta para ler o site automaticamente. Você pode continuar preenchendo manualmente.",
        },
        401,
      );
    userKey = `user:${userId}`;
  }
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    return json({ message: "Envie JSON." }, 415);
  let raw: unknown;
  try {
    raw = await readBody(request);
  } catch {
    return json({ message: "Pedido inválido ou muito grande." }, 400);
  }
  const parsed = inputSchema.safeParse(raw);
  if (!parsed.success) return json({ message: "Confira os dados enviados." }, 400);
  if (parsed.data.url.trim() && !parsed.data.siteAuthorized)
    return json(
      { message: "Confirme que este é o site da marca e que você pode solicitar sua análise." },
      400,
    );
  try {
    if (parsed.data.url.trim()) parsed.data.url = normalizeWebsite(parsed.data.url);
  } catch {
    return json({ message: "Informe um site público como suamarca.com.br." }, 400);
  }
  const release = acquireSlot(userKey);
  if (!release)
    return json(
      { code: "rate-limited", message: "Há uma leitura em andamento. Aguarde um instante." },
      429,
    );
  if (parsed.data.stream) {
    const cancel = new AbortController();
    const signal = AbortSignal.any([
      request.signal,
      cancel.signal,
      AbortSignal.timeout(STREAM_BUDGET_MS),
    ]);
    const started = Date.now();
    const deadline = started + STREAM_BUDGET_MS;
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
            // Synthesis runs whenever consent was given and there is evidence the
            // provider may receive — no longer only when a URL was typed. Pasted
            // material itself stays local by design (prepareEvidence drops it; the
            // AI consent copy only covers public site excerpts), so material-only
            // input keeps the local path instead of reporting a failed AI call.
            const aiEligible = aiAuthorized && prepareEvidence(research.sources).length > 0;
            research = {
              ...research,
              status: research.sources.length ? "ready" : "unavailable",
              phase: "synthesizing",
              synthesis: aiEligible ? "pending" : "local",
            };
            // Source-linked excerpts are useful even with no paid AI provider.
            const excerpts = prepareSynthesisExcerpts(research.sources).slice(0, 6);
            const extracted = excerpts.map((excerpt, index) => {
              const source = research.sources[Number(excerpt.sourceId.slice(1))]!;
              return suggestionSchema.parse({
                field: index < 3 ? "offers" : "detail",
                value: excerpt.text,
                quote: excerpt.text,
                sourceUrl: source.url,
                origin: "extracted",
                confidence: "medium",
              });
            });
            research.suggestions = [...research.suggestions, ...extracted].slice(0, 18);
            emit(research);
            if (aiEligible) {
              signal.throwIfAborted();
              try {
                const suggestions = await dependencies.synthesize(research, signal, { deadline });
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
                      suggestions: await dependencies.synthesize(research, signal, { deadline }),
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
            release();
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
    release();
  }
}
