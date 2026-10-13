import test from "node:test";
import assert from "node:assert/strict";
import { handleBrandPreview } from "../src/lib/brand-preview.server.ts";
import { researchSchema } from "../src/lib/brand-preview.ts";
const request = (overrides = {}) =>
  new Request("http://localhost:8081/api/brand-preview", {
    method: "POST",
    headers: { Origin: "http://localhost:8081", "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "research",
      url: "https://marca.com",
      material: "",
      stream: true,
      siteAuthorized: true,
      aiAuthorized: true,
      ...overrides,
    }),
  });
const source = {
  url: "https://marca.com",
  title: "Marca",
  text: "Aulas de pilates em pequenos grupos.",
  fetchedAt: "2026-09-24T12:00:00Z",
};
test("stream publishes real collection then grounded recommendations and complementary evidence", async () => {
  let round = 0;
  const response = await handleBrandPreview(request(), true, {
    collect: async () =>
      researchSchema.parse({
        status: "ready",
        sources: ++round === 1 ? [source] : [source, { ...source, url: "https://marca.com/faq" }],
      }),
    synthesize: async () =>
      researchSchema.parse({
        suggestions: [
          { field: "offers", value: "Aulas de pilates", quote: source.text, sourceUrl: source.url },
        ],
      }).suggestions,
  });
  assert.match(response.headers.get("content-type") ?? "", /ndjson/);
  const events = (await response.text())
    .trim()
    .split("\n")
    .map((x) => JSON.parse(x).research);
  assert.ok(events.some((x) => x.phase === "synthesizing" && x.sources.length === 1));
  assert.ok(events.some((x) => x.phase === "deepening" && x.suggestions.length > 0));
  assert.equal(events.at(-1).phase, "complete");
  assert.equal(events.at(-1).sources.length, 2);
});
test("missing AI authorization never invokes the provider and failing provider preserves sources", async () => {
  let calls = 0;
  const deps = {
    collect: async () => researchSchema.parse({ status: "ready", sources: [source] }),
    synthesize: async () => {
      calls++;
      throw new Error("private upstream payload");
    },
  };
  const local = await handleBrandPreview(request({ aiAuthorized: false }), true, deps);
  const a = await local.text();
  assert.equal(calls, 0);
  assert.match(a, /local/);
  const external = await handleBrandPreview(request(), true, deps);
  const b = await external.text();
  assert.equal(calls, 1);
  assert.match(b, /unavailable/);
  assert.doesNotMatch(b, /private upstream/);
});

test("canceling during collection never starts synthesis", async () => {
  const abort = new AbortController();
  const original = request();
  const canceledRequest = new Request(original, { signal: abort.signal });
  let calls = 0;
  const response = await handleBrandPreview(canceledRequest, true, {
    collect: async () => {
      abort.abort();
      return researchSchema.parse({ status: "ready", sources: [source] });
    },
    synthesize: async () => {
      calls++;
      return [];
    },
  });
  await response.text();
  assert.equal(calls, 0);
});

test("authorized hosted research reads the normalized public site and keeps source evidence", async () => {
  let seen = "";
  const hosted = new Request("https://nukkia.example/api/brand-preview", {
    method: "POST",
    headers: { Origin: "https://nukkia.example", "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "research",
      url: "www.marca.com",
      material: "",
      siteAuthorized: true,
      aiAuthorized: false,
      stream: true,
    }),
  });
  const response = await handleBrandPreview(hosted, false, {
    authorize: async () => true,
    collect: async (url) => {
      seen = url;
      return researchSchema.parse({ status: "ready", sources: [source] });
    },
    synthesize: async () => {
      throw Error("AI must not run");
    },
  });
  assert.equal(response.status, 200);
  const events = (await response.text())
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line).research);
  assert.equal(seen, "https://www.marca.com/");
  assert.equal(events.at(-1).sources[0].text, source.text);
  assert.equal(events.at(-1).phase, "complete");
});
test("hosted research rejects cross-origin callers and unauthenticated callers before fetching", async () => {
  let calls = 0;
  const deps = {
    authorize: async () => false,
    collect: async () => {
      calls++;
      return researchSchema.parse({});
    },
    synthesize: async () => [],
  };
  const response = await handleBrandPreview(
    new Request("https://nukkia.example/api/brand-preview", {
      method: "POST",
      headers: { origin: "https://nukkia.example" },
    }),
    false,
    deps,
  );
  assert.equal(response.status, 401);
  const cross = await handleBrandPreview(
    new Request("https://nukkia.example/api/brand-preview", {
      method: "POST",
      headers: { origin: "https://evil.example" },
    }),
    false,
    { ...deps, authorize: async () => true },
  );
  assert.equal(cross.status, 403);
  assert.equal(calls, 0);
});
