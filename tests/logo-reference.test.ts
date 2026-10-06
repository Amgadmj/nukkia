import test from "node:test";
import assert from "node:assert/strict";
import * as logo from "../src/lib/logo-reference.ts";
test("expired signed logo can recover its durable owned path without reusing tokens", () => {
  assert.equal(
    logo.ownedLogoPath(
      "https://project.supabase.co/storage/v1/object/sign/brand-assets/qa/logo.png?token=expired",
      "https://project.supabase.co",
      "qa",
    ),
    "qa/logo.png",
  );
  assert.equal(
    logo.ownedLogoPath(
      "https://foreign.test/storage/v1/object/sign/brand-assets/qa/logo.png",
      "https://project.supabase.co",
      "qa",
    ),
    null,
  );
  assert.equal(
    logo.ownedLogoPath(
      "https://project.supabase.co/storage/v1/object/sign/brand-assets/other/logo.png",
      "https://project.supabase.co",
      "qa",
    ),
    null,
  );
});
