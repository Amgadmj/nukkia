import test from "node:test";
import assert from "node:assert/strict";
import { extractClinicContacts, reconcileClinicContacts } from "../src/lib/clinic-contacts.ts";

const sourceUrl = "https://clinic.example/contact";
const observedAt = "2026-10-16T12:00:00.000Z";
const extract = (html: string) => extractClinicContacts(html, sourceUrl, observedAt);

test("public footer contacts survive with source evidence and WhatsApp numbers", () => {
  const contacts = extract(`<footer>
    <a href="mailto:Reception@Clinic.example?subject=Hello">Email</a>
    <a href="tel:+55 (11) 2345-6789">Reception</a>
    <a href="https://wa.me/5511987654321?text=Hello">WhatsApp</a>
    <a href="https://api.whatsapp.com/send?phone=%2B5511976543210">Message</a>
    <address>Rua Central, 123<br>São Paulo</address>
  </footer>`);
  assert.deepEqual(
    contacts.map(({ kind, normalizedValue }) => ({ kind, normalizedValue })),
    [
      { kind: "email", normalizedValue: "reception@clinic.example" },
      { kind: "phone", normalizedValue: "551123456789" },
      { kind: "phone", normalizedValue: "5511987654321" },
      { kind: "phone", normalizedValue: "5511976543210" },
      { kind: "address", normalizedValue: "rua central 123 sao paulo" },
    ],
  );
  assert.ok(contacts.every((c) => c.sourceUrl === sourceUrl && c.observedAt === observedAt));
});

test("business JSON-LD supports arrays, graph, typed businesses and PostalAddress", () => {
  const contacts = extract(
    `<script type="application/ld+json">${JSON.stringify({
      "@graph": ["Organization", "MedicalClinic", "Hospital", "LocalBusiness", "DiagnosticLab"].map(
        (type, index) => ({
          "@type": index === 0 ? ["Thing", type] : `https://schema.org/${type}`,
          email: [`Office${index}@clinic.example`],
          telephone: `+55 11 2345-670${index}`,
          address: {
            "@type": "PostalAddress",
            streetAddress: "Rua Central, 123",
            addressLocality: "São Paulo",
            addressRegion: "SP",
            postalCode: "01000-000",
            addressCountry: { "@type": "Country", name: "BR" },
          },
        }),
      ),
    })}</script><script type="application/ld+json">invalid</script>`,
  );
  assert.equal(contacts.filter((c) => c.kind === "email").length, 5);
  assert.equal(contacts.filter((c) => c.kind === "phone").length, 5);
  assert.deepEqual(
    contacts.filter((c) => c.kind === "address").map((c) => c.value),
    ["Rua Central, 123, São Paulo, SP, 01000-000, BR"],
  );
  assert.equal(
    extract(
      `<script type="application/ld+json">[{"@type":"MedicalClinic","email":"office@clinic.example"}]</script>`,
    ).length,
    1,
  );
});

test("native WhatsApp links and explicit phone extensions preserve distinct purposes", () => {
  const contacts = extract(`<a href="whatsapp://send?phone=%2B5511987654321">WhatsApp</a>
    <a href="tel:+551123456789;ext=12">Reception</a>
    <a href="tel:+551123456789;ext=34">Laboratory</a>`);
  assert.deepEqual(
    contacts.map((c) => c.normalizedValue),
    ["5511987654321", "551123456789x12", "551123456789x34"],
  );
  assert.equal(reconcileClinicContacts(contacts)[0].requiresReview, true);
});

test("structured itemprop addresses read postal fields and content attributes without partial duplicates", () => {
  const contacts = extract(`<div itemscope itemtype="https://schema.org/MedicalClinic">
    <div itemprop="address" itemscope itemtype="https://schema.org/PostalAddress">
      <span itemprop="streetAddress">Rua Central, 123</span>
      <span itemprop="addressLocality">São Paulo</span>
      <meta itemprop="addressRegion" content="SP">
      <meta itemprop="postalCode" content="01000-000">
    </div>
    <meta itemprop="streetAddress" content="Avenida Norte, 45">
    <span itemprop="address">Rua Sul, 99</span>
    <div itemprop="address"><meta itemprop="streetAddress" content="Rua Leste, 10"><meta itemprop="addressLocality" content="São Paulo"></div>
    <a itemprop="address" href="https://maps.example/clinic">Rua Oeste, 20</a>
  </div>`);
  assert.deepEqual(
    contacts.map((c) => c.value),
    [
      "Rua Central, 123, São Paulo, SP, 01000-000",
      "Avenida Norte, 45",
      "Rua Sul, 99",
      "Rua Leste, 10, São Paulo",
      "Rua Oeste, 20",
    ],
  );
  assert.ok(
    contacts.every(
      (c) => c.kind === "address" && c.sourceUrl === sourceUrl && c.observedAt === observedAt,
    ),
  );
});

test("reads only unambiguous address blocks in public footer, contact and unit scopes", () => {
  const contacts =
    extract(`<footer><p>Clínica Central</p><p>Rua Central, 123<br>São Paulo, SP</p><p>Atendimento acolhedor</p></footer>
    <section id="contato"><h2>Contato</h2><div class="address">Endereço: Avenida Norte, 45<br>São Paulo</div></section>
    <section class="unidade"><h3>Unidade Sul</h3><p>Rua Sul, 99</p></section>
    <section aria-label="Contact"><p>123 Main Street, Springfield</p></section>
    <p>Rua Privada, 17</p><article><p>Our patient lives at 123 Main Street.</p></article>`);
  assert.deepEqual(
    contacts.map((c) => c.value),
    [
      "Rua Central, 123 São Paulo, SP",
      "Avenida Norte, 45 São Paulo",
      "Rua Sul, 99",
      "123 Main Street, Springfield",
    ],
  );
  const group = reconcileClinicContacts(contacts)[0];
  assert.equal(group.kind, "address");
  assert.equal(group.requiresReview, true);
  assert.equal(group.values.length, 4);
});

test("new address markup excludes patient, review, identity and health form contexts", () => {
  const structured = `<div itemprop="address"><span itemprop="streetAddress">Rua Privada, 17</span></div>`;
  assert.deepEqual(
    extract(`<div itemtype="https://schema.org/Person">${structured}</div>
    <section class="patient-contact">${structured}<p>Rua Privada, 18</p></section>
    <section id="contact"><form><label>CPF</label>${structured}<p>Rua Privada, 19</p></form>
      <div class="health-data">${structured}</div><div class="identity">${structured}</div>
      <div class="testimonials"><p>Rua Privada, 20</p>${structured}</div>
      <p>My patient lives at Rua Privada, 21</p>
    </section><footer><p>Contact our patients for their addresses</p></footer>`),
    [],
  );
});

test("formatting duplicates merge while retaining every distinct source observation", () => {
  const first = extract(
    `<a href="mailto:Office@Clinic.example">Email</a><a href="tel:+55 (11) 2345-6789">Phone</a><address>Rua Central, 123 — São Paulo</address>`,
  );
  const second = extractClinicContacts(
    `<a href="mailto:office@clinic.example">Email</a><a href="tel:551123456789">Phone</a><address>RUA CENTRAL 123, SAO PAULO</address>`,
    "https://clinic.example/about",
    "2026-10-17T12:00:00Z",
  );
  const groups = reconcileClinicContacts([...first, ...second, ...first]);
  assert.equal(groups.length, 3);
  for (const group of groups) {
    assert.equal(group.requiresReview, false);
    assert.equal(group.values.length, 1);
    assert.deepEqual(group.values[0].sources, [
      { url: sourceUrl, observedAt },
      { url: "https://clinic.example/about", observedAt: "2026-10-17T12:00:00Z" },
    ]);
  }
});

test("different branch phones and addresses remain candidates with all sources for purpose review", () => {
  const first = extract(
    `<a href="tel:1123456789">Branch A</a><a href="tel:1198765432">Branch B</a><address>Rua A, 1</address><address>Rua B, 2</address>`,
  );
  const later = first.map((c) => ({ ...c, observedAt: "2026-10-17T12:00:00Z" }));
  const groups = reconcileClinicContacts([...first, ...later]);
  assert.deepEqual(
    groups.map((g) => [g.kind, g.requiresReview, g.values.length]),
    [
      ["phone", true, 2],
      ["address", true, 2],
    ],
  );
  assert.ok(groups.every((g) => g.values.every((v) => v.sources.length === 2)));
  assert.deepEqual(
    groups[0].values.map((v) => v.normalizedValue),
    ["1123456789", "1198765432"],
  );
});

test("ignores personal body text, Person JSON-LD, reviews and patient or health forms", () => {
  const unsafe = `<a href="mailto:patient@example.com">Patient</a><a href="tel:1199999999">Phone</a><address>Patient home</address>`;
  const contacts = extract(`
    <p>patient@example.com 1199999999 Rua Private 15</p>
    <section class="testimonials">${unsafe}</section>
    <section id="patient-details">${unsafe}</section>
    <section aria-label="Depoimentos">${unsafe}</section>
    <section><h2>Patient records</h2>${unsafe}</section>
    <div itemscope itemtype="https://schema.org/Person">${unsafe}</div>
    <form><label>CPF and diagnosis</label>${unsafe}</form>
    <section id="health-record">${unsafe}</section>
    <script type="application/ld+json">${JSON.stringify({ "@type": "Person", email: "person@example.com", telephone: "1199999999", address: { "@type": "PostalAddress", streetAddress: "Patient home" }, employer: { "@type": "MedicalClinic", email: "nested@example.com" } })}</script>
    <script type="application/ld+json">${JSON.stringify({ "@type": "MedicalClinic", review: { "@type": "Review", author: { "@type": "Person", email: "review@example.com" } } })}</script>
    <footer><a href="mailto:office@clinic.example">Office</a></footer>`);
  assert.deepEqual(
    contacts.map((c) => c.value),
    ["office@clinic.example"],
  );
});

test("rejects invalid sources, oversized values and misleading WhatsApp links; caps output", () => {
  const html = `<a href="mailto:office@clinic.example">Email</a>`;
  for (const url of [
    "http://clinic.example",
    "https://user:secret@clinic.example",
    "/contact",
    "https://clinic.example/" + "a".repeat(2048),
  ]) {
    assert.deepEqual(extractClinicContacts(html, url, observedAt), []);
  }
  assert.deepEqual(
    extract(
      `<address>${"a".repeat(501)}</address><a href="tel:no-number">Invalid</a><a href="https://wa.me.evil.example/5511999999999">Fake</a><a href="mailto:%ZZ">Invalid</a>`,
    ),
    [],
  );
  const contacts = extract(
    Array.from(
      { length: 40 },
      (_, i) => `<a href="mailto:office${i}@clinic.example">Email</a>`,
    ).join(""),
  );
  assert.equal(contacts.length, 30);
  assert.ok(contacts.every((c) => c.value.length <= 500));
});

test("does not flatten sensitive descendants into an address or accept Person postal data", () => {
  const contacts = extract(`<section aria-label="Avaliações">
    <a href="mailto:reviewer@example.com">Reviewer</a></section>
    <address><span class="patient-address">Rua Particular 12</span></address>
    <script type="application/ld+json">{"@type":"MedicalClinic","address":{"@type":["PostalAddress","Person"],"streetAddress":"Patient home"}}</script>
    <footer><address>Rua Pública 20</address></footer>`);
  assert.deepEqual(
    contacts.map((c) => c.value),
    ["Rua Pública 20"],
  );
});

test("extracts locally without fetching linked pages, scripts or JSON-LD contexts", (t) => {
  t.mock.method(globalThis, "fetch", () => {
    throw new Error("Network is forbidden");
  });
  const contacts = extract(
    `<script src="https://remote.example/script.js"></script><a href="https://remote.example/contact">Contact</a><script type="application/ld+json">{"@context":"https://remote.example/context","@type":"Hospital","email":"public@clinic.example"}</script>`,
  );
  assert.deepEqual(
    contacts.map((c) => c.value),
    ["public@clinic.example"],
  );
  assert.equal(globalThis.fetch.mock.callCount(), 0);
});
