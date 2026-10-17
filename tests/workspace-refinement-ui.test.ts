import * as serviceBriefDomain from "../src/lib/service-brief.ts";
import { saveLibraryVersion } from "../src/lib/content-library.ts";
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
    "@tanstack/react-router": { useBlocker() {} },
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
      useId: () => "trail-test",
      useEffect() {},
      useRef: (v: unknown) => ({ current: v }),
    },
    "@/lib/service-brief": serviceBriefDomain,
    "react/jsx-runtime": {
      jsx: (type: unknown, props: object) => ({ type, props }),
      jsxs: (type: unknown, props: object) => ({ type, props }),
    },
    "./inspiration-board": { InspirationBoard: "inspiration-board" },
    "@/components/inspiration-board": { InspirationBoard: "inspiration-board" },
    "./workspace-services": { WorkspaceServices: "workspace-services" },
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
          onChooseApproach(approach?: string) {
            actions.push(approach ? `approaches:${approach}` : "approaches");
          },
          onResumeSaved(id: string, version: number) {
            actions.push(`${id}:${version}`);
          },
          onEditPiece() {
            actions.push("image");
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

test("the initial Brain hides hypothesis editing without deleting saved hypotheses", () => {
  const app = harness();
  app.data().hypotheses = [
    { id: "saved-hypothesis", text: "Uma hipótese guardada", source: "user" },
  ];
  const before = JSON.stringify(app.data().hypotheses);
  const tree = app.render();
  assert.equal(
    tree.some((n) => n.props.role === "tab" && text(n) === "Hipóteses"),
    false,
  );
  assert.equal(JSON.stringify(app.data().hypotheses), before);
  assert.ok(tree.some((n) => n.props.role === "tab" && text(n) === "Referências do site"));
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

test("dashboard leads with diagnosis and hides secondary panels without deleting saved work", () => {
  const app = harness();
  const before = JSON.stringify(app.data());
  const tree = app.render("WorkspaceOverview");
  const firstButton = tree.find((n) => n.type === "button")!;
  assert.match(text(firstButton), /Concluir diagnóstico da marca/);
  firstButton.props.onClick!();
  assert.deepEqual(app.actions, ["editor"]);
  assert.doesNotMatch(
    text(tree),
    /Seus rascunhos|Prioridades|Em andamento|OBJETIVO DA MARCA|Seus resultados começam/,
  );
  assert.equal(JSON.stringify(app.data()), before);
});

test("journey puts identity before channels and exposes chronological production tasks", () => {
  const tree = harness().render("DeliveryJourney");
  const copy = text(tree);
  assert.ok(copy.indexOf("Identidade da marca") < copy.indexOf("Canais e presença digital"));
  for (const label of [
    "Gerar o cronograma mensal",
    "Revisar o cronograma",
    "Aprovar a peça completa",
    "Planejar a data de publicação",
  ])
    assert.ok(copy.includes(label), label);
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

test("home creation cards route video to scenes and image to a new piece brief", () => {
  const app = harness();
  let tree = app.render("WorkspaceOverview");
  tree.find((n) => n.type === "button" && n.props["aria-label"] === "Criar roteiro de vídeo")!.props
    .onClick!();
  tree = app.render("WorkspaceOverview");
  tree.find((n) => n.type === "button" && n.props["aria-label"] === "Criar imagem")!.props
    .onClick!();
  assert.deepEqual(app.actions, ["conteudo", "approaches:invite"]);
  assert.equal(app.data().name, "Movitta");
});

test("home hides the drafts section while retaining every saved library version", () => {
  const app = harness();
  app.data().brand.creative = preview.composeContent(app.data(), "invite");
  Object.assign(app.data(), saveLibraryVersion(app.data(), "generic"));
  const before = JSON.stringify(app.data().library);
  assert.doesNotMatch(text(app.render("WorkspaceOverview")), /Seus rascunhos|Retomar versão/);
  assert.equal(JSON.stringify(app.data().library), before);
});

test("home carousel choice selects an educational approach without replacing the draft", () => {
  const app = harness();
  app.data().brand.creative = preview.composeContent(app.data(), "invite");
  app.data().brand.creative!.copy.title = "Texto humano preservado";
  const before = JSON.stringify(app.data());
  const action = app
    .render("WorkspaceOverview")
    .find((n) => n.type === "button" && n.props["aria-label"] === "Criar carrossel");
  assert.ok(action, "The accepted carousel format needs a working entry");
  action.props.onClick!();
  assert.deepEqual(app.actions, ["approaches:educate"]);
  assert.equal(JSON.stringify(app.data()), before);
});

test("dashboard navigation never overwrites saved snapshots with unsaved editor changes", () => {
  const app = harness();
  app.data().brand.creative = preview.composeContent(app.data(), "invite");
  app.data().brand.creative!.copy.title = "Versão guardada QA";
  Object.assign(app.data(), saveLibraryVersion(app.data(), "generic"));
  app.data().brand.creative!.copy.title = "Alteração ainda não guardada";
  const before = JSON.stringify(app.data().library);
  const tree = app.render("WorkspaceOverview");
  tree.find((n) => n.type === "button" && text(n).includes("Concluir diagnóstico da marca"))!.props
    .onClick!();
  assert.equal(JSON.stringify(app.data().library), before);
  assert.match(JSON.stringify(app.data().library), /Versão guardada QA/);
});

test("trail dots reveal explanations without navigating or changing saved progress", () => {
  const app = harness();
  const before = JSON.stringify(app.data());
  let tree = app.render("DeliveryJourney");
  const dots = tree.filter((n) => n.type === "button" && n.props["aria-expanded"] !== undefined);
  assert.equal(dots.length, 5);
  const identity = dots.find((n) => text(n).includes("Identidade da marca"))!;
  identity.props.onClick!();
  tree = app.render("DeliveryJourney");
  const selected = tree.find((n) => n.type === "button" && n.props["aria-expanded"] === true)!;
  assert.match(text(selected), /Identidade da marca/);
  const panel = tree.find((n) => n.props.id === selected.props["aria-controls"])!;
  assert.ok(panel);
  const bullets = nodes(panel).filter((n) => n.type === "li");
  assert.ok(bullets.length >= 2 && bullets.length <= 3);
  assert.match(text(panel), /Cores, estilo e materiais/);
  assert.deepEqual(app.actions, []);
  assert.equal(JSON.stringify(app.data()), before);
  nodes(panel).find((n) => n.type === "button" && text(n).includes("Escolher uma direção"))!.props
    .onClick!();
  assert.deepEqual(app.actions, ["marca"]);
});

test("manual onboarding does not claim a site has been analyzed", () => {
  const app = harness();
  app.data().brand.research.sources = [];
  assert.doesNotMatch(text(app.render("WorkspaceOverview")), /Seu site já trouxe/);
});

test("home no longer duplicates the section title and workspace brand", () => {
  const tree = harness().render("WorkspaceOverview");
  assert.equal(tree.filter((n) => n.type === "h1" && text(n) === "Meu painel").length, 0);
  assert.equal(tree.filter((n) => n.props.className === "command-heading").length, 0);
});
