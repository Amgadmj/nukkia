import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as preview from "../src/lib/brand-preview.ts";
import * as art from "../src/lib/post-art.ts";
import * as quick from "../src/lib/quick-start.ts";
import * as workspace from "../src/lib/marketing-workspace.ts";
import * as onboarding from "../src/lib/onboarding.ts";
import * as research from "../src/lib/brand-research.ts";

type Element = {
  type: unknown;
  props: Record<string, unknown> & {
    children?: unknown;
    onClick?: () => void;
    onChange?: (event: { target: { value: string } }) => void;
    onSubmit?: (event: { preventDefault: () => void }) => void;
  };
};
const isElement = (v: unknown): v is Element => !!v && typeof v === "object" && "props" in v;
const nodes = (v: unknown): Element[] =>
  Array.isArray(v) ? v.flatMap(nodes) : isElement(v) ? [v, ...nodes(v.props.children)] : [];
const text = (v: unknown): string =>
  Array.isArray(v)
    ? v.map(text).join("")
    : isElement(v)
      ? text(v.props.children)
      : typeof v === "string"
        ? v
        : "";
function harness() {
  const actions: string[] = [];
  const cells: unknown[] = [];
  let cursor = 0;
  let data = quick.demoSchema.parse({
    name: "Movitta",
    segment: "Fisioterapia",
    onboarded: true,
    answers: { offers: "Exercícios", audience: "Adultos", goals: "Atrair novos clientes" },
    brand: {
      confirmed: true,
      detail: "Acompanhamento da equipe.",
      visualStyle: "essential",
      identityConfirmed: true,
    },
  });
  const exports: Record<string, (p: Record<string, unknown>) => Element> = {};
  const modules: Record<string, unknown> = {
    react: {
      useState(initial: unknown) {
        const index = cursor++;
        if (!(index in cells)) cells[index] = initial;
        return [
          cells[index],
          (value: unknown) => {
            cells[index] = typeof value === "function" ? value(cells[index]) : value;
          },
        ];
      },
      useEffect() {},
      useRef: (v: unknown) => ({ current: v }),
    },
    "react/jsx-runtime": {
      jsx: (type: unknown, props: object) => ({ type, props }),
      jsxs: (type: unknown, props: object) => ({ type, props }),
    },
    "lucide-react": {},
    "@/lib/brand-preview": preview,
    "@/lib/quick-start": quick,
    "@/lib/marketing-workspace": workspace,
    "@/lib/onboarding": onboarding,
    "@/lib/post-art": art,
    "@/lib/brand-research": research,
    "./brand-onboarding": {},
    "./brand-sources": {},
    "./research-suggestions": {},
    "./brand-direction": {},
    "./channel-recommendations": { ChannelRecommendations: "channel-recommendations" },
  };
  runInNewContext(
    ts.transpileModule(
      readFileSync(new URL("../src/components/marketing-views.tsx", import.meta.url), "utf8"),
      { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } },
    ).outputText,
    {
      exports,
      crypto: { randomUUID: () => "hypothesis-1" },
      require: (id: string) => {
        if (!(id in modules)) throw new Error(id);
        return modules[id];
      },
    },
  );
  return {
    data: () => data,
    actions,
    render(name = "BrandBrain") {
      cursor = 0;
      return nodes(
        exports[name]!({
          data,
          onData: (fn: (d: typeof data) => typeof data) => {
            data = fn(data);
          },
          onSection(section: string) {
            actions.push(section);
          },
          onEditBrief() {
            actions.push("editor");
          },
        }),
      );
    },
  };
}

test("demo channels use edited public references without reviving an excluded legacy handle", () => {
  const app = harness();
  app.data().answers.instagram = "@antigo";
  app.data().brand.extraLinks = ["https://instagram.com/atual", "https://facebook.com/aurora"];
  app.data().brand.excludedReferences = ["instagram.com/antigo"];
  const content = text(app.render("LocalChannels"));
  assert.ok(content.includes("instagram.com/atual"));
  assert.ok(content.includes("facebook.com/aurora"));
  assert.ok(!content.includes("@antigo"));
  assert.ok(!content.includes("Conta conectada"));
});

test("the brain lets a user create and revise a hypothesis without replacing brand facts", () => {
  const app = harness();
  app.render().find((n) => n.props.role === "tab" && text(n) === "Hipóteses")!.props.onClick!();
  const create = app.render().find((n) => n.type === "button" && text(n).includes("Nova hipótese"));
  assert.ok(create, "Hypotheses need a real creation action, not only suggestions");
  create.props.onClick!();
  app.render().find((n) => n.type === "textarea")!.props.onChange!({
    target: { value: "Mostrar a equipe pode aumentar os contatos." },
  });
  app.render().find((n) => n.type === "form")!.props.onSubmit!({ preventDefault() {} });
  assert.equal(app.data().hypotheses.length, 1);
  assert.equal(app.data().answers.offers, "Exercícios");
  app.render().find((n) => n.type === "button" && n.props["aria-label"] === "Editar hipótese")!
    .props.onClick!();
  app.render().find((n) => n.type === "textarea")!.props.onChange!({
    target: { value: "Mostrar o atendimento pode reduzir dúvidas." },
  });
  app.render().find((n) => n.type === "form")!.props.onSubmit!({ preventDefault() {} });
  assert.equal(app.data().hypotheses.length, 1);
  assert.equal(app.data().hypotheses[0].text, "Mostrar o atendimento pode reduzir dúvidas.");
});

test("dashboard opens diagnosis directly and defers channel recommendations until it is complete", () => {
  const app = harness();
  const tree = app.render("WorkspaceOverview");
  const diagnostic = tree.find(
    (n) => n.type === "button" && text(n).includes("Continuar diagnóstico"),
  );
  assert.ok(diagnostic, "a setup account must have an actionable diagnosis priority");
  diagnostic.props.onClick!();
  assert.deepEqual(app.actions, ["editor"]);
  assert.equal(
    tree.some((n) => n.type === "button" && text(n).includes("Ver recomendações")),
    false,
  );
});

test("trail completed sections carry explicit completion state instead of decorative ordinals", () => {
  const tree = harness().render("DeliveryJourney");
  assert.equal(
    tree.filter((n) => String(n.props.className).includes("workspace-phase-number")).length,
    0,
  );
  assert.equal(
    tree.filter((n) => n.type === "section" && n.props["data-complete"] === true).length,
    1, // Identity is complete; diagnosis still lacks challenge and metric.
  );
  const progress = tree.find((n) => n.type === "progress")!;
  assert.equal(progress.props.value, 3);
  assert.equal(progress.props.max, 5);
});
