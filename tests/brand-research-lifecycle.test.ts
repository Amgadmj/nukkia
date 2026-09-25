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
test("revoking consent or changing reference aborts the active request", () => {
  for (const field of ["aiAuthorized", "siteAuthorized", "referenceUrl", "material"] as const) {
    let data = seed();
    let cursor = 0;
    const cells: { value?: unknown; deps?: unknown[]; cleanup?: () => void }[] = [];
    const effects: (() => void)[] = [];
    let signal: AbortSignal | undefined;
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
      fetch: (_url: string, options: { signal: AbortSignal }) => {
        signal = options.signal;
        return new Promise(() => {});
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
    render().research();
    assert.equal(signal?.aborted, false);
    data = {
      ...data,
      brand: { ...data.brand, [field]: typeof data.brand[field] === "boolean" ? false : "changed" },
    };
    render();
    assert.equal(signal?.aborted, true, field);
  }
});
