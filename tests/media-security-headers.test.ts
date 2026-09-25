import test from "node:test";
import assert from "node:assert/strict";
import { SECURITY_HEADERS } from "../src/lib/security-headers.ts";

test("media policy allows local composed previews and saved Supabase media only", () => {
  const policy = SECURITY_HEADERS["Content-Security-Policy"]!;
  assert.equal(
    policy.split("; ").find((rule) => rule.startsWith("media-src ")),
    "media-src 'self' blob: https://*.supabase.co",
  );
  assert.ok(policy.includes("default-src 'self'"));
});
