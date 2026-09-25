import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as react from "react";
import * as jsx from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import * as icons from "lucide-react";
import { load } from "cheerio";
import { researchSchema } from "../src/lib/brand-preview.ts";
import * as sources from "../src/lib/brand-sources.ts";

const dependencies: Record<string, unknown> = {
  "react/jsx-runtime": jsx,
  "lucide-react": icons,
  "@/lib/brand-sources": sources,
};
const exports: Record<string, react.ComponentType<Record<string, unknown>>> = {};
runInNewContext(
  ts.transpileModule(
    readFileSync(new URL("../src/components/brand-sources.tsx", import.meta.url), "utf8"),
    {
      compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
    },
  ).outputText,
  {
    exports,
    require: (id: string) => {
      if (!(id in dependencies)) throw new Error(`Unexpected dependency ${id}`);
      return dependencies[id];
    },
  },
);

const research = researchSchema.parse({
  sources: ["/", "/about", "/services"].map((path) => ({
    url: "https://brand.com" + path,
    title: "Página da marca",
    text: "Longo texto bruto com aviso de cookies",
    fetchedAt: "2026-09-24T12:00:00Z",
  })),
  discoveredLinks: [{ url: "https://instagram.com/brand", foundOn: "https://brand.com/" }],
});
const render = (extra = {}) =>
  load(renderToStaticMarkup(react.createElement(exports.BrandSources!, { research, ...extra })));

test("onboarding shows compact clickable identities without page details or analysis claims", () => {
  const $ = render();
  assert.equal($(".brand-source-item").length, 2);
  assert.equal($(".brand-source-item").first().text(), "brand.com");
  assert.equal($(".brand-source-item").last().text(), "@brand");
  assert.equal($("details").length, 0);
  assert.equal($("a").length, 2);
  assert.doesNotMatch($.text(), /Longo texto bruto|páginas lidas|Link encontrado|não lido/);
  assert.equal(
    $(".brand-sources-note").text(),
    "Confira se estes endereços pertencem à sua marca.",
  );
  assert.equal(
    $("a[aria-label='Abrir Instagram: @brand']").attr("href"),
    "https://instagram.com/brand",
  );
  assert.equal($("a[aria-label='Abrir Site: brand.com']").attr("href"), "https://brand.com/");
  for (const link of $("a").toArray()) {
    assert.equal($(link).attr("target"), "_blank");
    assert.match($(link).attr("rel") ?? "", /noreferrer/);
  }
});

test("Brain retains full evidence on demand while post provenance excludes unread profiles", () => {
  const brain = render({ showMaterial: true });
  assert.equal(brain(".brand-source-evidence p").length, 3);
  assert.match(brain("details").text(), /Longo texto bruto/);
  assert.match(brain(".brand-source-item").first().text(), /3 páginas lidas/);
  assert.doesNotMatch(brain(".brand-source-item").last().text(), /página.*lida|analisad/);
  assert.doesNotMatch(brain.text(), /Link encontrado · não lido/);
  assert.equal(brain("details[open]").length, 0);
  const post = render({ includeDiscovered: false, extraLinks: ["https://manual.com/about"] });
  assert.equal(post(".brand-source-item").length, 1);
  assert.equal(post("a[href*='instagram.com']").length, 0);
  assert.equal(post("a[href*='manual.com']").length, 0);
});

test("the verification note is present even when every website has real evidence", () => {
  const $ = render({ research: { ...research, discoveredLinks: [] } });
  assert.equal(
    $(".brand-sources-note").text(),
    "Confira se estes endereços pertencem à sua marca.",
  );
});

test("manual references share rows with existing identities and excluded keys hide whole groups", () => {
  const $ = render({
    extraLinks: [
      "https://www.brand.com/contact",
      "https://instagram.com/BRAND/?igsh=123",
      "https://partner.com/services",
      "https://tiktok.com/@brand",
    ],
    excludedKeys: ["brand.com", "https://instagram.com/brand"],
  });
  assert.equal($(".brand-source-item").length, 2);
  assert.equal($(".brand-sources-heading span").text(), "2");
  assert.deepEqual(
    $(".brand-source-label a")
      .map((_, el) => $(el).attr("href"))
      .get(),
    ["https://partner.com/", "https://tiktok.com/@brand"],
  );
  assert.equal($("button").length, 0);
  const empty = render({ excludedKeys: ["brand.com", "https://instagram.com/brand"] });
  assert.equal(empty("section").length, 0);
});

test("an added profile stays clickable without implying its contents were analyzed", () => {
  const $ = render({
    research: researchSchema.parse({}),
    extraLinks: ["https://tiktok.com/@brand"],
  });
  assert.equal($("a[aria-label='Abrir TikTok: @brand']").attr("href"), "https://tiktok.com/@brand");
  assert.equal($(".brand-source-item").text(), "@brand");
  const brain = render({
    research: researchSchema.parse({}),
    extraLinks: ["https://tiktok.com/@brand"],
    showMaterial: true,
  });
  assert.match(brain.text(), /Conteúdo não consultado/);
  assert.equal(brain("details").length, 0);
});

test("real profile evidence remains eligible when discovered references are excluded", () => {
  const $ = render({
    research: researchSchema.parse({
      sources: [{ ...research.sources[0], url: "https://instagram.com/brand" }],
    }),
    includeDiscovered: false,
    showMaterial: true,
  });
  assert.equal($(".brand-source-item").length, 1);
  assert.match($("details").text(), /Longo texto bruto/);
});

test("site and unsupported platform icons use a globe while supported networks use their own glyphs", () => {
  const $ = render({
    extraLinks: [
      "https://facebook.com/pages/Brand/123",
      "https://linkedin.com/company/brand",
      "https://tiktok.com/@brand",
      "https://x.com/brand",
    ],
  });
  const cases = [
    ["Abrir Site: brand.com", ".lucide-earth"],
    ["Abrir Instagram: @brand", ".lucide-instagram"],
    ["Abrir Facebook: @Brand", ".lucide-facebook"],
    ["Abrir LinkedIn: @brand", ".lucide-linkedin"],
    ["Abrir TikTok: @brand", ".brand-source-icon-tiktok"],
    ["Abrir X: @brand", ".lucide-earth"],
  ];
  for (const [label, selector] of cases) {
    const row = $(`a[aria-label='${label}']`).closest(".brand-source-row");
    assert.equal(row.find(`svg${selector}`).length, 1, label);
    assert.equal(row.find("svg.brand-source-icon").attr("aria-hidden"), "true");
  }
});

function elements(node: react.ReactNode): react.ReactElement<Record<string, unknown>>[] {
  return react.Children.toArray(node).flatMap((child) => {
    if (!react.isValidElement<Record<string, unknown>>(child)) return [];
    return [child, ...elements(child.props.children as react.ReactNode)];
  });
}

test("remove controls call back with canonical group keys and never submit the onboarding form", () => {
  const removed: string[] = [];
  const props = {
    research,
    extraLinks: ["https://facebook.com/pages/Brand/123"],
    onRemove: (key: string) => removed.push(key),
  };
  const $ = render(props);
  assert.equal($("button").length, 3);
  assert.deepEqual(
    $("button")
      .map((_, el) => $(el).attr("aria-label"))
      .get(),
    ["Remover Site: brand.com", "Remover Instagram: @brand", "Remover Facebook: @Brand"],
  );
  const component = exports.BrandSources as react.FunctionComponent<Record<string, unknown>>;
  const buttons = elements(component(props) as react.ReactNode).filter(
    (el) => el.type === "button",
  );
  assert.equal(buttons.length, 3);
  for (const button of buttons) {
    assert.equal(button.props.type, "button");
    (button.props.onClick as () => void)();
  }
  assert.deepEqual(removed, [
    "brand.com",
    "https://instagram.com/brand",
    "https://facebook.com/profile.php?id=123",
  ]);
});

test("editable references have accessible pencil controls without replacing their validation links", () => {
  let selected: sources.SourceIdentity | undefined;
  const editor = {
    current: null,
    onStart: (value: sources.SourceIdentity) => {
      selected = value;
    },
    onChange() {},
    onSave() {},
    onCancel() {},
  };
  const $ = render({ editor });
  assert.equal($("a[aria-label='Abrir Instagram: @brand']").length, 1);
  assert.equal($("button[aria-label='Editar Instagram: @brand']").attr("type"), "button");
  const tree = elements(exports.BrandSources!({ research, editor }) as react.ReactNode);
  const button = tree.find((el) => el.props["aria-label"] === "Editar Instagram: @brand")!;
  (button.props.onClick as () => void)();
  assert.equal(selected?.url, "https://instagram.com/brand");
});

test("inline reference editor supports URL or handle, save on Enter and cancel on Escape without submitting", () => {
  let value = "";
  let saves = 0;
  let cancels = 0;
  const editor = {
    current: { key: "https://instagram.com/brand", value: "@new" },
    onStart() {},
    onChange: (next: string) => {
      value = next;
    },
    onSave: () => saves++,
    onCancel: () => cancels++,
  };
  const $ = render({ editor });
  assert.equal($("input[aria-label='Link de Instagram']").attr("value"), "@new");
  assert.equal($("button[aria-label='Salvar link de Instagram']").attr("type"), "button");
  assert.equal($("button[aria-label='Cancelar edição de Instagram']").attr("type"), "button");
  const tree = elements(exports.BrandSources!({ research, editor }) as react.ReactNode);
  const input = tree.find((el) => el.type === "input")!;
  (input.props.onChange as (e: unknown) => void)({ target: { value: "@changed" } });
  assert.equal(value, "@changed");
  let prevented = 0;
  for (const key of ["Enter", "Escape"])
    (input.props.onKeyDown as (e: unknown) => void)({ key, preventDefault: () => prevented++ });
  assert.equal(saves, 1);
  assert.equal(cancels, 1);
  assert.equal(prevented, 2);
});
