import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as quick from "../src/lib/quick-start.ts";
import * as preview from "../src/lib/brand-preview.ts";
import * as workspace from "../src/lib/marketing-workspace.ts";
import * as onboarding from "../src/lib/onboarding.ts";
import * as research from "../src/lib/brand-research.ts";
import * as sources from "../src/lib/brand-sources.ts";
// JSX props and hooks cross an untyped VM boundary in this behavior harness.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RuntimeValue = any;
type Element = { type: unknown; props: Record<string, RuntimeValue> };
const nodes = (v: RuntimeValue): Element[] =>
  Array.isArray(v)
    ? v.flatMap(nodes)
    : v && typeof v === "object" && "props" in v
      ? [v, ...nodes(v.props.children)]
      : [];
function harness(references = false) {
  let data = quick.demoSchema.parse({
    name: "Movitta",
    segment: "Fisioterapia",
    answers: { offers: "Aulas individuais", audience: "Adultos", goals: "Atrair clientes" },
    brand: {
      detail: "Acompanhamento individual da equipe.",
      referenceUrl: references ? "https://movitta.com.br" : "",
      research: references
        ? {
            sources: [
              {
                url: "https://movitta.com.br",
                title: "Movitta",
                text: "Site",
                fetchedAt: "2026-09-25",
              },
            ],
          }
        : {},
    },
  });
  const cells: RuntimeValue[] = [];
  let cursor = 0;
  let returned = 0;
  const exports: Record<string, RuntimeValue> = {};
  const dependencies: Record<string, RuntimeValue> = {
    react: {
      useState: (initial: RuntimeValue) => {
        const i = cursor++;
        if (!(i in cells)) cells[i] = initial;
        return [
          cells[i],
          (v: RuntimeValue) => (cells[i] = typeof v === "function" ? v(cells[i]) : v),
        ];
      },
      useEffect() {},
      useRef: (v: RuntimeValue) => ({ current: v }),
    },
    "react/jsx-runtime": {
      jsx: (type: RuntimeValue, props: RuntimeValue) => ({ type, props }),
      jsxs: (type: RuntimeValue, props: RuntimeValue) => ({ type, props }),
    },
    "lucide-react": {},
    "@/lib/quick-start": quick,
    "@/lib/brand-preview": preview,
    "@/lib/marketing-workspace": workspace,
    "@/lib/onboarding": onboarding,
    "@/lib/brand-research": research,
    "@/lib/brand-sources": sources,
    "./brand-onboarding": { CompactAnswer: "CompactAnswer" },
    "./brand-sources": { BrandSources: "BrandSources" },
  };
  runInNewContext(
    ts.transpileModule(
      readFileSync(
        new URL("../src/components/workspace-context-editor.tsx", import.meta.url),
        "utf8",
      ),
      {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          jsx: ts.JsxEmit.ReactJSX,
          target: ts.ScriptTarget.ES2022,
        },
      },
    ).outputText,
    {
      exports,
      require: (id: string) => {
        if (!(id in dependencies)) throw new Error(id);
        return dependencies[id];
      },
    },
  );
  return {
    data: () => data,
    replaceData: (next: quick.DemoData) => {
      data = next;
    },
    returned: () => returned,
    render() {
      cursor = 0;
      return nodes(
        exports.WorkspaceContextEditor({
          data,
          onData: (v: RuntimeValue) => {
            data = typeof v === "function" ? v(data) : v;
          },
          onReturn: () => returned++,
          onChapter: () => {},
          mode: "contexto",
        }),
      );
    },
  };
}
test("context editor populates existing answers and saves back without creating a new onboarding", () => {
  const app = harness();
  const offer = app.render().find((n) => n.props.label === "Oferta prioritária")!;
  assert.equal(offer.props.value, "Aulas individuais");
  offer.props.onChange("Fisioterapia individual");
  app
    .render()
    .find((n) => n.type === "form")!
    .props.onSubmit({ preventDefault() {} });
  assert.equal(app.returned(), 1);
  assert.equal(app.data().answers.offers, "Fisioterapia individual");
  assert.equal(app.data().brand.confirmed, true);
});
test("reference confirmation cannot be bypassed by submitting the context form", () => {
  const app = harness(true);
  app
    .render()
    .find((n) => n.type === "form")!
    .props.onSubmit({ preventDefault() {} });
  assert.equal(app.returned(), 0);
  assert.equal(app.data().brand.confirmed, false);
});

test("corrected suggested fields survive replacing the researched website", () => {
  const app = harness(true);
  app.replaceData({
    ...app.data(),
    brand: { ...app.data().brand, suggestedFields: ["name", "segment", "audience"] },
  });
  app
    .render()
    .find((n) => n.props.label === "Nome da marca")!
    .props.onChange("Nome confirmado");
  app
    .render()
    .find((n) => n.props.label === "Área de atuação")!
    .props.onChange("Área confirmada");
  app
    .render()
    .find((n) => n.props.label === "Quem você quer alcançar?")!
    .props.onChange("Público confirmado");
  const reference = app.render().find((n) => n.type === "BrandSources")!;
  reference.props.editor.onStart({ key: "movitta.com.br", url: "https://movitta.com.br" });
  app
    .render()
    .find((n) => n.type === "BrandSources")!
    .props.editor.onChange("https://example.org");
  app
    .render()
    .find((n) => n.type === "BrandSources")!
    .props.editor.onSave();
  assert.equal(app.data().name, "Nome confirmado");
  assert.equal(app.data().segment, "Área confirmada");
  assert.equal(app.data().answers.audience, "Público confirmado");
});

test("removing references never silently revives an older excluded link", () => {
  const app = harness(true);
  const remove = (key: string) =>
    app
      .render()
      .find((n) => n.type === "BrandSources")!
      .props.onRemove(key);
  for (let i = 0; i < 24; i++) remove("site:excluded-" + i);
  const original = [...app.data().brand.excludedReferences];
  remove("site:one-more");
  assert.deepEqual([...app.data().brand.excludedReferences], original);
  assert.ok(app.render().some((n) => n.props.role === "alert"));
});

test("editing the full essential form keeps a persistable workspace", () => {
  const app = harness();
  for (const label of [
    "Nome da marca",
    "Área de atuação",
    "O que você quer melhorar?",
    "O que mais dificulta esse resultado hoje?",
    "Oferta prioritária",
    "Quem você quer alcançar?",
  ]) {
    const field = app.render().find((n) => n.props.label === label);
    assert.ok(field, label);
    field.props.onChange(`Resposta revisada: ${label}`);
  }
  // An unrelated diagnostic field must not consume a suggestion-edit slot.
  assert.ok(quick.demoSchema.safeParse(app.data()).success);
  assert.ok(!app.data().brand.editedFields.includes("goals"));
  assert.ok(!app.data().brand.editedFields.includes("challenge"));
});
