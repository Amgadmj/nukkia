import * as workspace from "../src/lib/marketing-workspace.ts";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { demoSchema, type DemoData } from "../src/lib/quick-start.ts";
import * as preview from "../src/lib/brand-preview.ts";
import * as art from "../src/lib/post-art.ts";

type Element = { type: string; props: Record<string, unknown> & { children?: unknown } };
function nodes(value: unknown): Element[] {
  return Array.isArray(value)
    ? value.flatMap(nodes)
    : value && typeof value === "object" && "props" in value
      ? [value as Element, ...nodes((value as Element).props.children)]
      : [];
}
function text(value: unknown): string {
  return Array.isArray(value)
    ? value.map(text).join("")
    : value && typeof value === "object" && "props" in value
      ? text((value as Element).props.children)
      : typeof value === "string"
        ? value
        : "";
}
function invoke(node: Element | undefined, event = "onClick", value?: unknown) {
  assert.ok(node);
  return (node.props[event] as (value?: unknown) => unknown)(value);
}
function load(file: string, name: string, assetPreparation?: typeof art.prepareAsset) {
  let cursor = 0;
  const state: unknown[] = [];
  const refs: unknown[] = [];
  const exports: Record<string, (props: object) => unknown> = {};
  const dependencies: Record<string, unknown> = {
    react: {
      useMemo: (compute: () => unknown) => compute(),
      useEffect() {},
      useRef(value: unknown) {
        const i = cursor++;
        return (refs[i] ??= { current: value });
      },
      useState(initial: unknown) {
        const i = cursor++;
        if (!(i in state)) state[i] = typeof initial === "function" ? initial() : initial;
        return [
          state[i],
          (next: unknown) => {
            state[i] = typeof next === "function" ? next(state[i]) : next;
          },
        ];
      },
    },
    "react/jsx-runtime": {
      jsx: (type: string, props: object) => ({ type, props }),
      jsxs: (type: string, props: object) => ({ type, props }),
    },
    "./brand-onboarding": { CompactAnswer: "compact-answer" },
    "./brand-sources": { BrandSources: "brand-sources" },
    "lucide-react": {},
    "@/lib/marketing-workspace": workspace,
    "@/lib/brand-preview": preview,
    "@/lib/post-art": assetPreparation ? { ...art, prepareAsset: assetPreparation } : art,
    "./material-input": { MaterialInput: "material-input" },
  };
  runInNewContext(
    ts.transpileModule(
      readFileSync(new URL(`../src/components/${file}.tsx`, import.meta.url), "utf8"),
      { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } },
    ).outputText,
    {
      exports,
      require: (id: string) => {
        assert.ok(id in dependencies, id);
        return dependencies[id];
      },
      window: { confirm: () => true },
      Error,
      TextEncoder,
      crypto,
      structuredClone,
    },
  );
  return (props: object) => {
    cursor = 0;
    return nodes(exports[name]!(props));
  };
}
const fixture = () =>
  demoSchema.parse({
    name: "Ateliê QA",
    segment: "Cerâmica",
    answers: { offers: "Oficina de sábado", audience: "Adultos", goals: "Informar" },
    brand: {
      confirmed: true,
      detail: "Acompanhamento da equipe local.",
      visualStyle: "essential",
      identityConfirmed: true,
    },
  });
const material = {
  id: crypto.randomUUID(),
  title: "Material sintético",
  image: "data:image/png;base64,AAAA",
  source: "Arquivo QA",
  permission: "own",
  url: "",
  note: "",
};

test("brief controls persist format and instructions, prepare options and preserve human text", () => {
  let data = fixture();
  data.brand.creative = preview.composeContent(data, "invite");
  data.brand.creative.copy.title = "Texto humano preservado";
  const saved = structuredClone(data.brand.creative.copy);
  const actions: string[] = [];
  const render = load("piece-brief", "PieceBrief");
  const tree = () =>
    render({
      data,
      onData: (update: DemoData | ((value: DemoData) => DemoData)) => {
        data = typeof update === "function" ? update(data) : update;
      },
      onPrepare: () => actions.push("options"),
      onContext: () => actions.push("context"),
      onIdentity: () => actions.push("identity"),
    });
  assert.equal(
    tree().find((node) => node.type === "button" && text(node) === "Preparar opções")!.props
      .disabled,
    true,
  );
  invoke(tree().find((node) => node.type === "button" && text(node).startsWith("Carrossel")));
  invoke(
    tree().find((node) => node.type === "textarea" && node.props.placeholder),
    "onChange",
    { target: { value: "A oficina de sábado" } },
  );
  invoke(
    tree().find((node) => node.type === "input" && node.props.placeholder === "Informar"),
    "onChange",
    { target: { value: "Receber perguntas" } },
  );
  assert.equal(
    tree().find((node) => node.type === "button" && text(node) === "Preparar opções")!.props
      .disabled,
    false,
  );
  invoke(tree().find((node) => node.type === "button" && text(node) === "Preparar opções"));
  invoke(
    tree().find((node) => node.type === "button" && text(node) === "Revisar contexto e oferta"),
  );
  invoke(tree().find((node) => node.type === "button" && text(node) === "Revisar identidade"));
  assert.deepEqual(actions, ["options", "context", "identity"]);
  assert.deepEqual(data.brand.creative!.copy, saved);
  assert.equal(data.answers.goals, "Informar");
  data = demoSchema.parse(JSON.parse(JSON.stringify(data)));
  assert.equal(data.brand.pieceBrief!.format, "carousel");
  assert.equal(data.brand.pieceBrief!.goal, "Receber perguntas");
});
test("material inspection and cancellation are read-only; explicit use and remove invoke their callbacks", () => {
  const render = load("material-input", "MaterialInput");
  let applied: unknown = null;
  let writes = 0;
  const tree = () =>
    render({
      value: applied,
      onChange: (value: unknown) => {
        applied = value;
        writes++;
      },
      library: [material],
    });
  invoke(tree().find((node) => node.props["aria-label"] === `Inspecionar ${material.title}`));
  assert.equal(writes, 0);
  invoke(tree().find((node) => node.type === "button" && text(node) === "Cancelar seleção"));
  assert.equal(writes, 0);
  invoke(tree().find((node) => node.props["aria-label"] === `Inspecionar ${material.title}`));
  invoke(tree().find((node) => node.type === "button" && text(node) === "Usar material"));
  assert.deepEqual(applied, material);
  assert.equal(writes, 1);
  invoke(tree().find((node) => node.type === "button" && text(node) === "Remover material"));
  assert.equal(applied, null);
  assert.equal(writes, 2);
});
test("an invalid uploaded file leaves selected material intact and exposes a retryable error", async () => {
  const render = load("material-input", "MaterialInput");
  let writes = 0;
  const tree = () => render({ value: material, onChange: () => writes++ });
  await invoke(
    tree().find((node) => node.type === "input" && node.props.type === "file"),
    "onChange",
    { target: { files: [{ type: "application/pdf", size: 10 }], value: "qa.pdf" } },
  );
  assert.equal(writes, 0);
  assert.ok(tree().some((node) => node.props.role === "alert" && text(node).includes("PNG")));
  assert.equal(
    tree().find((node) => node.type === "input" && node.props.type === "file")!.props.disabled,
    false,
  );
});
test("material storage rejection retains the previous value and pending selection for retry", () => {
  const render = load("material-input", "MaterialInput");
  const tree = () =>
    render({
      value: null,
      onChange: () => {
        throw new Error("Sem espaço QA");
      },
      library: [material],
    });
  invoke(tree().find((node) => node.props["aria-label"] === `Inspecionar ${material.title}`));
  invoke(tree().find((node) => node.type === "button" && text(node) === "Usar material"));
  assert.ok(tree().some((node) => node.props.role === "alert" && text(node) === "Sem espaço QA"));
  assert.ok(tree().some((node) => node.type === "button" && text(node) === "Cancelar seleção"));
});
test("piece material refuses to exceed twenty attached references and preserves the draft", () => {
  let data = fixture();
  data.brand.inspirationBrief = Array.from({ length: 20 }, (_, i) => ({
    ...material,
    id: crypto.randomUUID(),
    title: `Source ${i}`,
    image: "",
    permission: "unknown" as const,
  }));
  const before = JSON.stringify(data);
  const render = load("piece-brief", "PieceBrief");
  const tree = render({
    data,
    onData: (next: DemoData) => {
      data = next;
    },
    onPrepare() {},
    onContext() {},
    onIdentity() {},
  });
  assert.throws(
    () =>
      invoke(
        tree.find((node) => node.type === "material-input"),
        "onChange",
        material,
      ),
    /20/,
  );
  assert.equal(JSON.stringify(data), before);
});
test("alternate editor recomposition starts an independent library item when requested", () => {
  let data = fixture();
  data.brand.creative = preview.composeContent(data, "invite");
  data.library.activeGeneric = crypto.randomUUID();
  data.brand.pieceBrief = preview.pieceBriefSchema.parse({ asNew: true, idea: "Outra peça" });
  const render = load("first-post-workspace", "FirstPostWorkspace");
  const tree = render({
    data,
    onData: (update: (current: DemoData) => DemoData) => {
      data = update(data);
    },
    onTrail() {},
    onEditBrief() {},
    onChooseApproach() {},
  });
  invoke(
    tree.find((node) => node.type === "button" && text(node).includes("Preparar nova versão")),
  );
  assert.equal(data.library.activeGeneric, null);
  assert.equal(data.brand.pieceBrief!.asNew, false);
});
test("a late upload cannot replace a deliberately inspected library image", async () => {
  let finish!: (image: string) => void;
  const render = load(
    "material-input",
    "MaterialInput",
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const tree = () => render({ value: null, onChange() {}, library: [material] });
  const request = invoke(
    tree().find((node) => node.type === "input" && node.props.type === "file"),
    "onChange",
    { target: { files: [{ type: "image/png", size: 10, name: "Late file" }], value: "" } },
  );
  invoke(tree().find((node) => node.props["aria-label"] === `Inspecionar ${material.title}`));
  finish("data:image/png;base64,BBBB");
  await request;
  assert.ok(tree().some((node) => node.type === "input" && node.props.value === material.title));
  assert.ok(!tree().some((node) => node.type === "input" && node.props.value === "Late file"));
});
