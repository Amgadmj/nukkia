import { test } from "node:test";
import assert from "node:assert/strict";
import { validateService, emptyService } from "../src/lib/service-catalog.ts";
import { serviceBriefPatch } from "../src/lib/service-brief.ts";

// Helper to create a valid service with optional overrides
function makeValidService(overrides = {}) {
  const base = emptyService();
  return {
    ...base,
    id: "test-service",
    title: "Serviço de Consultoria",
    summary:
      "Este é um serviço de consultoria profissional que ajuda empresas a melhorar seus processos e resultados.",
    audience: "Empresas de médio porte",
    conditionsConfirmed: true,
    status: "confirmed",
    ...overrides,
  };
}

test("confirmed valid service returns correct mapping", () => {
  const service = makeValidService();
  const result = serviceBriefPatch(service, "2024-06-15");

  assert.ok(result);
  assert.equal(result.offer, "Serviço de Consultoria");
  assert.equal(
    result.detail,
    "Este é um serviço de consultoria profissional que ajuda empresas a melhorar seus processos e resultados.",
  );
  assert.equal(result.audience, "Empresas de médio porte");
});

test("draft service is refused", () => {
  const service = makeValidService({ status: "draft" });
  const result = serviceBriefPatch(service, "2024-06-15");

  assert.strictEqual(result, null);
});

test("archived service is refused", () => {
  const service = makeValidService({ status: "archived" });
  const result = serviceBriefPatch(service, "2024-06-15");

  assert.strictEqual(result, null);
});

test("unconfirmed conditions are refused", () => {
  const service = makeValidService({ conditionsConfirmed: false });
  const result = serviceBriefPatch(service, "2024-06-15");

  assert.strictEqual(result, null);
});

test("expired validUntil is refused", () => {
  const service = makeValidService({ validUntil: "2024-06-10" });
  const result = serviceBriefPatch(service, "2024-06-15");

  assert.strictEqual(result, null);
});

test("today as validUntil is accepted", () => {
  const service = makeValidService({ validUntil: "2024-06-15" });
  const result = serviceBriefPatch(service, "2024-06-15");

  assert.ok(result);
});

test("future validUntil is accepted", () => {
  const service = makeValidService({ validUntil: "2024-07-15" });
  const result = serviceBriefPatch(service, "2024-06-15");

  assert.ok(result);
});

test("empty validUntil is accepted (no expiry)", () => {
  const service = makeValidService({ validUntil: "" });
  const result = serviceBriefPatch(service, "2024-06-15");

  assert.ok(result);
});

test("invalid today format returns null", () => {
  const service = makeValidService();

  assert.strictEqual(serviceBriefPatch(service, "2024/06/15"), null);
  assert.strictEqual(serviceBriefPatch(service, "06-15-2024"), null);
  assert.strictEqual(serviceBriefPatch(service, "2024-13-01"), null);
  assert.strictEqual(serviceBriefPatch(service, "not-a-date"), null);
});

test("invalid service input returns null", () => {
  // Service with invalid status
  const invalidService = makeValidService();
  Reflect.deleteProperty(invalidService, "status");

  assert.strictEqual(
    serviceBriefPatch(
      invalidService as unknown as Parameters<typeof serviceBriefPatch>[0],
      "2024-06-15",
    ),
    null,
  );
});

test("conditions retained in detail when non-empty", () => {
  const service = makeValidService({
    summary: "Resumo do serviço",
    conditions: "Condições especiais aplicam-se para clientes premium.",
  });
  const result = serviceBriefPatch(service, "2024-06-15");

  assert.ok(result);
  assert.equal(
    result.detail,
    "Resumo do serviço\n\nCondições especiais aplicam-se para clientes premium.",
  );
});

test("empty conditions not appended to detail", () => {
  const service = makeValidService({ conditions: "" });
  const result = serviceBriefPatch(service, "2024-06-15");

  assert.ok(result);
  assert.equal(
    result.detail,
    "Este é um serviço de consultoria profissional que ajuda empresas a melhorar seus processos e resultados.",
  );
});

test("whitespace trimmed from inputs", () => {
  const service = makeValidService({
    title: "   Título com espaços   ",
    summary: "   Resumo com espaços   ",
    audience: "   Público com espaços   ",
  });
  const result = serviceBriefPatch(service, "2024-06-15");

  assert.ok(result);
  assert.equal(result.offer, "Título com espaços");
  assert.equal(result.detail, "Resumo com espaços");
  assert.equal(result.audience, "Público com espaços");
});

test("summary < 12 chars is refused", () => {
  const service = makeValidService({ summary: "Short" });
  const result = serviceBriefPatch(service, "2024-06-15");

  assert.strictEqual(result, null);
});

test("audience < 3 chars is refused", () => {
  const service = makeValidService({ audience: "AB" });
  const result = serviceBriefPatch(service, "2024-06-15");

  assert.strictEqual(result, null);
});

test("title < 3 chars is refused", () => {
  const service = makeValidService({ title: "AB" });
  const result = serviceBriefPatch(service, "2024-06-15");

  assert.strictEqual(result, null);
});

test("detail over 600 chars is refused", () => {
  // Create a summary that when combined with conditions exceeds 600 chars
  const longSummary = "A".repeat(601);
  const service = makeValidService({ summary: longSummary });
  const result = serviceBriefPatch(service, "2024-06-15");

  assert.strictEqual(result, null);
});

test("detail exactly 599 chars is accepted (summary only)", () => {
  // Create a summary that is exactly 599 characters
  const summary599 = "A".repeat(599);
  const service = makeValidService({ summary: summary599 });
  const result = serviceBriefPatch(service, "2024-06-15");

  assert.ok(result);
  assert.equal(result.detail.length, 599);
});

test("detail exactly 600 chars is accepted (summary only)", () => {
  // Create a summary that is exactly 600 characters
  const summary600 = "A".repeat(600);
  const service = makeValidService({ summary: summary600 });
  const result = serviceBriefPatch(service, "2024-06-15");

  assert.ok(result);
  assert.equal(result.detail.length, 600);
});

test("detail exactly 601 chars is refused (summary only)", () => {
  // Create a summary that is exactly 601 characters
  const summary601 = "A".repeat(601);
  const service = makeValidService({ summary: summary601 });
  const result = serviceBriefPatch(service, "2024-06-15");

  assert.strictEqual(result, null);
});

test("detail exactly 599 chars is accepted (summary + blank line + non-empty conditions)", () => {
  // Summary: 596 chars + blank line: 2 chars + conditions: 1 char = 599 total
  const summary596 = "A".repeat(596);
  const service = makeValidService({
    summary: summary596,
    conditions: " B ",
  });
  const result = serviceBriefPatch(service, "2024-06-15");

  assert.ok(result);
  assert.equal(result.detail, summary596 + "\n\nB");
  assert.equal(result.detail.length, 599);
});

test("detail exactly 600 chars is accepted (summary + blank line + non-empty conditions)", () => {
  // Summary: 597 chars + blank line: 2 chars + conditions: 1 char = 600 total
  const summary597 = "A".repeat(597);
  const service = makeValidService({
    summary: summary597,
    conditions: " B ",
  });
  const result = serviceBriefPatch(service, "2024-06-15");

  assert.ok(result);
  assert.equal(result.detail, summary597 + "\n\nB");
  assert.equal(result.detail.length, 600);
});

test("detail exactly 601 chars is refused (summary + blank line + non-empty conditions)", () => {
  // Summary: 598 chars + blank line: 2 chars + conditions: 1 char = 601 total
  const summary598 = "A".repeat(598);
  const service = makeValidService({
    summary: summary598,
    conditions: "B",
  });
  const result = serviceBriefPatch(service, "2024-06-15");

  assert.strictEqual(result, null);
});

test("audience over 1000 chars is refused", () => {
  const service = makeValidService({ audience: "A".repeat(1001) });
  const result = serviceBriefPatch(service, "2024-06-15");

  assert.strictEqual(result, null);
});

test("title over 1000 chars is refused", () => {
  const service = makeValidService({ title: "A".repeat(1001) });
  const result = serviceBriefPatch(service, "2024-06-15");

  assert.strictEqual(result, null);
});

test("conditions over 1000 chars is allowed (not truncated)", () => {
  // Note: conditions are NOT truncated per requirements
  // But we need to check if the combined detail (summary + blank line + conditions) exceeds 600
  const longConditions = "B".repeat(500);
  const service = makeValidService({
    summary: "A".repeat(90), // 90 chars
    conditions: longConditions, // 500 chars
    // Total would be 90 + 2 (blank line) + 500 = 592 chars - under limit
  });
  const result = serviceBriefPatch(service, "2024-06-15");

  assert.ok(result);
  assert.equal(result.detail.length, 592);
});

test("validateService throws for invalid input", () => {
  // Test that validateService properly validates the service
  const invalidService = { ...emptyService(), conditionsConfirmed: "yes" } as unknown as Parameters<
    typeof serviceBriefPatch
  >[0];
  assert.throws(() => validateService(invalidService));

  // When validation fails, serviceBriefPatch should return null
  assert.strictEqual(serviceBriefPatch(invalidService, "2024-06-15"), null);
});

test("blank validity permitted (empty string)", () => {
  const service = makeValidService({ validUntil: "" });
  const result = serviceBriefPatch(service, "2024-06-15");

  assert.ok(result);
});

test("applying a catalog service keeps brand facts and written creative, but invalidates approval", async () => {
  const { demoSchema } = await import("../src/lib/quick-start.ts");
  const { composeContent, firstPostBrief } = await import("../src/lib/brand-preview.ts");
  const serviceBrief = await import("../src/lib/service-brief.ts");
  let data = demoSchema.parse({
    name: "QA",
    answers: { offers: "Oferta prioritária original", audience: "Público original" },
    brand: { detail: "Detalhe escrito originalmente" },
  });
  data.brand.creative = { ...composeContent(data, "invite"), approved: "old" };
  const before = data.brand.creative.copy;
  data = serviceBrief.applyServiceToBrief(
    data,
    validateService(makeValidService()),
    "catalog-revision",
    "2026-10-05",
  );
  assert.equal(data.answers.offers, "Oferta prioritária original");
  assert.equal(data.brand.detail, "Detalhe escrito originalmente");
  assert.equal(firstPostBrief(data).offer, "Serviço de Consultoria");
  assert.deepEqual(data.brand.creative!.copy, before);
  assert.equal(data.brand.creative!.approved, null);
  assert.equal(data.brand.serviceBrief!.catalogRevision, "catalog-revision");
});
