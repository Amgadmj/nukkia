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
import { suggestionSchema } from "../src/lib/brand-preview.ts";
import { demoSchema } from "../src/lib/quick-start.ts";
import { applyResearchSuggestion } from "../src/lib/brand-research.ts";
const exports: Record<string, react.ComponentType<Record<string, unknown>>> = {};
runInNewContext(
  ts.transpileModule(
    readFileSync(new URL("../src/components/research-suggestions.tsx", import.meta.url), "utf8"),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } },
  ).outputText,
  {
    exports,
    require: (id: string) =>
      ({ "react/jsx-runtime": jsx, react: react, "lucide-react": icons })[id],
    Date,
  },
);
test("suggestions expose evidence, collection date and historical warning, never an invented confidence percentage", () => {
  const $ = load(
    renderToStaticMarkup(
      react.createElement(exports.ResearchSuggestions!, {
        onUse: () => {},
        suggestions: [
          {
            field: "offers",
            value: "Aulas em grupo",
            sourceUrl: "https://marca.com/oferta",
            quote: "Campanha de março de 2026: aulas em grupo",
            kind: "past-campaign",
            origin: "ai",
            confidence: "medium",
            foundAt: "2026-09-24T12:00:00Z",
            publishedAt: "março de 2026",
            rationale: "Pode ser adaptada com novas condições.",
          },
        ],
      }),
    ),
  );
  assert.equal($("button").length, 1);
  assert.equal($("a").attr("href"), "https://marca.com/oferta");
  assert.match($.text(), /Campanha anterior/);
  assert.match($.text(), /março de 2026/);
  assert.match($.text(), /24\/09\/2026/);
  assert.match($.text(), /vigência/i);
  assert.doesNotMatch($.text(), /\d+% de confiança/);
  assert.equal($("details").length, 0);
});

const suggestions = [
  { field: "offers", value: "Programa de exercícios personalizado" },
  { field: "detail", value: "Acompanhamento individual" },
  { field: "faq", value: "Preciso ter experiência?" },
].map((item) =>
  suggestionSchema.parse({
    ...item,
    sourceUrl: "https://marca.com/servicos",
    quote: item.value,
    origin: "ai",
    foundAt: "2026-09-24T12:00:00Z",
  }),
);
const render = (props: Record<string, unknown> = {}) =>
  load(
    renderToStaticMarkup(
      react.createElement(exports.ResearchSuggestions!, {
        suggestions,
        onUse() {},
        compact: true,
        ...props,
      }),
    ),
  );

test("compact groups show one shared sparkle and direct choices without repeated source metadata", () => {
  const $ = render();
  assert.equal($("svg.lucide-sparkles").length, 1);
  assert.equal($("button").length, 3);
  assert.equal($("a").length, 0);
  assert.equal($(".research-suggestion-kind, .research-suggestion-source").length, 0);
  assert.deepEqual(
    $("button")
      .map((_, el) => $(el).text())
      .get(),
    [
      "Programa de exercícios personalizado",
      "Acompanhamento individual",
      "Preciso ter experiência?",
    ],
  );
  assert.equal($("details, blockquote").length, 0);
});

test("a compact subtitle stays short while selecting the complete verified offer", () => {
  const fullOffer = "Programa de exercícios personalizado com acompanhamento individual";
  const titledOffer = suggestionSchema.parse({
    field: "offers",
    title: "Exercícios personalizados",
    value: fullOffer,
    quote: fullOffer,
    sourceUrl: "https://marca.com/servicos",
    origin: "ai",
  });
  const $ = render({ suggestions: [titledOffer] });
  assert.equal($("button").text(), "Exercícios personalizados");
  assert.doesNotMatch($("button").text(), /acompanhamento individual/);

  let selected = "";
  const tree = elements(
    exports.ResearchSuggestions!({
      suggestions: [titledOffer],
      compact: true,
      onUse: (item) => {
        selected = item.value;
      },
    }) as react.ReactNode,
  );
  const button = tree.find((element) => element.type === "button");
  (button!.props.onClick as () => void)();
  assert.equal(selected, fullOffer);
});

test("compact suggestions retain historical and inference warnings outside closed explanations", () => {
  const $ = render({
    suggestions: [
      { ...suggestions[0], kind: "past-campaign", publishedAt: "março de 2026" },
      { ...suggestions[1], kind: "opportunity", confidence: "low" },
    ],
    confirmedValue: suggestions[0].value,
  });
  const visible = $.root().clone();
  visible.find("details").remove();
  assert.match(visible.text(), /Campanha anterior/);
  assert.match(visible.text(), /vigência/i);
  assert.match(visible.text(), /Hipótese de público/);
  assert.equal($("svg.lucide-sparkles").length, 1);
});

function elements(node: react.ReactNode): react.ReactElement<Record<string, unknown>>[] {
  return react.Children.toArray(node).flatMap((child) => {
    if (!react.isValidElement<Record<string, unknown>>(child)) return [];
    return [child, ...elements(child.props.children as react.ReactNode)];
  });
}

test("compact choice buttons fill the matching field without submitting or confirming an offer", () => {
  let data = demoSchema.parse({ name: "Marca", answers: {} });
  const onUse = (item: (typeof suggestions)[number]) => {
    data = applyResearchSuggestion(data, item);
  };
  const tree = elements(
    exports.ResearchSuggestions!({ suggestions, onUse, compact: true }) as react.ReactNode,
  );
  const buttons = tree.filter((el) => el.type === "button");
  assert.equal(buttons.length, 3);
  for (const button of buttons) {
    assert.equal(button.props.type, "button");
    (button.props.onClick as () => void)();
  }
  assert.equal(data.answers.offers, "Programa de exercícios personalizado");
  assert.equal(data.brand.detail, "Acompanhamento individual");
  assert.equal(data.brand.customerQuestion, "Preciso ter experiência?");
  assert.equal(data.brand.offerReviewRequired, true);
  const $ = render({ selectedValue: data.answers.offers });
  assert.equal($("button[aria-pressed='true']").length, 1);
  assert.equal($("button[aria-pressed='true']").text(), "Programa de exercícios personalizado");
});

test("empty compact groups render no decorative icon or empty choices", () => {
  const $ = render({ suggestions: [] });
  assert.equal($("svg, button, details").length, 0);
});

test("a long FAQ remains selected after applying the question field limit", () => {
  const faq = suggestionSchema.parse({ ...suggestions[2], value: "Como funciona? ".repeat(20) });
  const data = applyResearchSuggestion(demoSchema.parse({ name: "Marca", answers: {} }), faq);
  assert.equal(data.brand.customerQuestion.length, 240);
  const $ = render({ suggestions: [faq], selectedValue: data.brand.customerQuestion });
  assert.equal($("button[aria-pressed='true']").length, 1);
  assert.equal($("article[data-selected='true']").length, 1);
});
