// Opt-in live acceptance check: Node 24+, SCRAPLING_PYTHON and SCRAPLING_RENDER=1.
// Uses public clinic evidence only. --ai also exercises the configured Claude provider.
import assert from "node:assert/strict";
import { handleBrandPreview } from "../../src/lib/brand-preview.server.ts";
import { researchSchema } from "../../src/lib/brand-preview.ts";
import { applyResearchToData } from "../../src/lib/brand-research.ts";
import { demoSchema } from "../../src/lib/quick-start.ts";
import { profileConfirmed } from "../../src/lib/brand-preview.ts";
import { reconcileClinicContacts } from "../../src/lib/clinic-contacts.ts";

const clinics = [
  {
    url: "https://draquisyvascular.com.br/?utm_source=google&utm_medium=cpc&utm_campaign=13629757408&gad_source=1&gad_campaignid=13629757408&gbraid=abc&gclid=test",
    name: /Quisy Storti/,
    rendered: true,
  },
  {
    url: "https://www.clinicasaopaulo.com.br/especialidades/",
    name: /Clínica São Paulo/,
    rendered: false,
  },
  {
    url: "https://laboratoriosaopaulobh.com.br/",
    name: /(?:Laboratório|Lab) São Paulo/,
    rendered: false,
  },
];
for (const clinic of clinics) {
  const started = Date.now();
  const request = new Request("http://127.0.0.1:8080/api/brand-preview", {
    method: "POST",
    headers: { origin: "http://127.0.0.1:8080", "content-type": "application/json" },
    body: JSON.stringify({
      action: "research",
      url: clinic.url,
      material: "",
      stream: true,
      siteAuthorized: true,
      aiAuthorized: process.argv.includes("--ai"),
    }),
  });
  const response = process.argv.includes("--http")
    ? await fetch(request)
    : await handleBrandPreview(request, true);
  assert.equal(response.status, 200);
  const frames = (await response.text())
    .trim()
    .split("\n")
    .map((line) => researchSchema.parse(JSON.parse(line).research));
  const final = frames.at(-1)!;
  assert.equal(final.phase, "complete");
  assert.ok(final.sources.length > 0);
  assert.match(final.suggestions.find((s) => s.field === "name")?.value ?? "", clinic.name);
  for (const field of ["segment", "audience", "offers"])
    assert.ok(
      final.suggestions.some((s) => s.field === field),
      `missing ${field} for ${new URL(clinic.url).host}`,
    );
  assert.ok(final.evidenceMarkdown?.includes("https://"));
  for (const contact of final.contacts) {
    assert.ok(
      final.evidenceMarkdown?.includes(contact.value),
      "every collected contact must survive into Markdown",
    );
    assert.ok(
      final.evidenceMarkdown?.includes(contact.sourceUrl),
      "contact provenance must survive into Markdown",
    );
  }
  if (process.argv.includes("--ai"))
    assert.equal(
      final.synthesis,
      "ready",
      "configured AI synthesis must succeed, not merely fall back",
    );
  const url = new URL(clinic.url);
  url.search = "";
  const draft = demoSchema.parse({ name: "", answers: {}, brand: { referenceUrl: url.href } });
  const filled = applyResearchToData(draft, { url: url.href, material: "" }, final);
  assert.match(filled.name, clinic.name);
  assert.ok(
    filled.segment.trim().length > 2 && filled.answers.audience.trim().length > 3,
    "all three owner-review fields must be populated",
  );
  assert.equal(
    profileConfirmed(filled),
    false,
    "scraping must never impersonate the owner's confirmation",
  );
  if (clinic.rendered)
    assert.ok(
      final.sources.some((s) => s.parser === "scrapling-rendered" && s.text.length > 1000),
      "JS clinic must return actual rendered content",
    );
  console.log(
    JSON.stringify({
      clinic: new URL(clinic.url).host,
      elapsedMs: Date.now() - started,
      phase: final.phase,
      synthesis: final.synthesis,
      sources: final.sources.length,
      parsers: [...new Set(final.sources.map((s) => s.parser))],
      name: final.suggestions.find((s) => s.field === "name")?.value,
      areas: final.suggestions.filter((s) => s.field === "segment").map((s) => s.value),
      audience: final.suggestions.find((s) => s.field === "audience")?.value,
      topics: final.suggestions.filter((s) => s.field === "offers").map((s) => s.title || s.value),
      markdownChars: final.evidenceMarkdown?.length,
      contacts: {
        phones: final.contacts.filter((item) => item.kind === "phone").length,
        emails: final.contacts.filter((item) => item.kind === "email").length,
        addresses: final.contacts.filter((item) => item.kind === "address").length,
        groupsToReview: reconcileClinicContacts(final.contacts).filter(
          (group) => group.requiresReview,
        ).length,
      },
      profileFields: final.profile.length,
      colors: final.visualEvidence?.colors,
      fonts: final.visualEvidence?.fonts,
      logoSource: final.logoSource,
      ownerConfirmationRequired: !profileConfirmed(filled),
    }),
  );
}
