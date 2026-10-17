import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";

class AiError extends Error {
  readonly userMessage: string;
  constructor(userMessage: string, options?: { cause?: unknown }) {
    super(userMessage, options);
    this.userMessage = userMessage;
  }
}

type Call = {
  url: string;
  init: { method?: string; headers?: Record<string, string>; body?: string };
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Api = Record<string, any>;

function harness(
  responses: Response[],
  env: Record<string, string> = { HF_API_KEY_ID: "key-id", HF_API_KEY_SECRET: "key-secret" },
) {
  const calls: Call[] = [];
  const errors: unknown[][] = [];
  const exports: Api = {};
  runInNewContext(
    ts.transpileModule(
      readFileSync(new URL("../src/lib/higgsfield.server.ts", import.meta.url), "utf8"),
      { compilerOptions: { module: ts.ModuleKind.CommonJS } },
    ).outputText,
    {
      exports,
      URL,
      AbortSignal,
      Uint8Array,
      process: { env },
      console: { error: (...args: unknown[]) => errors.push(args), warn: () => {}, info: () => {} },
      setTimeout: (fn: () => void) => {
        fn();
        return 0;
      },
      require(name: string) {
        if (name === "@/lib/ai.server") return { AiError };
        throw new Error(`Unexpected import: ${name}`);
      },
      fetch: async (url: string, init: Call["init"]) => {
        calls.push({ url, init });
        const next = responses.shift();
        if (!next) throw new Error("No response queued");
        return next;
      },
    },
  );
  return { api: exports, calls, errors };
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const shot = (ordem: number, duracao_seg: number, visual_descricao = `cena ${ordem}`) => ({
  ordem,
  duracao_seg,
  narracao: "texto falado que nunca deve ir para o prompt",
  visual_descricao,
});

test("a 30-second storyboard is scaled onto one 15-second timed clip", () => {
  const { api } = harness([]);
  const plan = api["planVideoRender"](
    { titulo: "t", duracao_total_seg: 30, shots: [shot(1, 10), shot(2, 10), shot(3, 10)] },
    { profile: "standard" },
  );
  assert.equal(plan.duration, 15);
  assert.equal(plan.resolution, "720p");
  assert.equal(plan.estimatedCredits, 67.5);
  assert.equal(
    JSON.stringify(plan.segments.map((s: { start: number; end: number }) => [s.start, s.end])),
    "[[0,5],[5,10],[10,15]]",
  );
});

test("segments stay strictly increasing even with many one-second blocks", () => {
  const { api } = harness([]);
  const plan = api["planVideoRender"](
    {
      titulo: "t",
      duracao_total_seg: 6,
      shots: [1, 2, 3, 4, 5, 6].map((n) => shot(n, 1)),
    },
    { profile: "draft" },
  );
  assert.equal(plan.duration, 6);
  let previous = 0;
  for (const segment of plan.segments) {
    assert.equal(segment.start, previous);
    assert.ok(segment.end > segment.start);
    previous = segment.end;
  }
  assert.equal(previous, 6);
});

test("a plan above the credit ceiling is refused before any request is made", () => {
  const { api, calls } = harness([]);
  const storyboard = { titulo: "t", duracao_total_seg: 30, shots: [shot(1, 15), shot(2, 15)] };
  assert.throws(
    () => api["planVideoRender"](storyboard, { profile: "premium" }),
    /limite de custo/,
  );
  assert.doesNotThrow(() => api["planVideoRender"](storyboard, { profile: "draft" }));
  assert.equal(calls.length, 0);
});

test("a 1080p 15-second plan is refused for storage even when the credit ceiling allows it", () => {
  const { api, calls, errors } = harness([]);
  const storyboard = { titulo: "t", duracao_total_seg: 15, shots: [shot(1, 8), shot(2, 7)] };
  // Measured Seedance 1080p output runs up to 30 Mbps: 15 s is ~56 MB, above the 50 MiB bucket.
  assert.ok(api["estimateVideoBytes"]("1080p", 15) > api["MAX_VIDEO_BYTES"]);
  assert.throws(
    () => api["planVideoRender"](storyboard, { profile: "premium", maxCredits: 1000 }),
    /limite de armazenamento/,
  );
  assert.equal(calls.length, 0, "refused before any paid request");
  assert.match(JSON.stringify(errors), /content-media bucket limit/);
  assert.match(JSON.stringify(errors), /"duration":15/);
});

test("1080p stays available for clips short enough to fit the bucket", () => {
  const { api } = harness([]);
  const plan = api["planVideoRender"](
    { titulo: "t", duracao_total_seg: 13, shots: [shot(1, 7), shot(2, 6)] },
    { profile: "premium", maxCredits: 1000 },
  );
  assert.equal(plan.resolution, "1080p");
  assert.equal(plan.duration, 13);
  assert.ok(api["estimateVideoBytes"]("1080p", 13) <= api["MAX_VIDEO_BYTES"]);
});

test("the default 720p 15-second render fits the bucket", () => {
  const { api } = harness([]);
  assert.ok(api["estimateVideoBytes"]("720p", 15) <= api["MAX_VIDEO_BYTES"]);
  assert.doesNotThrow(() =>
    api["planVideoRender"](
      { titulo: "t", duracao_total_seg: 15, shots: [shot(1, 8), shot(2, 7)] },
      { profile: "standard" },
    ),
  );
});

test("the prompt carries timed hard cuts and never the narration", () => {
  const { api } = harness([]);
  const plan = api["planVideoRender"](
    {
      titulo: "t",
      duracao_total_seg: 30,
      shots: [shot(1, 15, "mãos organizando a agenda"), shot(2, 15)],
    },
    { profile: "standard" },
  );
  const prompt: string = api["buildSeedancePrompt"]("Paleta da marca: #112233.", plan);
  assert.match(prompt, /\[00:00-00:08\] SHOT 1: mãos organizando a agenda/);
  assert.match(prompt, /\[00:08-00:15\] SHOT 2:/);
  assert.match(prompt, /HARD CUT at each timestamp/);
  assert.match(prompt, /the camera does not cut on its own/);
  assert.match(prompt, /Paleta da marca: #112233\./);
  assert.doesNotMatch(prompt, /nunca deve ir para o prompt/);
});

test("submit sends exactly the documented fields, auth and an idempotency key", async () => {
  const { api, calls } = harness([json({ request_id: "req_abcdef12", status: "queued" })]);
  const plan = api["planVideoRender"](
    { titulo: "t", duracao_total_seg: 15, shots: [shot(1, 7), shot(2, 8)] },
    { profile: "standard" },
  );
  const result = await api["startHiggsfieldVideo"]({
    prompt: "p",
    plan,
    aspectRatio: "9:16",
    idempotencyKey: "11111111-2222-3333-4444-555555555555",
  });
  assert.equal(result.operationName, "higgsfield:req_abcdef12");
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.url, "https://api.higgsfield.ai/bytedance/seedance-2.0/text-to-video");
  assert.equal(calls[0]?.init.method, "POST");
  assert.equal(calls[0]?.init.headers?.["Authorization"], "Key key-id:key-secret");
  assert.equal(calls[0]?.init.headers?.["Idempotency-Key"], "11111111-2222-3333-4444-555555555555");
  assert.deepEqual(JSON.parse(calls[0]?.init.body ?? "{}"), {
    prompt: "p",
    duration: 15,
    resolution: "720p",
    aspect_ratio: "9:16",
    generate_audio: true,
  });
});

test("a transient 503 is retried with the same idempotency key", async () => {
  const { api, calls } = harness([
    new Response("busy", { status: 503 }),
    json({ request_id: "req_retry001" }),
  ]);
  const plan = api["planVideoRender"](
    { titulo: "t", duracao_total_seg: 10, shots: [shot(1, 5), shot(2, 5)] },
    { profile: "draft" },
  );
  const result = await api["startHiggsfieldVideo"]({
    prompt: "p",
    plan,
    aspectRatio: "9:16",
    idempotencyKey: "key-1",
  });
  assert.equal(result.operationName, "higgsfield:req_retry001");
  assert.equal(calls.length, 2);
  assert.equal(calls[0]?.init.headers?.["Idempotency-Key"], "key-1");
  assert.equal(calls[1]?.init.headers?.["Idempotency-Key"], "key-1");
});

test("exhausted credits surface a clear message and are not retried", async () => {
  const { api, calls } = harness([new Response("no credits", { status: 402 })]);
  const plan = api["planVideoRender"](
    { titulo: "t", duracao_total_seg: 10, shots: [shot(1, 5), shot(2, 5)] },
    { profile: "draft" },
  );
  await assert.rejects(
    api["startHiggsfieldVideo"]({ prompt: "p", plan, aspectRatio: "9:16", idempotencyKey: "k" }),
    (err: AiError) => /créditos de geração de vídeo acabaram/.test(err.userMessage),
  );
  assert.equal(calls.length, 1);
});

test("missing credentials fail closed without calling the network", async () => {
  const { api, calls } = harness([], {});
  const plan = api["planVideoRender"](
    { titulo: "t", duracao_total_seg: 10, shots: [shot(1, 5), shot(2, 5)] },
    { profile: "draft" },
  );
  await assert.rejects(
    api["startHiggsfieldVideo"]({ prompt: "p", plan, aspectRatio: "9:16", idempotencyKey: "k" }),
    /indisponível/,
  );
  assert.equal(calls.length, 0);
});

test("status maps provider states onto the existing render states", async () => {
  const cases: [unknown, unknown][] = [
    [{ status: "queued" }, { status: "rendering" }],
    [{ status: "in_progress" }, { status: "rendering" }],
    [
      { status: "completed", video: { url: "https://cdn.example/out.mp4" } },
      { status: "ready", videoUrl: "https://cdn.example/out.mp4" },
    ],
    [{ status: "completed" }, { status: "failed", error: "Vídeo gerado sem URL de saída." }],
    [{ status: "failed" }, { status: "failed", error: "Falha ao gerar o vídeo." }],
    [
      { status: "nsfw" },
      { status: "failed", error: "O conteúdo foi recusado pela moderação do provedor." },
    ],
    [{ status: "mystery" }, { status: "rendering" }],
  ];
  for (const [body, expected] of cases) {
    const { api, calls } = harness([json(body)]);
    const result = await api["checkHiggsfieldVideo"]("higgsfield:req_abcdef12");
    assert.deepEqual({ ...result }, expected);
    assert.equal(calls[0]?.url, "https://api.higgsfield.ai/requests/req_abcdef12/status");
  }
});

test("operation ids that are not plain request ids are rejected", () => {
  const { api } = harness([]);
  assert.equal(api["requestIdFromOperation"]("higgsfield:req_abcdef12"), "req_abcdef12");
  assert.throws(() => api["requestIdFromOperation"]("operations/abc"), /inválido/);
  assert.throws(() => api["requestIdFromOperation"]("higgsfield:../admin"), /inválido/);
});

test("downloads accept only https and enforce the bucket size limit", async () => {
  const ok = harness([new Response(new Uint8Array([1, 2, 3]), { status: 200 })]);
  const bytes = await ok.api["downloadHiggsfieldVideo"]("https://cdn.example/out.mp4");
  assert.equal(bytes.byteLength, 3);
  assert.equal(ok.calls[0]?.init.headers, undefined, "the CDN download carries no credentials");

  const insecure = harness([]);
  await assert.rejects(
    insecure.api["downloadHiggsfieldVideo"]("http://cdn.example/out.mp4"),
    /baixar o vídeo/,
  );

  const big = harness([
    new Response("x", { status: 200, headers: { "content-length": String(60 * 1024 * 1024) } }),
  ]);
  await assert.rejects(
    big.api["downloadHiggsfieldVideo"]("https://cdn.example/out.mp4"),
    /limite de armazenamento/,
  );
});

test("the provider is opt-in and defaults to the existing Veo path", () => {
  assert.equal(harness([], {}).api["videoProvider"](), "veo");
  assert.equal(harness([], { VIDEO_PROVIDER: "higgsfield" }).api["videoProvider"](), "higgsfield");
  assert.equal(
    harness([], { HIGGSFIELD_VIDEO_PROFILE: "bogus" }).api["configuredProfile"](),
    "standard",
  );
});
