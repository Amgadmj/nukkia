import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as zod4 from "zod/v4";
const require = createRequire(import.meta.url);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Api = Record<string, any>;

function load(path: string, context: Record<string, unknown>): Api {
  const exports: Api = {};
  runInNewContext(
    ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
    }).outputText,
    { exports, ...context },
  );
  return exports;
}

function aiServer() {
  const bodies: Record<string, unknown>[] = [];
  const api = load("../src/lib/ai.server.ts", {
    require,
    AbortSignal,
    Response,
    setTimeout,
    process: { env: { GEMINI_API_KEY: "test-key" } },
    console: { error: () => {}, warn: () => {} },
    fetch: async (_url: string, init: { body: string }) => {
      bodies.push(JSON.parse(init.body));
      return new Response(JSON.stringify({ name: "operations/1" }), { status: 200 });
    },
  });
  return { api, bodies };
}

test("Veo lengths snap up to 4, 6 or 8 seconds and never exceed 8", () => {
  const { api } = aiServer();
  const pick = (seconds: number) => api["veoDurationSeconds"](seconds);
  assert.deepEqual([1, 4, 5, 6, 7, 8, 15, 45, Number.NaN].map(pick), [4, 4, 6, 6, 8, 8, 8, 8, 8]);
});

test("the Veo request carries the clip length next to the aspect ratio", async () => {
  const { api, bodies } = aiServer();
  await api["startVideoGeneration"]("a prompt", { aspectRatio: "9:16", durationSeconds: 6 });
  await api["startVideoGeneration"]("a prompt");
  assert.deepEqual(bodies[0]?.["parameters"], { aspectRatio: "9:16", durationSeconds: 6 });
  assert.deepEqual(bodies[1]?.["parameters"], { aspectRatio: "9:16", durationSeconds: 8 });
});

function contentEngine() {
  const starts: { prompt: string; options: Record<string, unknown> }[] = [];
  const instructions: string[] = [];
  const warnings: unknown[][] = [];
  const api = load("../src/lib/content-engine/index.ts", {
    console: { warn: (...args: unknown[]) => warnings.push(args), error: () => {} },
    require(name: string) {
      const modules: Record<string, unknown> = {
        "zod/v4": zod4,
        "./style-anchor": { buildStyleAnchor: () => "Paleta da marca." },
        "@/lib/higgsfield.server": { videoProvider: () => "veo" },
        "@/lib/ai.server": {
          AiError: class extends Error {},
          veoDurationSeconds: aiServer().api["veoDurationSeconds"],
          startVideoGeneration: async (prompt: string, options: Record<string, unknown>) => {
            starts.push({ prompt, options });
            return { operationName: "operations/1" };
          },
          generateJson: async (params: { instructions: string }) => {
            instructions.push(params.instructions);
            return {};
          },
        },
      };
      if (!(name in modules)) throw new Error(`Unexpected import: ${name}`);
      return modules[name];
    },
    fetch: () => {
      throw new Error("Network forbidden in content-engine tests");
    },
  });
  return { api, starts, instructions, warnings };
}

const shot = (ordem: number, duracao_seg: number) => ({
  ordem,
  duracao_seg,
  narracao: "fala",
  visual_descricao: `cena ${ordem}`,
});

const render = (api: Api, shots: ReturnType<typeof shot>[]) =>
  api["startVideoRender"]({
    company: { name: "Clínica", segment: "Saúde" },
    brandKit: null,
    storyboard: { titulo: "t", duracao_total_seg: 99, shots },
  });

test("a Veo render asks for the storyboard's length and states that length in the prompt", async () => {
  const h = contentEngine();
  await render(h.api, [shot(1, 3), shot(2, 3)]);
  assert.equal(h.starts[0]?.options["durationSeconds"], 6);
  assert.match(h.starts[0]?.prompt ?? "", /6 segundos/);
  assert.doesNotMatch(h.starts[0]?.prompt ?? "", /99 segundos/);
  assert.equal(h.warnings.length, 0);
});

test("a storyboard longer than Veo can render is sent as 8 seconds with a warning", async () => {
  const h = contentEngine();
  await render(h.api, [shot(1, 5), shot(2, 5), shot(3, 5)]);
  assert.equal(h.starts[0]?.options["durationSeconds"], 8);
  assert.match(h.starts[0]?.prompt ?? "", /8 segundos/);
  assert.match(JSON.stringify(h.warnings), /"scripted":15/);
});

test("the storyboard prompt targets one render of at most 15 seconds", async () => {
  const h = contentEngine();
  await h.api["generateVideoStoryboard"]({
    company: { name: "Clínica" },
    brandKit: null,
    item: { title: "Tema" },
  });
  assert.match(h.instructions[0] ?? "", /no máximo 15 segundos/);
  assert.doesNotMatch(h.instructions[0] ?? "", /45 segundos/);
});
