import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as quick from "../src/lib/quick-start.ts";
import * as preview from "../src/lib/brand-preview.ts";
import * as research from "../src/lib/brand-research.ts";
import * as sources from "../src/lib/brand-sources.ts";
import * as onboarding from "../src/lib/onboarding.ts";
import { parseStoredWorkspace } from "../src/lib/marketing-workspace.ts";

type Node = { type: unknown; props: Record<string, unknown> };
function nodes(value: unknown): Node[] {
  if (Array.isArray(value)) return value.flatMap(nodes);
  if (!value || typeof value !== "object" || !("props" in value)) return [];
  const node = value as Node;
  return [node, ...nodes(node.props.children)];
}
function harness(segment = "", offers = "", goals = "Atrair novos clientes") {
  let data = quick.demoSchema.parse({
    name: "Clínica Aurora",
    segment,
    answers: { audience: "Adultos da região", offers, goals },
    brand: { confirmed: true },
  });
  let cursor = 0;
  let scope = "parent";
  const state: Record<string, unknown[]> = { parent: [], chips: [] };
  const dependencies: Record<string, unknown> = {
    react: {
      useState(initial: unknown) {
        const values = state[scope]!;
        const index = cursor++;
        if (!(index in values)) values[index] = initial;
        return [values[index], (value: unknown) => (values[index] = value)];
      },
      useId: () => "area-error",
      useRef: () => ({ current: null }),
      useEffect() {},
      useLayoutEffect() {},
    },
    "react/jsx-runtime": {
      jsx: (type: unknown, props: Node["props"]) => ({ type, props }),
      jsxs: (type: unknown, props: Node["props"]) => ({ type, props }),
    },
    "lucide-react": {},
    "./quick-start-flow": {},
    "./brand-direction": {},
    "./brand-sources": {},
    "./research-suggestions": {},
    "@/lib/quick-start": quick,
    "@/lib/brand-preview": preview,
    "@/lib/brand-research": research,
    "@/lib/brand-sources": sources,
    "@/lib/onboarding": onboarding,
  };
  const exports = {} as { BrandOnboarding: (props: Record<string, unknown>) => Node };
  runInNewContext(
    ts.transpileModule(
      readFileSync(new URL("../src/components/brand-onboarding.tsx", import.meta.url), "utf8"),
      {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          jsx: ts.JsxEmit.ReactJSX,
          target: ts.ScriptTarget.ES2022,
        },
      },
    ).outputText,
    { exports, require: (id: string) => dependencies[id] },
  );
  let nextStep: number | undefined;
  function render(step = 1) {
    scope = "parent";
    cursor = 0;
    return nodes(
      exports.BrandOnboarding({
        step,
        data,
        onData: (update: quick.DemoData | ((current: quick.DemoData) => quick.DemoData)) => {
          data = typeof update === "function" ? update(data) : update;
        },
        onStep: (step: number) => {
          nextStep = step;
        },
        onResearch() {},
      }),
    );
  }
  function chips() {
    const child = render().find(
      (node) => typeof node.type === "function" && node.type.name === "AreaChips",
    )!;
    scope = "chips";
    cursor = 0;
    return nodes((child.type as (props: Node["props"]) => Node)(child.props));
  }
  function input() {
    return chips().find((node) => node.type === "input")!;
  }
  function type(value: string) {
    (input().props.onChange as (event: unknown) => void)({ target: { value } });
  }
  function key(value: string) {
    (input().props.onKeyDown as (event: unknown) => void)({ key: value, preventDefault() {} });
  }
  return {
    data: () => data,
    mutate: (update: (current: quick.DemoData) => void) => update(data),
    render,
    chips,
    input,
    type,
    key,
    nextStep: () => nextStep,
  };
}

test("area chips reject aggregate overflow, preserve pending text and expose an accessible error", () => {
  const ui = harness("a".repeat(110));
  ui.type("Cardiologia");
  ui.key("Enter");
  assert.equal(ui.data().segment, "a".repeat(110));
  assert.equal(ui.input().props.value, "Cardiologia");
  assert.equal(ui.input().props["aria-label"], "Adicionar área de atuação");
  assert.equal(ui.input().props["aria-invalid"], true);
  const error = ui.chips().find((node) => node.props.role === "alert")!;
  assert.ok(error);
  assert.equal(ui.input().props["aria-describedby"], error.props.id);
  assert.ok(parseStoredWorkspace(JSON.stringify({ data: ui.data(), revision: null, dirty: true })));
  (ui.input().props.onBlur as () => void)();
  assert.equal(ui.input().props.value, "Cardiologia");
  ui.type("Pilates");
  ui.key(",");
  assert.equal(ui.data().segment, `${"a".repeat(110)}, Pilates`);
  assert.equal(ui.input().props.value, "");
  assert.equal(ui.input().props["aria-invalid"], false);
});

test("area chips accept exactly 120 characters and deduplicate existing and pasted areas", () => {
  const boundary = harness("a".repeat(110));
  boundary.type("b".repeat(8));
  boundary.key("Enter");
  assert.equal(boundary.data().segment.length, 120);
  assert.equal(quick.demoSchema.safeParse(boundary.data()).success, true);
  const ui = harness("Pilates");
  ui.type("Pilates; Cardiologia; Cardiologia");
  ui.key("Enter");
  assert.equal(ui.data().segment, "Pilates, Cardiologia");
  assert.equal(ui.input().props.value, "");
});

test("Tab cannot accept an oversized area suggestion", () => {
  const ui = harness();
  ui.mutate((data) => {
    data.brand.referenceUrl = "https://clinic.example/";
    data.brand.research = preview.researchSchema.parse({
      status: "ready",
      sources: [
        {
          url: "https://clinic.example/",
          title: "Clínica",
          text: "a".repeat(121),
          fetchedAt: "2026-10-16",
        },
      ],
      suggestions: [
        {
          field: "segment",
          value: "a".repeat(121),
          quote: "a".repeat(121),
          sourceUrl: "https://clinic.example/",
          origin: "extracted",
        },
      ],
    });
  });
  assert.equal(research.allowedSuggestions(ui.data()).length, 1);
  ui.key("Tab");
  assert.equal(ui.data().segment, "");
  assert.equal(quick.demoSchema.safeParse(ui.data()).success, true);
});

for (const offers of ["", "Consulta confirmada"]) {
  test(`intent clicks preserve ${offers ? "existing" : "blank"} offers even with a research candidate`, () => {
    const ui = harness("Cardiologia", offers);
    ui.mutate((data) => {
      data.brand.referenceUrl = "https://clinic.example/";
      data.brand.research = preview.researchSchema.parse({
        status: "ready",
        sources: [
          {
            url: "https://clinic.example/",
            title: "Clínica",
            text: "Exame candidato",
            fetchedAt: "2026-10-16",
          },
        ],
        suggestions: [
          {
            field: "offers",
            value: "Exame candidato",
            quote: "Exame candidato",
            sourceUrl: "https://clinic.example/",
            origin: "extracted",
          },
        ],
      });
    });
    const card = ui.render(2).find((node) => node.props["data-intent"] === "trust")!;
    (card.props.onClick as () => void)();
    assert.equal(ui.data().answers.offers, offers);
    assert.equal(ui.data().answers.goals, "Fortalecer minha marca");
    assert.deepEqual(preview.selectedContentIntents(ui.data().brand), ["trust"]);
    assert.equal(ui.data().brand.research.suggestions[0]!.value, "Exame candidato");
  });
}

test("intent clicks preserve custom goals and do not derive an offer from the specialty", () => {
  const ui = harness("Cardiologia", "", "Orientar famílias sobre prevenção");
  (
    ui.render(2).find((node) => node.props["data-intent"] === "explain")!.props
      .onClick as () => void
  )();
  assert.equal(ui.data().answers.offers, "");
  assert.equal(ui.data().answers.goals, "Orientar famílias sobre prevenção");
});

test("onboarding can continue and finish with an offer deferred, while still requiring an intent", () => {
  const ui = harness("Cardiologia");
  const submit = (step: number) => {
    const form = ui.render(step).find((node) => node.type === "form")!;
    (form.props.onSubmit as (event: unknown) => void)({ preventDefault() {} });
  };
  submit(2);
  assert.equal(ui.nextStep(), undefined);
  (
    ui.render(2).find((node) => node.props["data-intent"] === "trust")!.props.onClick as () => void
  )();
  assert.equal(ui.data().answers.offers, "");
  submit(2);
  assert.equal(ui.nextStep(), 3);
  submit(3);
  assert.equal(ui.nextStep(), 6);
  assert.equal(ui.data().answers.offers, "");
  assert.equal(ui.data().onboarded, true);
});
