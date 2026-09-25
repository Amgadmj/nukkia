import test from "node:test";
import assert from "node:assert/strict";
import { extractPage } from "../src/lib/public-site.server.ts";
import { researchSchema } from "../src/lib/brand-preview.ts";
import {
  groupBrandSources,
  mergeDiscoveredLinks,
  sourceIdentity,
} from "../src/lib/brand-sources.ts";

const source = (url: string) => ({
  url,
  title: "Clínica",
  text: "Evidência original",
  fetchedAt: "2026-09-24T12:00:00Z",
});

test("three internal pages render as one website without discarding original evidence", () => {
  const research = researchSchema.parse({
    sources: [
      source("https://www.brand.com/"),
      source("https://brand.com/services"),
      source("https://brand.com/about?utm_source=footer"),
    ],
    discoveredLinks: [{ url: "https://www.brand.com/other", foundOn: "https://brand.com/" }],
  });
  const before = JSON.stringify(research);
  const groups = groupBrandSources(research);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].label, "brand.com");
  assert.equal(groups[0].url, "https://www.brand.com/");
  assert.equal(groups[0].pages.length, 3);
  assert.equal(groups[0].pages[1].text, "Evidência original");
  assert.equal(JSON.stringify(research), before);
});

test("distinct profiles remain separate and discovered links never count as read pages", () => {
  const research = researchSchema.parse({
    sources: [source("https://brand.com/")],
    discoveredLinks: [
      { url: "https://instagram.com/brand/?igsh=123", foundOn: "https://brand.com/" },
      { url: "https://www.instagram.com/brand/", foundOn: "https://brand.com/about" },
      { url: "https://instagram.com/otherbranch", foundOn: "https://brand.com/" },
      { url: "https://linkedin.com/company/brand", foundOn: "https://brand.com/" },
    ],
  });
  const groups = groupBrandSources(research);
  assert.equal(groups.length, 4);
  assert.equal(groups[1].pages.length, 0);
  assert.deepEqual(groups[1].foundOn, ["https://brand.com/", "https://brand.com/about"]);
  assert.deepEqual(
    groups.map((group) => group.label),
    ["brand.com", "@brand", "@otherbranch", "@brand"],
  );
});

test("pasted material is not merged into a website and unsafe links are not displayed", () => {
  const groups = groupBrandSources(
    researchSchema.parse({
      sources: [source("material:fornecido"), source("javascript:alert(1)")],
      discoveredLinks: [{ url: "https://instagram.com/brand", foundOn: "javascript:alert(1)" }],
    }),
  );
  assert.equal(groups.length, 1);
  assert.equal(groups[0].kind, "Texto");
  assert.equal(groups[0].url, "");
});

test("associated sites found on multiple pages stay one site, while distinct domains remain separate", () => {
  const links = mergeDiscoveredLinks([
    { url: "https://www.brand.com.br/about", foundOn: "https://brand.com/" },
    { url: "https://brand.com.br/contact", foundOn: "https://brand.com/services" },
    { url: "https://other.com.br", foundOn: "https://brand.com/" },
  ]);
  assert.deepEqual(
    links.map((link) => link.url),
    ["https://www.brand.com.br/", "https://other.com.br/"],
  );
});

test("website grouping preserves working www links and case-sensitive channel IDs", () => {
  assert.equal(sourceIdentity("https://www.brand.com/about")?.url, "https://www.brand.com/");
  assert.notEqual(
    sourceIdentity("https://youtube.com/channel/UCab")?.key,
    sourceIdentity("https://youtube.com/channel/UCAB")?.key,
  );
  assert.equal(sourceIdentity("https://brand.com/" + "a".repeat(2048)), null);
});

test("Facebook numeric profiles preserve their identity instead of merging into profile.php", () => {
  assert.notEqual(
    sourceIdentity("https://facebook.com/profile.php?id=123")?.key,
    sourceIdentity("https://facebook.com/profile.php?id=456")?.key,
  );
  assert.equal(sourceIdentity("https://facebook.com/profile.php"), null);
});

test("a website discovered through a subpage links to its root without query or fragment", () => {
  assert.deepEqual(sourceIdentity("https://www.brand.com/services?lang=pt&utm_source=ig#team"), {
    key: "brand.com",
    url: "https://www.brand.com/",
    label: "brand.com",
    kind: "Site",
  });
  const groups = groupBrandSources(
    researchSchema.parse({
      sources: [source("https://brand.com/about"), source("https://www.brand.com/services")],
    }),
  );
  assert.equal(groups.length, 1);
  assert.equal(groups[0].url, "https://brand.com/");
  assert.equal(groups[0].pages[0].url, "https://brand.com/about");
});

test("Facebook page and numeric profile aliases share an identity with usable links and labels", () => {
  const cases = [
    {
      input: "https://www.facebook.com/pages/Clinica-Exemplo/123/?ref=footer#about",
      url: "https://facebook.com/pages/Clinica-Exemplo/123",
      label: "@Clinica-Exemplo",
    },
    {
      input: "https://m.facebook.com/people/Clinica-Exemplo/123/?mibextid=abc",
      url: "https://facebook.com/people/Clinica-Exemplo/123",
      label: "@Clinica-Exemplo",
    },
    {
      input: "https://web.facebook.com/profile.php?id=123&ref=footer",
      url: "https://facebook.com/profile.php?id=123",
      label: "@123",
    },
  ];
  for (const { input, url, label } of cases) {
    assert.deepEqual(sourceIdentity(input), {
      key: "https://facebook.com/profile.php?id=123",
      url,
      label,
      kind: "Facebook",
    });
  }
  const groups = groupBrandSources(
    researchSchema.parse({
      discoveredLinks: cases.map(({ input }) => ({ url: input, foundOn: "https://brand.com/" })),
    }),
  );
  assert.equal(groups.length, 1);
  assert.equal(groups[0].label, "@Clinica-Exemplo");
  assert.deepEqual(groups[0].pages, []);
});

test("incomplete Facebook pages and nonnumeric profile IDs are not brand identities", () => {
  for (const path of [
    "pages",
    "people",
    "pages/Brand",
    "pages/Brand/no-id",
    "profile.php?id=abc",
  ]) {
    assert.equal(sourceIdentity(`https://facebook.com/${path}`), null, path);
  }
});

test("manual references merge with discovered and read identities without inventing evidence", () => {
  const research = researchSchema.parse({
    sources: [source("https://www.brand.com/services")],
    discoveredLinks: [{ url: "https://instagram.com/brand", foundOn: "https://brand.com/about" }],
  });
  const extraLinks = [
    "https://brand.com/contact",
    "https://www.instagram.com/BRAND/?igsh=123",
    "https://www.partner.com/about?ref=brand",
    "https://partner.com/contact",
    "https://tiktok.com/@brand/?lang=pt",
    "javascript:alert(1)",
    "https://user:password@private.com/",
    "https://instagram.com/p/post-id",
  ];
  const before = JSON.stringify({ research, extraLinks });
  const groups = groupBrandSources(research, extraLinks);
  assert.deepEqual(
    groups.map((group) => group.url),
    [
      "https://www.brand.com/",
      "https://instagram.com/brand",
      "https://www.partner.com/",
      "https://tiktok.com/@brand",
    ],
  );
  assert.deepEqual(
    groups.map((group) => group.pages.length),
    [1, 0, 0, 0],
  );
  assert.deepEqual(groups[1].foundOn, ["https://brand.com/about"]);
  assert.deepEqual(groups[2].foundOn, []);
  assert.equal(JSON.stringify({ research, extraLinks }), before);
});

test("discovers profile links before footer removal and deduplicates tracking variants", () => {
  const page = extractPage(
    `<footer>
    <a href="https://www.instagram.com/clinica.exemplo/?igsh=abc">Instagram</a>
    <a href="https://instagram.com/clinica.exemplo/">Instagram</a>
    <a href="https://br.linkedin.com/company/clinica-exemplo/?trk=footer">LinkedIn</a>
    <a href="https://www.facebook.com/clinicaexemplo/">Facebook</a>
    <a href="https://instagram.com/p/123/">Post</a>
    <a href="https://linkedin.com/sharing/share-offsite/?url=https://brand.com">Share</a>
    <a href="https://agency.com/">Developed by</a>
  </footer>`,
    "https://brand.com/sobre",
  );
  assert.deepEqual(page.discoveredLinks, [
    { url: "https://instagram.com/clinica.exemplo", foundOn: "https://brand.com/sobre" },
    { url: "https://linkedin.com/company/clinica-exemplo", foundOn: "https://brand.com/sobre" },
    { url: "https://facebook.com/clinicaexemplo", foundOn: "https://brand.com/sobre" },
  ]);
  assert.deepEqual(page.links, [], "discovered profiles must not enter the crawler queue");
});

test("uses organization sameAs and rel=me without treating staff or arbitrary links as brand sites", () => {
  const page = extractPage(
    `<script type="application/ld+json">{"@graph":[
    {"@type":"MedicalClinic","sameAs":["https://brand.net/about","https://instagram.com/clinica"],
     "employee":{"@type":"Person","sameAs":"https://instagram.com/doctor"}},
    {"@type":"Person","sameAs":"https://linkedin.com/in/doctor"}
  ]}</script>
  <a rel="me noopener" href="https://brand.org/contact">Nossa outra unidade</a>
  <a href="https://payment.com">Pagar</a>`,
    "https://brand.com/",
  );
  assert.deepEqual(
    new Set(page.discoveredLinks.map((link) => link.url)),
    new Set(["https://brand.net/", "https://instagram.com/clinica", "https://brand.org/"]),
  );
  assert.ok(page.discoveredLinks.every((link) => link.foundOn === "https://brand.com/"));
});

test("discovery rejects unsafe, fake social hosts, login and sharing URLs", () => {
  const urls = [
    "javascript:alert(1)",
    "https://user:secret@brand.org/",
    "https://127.0.0.1/",
    "https://private.local/",
    "https://instagram.com.evil.org/brand",
    "https://evil.instagram.com/brand",
    "https://instagram.com/accounts/login",
    "https://facebook.com/sharer.php?u=brand",
    "https://x.com/intent/tweet",
    "https://youtube.com/watch?v=123",
  ];
  const page = extractPage(
    urls.map((url) => `<a href="${url}">Link</a>`).join(""),
    "https://brand.com/",
  );
  assert.deepEqual(page.discoveredLinks, []);
});

test("a malformed structured-data block does not hide subsequent profile links", () => {
  const page = extractPage(
    '<script type="application/ld+json">{invalid</script><a href="https://instagram.com/brand">Instagram</a>',
    "https://brand.com/",
  );
  assert.equal(page.discoveredLinks[0]?.url, "https://instagram.com/brand");
});

test("discovery has a bounded result and old saved research remains compatible", () => {
  const page = extractPage(
    Array.from(
      { length: 30 },
      (_, i) => `<a href="https://instagram.com/brand${i}">Instagram</a>`,
    ).join(""),
    "https://brand.com/",
  );
  assert.equal(page.discoveredLinks.length, 12);
  const old = researchSchema.parse({ status: "ready", sources: [] });
  assert.deepEqual(old.discoveredLinks, []);
  const restored = researchSchema.parse({ ...old, discoveredLinks: page.discoveredLinks });
  assert.equal(restored.discoveredLinks.length, 12);
});
