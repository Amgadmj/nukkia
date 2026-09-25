import test from "node:test";
import assert from "node:assert/strict";
import { demoSchema } from "../src/lib/quick-start.ts";
import * as preview from "../src/lib/brand-preview.ts";
import {
  publicWebsiteUrl,
  isPublicIpv4,
  robotsAllows,
  extractPage,
} from "../src/lib/public-site.server.ts";

const fixture = () =>
  demoSchema.parse({
    name: "Jardim Studio",
    segment: "Pilates",
    answers: {
      offers: "Aulas de pilates",
      audience: "Pessoas que buscam movimento",
      goals: "Atrair novos clientes",
    },
    brand: { confirmed: true, detail: "Turmas de até quatro pessoas com acompanhamento próximo." },
  });
test("unfinished copy survives refresh without losing the brand or allowing approval", () => {
  const data = fixture();
  data.brand.creative = {
    copy: { title: "", body: "", caption: "" },
    briefKey: preview.briefKey(preview.firstPostBrief(data)),
    origin: "manual",
    review: "needs-review",
    reviewNotes: [],
    approved: null,
    exported: null,
  };
  const restored = demoSchema.safeParse(JSON.parse(JSON.stringify(data)));
  assert.equal(restored.success, true);
  assert.equal(preview.creativeStatus(data).valid, false);
});
test("late research cannot replace a newer reference or confirmed human answers", () => {
  const data = fixture();
  data.brand.referenceUrl = "https://new.com";
  const result = preview.researchSchema.parse({ status: "ready" });
  assert.equal(
    preview.applyBrandResearch(data.brand, { url: "https://old.com", material: "" }, result),
    data.brand,
  );
  const updated = preview.applyBrandResearch(
    data.brand,
    { url: "https://new.com", material: "" },
    result,
  );
  assert.equal(updated.detail, data.brand.detail);
  assert.equal(updated.confirmed, true);
  assert.equal(updated.research, result);
});
test("approval covers text, brief and visual, with a bounded fingerprint", () => {
  const data = fixture();
  data.brand.creative = preview.creativeSchema.parse({
    copy: preview.fallbackCopy(preview.firstPostBrief(data)),
    briefKey: preview.briefKey(preview.firstPostBrief(data)),
    origin: "manual",
    review: "needs-review",
  });
  data.brand.photo = "data:image/png;base64," + "A".repeat(100000);
  const fingerprint = preview.creativeFingerprint(data);
  assert.ok(fingerprint.length < 100, "asset contents must not be duplicated in approval storage");
  data.brand.creative.approved = fingerprint;
  assert.equal(preview.creativeStatus(data).approved, true);
  data.brand.accent = "#112233";
  assert.equal(preview.creativeStatus(data).approved, false);
  assert.equal(preview.creativeStatus(data).xp, 20);
});
test("only suggestions quoting a collected source survive grounding", () => {
  const source = {
    url: "https://brand.com/",
    title: "Marca",
    text: "Turmas de até quatro pessoas.",
    fetchedAt: "2026-09-24",
  };
  const suggestions = [
    {
      field: "detail" as const,
      value: "Turmas pequenas",
      quote: "Turmas de até quatro pessoas.",
      sourceUrl: source.url,
    },
    {
      field: "detail" as const,
      value: "Resultados garantidos",
      quote: "Resultados garantidos",
      sourceUrl: source.url,
    },
  ];
  assert.equal(typeof preview.groundedSuggestions, "function");
  assert.deepEqual(preview.groundedSuggestions(suggestions, [source]), [suggestions[0]]);
});
test("collector fails closed for private, literal and credentialed addresses", () => {
  for (const url of [
    "http://brand.com",
    "https://localhost",
    "https://127.0.0.1",
    "https://2130706433",
    "https://[::1]",
    "https://user:pass@brand.com",
    "https://brand.com:9000",
  ])
    assert.throws(() => publicWebsiteUrl(url));
  for (const address of [
    "127.0.0.1",
    "10.1.0.2",
    "169.254.169.254",
    "100.64.0.1",
    "192.168.1.1",
    "198.18.1.1",
    "::1",
  ])
    assert.equal(isPublicIpv4(address), false);
  assert.equal(isPublicIpv4("93.184.216.34"), true);
});
test("robots rules and page extraction keep scope narrow", () => {
  assert.equal(
    robotsAllows("User-agent: *\nDisallow: /private\nAllow: /private/public", "/private/a"),
    false,
  );
  assert.equal(
    robotsAllows("User-agent: *\nDisallow: /private\nAllow: /private/public", "/private/public"),
    true,
  );
  const page = extractPage(
    '<title>Marca</title><script>secret()</script><p>Atendimento presencial.</p><a href="https://other.com/about">Other</a><a href="/sobre">Sobre</a>',
    "https://brand.com/",
  );
  assert.ok(!page.text.includes("secret"));
  assert.deepEqual(page.links, ["https://brand.com/sobre"]);
});

test("collection discovers clinic and service pages without following external or utility links", () => {
  const page = extractPage(
    `<title>Inicial</title><nav>
      <a href="index.html">Home</a><a href="fisioterapia.html">Fisioterapia</a>
      <a href="clinica.html">A Clínica</a><a href="/agenda">Agendar</a>
      <a href="https://elsewhere.com/clinica">A Clínica</a>
    </nav>`,
    "https://www.movitta.com.br/",
  );
  assert.deepEqual(page.links, [
    "https://www.movitta.com.br/fisioterapia.html",
    "https://www.movitta.com.br/clinica.html",
  ]);
});

test("logo filename is a fallback when its alt and class are generic", () => {
  const page = extractPage(
    '<img src="images/menu-icon.png"><img src="images/Logo-1.png" alt="" class="image">',
    "https://www.movitta.com.br/",
  );
  assert.equal(page.logo, "https://www.movitta.com.br/images/Logo-1.png");
});

test("template bios are excluded with their associated names, not turned into brand facts", () => {
  const page = extractPage(
    `<h2>Serviços</h2><p>Fisioterapia e condicionamento.</p>
      <a href="#"><h3>Emily Carolina</h3><p>Lorem Ipsum is simply dummy text.</p></a>
      <p>Lorem ipsum dolor sit amet.</p><p>Atendimento presencial.</p>`,
    "https://www.movitta.com.br/",
  );
  assert.doesNotMatch(page.text, /lorem|Emily Carolina/i);
  assert.match(page.text, /Atendimento presencial/);
  assert.match(page.text, /Fisioterapia e condicionamento/);
  assert.equal(page.placeholderRemoved, true);
});
