import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as preview from "../src/lib/brand-preview.ts";
import * as research from "../src/lib/brand-research.ts";
import { demoSchema, type DemoData } from "../src/lib/quick-start.ts";
import { parseStoredWorkspace } from "../src/lib/marketing-workspace.ts";
const source = {
  url: "https://marca.com",
  title: "Marca",
  text: "Serviços da marca.",
  fetchedAt: "2026-09-24T12:00:00Z",
};
const seed = () =>
  demoSchema.parse({
    name: "Marca",
    segment: "Pilates",
    answers: { offers: "Pilates", audience: "Público local", goals: "Atrair novos clientes" },
    brand: {
      confirmed: true,
      detail: "Aulas em pequenos grupos",
      referenceUrl: source.url,
      siteAuthorized: true,
      aiAuthorized: true,
      research: { status: "ready", sources: [source] },
    },
  });

test("late identities invalidate reference confirmation and block content preparation", () => {
  const data = seed();
  data.brand.referencesConfirmed = research.referenceFingerprint(data);
  assert.deepEqual(preview.briefIssues(data), []);
  const next = research.applyResearchToData(
    data,
    { url: source.url, material: "" },
    preview.researchSchema.parse({
      ...data.brand.research,
      discoveredLinks: [{ url: "https://instagram.com/marca", foundOn: source.url }],
    }),
  );
  assert.ok(preview.briefIssues(next).some((x) => /referências/i.test(x)));
});
test("excluded references cannot suggest, autofill or directly mutate the brand", () => {
  const data = seed();
  data.name = "";
  data.brand.confirmed = false;
  data.brand.excludedReferences = ["marca.com"];
  const item = preview.suggestionSchema.parse({
    field: "name",
    value: "Marca removida",
    quote: "Marca removida",
    sourceUrl: source.url,
  });
  const next = research.applyResearchToData(
    data,
    { url: source.url, material: "" },
    preview.researchSchema.parse({ status: "ready", sources: [source], suggestions: [item] }),
  );
  assert.equal(next.name, "");
  assert.equal(research.applyResearchSuggestion(next, item), next);
  assert.equal(research.allowedSuggestions(next).length, 0);
});
test("interrupted background work restores existing evidence instead of a perpetual spinner", () => {
  const data = seed();
  data.brand.research.phase = "deepening";
  const result = parseStoredWorkspace(JSON.stringify({ data, revision: null, dirty: true }));
  assert.equal(result?.data.brand.research.phase, "complete");
  assert.equal(result?.data.brand.research.sources.length, 1);
  assert.match(result?.data.brand.research.message ?? "", /interrompida/i);
});

const compiled = ts.transpileModule(
  readFileSync(new URL("../src/lib/use-brand-research.ts", import.meta.url), "utf8"),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
).outputText;
type FetchCall = { url: string; headers: Record<string, string>; signal: AbortSignal };
// Runs the real hook against minimal React/Supabase stubs. `session` is the
// Supabase session the hook sees; `respond` decides each fetch's outcome.
function mountHook(
  initial: DemoData,
  options: {
    session?: { access_token: string } | null;
    respond?: (call: FetchCall) => Promise<Response>;
  } = {},
) {
  let data = initial;
  let cursor = 0;
  const cells: { value?: unknown; deps?: unknown[]; cleanup?: () => void }[] = [];
  const effects: (() => void)[] = [];
  const calls: FetchCall[] = [];
  const modules: Record<string, unknown> = {
    react: {
      useRef: (value: unknown) => (cells[cursor++] ??= { value: { current: value } }).value,
      useEffect: (fn: () => void | (() => void), deps: unknown[]) => {
        const cell = (cells[cursor++] ??= {});
        if (!cell.deps || deps.some((x, i) => x !== cell.deps?.[i])) {
          cell.deps = deps;
          effects.push(() => {
            cell.cleanup?.();
            cell.cleanup = fn() || undefined;
          });
        }
      },
    },
    "./brand-preview": preview,
    "./brand-research": research,
    "@/integrations/supabase/client": {
      supabase: {
        auth: {
          getSession: async () => ({ data: { session: options.session ?? null }, error: null }),
        },
      },
    },
  };
  const exports = {} as {
    useBrandResearch: (
      data: DemoData,
      setData: (fn: (d: DemoData) => DemoData) => void,
    ) => { research: () => void };
  };
  runInNewContext(compiled, {
    exports,
    require: (id: string) => modules[id],
    AbortController,
    TextDecoder,
    fetch: (url: string, init: { headers: Record<string, string>; signal: AbortSignal }) => {
      const call = { url, headers: init.headers, signal: init.signal };
      calls.push(call);
      return options.respond ? options.respond(call) : new Promise(() => {});
    },
  });
  const setData = (fn: (d: DemoData) => DemoData) => {
    data = fn(data);
  };
  const render = () => {
    cursor = 0;
    const hook = exports.useBrandResearch(data, setData);
    while (effects.length) effects.shift()!();
    return hook;
  };
  return {
    render,
    calls,
    data: () => data,
    setDataDirect: (next: DemoData) => {
      data = next;
    },
  };
}
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

test("revoking consent or changing reference aborts the active request", async () => {
  for (const field of ["aiAuthorized", "siteAuthorized", "referenceUrl", "material"] as const) {
    const hook = mountHook(seed());
    hook.render().research();
    await settle();
    const signal = hook.calls[0]?.signal;
    assert.equal(signal?.aborted, false);
    const data = hook.data();
    hook.setDataDirect({
      ...data,
      brand: { ...data.brand, [field]: typeof data.brand[field] === "boolean" ? false : "changed" },
    });
    hook.render();
    assert.equal(signal?.aborted, true, field);
  }
});

test("a signed-in reading sends the Supabase access token like other authenticated calls", async () => {
  const hook = mountHook(seed(), { session: { access_token: "header.payload.signature" } });
  hook.render().research();
  await settle();
  assert.equal(hook.calls[0]?.url, "/api/brand-preview");
  assert.equal(hook.calls[0]?.headers.Authorization, "Bearer header.payload.signature");
});

test("the public demo without a session degrades to a clear manual-entry message", async () => {
  const hook = mountHook(seed(), {
    session: null,
    respond: async () =>
      new Response(JSON.stringify({ code: "auth-required", message: "x" }), { status: 401 }),
  });
  hook.render().research();
  await settle();
  await settle();
  assert.equal(hook.calls[0]?.headers.Authorization, undefined);
  const state = hook.data().brand.research;
  assert.equal(state.phase, "complete");
  assert.match(state.message, /Entre na sua conta/);
  assert.match(state.message, /manualmente/);
  // No perpetual spinner, and the user's own answers stay untouched.
  assert.equal(state.status, "unavailable");
  assert.equal(hook.data().answers.offers, "Pilates");
  assert.equal(hook.data().brand.detail, "Aulas em pequenos grupos");
});
