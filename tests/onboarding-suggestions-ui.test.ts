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

const modules: Record<string, unknown> = {
  react,
  "react/jsx-runtime": jsx,
  "lucide-react": icons,
  "@/lib/quick-start": quick,
  "@/lib/brand-preview": preview,
  "@/lib/brand-research": research,
  "@/lib/brand-sources": sources,
  "@/lib/onboarding": onboarding,
  "./quick-start-flow": { OnboardingMark: () => null },
  "./content-recommendation": { ContentRecommendation: () => null },
};
function componentModule(file: string) {
  const exports: Record<string, react.ComponentType<Record<string, unknown>>> = {};
  runInNewContext(
    ts.transpileModule(
      readFileSync(new URL(`../src/components/${file}.tsx`, import.meta.url), "utf8"),
      { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } },
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
const notice =
  "Encontramos textos de exemplo no site e os excluímos da leitura. Confirme as informações da marca antes de usar.";
function render(
  step: number,
  message = "",
  researchPatch: Partial<quick.DemoData["brand"]["research"]> = {},
) {
  const data = quick.demoSchema.parse({
    name: "Marca",
    answers: {},
    brand: {
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
    },
  });
  return load(
    renderToStaticMarkup(
      react.createElement(component, { step, data, onData() {}, onStep() {}, onResearch() {} }),
    ),
  );
}

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

test("brief uses compact suggestions for offer, detail and FAQ, directly after their fields", () => {
  const $ = render(2);
  assert.equal($(".research-suggestions-compact").length, 3);
  for (const name of [
    "Qual oferta vamos apresentar?",
    "Um detalhe verdadeiro que vale destacar",
    "Uma dúvida que você costuma ouvir",
  ]) {
    const field = $("label").filter((_, el) => $(el).text().startsWith(name));
    assert.equal(field.next().is(".research-suggestions-compact"), true, name);
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
    "Conferi os links e confirmo que pertencem à minha marca.",
  );
});
