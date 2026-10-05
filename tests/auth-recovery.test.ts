import test from "node:test";
import assert from "node:assert/strict";
import * as recovery from "../src/lib/auth-recovery.ts";
test("recovery returns only to this origin and password confirmation is required", () => {
  assert.equal(
    recovery.authRecoveryUrl("https://nukkia.example"),
    "https://nukkia.example/auth?modo=redefinir",
  );
  assert.equal(recovery.passwordIssue("12345678", "different"), "As senhas não coincidem.");
  assert.ok(recovery.passwordIssue("short", "short"));
  assert.equal(recovery.passwordIssue("valid-password", "valid-password"), null);
});
