import test from "node:test";
import assert from "node:assert/strict";
import {
  handleBrandPreview,
  PREVIEW_LIMITS,
  resetBrandPreviewLimits,
} from "../src/lib/brand-preview.server.ts";
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
  const localResearch = JSON.parse(a.trim().split("\n").at(-1)!).research;
  assert.ok(
    localResearch.suggestions.some(
      (item: { origin: string; sourceUrl: string; quote: string }) =>
        item.origin === "extracted" && item.sourceUrl === source.url && item.quote === source.text,
    ),
  );
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

// Production requests: a real host, a same-origin browser and a signed-in user.
const prodRequest = (
  overrides: Record<string, unknown> = {},
  { origin = "https://www.nukkia.com", token = "a.b.c" }: { origin?: string; token?: string } = {},
) =>
  new Request("https://www.nukkia.com/api/brand-preview", {
    method: "POST",
    headers: {
      Origin: origin,
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      action: "research",
      url: "",
      material: "Texto da marca colado pelo usuário.",
      stream: false,
      siteAuthorized: true,
      aiAuthorized: false,
      ...overrides,
    }),
  });
const noNetwork = {
  collect: async () => researchSchema.parse({ status: "ready", sources: [source] }),
  synthesize: async () => [],
};
const events = async (response: Response) =>
  (await response.text())
    .trim()
    .split("\n")
    .map((x) => JSON.parse(x).research);

test("production readings require a signed-in user and answer 401 in Portuguese otherwise", async () => {
  resetBrandPreviewLimits();
  const verified: string[] = [];
  const response = await handleBrandPreview(prodRequest(), false, {
    ...noNetwork,
    verifyUser: async (request) => {
      verified.push(request.headers.get("authorization") ?? "");
      return null;
    },
  });
  assert.equal(response.status, 401);
  const body = await response.json();
  assert.equal(body.code, "auth-required");
  assert.match(body.message, /Entre na sua conta/);
  assert.deepEqual(verified, ["Bearer a.b.c"]);
  // Without a bearer token the real Supabase verifier refuses before any network call.
  assert.equal(
    (await handleBrandPreview(prodRequest({}, { token: "" }), false, noNetwork)).status,
    401,
  );
});

test("a signed-in same-origin user can read in production; cross-origin is refused first", async () => {
  resetBrandPreviewLimits();
  let verifications = 0;
  const deps = {
    ...noNetwork,
    verifyUser: async () => {
      verifications++;
      return "user-prod";
    },
  };
  const ok = await handleBrandPreview(prodRequest(), false, deps);
  assert.equal(ok.status, 200);
  assert.equal((await ok.json()).research.sources[0].url, "material:fornecido");
  const streamed = await handleBrandPreview(
    prodRequest({ url: "https://marca.com", material: "", stream: true }),
    false,
    deps,
  );
  assert.equal(streamed.status, 200);
  assert.equal((await events(streamed)).at(-1).phase, "complete");
  assert.equal(verifications, 2);
  const cross = await handleBrandPreview(
    prodRequest({}, { origin: "https://attacker.example" }),
    false,
    deps,
  );
  assert.equal(cross.status, 403);
  const withoutOrigin = prodRequest();
  withoutOrigin.headers.delete("origin");
  assert.equal((await handleBrandPreview(withoutOrigin, false, deps)).status, 403);
  assert.equal(verifications, 2, "cross-origin requests never reach session verification");
});

test("local development on localhost still works without a session", async () => {
  resetBrandPreviewLimits();
  let verifications = 0;
  const response = await handleBrandPreview(
    request({ stream: false, url: "", material: "Olá marca" }),
    true,
    {
      ...noNetwork,
      verifyUser: async () => {
        verifications++;
        return null;
      },
    },
  );
  assert.equal(response.status, 200);
  assert.equal(verifications, 0);
});

test("the rate limit is per user: one account's burst does not block another", async () => {
  resetBrandPreviewLimits();
  const as = (user: string) => ({ ...noNetwork, verifyUser: async () => user });
  for (let i = 0; i < PREVIEW_LIMITS.userRequests; i++)
    assert.equal((await handleBrandPreview(prodRequest(), false, as("user-a"))).status, 200);
  const limited = await handleBrandPreview(prodRequest(), false, as("user-a"));
  assert.equal(limited.status, 429);
  assert.equal((await limited.json()).code, "rate-limited");
  assert.equal((await handleBrandPreview(prodRequest(), false, as("user-b"))).status, 200);
});

test("concurrent readings are capped per user and globally, and slots are released", async () => {
  resetBrandPreviewLimits();
  const hanging = (user: string) =>
    ({
      collect: (_url: string, options: { signal?: AbortSignal } = {}) =>
        new Promise<never>((_, reject) =>
          options.signal?.addEventListener("abort", () => reject(new Error("aborted"))),
        ),
      synthesize: async () => [],
      verifyUser: async () => user,
    }) as never;
  const stream = (user: string) =>
    handleBrandPreview(
      prodRequest({ url: "https://marca.com", material: "", stream: true }),
      false,
      hanging(user),
    );
  const open = [await stream("busy"), await stream("busy")];
  for (const response of open) assert.equal(response.status, 200);
  assert.equal((await stream("busy")).status, 429, "per-user concurrency");
  for (let i = open.length; i < PREVIEW_LIMITS.globalActive; i++) {
    const response = await stream(`other-${i}`);
    assert.equal(response.status, 200);
    open.push(response);
  }
  assert.equal((await stream("fresh")).status, 429, "global concurrency");
  for (const response of open) await response.body?.cancel();
  await new Promise((resolve) => setTimeout(resolve, 20));
  const again = await stream("fresh");
  assert.equal(again.status, 200);
  await again.body?.cancel();
});

test("synthesis runs for any provider-eligible evidence, not only when a URL was typed", async () => {
  resetBrandPreviewLimits();
  let collects = 0;
  const synthesized: string[][] = [];
  const deps = {
    collect: async () => {
      collects++;
      return researchSchema.parse({ status: "ready", sources: [source] });
    },
    synthesize: async (research: { sources: { url: string }[] }) => {
      synthesized.push(research.sources.map((item) => item.url));
      return researchSchema.parse({
        suggestions: [
          { field: "offers", value: "Aulas de pilates", quote: source.text, sourceUrl: source.url },
        ],
      }).suggestions;
    },
  } as never;
  // A URL plus pasted material: synthesis sees both sources.
  const both = await events(
    await handleBrandPreview(request({ material: "Texto extra." }), true, deps),
  );
  assert.ok(both.some((x) => x.synthesis === "ready"));
  assert.deepEqual(synthesized[0], [source.url, "material:fornecido"]);
  // Pasted material alone never reaches the provider (privacy design: the AI
  // consent covers public site excerpts only) and is reported as local, not failed.
  const materialOnly = await events(
    await handleBrandPreview(
      request({ url: "", material: "Aulas de pilates em pequenos grupos." }),
      true,
      deps,
    ),
  );
  assert.equal(materialOnly.at(-1).synthesis, "local");
  assert.equal(materialOnly.at(-1).message, "");
  assert.equal(materialOnly.at(-1).sources[0].url, "material:fornecido");
  assert.equal(synthesized.length, 1, "material-only input never calls the provider");
  assert.equal(collects, 2, "initial + deepening pass for the URL reading only");
});

test("hosted research rejects cross-origin callers and unauthenticated callers before fetching", async () => {
  resetBrandPreviewLimits();
  let calls = 0;
  const deps = {
    verifyUser: async () => null,
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
    { ...deps, verifyUser: async () => "normalization-qa" },
  );
  assert.equal(cross.status, 403);
  assert.equal(calls, 0);
});

test("authorized hosted research reads the normalized public site and keeps source evidence", async () => {
  resetBrandPreviewLimits();
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
    verifyUser: async () => "normalization-qa",
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
