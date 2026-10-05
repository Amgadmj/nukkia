import { test } from "node:test";
import assert from "node:assert/strict";
import { validateService, emptyService } from "../src/lib/service-catalog.ts";

test("validateService accepts empty validUntil", () => {
  const service = emptyService();
  service.title = "Test service";
  service.validUntil = "";
  assert.doesNotThrow(() => validateService(service));
});

test("validateService accepts 2028-02-29 (leap year)", () => {
  const service = emptyService();
  service.title = "Test service";
  service.validUntil = "2028-02-29";
  assert.doesNotThrow(() => validateService(service));
});

test("validateService rejects 2026-02-29 (not a leap year)", () => {
  const service = emptyService();
  service.title = "Test service";
  service.validUntil = "2026-02-29";
  assert.throws(() => validateService(service), /data de validade válida/);
});

test("validateService rejects 2026-02-30 (invalid date)", () => {
  const service = emptyService();
  service.title = "Test service";
  service.validUntil = "2026-02-30";
  assert.throws(() => validateService(service), /data de validade válida/);
});

test("validateService rejects malformed date format", () => {
  const service = emptyService();
  service.title = "Test service";
  service.validUntil = "29-02-2026";
  assert.throws(() => validateService(service), /data de validade válida/);
});
