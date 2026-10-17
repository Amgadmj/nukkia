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
  let studioOpened = 0;
  let chapterOpened: number | undefined;
  let shouldBlock:
    | ((args: { next: { pathname: string; search: Record<string, unknown> } }) => boolean)
    | undefined;
  const exports: Record<string, RuntimeValue> = {};
  const dependencies: Record<string, RuntimeValue> = {
    "@tanstack/react-router": {
      useBlocker: (options: RuntimeValue) => {
        shouldBlock = options.shouldBlockFn;
      },
    },
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
    studioOpened: () => studioOpened,
    chapterOpened: () => chapterOpened,
    navigate: (pathname: string, search: Record<string, unknown> = {}) =>
      shouldBlock?.({ next: { pathname, search } }),
    render(chapter?: number) {
      cursor = 0;
      return nodes(
        exports.WorkspaceContextEditor({
          data,
          onData: (v: RuntimeValue) => {
            data = typeof v === "function" ? v(data) : v;
          },
          onReturn: () => returned++,
          onChapter: (next?: number) => {
            chapterOpened = next;
          },
          onHealthStudio: () => studioOpened++,
          mode: chapter === undefined ? "contexto" : "diagnostico",
          chapter,
        }),
      );
    },
  };
}
test("the context editor keeps focus on diagnosis without a Health-studio detour", () => {
  const app = harness();
  const before = JSON.stringify(app.data());
  const button = app
    .render()
    .find((n) => n.type === "button" && n.props.className === "context-health-link");
  assert.equal(button, undefined);
  assert.equal(app.studioOpened(), 0);
  assert.equal(JSON.stringify(app.data()), before);
});
test("an unfinished essential setup cannot return to the panel or generate analysis", () => {
  const app = harness();
  app
    .render()
    .find((n) => n.type === "form")!
    .props.onSubmit({ preventDefault() {} });
  assert.equal(app.returned(), 0);
  assert.ok(app.render().some((n) => n.props.role === "alert"));
});
test("a completed diagnostic cannot bypass an invalid clinic name via Back", () => {
  const app = harness();
  app.data().name = "";
  app.data().answers.challenge = "Reduzir dúvidas de preparo";
  app.data().strategy.metric = "appointments";
  app
    .render()
    .find((n) => n.props.className === "quick-text-button context-back")!
    .props.onClick();
  assert.equal(app.returned(), 0);
  assert.ok(app.render().some((n) => n.props.role === "alert"));
});
test("sidebar navigation cannot bypass the current diagnostic setup", () => {
  const app = harness();
  app.render();
  assert.equal(app.navigate("/painel"), true);
  assert.equal(app.navigate("/trilha"), true);
  assert.equal(app.navigate("/demo", { aba: "painel", passo: 6 }), true);
  assert.equal(app.navigate("/demo", { aba: "trilha", editar: "contexto" }), false);
  assert.equal(app.navigate("/conta"), false, "account and sign-out remain accessible");
  app.data().answers.challenge = "Reduzir dúvidas";
  app.data().strategy.metric = "appointments";
  app.render();
  assert.equal(app.navigate("/painel"), false);
});
test("returning to the panel preserves an unfinished edit to an existing reference link", () => {
  const app = harness(true);
  const before = JSON.stringify(app.data());
  app
    .render()
    .find((n) => n.type === "BrandSources")!
    .props.editor.onStart({
      key: "movitta.com.br",
      url: "https://movitta.com.br",
    });
  app
    .render()
    .find((n) => n.type === "BrandSources")!
    .props.editor.onChange("https://edited.example");
  app
    .render()
    .find((n) => n.props.className === "quick-text-button context-back")!
    .props.onClick();
  assert.equal(app.studioOpened(), 0);
  assert.equal(
    app.render().find((n) => n.type === "BrandSources")!.props.editor.current.value,
    "https://edited.example",
  );
  assert.equal(JSON.stringify(app.data()), before);
  assert.ok(app.render().some((n) => n.props.role === "alert"));
});
test("returning to the panel preserves an unfinished new reference link", () => {
  const app = harness();
  app
    .render()
    .find((n) => n.type === "button" && n.props.children?.includes?.(" Adicionar link"))!
    .props.onClick();
  app
    .render()
    .find((n) => n.type === "input" && n.props.inputMode === "url")!
    .props.onChange({ target: { value: "https://new.example" } });
  app
    .render()
    .find((n) => n.props.className === "quick-text-button context-back")!
    .props.onClick();
  assert.equal(app.studioOpened(), 0);
  assert.equal(
    app.render().find((n) => n.type === "input" && n.props.inputMode === "url")!.props.value,
    "https://new.example",
  );
  assert.equal(app.data().brand.extraLinks.length, 0);
});
test("context editor generates the review only after all essential decisions, without restarting onboarding", () => {
  const app = harness();
  const offer = app.render().find((n) => n.props.label === "Oferta prioritária")!;
  assert.equal(offer.props.value, "Aulas individuais");
  offer.props.onChange("Fisioterapia individual");
  app
    .render()
    .find((n) => n.type === "form")!
    .props.onSubmit({ preventDefault() {} });
  assert.equal(app.returned(), 0);
  assert.equal(app.data().brand.confirmed, false);
  app.data().answers.challenge = "Reduzir dúvidas de preparo";
  app.data().strategy.metric = "appointments";
  app
    .render()
    .find((n) => n.type === "form")!
    .props.onSubmit({ preventDefault() {} });
  assert.equal(app.data().answers.offers, "Fisioterapia individual");
  assert.equal(app.data().brand.confirmed, true);
  const continueButton = app
    .render()
    .find(
      (n) => n.type === "button" && n.props.children?.includes?.("Continuar para Identidade "),
    )!;
  assert.ok(continueButton);
  continueButton.props.onClick();
  assert.equal(app.returned(), 1);
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

test("context steps preserve answers and prevent hiding an unfinished reference", () => {
  const app = harness();
  app.data().answers.challenge = "Reduzir dúvidas de preparo";
  app.data().strategy.metric = "appointments";
  const panel = (title: string) =>
    app.render().find((n) => n.type === "section" && n.props["aria-label"] === title);
  assert.equal(panel("Marca e oferta")?.props.hidden, false);
  app
    .render()
    .find((n) => n.type === "button" && n.props["aria-label"] === "Objetivo")!
    .props.onClick();
  assert.equal(panel("Seu objetivo")?.props.hidden, false);
  app
    .render()
    .find((n) => n.props.label === "O que você quer melhorar?")!
    .props.onChange("Reduzir dúvidas antes da consulta");
  app
    .render()
    .find((n) => n.type === "button" && n.props["aria-label"] === "Referências")!
    .props.onClick();
  app
    .render()
    .find((n) => n.type === "button" && n.props.children?.includes?.(" Adicionar link"))!
    .props.onClick();
  app
    .render()
    .find((n) => n.type === "input" && n.props.inputMode === "url")!
    .props.onChange({ target: { value: "https://draft.example" } });
  app
    .render()
    .find((n) => n.type === "button" && n.props["aria-label"] === "Marca")!
    .props.onClick();
  assert.equal(panel("Referências da marca")?.props.hidden, false);
  assert.equal(
    app.render().find((n) => n.type === "input" && n.props.inputMode === "url")!.props.value,
    "https://draft.example",
  );
  assert.equal(app.data().answers.goals, "Reduzir dúvidas antes da consulta");
  assert.ok(app.render().some((n) => n.props.role === "alert"));
});

test("forward context tabs require the current stage while previous tabs remain reachable", () => {
  const app = harness();
  const tab = (label: string) =>
    app.render().find((n) => n.type === "button" && n.props["aria-label"] === label)!;
  app.data().name = "";
  tab("Objetivo").props.onClick();
  assert.equal(
    app.render().find((n) => n.props["aria-label"] === "Marca e oferta")?.props.hidden,
    false,
  );
  app.data().name = "Clínica QA";
  tab("Objetivo").props.onClick();
  tab("Referências").props.onClick();
  assert.equal(
    app.render().find((n) => n.props["aria-label"] === "Seu objetivo")?.props.hidden,
    false,
  );
  tab("Marca").props.onClick();
  assert.equal(
    app.render().find((n) => n.props["aria-label"] === "Marca e oferta")?.props.hidden,
    false,
  );
});

test("a chapter advances only after required answers, without making optional history mandatory", () => {
  const app = harness();
  const direction = () =>
    app
      .render(1)
      .find(
        (n) =>
          n.type === "button" &&
          n.props.children?.some?.(
            (child: Element) => child?.type === "strong" && child.props.children === "Seu público",
          ),
      )!;
  direction().props.onClick();
  assert.equal(app.chapterOpened(), undefined);
  app.data().answers.problems = "Dúvidas antes das consultas";
  direction().props.onClick();
  assert.equal(app.chapterOpened(), 2);
  assert.equal(app.data().answers.founderStory, "");
});
