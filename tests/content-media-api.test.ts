import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as zod from "zod";
import * as zod4 from "zod/v4";
import * as preview from "../src/lib/brand-preview.ts";
import { demoSchema } from "../src/lib/quick-start.ts";

const companyId = "00000000-0000-4000-8000-000000000001";
const itemId = "00000000-0000-4000-8000-000000000002";
const privateError = "PRIVATE_UPSTREAM_DATA";
const storyboard = {
  titulo: "Uma visita ao estúdio",
  duracao_total_seg: 20,
  shots: [
    {
      ordem: 1,
      duracao_seg: 10,
      narracao: "Conheça a equipe.",
      visual_descricao: "Equipe no estúdio",
    },
    {
      ordem: 2,
      duracao_seg: 10,
      narracao: "Consulte os horários.",
      visual_descricao: "Sala de aula",
    },
  ],
};
const workspace = () =>
  demoSchema.parse({
    name: "Marca atual",
    segment: "Pilates atual",
    answers: {
      offers: "Aulas individuais atuais",
      audience: "Adultos do bairro atual",
      goals: "Receber mais agendamentos",
    },
    brand: {
      confirmed: true,
      detail: "Cada aula tem acompanhamento individual da equipe.",
      action: "website",
      destination: "https://marca.example/agenda",
      customerQuestion: "Preciso ter experiência?",
      questionAnswer: "A equipe orienta quem está começando.",
    },
  });

type Values = Record<string, unknown>;
type Options = {
  workspace?: unknown;
  format?: string;
  readError?: string;
  readErrorCode?: string;
  failWrite?: number;
  emptyWrite?: number;
  failProvider?: string;
  renderQuota?: boolean;
  /** Finished videos the company has left. Defaults to 2. */
  videoBalance?: number;
  poll?: { status: string; videoPath?: string; error?: string };
};

// Only external boundaries are replaced. The actual route, schemas and brief
// validation execute here; unknown imports and any network attempt fail closed.
function harness(routeName: "plano" | "arte" | "video-status", options: Options = {}) {
  const reads: string[] = [];
  const filters: [string, string, unknown][] = [];
  const writes: { table: string; action: string; values: unknown }[] = [];
  const calls: string[] = [];
  const logs: string[] = [];
  let prompt = "";
  const item: Values = {
    id: itemId,
    company_id: companyId,
    title: "Título salvo",
    caption: "Legenda salva com condições específicas.",
    format: options.format ?? "post",
    pillar: "oferta",
    cta: "Consulte os horários.",
    video_operation: "operations/test",
    video_path: null,
  };
  const rows: Record<string, unknown> = {
    companies: { id: companyId, name: "Marca antiga", segment: "Segmento antigo" },
    brand_kits: { tone: "acolhedor", palette: { cores: ["#112233"] }, fonts: null },
    diagnostics: { report: { resumo: "RESUMO_ANTIGO", pilares: ["PILAR_ANTIGO"] } },
    marketing_workspaces:
      options.workspace === null ? null : { data: options.workspace ?? workspace() },
    content_items: item,
  };
  const db = {
    from(table: string) {
      let action = "read";
      let values: unknown;
      const finish = async () => {
        if (action === "read") {
          reads.push(table);
          return {
            data: options.readError === table ? null : (rows[table] ?? null),
            error:
              options.readError === table
                ? { code: options.readErrorCode ?? "42501", message: privateError }
                : null,
          };
        }
        writes.push({ table, action, values: structuredClone(values) });
        if (writes.length === options.failWrite)
          return { data: null, error: { message: privateError, code: "42501" } };
        if (writes.length === options.emptyWrite) return { data: null, error: null };
        if (table === "content_items" && action === "update") Object.assign(item, values);
        return { data: { id: itemId }, error: null };
      };
      const chain = {
        select: () => chain,
        eq(column: string, value: unknown) {
          filters.push([table, column, value]);
          return chain;
        },
        order: () => chain,
        limit: () => chain,
        update(value: unknown) {
          action = "update";
          values = value;
          return chain;
        },
        upsert(value: unknown) {
          action = "upsert";
          values = value;
          return chain;
        },
        insert(value: unknown) {
          action = "insert";
          values = value;
          return chain;
        },
        delete() {
          action = "delete";
          values = null;
          return chain;
        },
        single: finish,
        maybeSingle: finish,
        then(resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) {
          return finish().then(resolve, reject);
        },
      };
      return chain;
    },
  };
  const provider = async (name: string, result: unknown) => {
    calls.push(name);
    if (options.failProvider === name) throw new Error(privateError);
    return result;
  };
  const modules: Record<string, unknown> = {
    "@tanstack/react-router": { createFileRoute: () => (config: unknown) => config },
    zod,
    "zod/v4": zod4,
    "@/lib/quick-start": { demoSchema },
    "@/lib/brand-preview": preview,
    "@/lib/supabase-request.server": { userClientFromRequest: () => db },
    "@/lib/quota.server": {
      checkAiQuota: async (_db: unknown, _id: string, kind: string) => {
        calls.push(`quota:${kind}`);
        return kind !== "video_render" || options.renderQuota !== false;
      },
      quotaExceededResponse: () => new Response("Limite atingido", { status: 429 }),
    },
    "@/lib/video-units.server": {
      ensureVideoGrant: async () => {
        calls.push("video-grant");
        return 0;
      },
      videoUnitsBalance: async () => options.videoBalance ?? 2,
      consumeVideoUnit: async (_db: unknown, _company: string, ref: string) => {
        calls.push(`video-consume:${ref}`);
        return true;
      },
    },
    "@/lib/ai.server": {
      AiError: class extends Error {},
      generateJson: async ({ input }: { input: string }) => {
        prompt = input;
        return provider("plan", {
          publicacoes: [
            {
              dia: 1,
              canal: "instagram",
              formato: "post",
              pilar: "oferta",
              titulo: "Aula",
              legenda: "Conheça a proposta",
              hashtags: "#aula",
              cta: "Consulte a equipe",
            },
          ],
        });
      },
    },
    "@/lib/content-engine": {
      generateStaticArt: () => provider("image", { imagePath: "company/image.png" }),
      generateCarousel: () =>
        provider("carousel", {
          slides: [{ path: "company/slide.png", order: 0 }],
          coverPath: "company/slide.png",
        }),
      generateVideoStoryboard: () => provider("storyboard", storyboard),
      startVideoRender: () => provider("video-start", { operationName: "operations/new" }),
      checkVideoRender: () =>
        provider("video-poll", options.poll ?? { status: "ready", videoPath: "company/video.mp4" }),
    },
  };
  const exports: Record<string, unknown> = {};
  runInNewContext(
    ts.transpileModule(
      readFileSync(new URL(`../src/routes/api/${routeName}.ts`, import.meta.url), "utf8"),
      {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
      },
    ).outputText,
    {
      exports,
      require(name: string) {
        if (!(name in modules)) throw new Error(`Unexpected import: ${name}`);
        return modules[name];
      },
      Response,
      console: { error: (...args: unknown[]) => logs.push(args.map(String).join(" ")) },
      fetch: () => {
        throw new Error("Network forbidden in media regression tests");
      },
    },
  );
  const route = exports.Route as {
    server: { handlers: { POST: (context: { request: Request }) => Promise<Response> } };
  };
  return {
    reads,
    filters,
    writes,
    calls,
    logs,
    item,
    prompt: () => prompt,
    post: () =>
      route.server.handlers.POST({
        request: new Request(`http://local.test/api/${routeName}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ companyId, contentItemId: itemId }),
        }),
      }),
  };
}

test("plan uses the current confirmed workspace and never reads the stale diagnostic", async () => {
  const h = harness("plano");
  assert.equal((await h.post()).status, 200);
  for (const value of [
    "Marca atual",
    "Pilates atual",
    "Aulas individuais atuais",
    "Adultos do bairro atual",
    "Receber mais agendamentos",
    "acompanhamento individual",
    "https://marca.example/agenda",
    "Preciso ter experiência?",
    "A equipe orienta",
  ])
    assert.ok(h.prompt().includes(value), `missing current context: ${value}`);
  assert.ok(!h.prompt().includes("RESUMO_ANTIGO"));
  assert.ok(!h.reads.includes("diagnostics"));
  assert.ok(
    h.filters.some(
      ([table, column, id]) =>
        table === "marketing_workspaces" && column === "company_id" && id === companyId,
    ),
  );
});

test("legacy diagnostic fallback remains available only for an absent workspace row", async () => {
  const h = harness("plano", { workspace: null });
  assert.equal((await h.post()).status, 200);
  assert.ok(h.prompt().includes("RESUMO_ANTIGO"));
  assert.ok(h.reads.includes("marketing_workspaces"));
});

test("workspace database errors cannot spend quota or silently select legacy context", async () => {
  for (const code of ["PGRST205", "42P01", "42501"]) {
    const h = harness("plano", { readError: "marketing_workspaces", readErrorCode: code });
    const response = await h.post();
    assert.equal(response.status, 503);
    assert.deepEqual(h.calls, []);
    assert.deepEqual(h.writes, []);
    assert.ok(!h.reads.includes("diagnostics"));
    assert.ok(!(await response.text()).includes(privateError));
  }
});

test("existing invalid or unconfirmed workspace blocks plan generation instead of falling back", async () => {
  const unconfirmed = workspace();
  unconfirmed.brand.confirmed = false;
  for (const data of [{ broken: true }, unconfirmed]) {
    const h = harness("plano", { workspace: data });
    assert.equal((await h.post()).status, 409);
    assert.deepEqual(h.calls, []);
    assert.ok(!h.reads.includes("diagnostics"));
  }
});

test("failed legacy lookup does not fabricate a context-free plan", async () => {
  const h = harness("plano", { workspace: null, readError: "diagnostics" });
  assert.equal((await h.post()).status, 503);
  assert.deepEqual(h.calls, []);
});

test("plan provider and write failures do not log upstream data", async () => {
  for (const options of [
    { failProvider: "plan" },
    { failWrite: 1 },
    { failWrite: 2 },
    { failWrite: 3 },
  ]) {
    const h = harness("plano", options);
    const response = await h.post();
    assert.ok(response.status >= 500);
    assert.ok(!(await response.text()).includes(privateError));
    assert.ok(!h.logs.join(" ").includes(privateError));
  }
});

test("image and carousel completion requires a successfully updated media row", async () => {
  for (const format of ["post", "carrossel"])
    for (const failure of [{ failWrite: 1 }, { emptyWrite: 1 }]) {
      const h = harness("arte", { format, ...failure });
      const response = await h.post();
      assert.equal(response.status, 500);
      assert.match(await response.text(), /salvar/i);
      assert.equal(h.item.image_path, undefined);
    }
});

test("successful image and carousel requests preserve response contracts", async () => {
  for (const format of ["post", "carrossel"]) {
    const h = harness("arte", { format });
    const response = await h.post();
    assert.equal(response.status, 200);
    assert.equal((await response.json()).format, format);
    assert.ok(h.item.image_path);
  }
});

test("a video start failure leaves the completed storyboard available", async () => {
  const h = harness("arte", { format: "reels", failProvider: "video-start" });
  const response = await h.post();
  assert.equal(response.status, 502);
  assert.deepEqual(h.item.storyboard, storyboard);
  assert.match(await response.text(), /roteiro.*salvo.*iniciar.*vídeo/i);
  assert.ok(!h.logs.join(" ").includes(privateError));
});

test("storyboard save failure stops before spending video-render quota or starting the provider", async () => {
  for (const failure of [{ failWrite: 1 }, { emptyWrite: 1 }]) {
    const h = harness("arte", { format: "reels", ...failure });
    assert.equal((await h.post()).status, 500);
    assert.ok(!h.calls.includes("quota:video_render"));
    assert.ok(!h.calls.includes("video-start"));
  }
});

test("render quota denial preserves the storyboard and does not start a video", async () => {
  const h = harness("arte", { format: "reels", renderQuota: false });
  assert.equal((await h.post()).status, 429);
  assert.deepEqual(h.item.storyboard, storyboard);
  assert.ok(!h.calls.includes("video-start"));
});

test("a company with no finished videos left is refused before any render quota or provider call", async () => {
  const h = harness("arte", { format: "reels", videoBalance: 0 });
  const response = await h.post();
  assert.equal(response.status, 402);
  assert.match(await response.text(), /Sem vídeos restantes/);
  assert.deepEqual(h.item.storyboard, storyboard, "the storyboard is kept");
  assert.ok(h.calls.includes("video-grant"));
  assert.ok(!h.calls.includes("quota:video_render"));
  assert.ok(!h.calls.includes("video-start"));
});

test("a finished render uses one video unit, once per render, and a failed render uses none", async () => {
  const ready = harness("video-status");
  assert.equal((await ready.post()).status, 200);
  assert.deepEqual(
    ready.calls.filter((call) => call.startsWith("video-consume")),
    ["video-consume:render:operations/test"],
  );
  const failed = harness("video-status", { poll: { status: "failed", error: privateError } });
  await failed.post();
  assert.ok(!failed.calls.some((call) => call.startsWith("video-consume")));
});

test("operation save failure is not reported as rendering success", async () => {
  for (const failure of [{ failWrite: 2 }, { emptyWrite: 2 }]) {
    const h = harness("arte", { format: "reels", ...failure });
    const response = await h.post();
    assert.equal(response.status, 500);
    assert.match(await response.text(), /salvar|registrar/i);
    assert.deepEqual(h.item.storyboard, storyboard);
  }
});

test("media generation failures name their stage without echoing errors in responses or logs", async () => {
  for (const [format, failProvider, message] of [
    ["post", "image", /arte|imagem/i],
    ["carrossel", "carousel", /carrossel/i],
    ["reels", "storyboard", /roteiro/i],
  ] as const) {
    const h = harness("arte", { format, failProvider });
    const response = await h.post();
    assert.equal(response.status, 502);
    assert.match(await response.text(), message);
    assert.ok(!h.logs.join(" ").includes(privateError));
  }
});

test("video status only reports ready or failed after its media update succeeds", async () => {
  for (const poll of [
    { status: "ready", videoPath: "company/video.mp4" },
    { status: "failed", error: privateError },
  ])
    for (const failure of [{ failWrite: 1 }, { emptyWrite: 1 }]) {
      const h = harness("video-status", { poll, ...failure });
      const response = await h.post();
      assert.equal(response.status, 500);
      assert.match(await response.text(), /salvar|registrar/i);
      assert.equal(h.item.video_operation, "operations/test");
    }
});

test("failed video results persist and return only a safe message", async () => {
  const h = harness("video-status", { poll: { status: "failed", error: privateError } });
  const response = await h.post();
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.status, "failed");
  assert.equal(result.error, h.item.video_error);
  assert.ok(!JSON.stringify([result, h.writes, h.logs]).includes(privateError));
});

test("video polling exceptions are sanitized and leave the pending operation retryable", async () => {
  const h = harness("video-status", { failProvider: "video-poll" });
  const response = await h.post();
  assert.equal(response.status, 502);
  assert.match(await response.text(), /verificar.*vídeo/i);
  assert.equal(h.item.video_operation, "operations/test");
  assert.ok(!h.logs.join(" ").includes(privateError));
});
