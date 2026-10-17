import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as react from "react";
import * as jsx from "react/jsx-runtime";
import * as icons from "lucide-react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import * as quick from "../src/lib/quick-start.ts";
import * as preview from "../src/lib/brand-preview.ts";
import * as research from "../src/lib/brand-research.ts";
import * as sources from "../src/lib/brand-sources.ts";
import * as onboarding from "../src/lib/onboarding.ts";
import * as palettes from "../src/lib/identity-palette.ts";

const modules: Record<string, unknown> = {
  react,
  "react/jsx-runtime": jsx,
  "lucide-react": icons,
  "@/lib/quick-start": quick,
  "@/lib/brand-preview": preview,
  "@/lib/brand-research": research,
  "@/lib/brand-sources": sources,
  "@/lib/onboarding": onboarding,
  "@/lib/identity-palette": palettes,
  "./quick-start-flow": { OnboardingMark: () => null },
  "./content-recommendation": { ContentRecommendation: () => null },
};
function componentModule(file: string) {
  const exports: Record<string, react.ComponentType<Record<string, unknown>>> = {};
  runInNewContext(
    ts.transpileModule(
      readFileSync(new URL(`../src/components/${file}.tsx`, import.meta.url), "utf8"),
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
        if (!(id in modules)) throw new Error(id);
        return modules[id];
      },
    },
  );
  return exports;
}
modules["./brand-sources"] = componentModule("brand-sources");
modules["./research-suggestions"] = componentModule("research-suggestions");
modules["./brand-direction"] = componentModule("brand-direction");
const component = componentModule("brand-onboarding").BrandOnboarding!;
test("onboarding provides official transparent symbols for both light and dark surfaces", () => {
  const mark = componentModule("quick-start-flow").OnboardingMark!;
  const $ = load(renderToStaticMarkup(react.createElement(mark)));
  assert.equal($("img.quick-mark-light[src='/nukkia-mark.png']").length, 1);
  assert.equal($("img.quick-mark-dark[src='/nukkia-mark-white.png']").length, 1);
});
const notice =
  "Encontramos textos de exemplo no site e os excluímos da leitura. Confirme as informações da marca antes de usar.";
function render(
  step: number,
  message = "",
  researchPatch: Partial<quick.DemoData["brand"]["research"]> = {},
  brandPatch: Partial<quick.DemoData["brand"]> = {},
) {
  const data = quick.demoSchema.parse({
    name: "Marca",
    segment: "Análises clínicas",
    answers: { audience: "Pessoas da região" },
    brand: {
      confirmed: step > 1,
      contentIntent: "service",
      referenceUrl: "https://marca.com",
      research: {
        message,
        suggestions: [
          {
            field: "offers",
            value: "Programa personalizado",
            quote: "Programa personalizado",
            sourceUrl: "https://marca.com",
            origin: "ai",
          },
          {
            field: "detail",
            value: "Grupos pequenos",
            quote: "Grupos pequenos",
            sourceUrl: "https://marca.com",
            origin: "ai",
          },
          {
            field: "faq",
            value: "Preciso de experiência?",
            quote: "Preciso de experiência?",
            sourceUrl: "https://marca.com",
            origin: "ai",
          },
        ],
        ...researchPatch,
      },
      ...brandPatch,
    },
  });
  return load(
    renderToStaticMarkup(
      react.createElement(component, { step, data, onData() {}, onStep() {}, onResearch() {} }),
    ),
  );
}

test("context exposes sourced clinic suggestions for name, areas and audience", () => {
  const $ = render(1, "", {
    suggestions: [
      {
        field: "name",
        value: "Hospital Israelita Albert Einstein",
        quote: "Hospital Israelita Albert Einstein",
        sourceUrl: "https://www.einstein.br/",
      },
      {
        field: "segment",
        value: "Hospital, saúde e pesquisa",
        quote: "Hospital, saúde e pesquisa",
        sourceUrl: "https://www.einstein.br/",
      },
      {
        field: "audience",
        value: "Pessoas que buscam atendimento hospitalar e cuidado em saúde",
        quote: "atendimento hospitalar e cuidado em saúde",
        rationale: "O site apresenta serviços de cuidado em saúde.",
        kind: "opportunity",
        sourceUrl: "https://www.einstein.br/",
      },
    ],
  });
  assert.match($.text(), /Nome da clínica/);
  assert.match($.text(), /Áreas de atuação/);
  assert.equal($(".research-suggestions-compact").length, 3);
  assert.equal($(".clinic-name-field .research-suggestions-compact").length, 1);
  assert.equal($(".clinic-areas-field .research-suggestions-compact").length, 1);
  assert.equal($(".segment-chip-control .segment-chip").length, 1);
  assert.equal($(".segment-chip-control input").length, 1);
  assert.match($(".segment-chip-input input").attr("placeholder") ?? "", /Digite uma área/);
});

test("onboarding retains sources without exposing the research document", () => {
  const $ = render(1, "", {
    status: "ready",
    phase: "complete",
    evidenceMarkdown: "# Pesquisa preservada",
    sources: [
      {
        url: "https://marca.com/",
        title: "Clínica QA",
        text: "Análises clínicas",
        fetchedAt: "2026-10-16",
      },
    ],
  });
  assert.match($.text(), /Links da sua clínica/);
  assert.equal($(".brand-source-evidence").length, 0);
  assert.equal($("a[download='perfil-clinica-evidencias.md']").length, 0);
  const sourceReview = load(
    renderToStaticMarkup(
      react.createElement(componentModule("brand-sources").BrandSources!, {
        research: preview.researchSchema.parse({
          status: "ready",
          evidenceMarkdown: "# Pesquisa preservada",
          sources: [
            {
              url: "https://marca.com/",
              title: "Clínica QA",
              text: "Análises clínicas",
              fetchedAt: "2026-10-16",
            },
          ],
        }),
      }),
    ),
  );
  assert.equal(
    sourceReview("a[download='perfil-clinica-evidencias.md']").length,
    1,
    "later source review can still export the retained evidence",
  );
});

test("processing hides all profile fields and disables human confirmation", () => {
  const $ = render(1, "", { status: "loading", phase: "synthesizing" });
  assert.match($.text(), /Processando nome, áreas de atuação e público/);
  assert.equal($("input.quick-input, textarea").length, 0);
  assert.equal($("button[type='submit']").is("[disabled]"), true);
});

test("a direct later-step URL exposes profile review until the owner confirms", () => {
  const $ = render(2, "", {}, { confirmed: false });
  assert.equal($("input[name='content-intent']").length, 0);
  assert.match($.text(), /Nome da clínica/);
});

test("content intentions use four toggle buttons, expressive icons and no radio circles", () => {
  const $ = render(2);
  assert.equal($(".content-intent-card[aria-pressed]").length, 4);
  assert.equal($(".content-intent-card input").length, 0);
  assert.equal($(".content-intent-icon").length, 4);
  assert.equal($(".content-intent-card img").length, 0);
  assert.match($.text(), /Apresentar um serviço/);
  assert.match($.text(), /Explicar serviços/);
  assert.match($.text(), /Fortalecer Marca/);
  assert.match($.text(), /Convidar para agendar/);
});

test("the simplified brief exposes patient questions without a disclosure or action question", () => {
  const $ = render(2);
  assert.equal($("details").filter((_, el) => /Uma dúvida/.test($(el).text())).length, 0);
  assert.doesNotMatch(
    $.text(),
    /Qual serviço vamos apresentar\?|O que a pessoa deve fazer depois\?|Escolha uma sugestão do perfil/,
  );
  assert.doesNotMatch(
    $.text(),
    /Seu primeiro foco|Assunto selecionado:|Como sua equipe responde\?/,
  );
  assert.match($.text(), /Um detalhe importante que vale destacar/);
  assert.match($.text(), /Canal preferido de atendimento/);
});

test("context removes nonblocking extraction detail while a partial-reading warning stays visible", () => {
  const partial = "A leitura ficou parcial; preservamos as fontes disponíveis até a interrupção.";
  const $ = render(1, `${notice} ${partial}`);
  assert.doesNotMatch($.text(), /Encontramos textos de exemplo/);
  assert.doesNotMatch($.text(), /Por que sugerimos isso\?/);
  assert.equal($("[role='status']").text().trim(), partial);
  const later = render(2, notice);
  assert.doesNotMatch(later.text(), /Encontramos textos de exemplo/);
});

test("collection failures are not hidden with nonblocking details", () => {
  const failure = "Não foi possível concluir a leitura. Continue manualmente ou tente novamente.";
  const $ = render(1, failure);
  assert.equal($("[role='status']").text().trim(), failure);
});

test("brief keeps detail and FAQ suggestions without repeating offer summaries", () => {
  const $ = render(2);
  assert.equal($(".research-suggestions-compact").length, 2);
  for (const name of [
    "Um detalhe importante que vale destacar",
    "Uma dúvida que você costuma ouvir",
  ]) {
    const field = $("label").filter((_, el) => $(el).text().startsWith(name));
    assert.equal(field.nextAll(".research-suggestions-compact").length > 0, true, name);
  }
});

test("reference confirmation replaces the generic instruction below the editable links", () => {
  const $ = render(1, "", {
    sources: [
      {
        url: "https://marca.com",
        title: "Marca",
        text: "Aulas de pilates.",
        fetchedAt: "2026-09-24T12:00:00Z",
      },
    ],
  });
  assert.equal($(".brand-sources-note").length, 0);
  assert.equal(
    $(".brand-sources").nextAll(".research-check").first().text().trim(),
    "Conferi os links e confirmo que pertencem à minha clínica.",
  );
});

test("website entry accepts domain text and offers a dedicated no-website path", () => {
  const $ = render(0);
  assert.equal($('input[placeholder="suaclinica.com.br"]').attr("type"), "text");
  assert.equal($('input[placeholder="suaclinica.com.br"]').attr("inputmode"), "url");
  assert.equal($("button").filter((_, el) => $(el).text() === "Não tenho site").length, 1);
});
test("brand direction shows an editable brand system instead of example posts", () => {
  const $ = render(3);
  assert.match($.text(), /Sistema da marca/);
  assert.match($.text(), /Paleta/);
  assert.match($.text(), /Tipografia/);
  assert.equal($(".direction-art").length, 0);
  assert.equal($('input[type="color"]').length, 3);
});

test("native palette input saves its value before blur", () => {
  type Node = { type: unknown; props: Record<string, unknown> };
  const find = (value: unknown): Node[] => {
    if (Array.isArray(value)) return value.flatMap(find);
    if (!value || typeof value !== "object" || !("props" in value)) return [];
    const node = value as Node;
    return [node, ...find(node.props.children)];
  };
  const direction = componentModule("brand-direction").BrandDirection as (
    props: Record<string, unknown>,
  ) => unknown;
  let saved = "";
  const tree = direction({
    data: quick.demoSchema.parse({ name: "QA", answers: {} }),
    selected: "dynamic",
    onSelect() {},
    onCorrect() {},
    onAccent(value: string) {
      saved = value;
    },
  });
  const input = find(tree).find((node) => node.type === "input" && node.props.type === "color")!;
  assert.equal(typeof input.props.onInput, "function");
  (input.props.onInput as (event: { currentTarget: { value: string } }) => void)({
    currentTarget: { value: "#006c72" },
  });
  assert.equal(saved, "#006c72");
});
