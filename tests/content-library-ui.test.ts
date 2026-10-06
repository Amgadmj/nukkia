import * as calendar from "../src/lib/content-calendar.ts";
import * as health from "../src/lib/health-studio.ts";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { demoSchema } from "../src/lib/quick-start.ts";
import * as library from "../src/lib/content-library.ts";
import * as preview from "../src/lib/brand-preview.ts";
import * as art from "../src/lib/post-art.ts";

type Element = {
  type: string;
  props: {
    children?: unknown;
    onClick?: () => void;
    onChange?: (e: { target: { value?: string; checked?: boolean } }) => void;
    [key: string]: unknown;
  };
};
function nodes(value: unknown): Element[] {
  if (Array.isArray(value)) return value.flatMap(nodes);
  if (!value || typeof value !== "object" || !("props" in value)) return [];
  const node = value as Element;
  return [node, ...nodes(node.props.children)];
}
function harness() {
  let cursor = 0;
  const state: unknown[] = [];
  let confirmed = true;
  const exports: Record<string, (props: object) => unknown> = {};
  const deps: Record<string, unknown> = {
    "@/lib/content-calendar": calendar,
    "./content-calendar": { ContentCalendar: "calendar", CalendarTimezone: "timezone" },
    react: {
      useState(initial: unknown) {
        const index = cursor++;
        if (!(index in state)) state[index] = typeof initial === "function" ? initial() : initial;
        return [
          state[index],
          (next: unknown) => {
            state[index] = typeof next === "function" ? next(state[index]) : next;
          },
        ];
      },
    },
    "react/jsx-runtime": {
      jsx: (type: string, props: object) => ({ type, props }),
      jsxs: (type: string, props: object) => ({ type, props }),
    },
    "@/lib/content-library": library,
    "@/lib/health-studio": health,
    "@/lib/brand-preview": preview,
    "@/lib/post-art": art,
  };
  runInNewContext(
    ts.transpileModule(
      readFileSync(new URL("../src/components/content-library.tsx", import.meta.url), "utf8"),
      {
        compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
      },
    ).outputText,
    { exports, require: (id: string) => deps[id], window: { confirm: () => confirmed } },
  );
  let data = demoSchema.parse({
    name: "Ateliê QA",
    answers: { offers: "Oficina sintética", audience: "Adultos", goals: "Informar" },
  });
  data.brand.creative = preview.composeContent(data, "invite");
  data.brand.creative.copy.title = "Versão inicial";
  data = library.saveLibraryVersion(data, "generic");
  data.brand.creative!.copy.title = "Versão revisada";
  data = library.saveLibraryVersion(data, "generic");
  const id = data.library.items[0]!.id;
  const month = new Date().toISOString().slice(0, 7);
  data = library.planLibraryVersion(data, id, 2, `${month}-15`);
  const opened: string[] = [];
  return {
    opened,
    data: () => data,
    confirm: (value: boolean) => {
      confirmed = value;
    },
    picker() {
      cursor = 0;
      assert.equal(
        typeof exports.SavedContentPicker,
        "function",
        "Reusable saved-content chooser must be implemented",
      );
      return nodes(
        exports.SavedContentPicker!({
          data,
          onData: (next: typeof data) => {
            data = next;
          },
          onOpen: (view: string) => opened.push(view),
        }),
      );
    },
    render(planning = false, empty = false) {
      cursor = 0;
      return nodes(
        exports.ContentLibrary!({
          data: empty ? { ...data, library: { ...data.library, items: [] } } : data,
          planning,
          onData: (next: typeof data) => {
            data = next;
          },
          onOpen: (view: string) => opened.push(view),
        }),
      );
    },
  };
}

test("planning remains populated after viewing archived library items", () => {
  const ui = harness();
  ui.render().find((n) => n.props.type === "checkbox")!.props.onChange!({
    target: { checked: true },
  });
  assert.equal(
    (ui.render(true).find((n) => n.type === "calendar")!.props.items as unknown[]).length,
    1,
  );
});

test("planning displays the scheduled version even after inspecting an older library version", () => {
  const ui = harness();
  const version = ui.render().find((n) => n.type === "select" && n.props.value === 2)!;
  version.props.onChange!({ target: { value: "1" } });
  (ui.render(true).find((n) => n.type === "calendar")!.props.onSelect as (id: string) => void)(
    ui.data().library.items[0]!.id,
  );
  const thumbnail = ui.render(true).find((n) => n.type === "img")!;
  assert.match(String(thumbnail.props.alt), /versão 2: Versão revisada/);
});

test("empty monthly planning retains the calendar instead of replacing it with another composition", () => {
  const ui = harness();
  const calendar = ui.render(true, true).find((n) => n.type === "calendar")!;
  assert.deepEqual(calendar.props.items, []);
  assert.deepEqual(calendar.props.allItems, []);
});

test("inspecting an older version uses its title instead of the latest title", () => {
  const ui = harness();
  ui.render().find((n) => n.type === "select" && n.props.value === 2)!.props.onChange!({
    target: { value: "1" },
  });
  const card = ui.render().find((n) => n.type === "article")!;
  assert.equal(nodes(card).find((n) => n.type === "h2")!.props.children, "Versão inicial");
});

test("a copied version remains distinguishable without changing its snapshot title", () => {
  const ui = harness();
  ui.render().find((n) => n.props.children === "Duplicar versão")!.props.onClick!();
  const cards = ui.render().filter((n) => n.type === "article");
  assert.equal(cards.length, 2);
  assert.ok(cards.some((card) => JSON.stringify(card).includes("(cópia)")));
});

test("saved-content chooser cancellation preserves unsaved draft and active version", () => {
  const ui = harness();
  ui.data().brand.creative!.copy.title = "Edição humana não guardada";
  const before = JSON.stringify(ui.data());
  ui.confirm(false);
  const button = ui.picker().find((n) => n.type === "button")!;
  button.props.onClick!();
  assert.equal(JSON.stringify(ui.data()), before);
  assert.deepEqual(ui.opened, []);
});

test("saved-content chooser resumes the selected historical version without rolling back identity", () => {
  const ui = harness();
  ui.data().brand.accent = "#123456";
  const picker = ui.picker();
  picker.find((n) => n.type === "select")!.props.onChange!({ target: { value: "1" } });
  ui.picker().find((n) => n.type === "button")!.props.onClick!();
  assert.equal(ui.data().brand.creative!.copy.title, "Versão inicial");
  assert.equal(ui.data().brand.accent, "#123456");
  assert.equal(ui.data().brand.creative!.approved, null);
  assert.deepEqual(ui.opened, ["peca"]);
});

test("library approval filter follows the inspected version, not the item's latest metadata", () => {
  const ui = harness();
  const snapshot = ui.data().library.items[0]!.versions[0]!.snapshot;
  if (snapshot.kind === "generic") snapshot.approved = true;
  ui.render().find((n) => n.type === "select" && n.props.value === 2)!.props.onChange!({
    target: { value: "1" },
  });
  const status = ui.render().find((n) => n.type === "select" && n.props["aria-label"] === "Estado");
  assert.ok(status, "Library needs a real approval-state filter");
  status.props.onChange!({ target: { value: "approved" } });
  assert.equal(ui.render().filter((n) => n.type === "article").length, 1);
  ui.render().find((n) => n.type === "select" && n.props.value === 1)!.props.onChange!({
    target: { value: "2" },
  });
  assert.equal(ui.render().filter((n) => n.type === "article").length, 0);
});

test("library inspection exposes the first page body as selectable text", () => {
  const ui = harness();
  const body = ui.data().library.items[0]!.versions.at(-1)!.snapshot;
  assert.equal(body.kind, "generic");
  if (body.kind !== "generic") return;
  const tree = ui.render();
  assert.ok(
    tree.some(
      (node) => node.type === "p" && node.props.children === body.brand.creative!.copy.body,
    ),
  );
});
test("planner channel control updates only the planned version", () => {
  const ui = harness();
  (ui.render(true).find((n) => n.type === "calendar")!.props.onSelect as (id: string) => void)(
    ui.data().library.items[0]!.id,
  );
  const control = ui
    .render(true)
    .find((node) => node.type === "select" && node.props["aria-label"] === "Canal pretendido");
  assert.ok(control, "planned items must expose a channel");
  control.props.onChange!({ target: { value: "whatsapp" } });
  assert.equal(ui.data().library.items[0]!.plan!.channel, "whatsapp");
  assert.equal(ui.data().library.items[0]!.plan!.version, 2);
});

test("native time input updates the planned clock before focus leaves the field", () => {
  const ui = harness();
  (
    ui.render(true).find((node) => node.type === "calendar")!.props.onSelect as (id: string) => void
  )(ui.data().library.items[0]!.id);
  const input = ui.render(true).find((node) => node.props.type === "time")!;
  assert.equal(typeof input.props.onInput, "function");
  (input.props.onInput as (event: { currentTarget: { value: string } }) => void)({
    currentTarget: { value: "10:45" },
  });
  assert.equal(ui.data().library.items[0]!.plan!.time, "10:45");
  assert.equal(ui.data().library.items[0]!.plan!.timezone, "America/Sao_Paulo");
  assert.equal(ui.data().library.items[0]!.plan!.version, 2);
});
