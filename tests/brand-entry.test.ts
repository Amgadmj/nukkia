import test from "node:test";
import assert from "node:assert/strict";
import * as onboarding from "../src/lib/onboarding.ts";

test("website entry accepts bare and www domains and produces one HTTPS URL", () => {
  assert.equal(typeof onboarding.normalizeWebsite, "function");
  for (const [input, expected] of [
    [" clinica.com.br ", "https://clinica.com.br/"],
    ["www.clinica.com.br/sobre", "https://www.clinica.com.br/sobre"],
    ["http://clinica.com.br", "https://clinica.com.br/"],
    ["https://clinica.com.br/#equipe", "https://clinica.com.br/"],
  ])
    assert.equal(onboarding.normalizeWebsite(input!), expected);
});
test("website entry rejects credentials, local addresses and non-web schemes", () => {
  assert.equal(typeof onboarding.normalizeWebsite, "function");
  for (const input of [
    "",
    "foo",
    "localhost",
    "127.0.0.1",
    "https://10.0.0.1",
    "https://user:pass@clinica.com",
    "javascript:alert(1)",
    "ftp://clinica.com",
    "clinica.local",
    "clinica.com:123",
    "cl inica.com",
  ]) {
    assert.throws(() => onboarding.normalizeWebsite(input));
  }
});
test("business Instagram accepts handle or profile URL without accepting another site or content URL", () => {
  assert.equal(typeof onboarding.normalizeInstagram, "function");
  for (const input of [
    "@clinica.qa",
    "clinica.qa",
    "www.instagram.com/clinica.qa/",
    "https://instagram.com/clinica.qa/?hl=pt",
  ])
    assert.equal(onboarding.normalizeInstagram(input), "@clinica.qa");
  for (const input of [
    "https://evil.com/clinica",
    "instagram.com/p/post",
    "@bad handle",
    "../admin",
    "instagram.com/accounts",
    "instagram.com/",
  ])
    assert.throws(() => onboarding.normalizeInstagram(input));
});
