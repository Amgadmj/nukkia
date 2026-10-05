import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as domain from "../src/lib/health-studio.ts";
import { demoSchema } from "../src/lib/quick-start.ts";

type Element = {
  type: unknown;
  props: {
    children?: unknown;
    onClick?: () => void;
    onChange?: (event: { target: { value: string } }) => void;
    onBlur?: () => void;
    value?: unknown;
    disabled?: boolean;
    type?: string;
    role?: string;
    "aria-label"?: string;
    "aria-current"?: string;
  };
};
const isElement = (value: unknown): value is Element =>
  !!value && typeof value === "object" && "props" in value;
function nodes(value: unknown): Element[] {
  return Array.isArray(value)
    ? value.flatMap(nodes)
    : isElement(value)
      ? [value, ...nodes(value.props.children)]
      : [];
}
function text(value: unknown): string {
  return Array.isArray(value)
    ? value.map(text).join("")
    : isElement(value)
      ? text(value.props.children)
      : typeof value === "string"
        ? value
        : "";
}
function mount(saved?: ReturnType<typeof demoSchema.parse>) {
  let data = saved ?? demoSchema.parse({ name: "Existing brand", answers: {} }),
    writes = 0,
    cursor = 0,
    duration = 10;
  const cells: unknown[] = [];
  const modules: Record<string, unknown> = {
    "./material-input": { MaterialInput: "material-input" },
    react: {
      useState: (initial: unknown) => {
        const i = cursor++;
        if (!(i in cells)) cells[i] = initial;
        return [
          cells[i],
          (next: unknown) => {
            cells[i] = typeof next === "function" ? next(cells[i]) : next;
          },
        ];
      },
      useEffect: () => {},
      useRef: (value: unknown) => ({ current: value }),
    },
    "react/jsx-runtime": {
      jsx: (type: unknown, props: object) => ({ type, props }),
      jsxs: (type: unknown, props: object) => ({ type, props }),
    },
    "@/lib/health-studio": domain,
    "./marketing-views": { WorkspaceHeading: "heading" },
    "lucide-react": {},
  };
  const exports: Record<string, (props: Record<string, unknown>) => Element> = {};
  runInNewContext(
    ts.transpileModule(
      readFileSync(new URL("../src/components/health-studio.tsx", import.meta.url), "utf8"),
      { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } },
    ).outputText,
    {
      TextEncoder,
      exports,
      require: (id: string) => {
        if (!(id in modules)) throw Error(id);
        return modules[id];
      },
      window: { confirm: () => true },
      crypto,
    },
  );
  return {
    data: () => data,
    writes: () => writes,
    duration: () => duration,
    renderDuration: () => {
      cursor = 0;
      return nodes(
        exports.SceneDurationInput!({
          value: duration,
          onCommit: (value: number) => {
            duration = value;
          },
        }),
      );
    },
    render: () => {
      cursor = 0;
      return nodes(
        exports.HealthStudio!({
          data,
          onData: (fn: (value: typeof data) => typeof data) => {
            data = fn(data);
            writes++;
          },
        }),
      );
    },
  };
}
function click(ui: ReturnType<typeof mount>, label: string) {
  const button = ui
    .render()
    .find(
      (e) => e.type === "button" && (e.props["aria-label"] === label || text(e).trim() === label),
    );
  assert.ok(button, `Missing action: ${label}`);
  assert.ok(!button.props.disabled, `Disabled action: ${label}`);
  button.props.onClick!();
}
function create(ui: ReturnType<typeof mount>) {
  click(ui, "Roteiro em cenas");
  click(ui, "Preparar três exemplos");
  click(ui, ui.data().healthStudio.options[0]!.title);
}
test("health empty state creates persistent synthetic options without granting release", () => {
  const ui = mount(),
    tree = ui.render();
  assert.ok(text(tree).includes("textos fictícios"));
  click(ui, "Roteiro em cenas");
  const prepare = ui
    .render()
    .find((e) => e.type === "button" && text(e).includes("Preparar três exemplos"));
  assert.ok(prepare);
  prepare.props.onClick();
  assert.equal(ui.data().healthStudio.options.length, 3);
  assert.equal(ui.data().name, "Existing brand");
  const updated = ui.render();
  const production = updated.find(
    (e) => e.type === "button" && text(e).includes("Gerar com gêmeo digital"),
  );
  assert.equal(production?.props.disabled, true);
  assert.equal(
    updated.some((e) => e.type === "input" && e.props.type === "file"),
    false,
  );
});
test("duration editing accepts transient empty and partial values before committing", () => {
  const ui = mount();
  ui.renderDuration()
    .find((e) => e.type === "input")!
    .props.onChange({ target: { value: "" } });
  assert.equal(ui.duration(), 10);
  ui.renderDuration()
    .find((e) => e.type === "input")!
    .props.onChange({ target: { value: "1" } });
  assert.equal(ui.duration(), 10);
  ui.renderDuration()
    .find((e) => e.type === "input")!
    .props.onChange({ target: { value: "15" } });
  assert.equal(ui.duration(), 10);
  ui.renderDuration()
    .find((e) => e.type === "input")!
    .props.onBlur();
  assert.equal(ui.duration(), 15);
  ui.renderDuration()
    .find((e) => e.type === "input")!
    .props.onChange({ target: { value: "2" } });
  ui.renderDuration()
    .find((e) => e.type === "input")!
    .props.onBlur();
  assert.equal(ui.duration(), 15);
  assert.ok(ui.renderDuration().some((e) => e.props.role === "alert"));
});
test("editing a scene and undo use the shared workspace state", () => {
  const ui = mount();
  create(ui);
  const before = ui.data().healthStudio.options[0]!.scenes[0]!.script;
  const editor = ui.render().find((e) => e.type === "textarea")!;
  editor.props.onChange({ target: { value: "Um texto atualizado no exemplo." } });
  assert.equal(
    ui.data().healthStudio.options[0]!.scenes[0]!.script,
    "Um texto atualizado no exemplo.",
  );
  ui.render()
    .find((e) => e.type === "button" && text(e) === "Desfazer")!
    .props.onClick();
  assert.equal(ui.data().healthStudio.options[0]!.scenes[0]!.script, before);
});
test("undo can recover a template replacement and redo survives an empty studio", () => {
  const ui = mount();
  create(ui);
  const original = ui.data().healthStudio.options;
  ui.render()
    .find((e) => e.type === "button" && text(e) === "Desfazer")!
    .props.onClick();
  assert.equal(ui.data().healthStudio.options.length, 0);
  const redo = ui.render().find((e) => e.type === "button" && text(e) === "Refazer");
  assert.ok(redo);
  redo.props.onClick();
  assert.deepEqual(ui.data().healthStudio.options, original);
  click(ui, "Voltar");
  click(ui, "Voltar");
  ui.render()
    .find((e) => e.type === "select" && e.props.value === "V01")!
    .props.onChange({ target: { value: "V02" } });
  assert.equal(ui.data().healthStudio.options.length, 0);
  const undo = ui.render().find((e) => e.type === "button" && text(e) === "Desfazer");
  assert.ok(undo);
  undo.props.onClick();
  assert.deepEqual(ui.data().healthStudio.options, original);
});

test("creation steps hide the editor until an option is chosen and back preserves drafts", () => {
  const ui = mount();
  assert.equal(
    ui.render().some((e) => e.type === "textarea"),
    false,
  );
  click(ui, "Roteiro em cenas");
  click(ui, "Preparar três exemplos");
  assert.equal(
    ui.render().some((e) => e.type === "textarea"),
    false,
  );
  click(ui, ui.data().healthStudio.options[1]!.title);
  assert.equal(ui.data().healthStudio.selectedOption, ui.data().healthStudio.options[1]!.id);
  assert.equal(ui.render().filter((e) => e.type === "textarea").length, 1);
  const saved = JSON.stringify(ui.data());
  click(ui, "Voltar");
  assert.equal(
    ui.render().some((e) => e.type === "textarea"),
    false,
  );
  click(ui, "Voltar");
  assert.equal(JSON.stringify(ui.data()), saved);
});

test("scene thumbnails edit the selected scene and reload recovers saved options", () => {
  const ui = mount();
  create(ui);
  const first = ui.data().healthStudio.options[0]!.scenes[0]!.script;
  ui.render().find((e) => e.props["aria-label"] === "Editar cena 2")!.props.onClick!();
  ui.render().find((e) => e.type === "textarea")!.props.onChange!({
    target: { value: "Segunda cena revisada." },
  });
  assert.equal(ui.data().healthStudio.options[0]!.scenes[0]!.script, first);
  assert.equal(ui.data().healthStudio.options[0]!.scenes[1]!.script, "Segunda cena revisada.");
  const restored = mount(demoSchema.parse(JSON.parse(JSON.stringify(ui.data()))));
  assert.equal(restored.render().filter((e) => e.type === "textarea").length, 1);
  assert.equal(
    restored.data().healthStudio.options[0]!.scenes[1]!.script,
    "Segunda cena revisada.",
  );
});

test("moving the initially selected scene keeps its editor selected through undo and redo", () => {
  const ui = mount();
  create(ui);
  const heading = ui.render().find((e) => e.type === "input")!.props.value;
  click(ui, "Mover abaixo");
  assert.equal(ui.render().find((e) => e.type === "input")!.props.value, heading);
  assert.ok(ui.render().some((e) => e.props["aria-label"] === "Editor da cena 2"));
  click(ui, "Desfazer");
  assert.equal(ui.render().find((e) => e.type === "input")!.props.value, heading);
  assert.ok(ui.render().some((e) => e.props["aria-label"] === "Editor da cena 1"));
  click(ui, "Refazer");
  assert.equal(ui.render().find((e) => e.type === "input")!.props.value, heading);
});
