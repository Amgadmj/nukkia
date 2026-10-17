import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as calendar from "../src/lib/content-calendar.ts";
import { demoSchema } from "../src/lib/quick-start.ts";
import { composeContent } from "../src/lib/brand-preview.ts";
import { saveLibraryVersion, planLibraryVersion } from "../src/lib/content-library.ts";

type Node = {
  type: string;
  props: Record<string, unknown> & {
    onClick: () => void;
    onChange: (event: { target: { value: string } }) => void;
    onInput: (event: { currentTarget: { value: string } }) => void;
    onSubmit: (event: { preventDefault: () => void }) => void;
    onDragStart: (event: ReturnType<typeof dragEvent>) => void;
    onDragEnd: () => void;
    onDrop: (event: ReturnType<typeof dragEvent>) => void;
  };
};
function nodes(value: unknown): Node[] {
  if (Array.isArray(value)) return value.flatMap(nodes);
  if (!value || typeof value !== "object" || !("props" in value)) return [];
  const node = value as Node;
  return [node, ...nodes(node.props.children)];
}
function harness(outcome: boolean | Error = true) {
  let data = demoSchema.parse({ name: "Clínica QA", answers: {} });
  data.brand.creative = composeContent(data, "educate");
  data = saveLibraryVersion(data, "generic");
  const id = data.library.items[0]!.id;
  data = planLibraryVersion(data, id, 1, "2026-11-01", "instagram", {
    time: "09:00",
    timezone: "UTC",
  });
  const state: unknown[] = [];
  let cursor = 0;
  let month = "2026-10";
  let activeId: string | null = null;
  const plans: unknown[][] = [];
  const exports: Record<string, (props: object) => unknown> = {};
  const deps: Record<string, unknown> = {
    react: {
      useState(initial: unknown) {
        const i = cursor++;
        if (!(i in state)) state[i] = initial;
        return [
          state[i],
          (next: unknown) => {
            state[i] = next;
          },
        ];
      },
      useRef(initial: unknown) {
        const i = cursor++;
        if (!(i in state)) state[i] = { current: initial };
        return state[i];
      },
      useEffect: () => {},
    },
    "react/jsx-runtime": {
      jsx: (type: string, props: object) => ({ type, props }),
      jsxs: (type: string, props: object) => ({ type, props }),
    },
    "lucide-react": {},
    "@/lib/content-calendar": calendar,
    "./content-calendar.css": {},
  };
  runInNewContext(
    ts.transpileModule(
      readFileSync(new URL("../src/components/content-calendar.tsx", import.meta.url), "utf8"),
      { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } },
    ).outputText,
    { exports, require: (id: string) => deps[id] },
  );
  return {
    plans,
    id,
    items: data.library.items,
    render() {
      cursor = 0;
      return nodes(
        exports.ContentCalendar!({
          items: data.library.items,
          allItems: data.library.items,
          month,
          activeId,
          onMonth: (value: string) => {
            month = value;
            activeId = null;
          },
          onSelect: (value: string | null) => {
            activeId = value;
          },
          onPlan: (...args: unknown[]) => {
            plans.push(args);
            if (outcome instanceof Error) throw outcome;
            return outcome;
          },
        }),
      );
    },
    selected: () => ({ month, activeId }),
  };
}
test("opening an adjacent-month bubble selects its actual day, month and saved item", () => {
  const h = harness();
  h.render()
    .find((n) => n.props.className === "calendar-bubble")!
    .props.onClick();
  assert.deepEqual(h.selected(), { month: "2026-11", activeId: h.id });
  assert.equal(
    h.render().find((n) => n.props["data-day"] === "2026-11-01")!.props["aria-pressed"],
    true,
  );
});

function dragEvent() {
  const payload = new Map<string, string>();
  return {
    preventDefault() {},
    dataTransfer: {
      effectAllowed: "all",
      dropEffect: "none",
      setData(type: string, value: string) {
        payload.set(type, value);
      },
      getData(type: string) {
        return payload.get(type) ?? "";
      },
    },
  };
}
function target(h: ReturnType<typeof harness>, date = "2026-10-20") {
  return h
    .render()
    .find(
      (n) =>
        n.props.className === "calendar-cell" &&
        nodes(n.props.children).some((child) => child.props["data-day"] === date),
    )!;
}
test("dragging a saved plan changes only its date through onPlan", () => {
  const h = harness();
  const event = dragEvent();
  const bubble = h.render().find((n) => n.props.className === "calendar-bubble")!;
  assert.equal(bubble.props.draggable, true);
  bubble.props.onDragStart(event);
  target(h).props.onDrop(event);
  assert.deepEqual(JSON.parse(JSON.stringify(h.plans)), [
    [h.id, 1, "2026-10-20", "instagram", { time: "09:00", timezone: "UTC" }],
  ]);
  assert.deepEqual(h.selected(), { month: "2026-10", activeId: h.id });
  assert.ok(h.render().some((n) => n.props.role === "status"));
  target(h).props.onDrop(event);
  assert.equal(h.plans.length, 1, "a consumed drag cannot be replayed");
});
test("external drops and stale, archived or unplanned items never call onPlan", () => {
  for (const invalid of ["external", "archived", "unplanned", "version", "forged", "ended"]) {
    const h = harness();
    const event = dragEvent();
    const bubble = h.render().find((n) => n.props.className === "calendar-bubble")!;
    if (invalid !== "external") bubble.props.onDragStart(event);
    if (invalid === "archived") h.items[0]!.archived = true;
    if (invalid === "unplanned") h.items[0]!.plan = null;
    if (invalid === "version") h.items[0]!.plan!.version = 999;
    if (invalid === "forged") event.dataTransfer.getData = () => "unknown-item";
    if (invalid === "ended") bubble.props.onDragEnd();
    target(h).props.onDrop(event);
    assert.equal(h.plans.length, 0, invalid);
  }
});
test("moving a date-only legacy plan does not invent channel, time or timezone", () => {
  const h = harness();
  h.items[0]!.plan = { date: "2026-11-01", version: 1 };
  const event = dragEvent();
  h.render()
    .find((n) => n.props.className === "calendar-bubble")!
    .props.onDragStart(event);
  target(h).props.onDrop(event);
  assert.equal(h.plans.length, 1);
  assert.equal(h.plans[0]![3], undefined);
  assert.deepEqual(Object.keys(h.plans[0]![4] as object), []);
});
test("failed or throwing onPlan reports an error without selecting the moved item", () => {
  for (const outcome of [false, new Error("save failed")]) {
    const h = harness(outcome);
    const event = dragEvent();
    h.render()
      .find((n) => n.props.className === "calendar-bubble")!
      .props.onDragStart(event);
    target(h).props.onDrop(event);
    assert.equal(h.selected().activeId, null);
    assert.ok(h.render().some((n) => n.props.role === "alert"));
    assert.ok(!h.render().some((n) => n.props.role === "status"));
  }
});
test("failed keyboard-accessible planning form stays open and reports the failure", () => {
  for (const outcome of [false, new Error("save failed")]) {
    const h = harness(outcome);
    h.render()
      .find((n) => n.props["aria-expanded"] === false)!
      .props.onClick();
    h.render()
      .find((n) => n.type === "select" && n.props.required)!
      .props.onChange({ target: { value: h.id } });
    h.render()
      .find((n) => n.type === "form")!
      .props.onSubmit({ preventDefault() {} });
    assert.ok(h.render().some((n) => n.type === "form"));
    assert.ok(h.render().some((n) => n.props.role === "alert"));
    assert.equal(h.selected().activeId, null);
  }
});
test("planning form persists native time input and cancel does not submit a plan", () => {
  const h = harness();
  h.render()
    .find((n) => n.props["aria-expanded"] === false)!
    .props.onClick();
  h.render()
    .find((n) => n.type === "select" && n.props.required)!
    .props.onChange({ target: { value: h.id } });
  h.render()
    .find((n) => n.props.type === "time")!
    .props.onInput({ currentTarget: { value: "14:30" } });
  h.render()
    .find((n) => n.props.children === "Cancelar")!
    .props.onClick();
  assert.equal(h.plans.length, 0);
  h.render()
    .find((n) => n.props["aria-expanded"] === false)!
    .props.onClick();
  h.render()
    .find((n) => n.type === "form")!
    .props.onSubmit({ preventDefault() {} });
  assert.equal(h.plans.length, 1);
  assert.equal((h.plans[0]![4] as { time: string }).time, "14:30");
});
