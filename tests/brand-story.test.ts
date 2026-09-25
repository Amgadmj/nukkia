import { test } from "node:test";
import assert from "node:assert/strict";
import {
  brandStorySchema,
  brandStoryRequestSchema,
  brandStoryContext,
  brandPalette,
  brandFonts,
  brandBookFilename,
  buildBrandBookDocument,
  escapeBrandBookHtml,
  isBrandStoryUnavailable,
  type BrandBookInput,
} from "../src/lib/brand-story.ts";

const story = {
  manifesto: "Ajudamos pequenas padarias a organizar suas entregas.",
  mission: "Facilitar o planejamento diário de entregas.",
  vision: "Queremos tornar o serviço acessível às padarias da região.",
  values: ["Clareza: explicar cada etapa antes de confirmar um pedido."],
};
const input: BrandBookInput = {
  company: { name: "Pão & Companhia", segment: "Logística", website: "https://example.com" },
  diagnosticAnswers: {
    audience: "Padarias de bairro",
    offers: "Planejamento de entregas",
    problems: "Atrasos nas entregas",
    age: "35 a 44 anos",
    location: "Recife",
    purpose: "Aproximar produtores e clientes",
    founderStory: "Começamos organizando as entregas da família.",
  },
  brandKit: {
    logo_url: "https://example.supabase.co/storage/logo.png?token=a&v=1",
    palette: { nome: "Pão da manhã", cores: ["#604020", "#FBF7F0"] },
    fonts: { preset: "playfair-inter" },
    tone: "Profissional e acolhedor",
  },
  story,
};

test("story schema trims text and rejects incomplete, oversized or unexpected content", () => {
  assert.equal(
    brandStorySchema.parse({ ...story, mission: ` ${story.mission} ` }).mission,
    story.mission,
  );
  for (const patch of [
    { manifesto: " " },
    { mission: "" },
    { vision: " " },
    { values: [] },
    { manifesto: "x".repeat(4001) },
    { mission: "x".repeat(1001) },
    { vision: "x".repeat(1001) },
    { values: ["x".repeat(301)] },
    { values: [" "] },
    { values: Array(9).fill("Prática") },
    { values: "Qualidade" },
    { madeUpClaim: "Certificada" },
  ])
    assert.equal(brandStorySchema.safeParse({ ...story, ...patch }).success, false);
});

test("request schema accepts only scoped generation or validated saving", () => {
  const companyId = "00000000-0000-4000-8000-000000000001";
  assert.equal(brandStoryRequestSchema.safeParse({ action: "generate", companyId }).success, true);
  assert.equal(
    brandStoryRequestSchema.safeParse({ action: "save", companyId, story }).success,
    true,
  );
  for (const body of [
    { action: "delete", companyId },
    { action: "generate", companyId: "other" },
    { action: "generate", companyId, diagnosticAnswers: { audience: "injected" } },
    { action: "save", companyId, story: {} },
  ])
    assert.equal(brandStoryRequestSchema.safeParse(body).success, false);
});

test("context uses selected owner answers and brand choices without inferred claims or logo tokens", () => {
  const context = brandStoryContext({
    ...input,
    diagnosticAnswers: {
      ...(input.diagnosticAnswers as object),
      report: "Líder de mercado",
      secret: "private",
    },
  });
  const serialized = JSON.stringify(context);
  for (const expected of [
    "Padarias de bairro",
    "Planejamento de entregas",
    "Playfair Display + Inter",
    "Profissional e acolhedor",
  ])
    assert.ok(serialized.includes(expected));
  for (const excluded of ["Líder de mercado", "private", "token=a", "story", "manifesto"])
    assert.ok(!serialized.includes(excluded));
});

test("BrandBook combines real company, diagnostic, story and saved identity", () => {
  const html = buildBrandBookDocument(input);
  for (const value of [
    "Pão &amp; Companhia",
    "Padarias de bairro",
    "Planejamento de entregas",
    "Recife",
    "35 a 44 anos",
    story.manifesto,
    story.mission,
    story.vision,
    story.values[0]!,
    "Pão da manhã",
    "#604020",
    "Playfair Display + Inter",
    "Profissional e acolhedor",
    "Aproximar produtores e clientes",
    "Começamos organizando as entregas da família.",
  ])
    assert.ok(html.includes(value), value);
  assert.ok(html.includes("token=a&amp;v=1"));
  assert.ok(html.includes("@media print"));
  assert.ok(!html.includes("<script"));
});

test("HTML text, attributes, colors and font presets cannot inject markup or CSS", () => {
  const attack = '"><script>alert(1)</script><img src=x onerror=alert(2)>';
  const html = buildBrandBookDocument({
    company: { name: attack, segment: attack, website: attack },
    diagnosticAnswers: { audience: attack, offers: attack, founderStory: attack },
    brandKit: {
      logo_url: 'https://example.com/a" onerror="alert(1)',
      palette: {
        nome: attack,
        cores: ["#123456", "red; background:url(https://evil.test)", attack],
      },
      fonts: { preset: "</style><script>alert(1)</script>" },
      tone: attack,
    },
    story: { manifesto: attack, mission: attack, vision: attack, values: [attack] },
  });
  assert.ok(!html.includes("<script"));
  assert.ok(!html.includes("<img src=x"));
  assert.ok(!html.includes(' onerror="'));
  assert.ok(!html.includes("evil.test"));
  assert.ok(html.includes(escapeBrandBookHtml(attack)));
  assert.equal(escapeBrandBookHtml("&<>'\""), "&amp;&lt;&gt;&#39;&quot;");
  assert.deepEqual(brandPalette({ cores: [null, 42, "#ABCdef", "transparent"] }).colors, [
    "#ABCdef",
  ]);
  for (const preset of ["__proto__", "constructor", "missing"]) {
    assert.equal(brandFonts({ preset }).label, "Não informada");
  }
});

test("unsafe logo URLs are omitted and absent data stays explicitly absent", () => {
  for (const logo_url of [
    "javascript:alert(1)",
    "data:image/svg+xml,<svg onload=alert(1)>",
    "//evil.test/x",
    "https://user:pass@example.com/logo",
  ]) {
    const html = buildBrandBookDocument({ ...input, brandKit: { ...input.brandKit!, logo_url } });
    assert.ok(!html.includes("<img "));
  }
  const empty = buildBrandBookDocument({
    ...input,
    diagnosticAnswers: null,
    story: null,
    brandKit: null,
  });
  for (const value of [
    "Não informado",
    "Manifesto ainda não salvo",
    "Paleta ainda não salva",
    "Logomarca não cadastrada",
  ])
    assert.ok(empty.includes(value));
  assert.ok(!empty.includes(story.manifesto));
});

test("missing migration is distinguished from transient database errors", () => {
  assert.equal(isBrandStoryUnavailable({ code: "42P01" }), true);
  assert.equal(isBrandStoryUnavailable({ code: "PGRST205" }), true);
  assert.equal(isBrandStoryUnavailable({ code: "42501" }), false);
  assert.equal(isBrandStoryUnavailable(null), false);
});

test("HTML download filenames cannot contain paths, controls or unsafe extensions", () => {
  assert.equal(brandBookFilename("Pão & Companhia"), "brandbook-pao-companhia.html");
  assert.equal(
    brandBookFilename("../../Movitta\n:Clínica.exe"),
    "brandbook-movitta-clinica-exe.html",
  );
  assert.equal(brandBookFilename("<>/\\\u0000"), "brandbook-marca.html");
  assert.equal(brandBookFilename("a".repeat(300)), `brandbook-${"a".repeat(80)}.html`);
});
