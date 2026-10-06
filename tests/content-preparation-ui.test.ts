import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { demoSchema, type DemoData } from "../src/lib/quick-start.ts";
import * as preview from "../src/lib/brand-preview.ts";

type Element = {
  type: unknown;
  props: {
    children?: unknown;
    disabled?: boolean;
    onClick?: () => void;
    onIdentity?: () => void;
    onSelect?: (value: preview.ContentApproach) => void;
    selected?: preview.ContentApproach;
  };
};
const isElement = (value: unknown): value is Element =>
  !!value && typeof value === "object" && "props" in value;
const nodes = (value: unknown): Element[] =>
  Array.isArray(value)
    ? value.flatMap(nodes)
    : isElement(value)
      ? [value, ...nodes(value.props.children)]
      : [];
const text = (value: unknown): string =>
  Array.isArray(value)
    ? value.map(text).join("")
    : isElement(value)
      ? text(value.props.children)
      : typeof value === "string"
        ? value
        : "";
function mount(
  confirmed = true,
  approach: preview.ContentApproach = "educate",
  saved?: DemoData,
  initialView: "peca" | "abordagens" = "peca",
) {
  let data = demoSchema.parse(
    saved ?? {
      name: "Movitta",
      segment: "Fisioterapia",
      answers: {
        offers: "Exercícios personalizados",
        audience: "Adultos que procuram movimento",
        goals: "Atrair novos clientes",
      },
      brand: {
        confirmed: true,
        detail: "Acompanhamento individual por profissionais da equipe.",
        visualStyle: "essential",
        identityConfirmed: confirmed,
        preferredApproach: approach,
      },
    },
  );
  let selected = approach;
  let view = initialView;
  let writes = 0;
  let identityVisits = 0;
  const modules: Record<string, unknown> = {
    react: {
      useState: () => [
        selected,
        (value: preview.ContentApproach) => {
          selected = value;
        },
      ],
    },
    "react/jsx-runtime": {
      jsx: (type: unknown, props: object) => ({ type, props }),
      jsxs: (type: unknown, props: object) => ({ type, props }),
    },
    "lucide-react": {},
    "@/lib/brand-preview": preview,
    "./piece-brief": { PieceBrief: "piece-brief" },
    "./content-library": { SavedContentPicker: "saved-content-picker" },
    "./content-recommendation": { ContentRecommendation: "recommendation" },
    "./content-readiness": { ContentReadiness: "readiness" },
    "./first-post-workspace": { FirstPostWorkspace: "editor" },
    "./marketing-views": { WorkspaceHeading: "heading" },
  };
  const exports: Record<string, (props: Record<string, unknown>) => Element> = {};
  runInNewContext(
    ts.transpileModule(
      readFileSync(new URL("../src/components/content-studio.tsx", import.meta.url), "utf8"),
      { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } },
    ).outputText,
    {
      window: { confirm: () => true },
      exports,
      require: (id: string) => {
        if (!(id in modules)) throw new Error(id);
        return modules[id];
      },
    },
  );
  return {
    data: () => data,
    writes: () => writes,
    identityVisits: () => identityVisits,
    render: () =>
      nodes(
        exports.ContentStudio({
          data,
          view,
          onView: (next: string) => {
            view = next;
          },
          onIdentity: () => {
            identityVisits++;
          },
          onEditBrief() {},
          onTrail() {},
          onData: (update: (data: DemoData) => DemoData) => {
            writes++;
            data = update(data);
          },
        }),
      ),
  };
}
const createButton = (elements: Element[]) =>
  elements.find(
    (element) => element.type === "button" && text(element).includes("Preparar meu rascunho"),
  );

test("entering the studio before identity confirmation cannot create a draft", () => {
  const ui = mount(false);
  const tree = ui.render();
  assert.equal(createButton(tree), undefined);
  assert.equal(ui.writes(), 0);
  tree.find((element) => element.type === "readiness")!.props.onIdentity!();
  assert.equal(ui.identityVisits(), 1);
  assert.equal(ui.data().brand.creative, null);
});

test("identity-incomplete users can compare and save an approach before creating a draft", () => {
  const ui = mount(false, "educate", undefined, "abordagens");
  const tree = ui.render();
  const recommendation = tree.find((element) => element.type === "recommendation")!;
  assert.ok(recommendation, "the three approaches stay available before identity completion");
  recommendation.props.onSelect!("trust");
  assert.equal(ui.data().brand.preferredApproach, "trust");
  assert.equal(ui.data().brand.creative, null);
  assert.equal(createButton(tree), undefined);
  tree.find(
    (element) => element.type === "button" && text(element).includes("Finalizar identidade"),
  )!.props.onClick!();
  assert.equal(ui.identityVisits(), 1);
});

test("a personalized studio stays empty until an explicit create click", () => {
  const ui = mount();
  const button = createButton(ui.render())!;
  assert.equal(ui.writes(), 0);
  assert.equal(ui.data().brand.creative, null);
  button.props.onClick!();
  assert.equal(ui.writes(), 1);
  assert.equal(ui.data().brand.creative?.approach, "educate");
});

test("choosing a photo format without assets cannot generate a placeholder piece", () => {
  const ui = mount(true, "trust");
  const button = createButton(ui.render())!;
  assert.equal(button.props.disabled, true);
  button.props.onClick!();
  assert.equal(ui.writes(), 0);
  assert.equal(ui.data().brand.creative, null);
});

test("a pending approach survives the round trip to identity without generating content", () => {
  const ui = mount();
  ui.render().find((element) => element.type === "recommendation")!.props.onSelect!("trust");
  const restored = mount(true, "educate", demoSchema.parse(JSON.parse(JSON.stringify(ui.data()))));
  assert.equal(
    restored.render().find((element) => element.type === "recommendation")!.props.selected,
    "trust",
  );
  assert.equal(restored.data().brand.creative, null);
});

test("confirming a new piece clears the active saved item without changing its history", () => {
  const seed = mount().data();
  seed.brand.creative = preview.composeContent(seed, "educate");
  const id = crypto.randomUUID();
  seed.library.activeGeneric = id;
  seed.brand.pieceBrief = preview.pieceBriefSchema.parse({
    format: "image",
    idea: "Nova peça independente",
    asNew: true,
  });
  const ui = mount(true, "educate", seed, "abordagens");
  const button = ui
    .render()
    .find((element) => element.type === "button" && text(element).includes("Usar esta abordagem"))!;
  button.props.onClick!();
  assert.equal(ui.data().library.activeGeneric, null);
  assert.equal(ui.data().brand.creative!.copy.title, "Nova peça independente");
  assert.equal(ui.data().brand.pieceBrief!.asNew, false);
});
