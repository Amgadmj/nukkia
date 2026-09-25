import { test } from "node:test";
import assert from "node:assert/strict";

const moduleUrl = new URL("../scripts/check-demo-readiness.mjs", import.meta.url);
const env = {
  SUPABASE_URL: "https://demo-readiness.supabase.co",
  VITE_SUPABASE_URL: "https://demo-readiness.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_TEST_KEY_MUST_NOT_PRINT",
  VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_TEST_KEY_MUST_NOT_PRINT",
  ANTHROPIC_API_KEY: "PRIVATE_TEXT_KEY_MUST_NOT_PRINT",
  GEMINI_API_KEY: "PRIVATE_IMAGE_KEY_MUST_NOT_PRINT",
  NITRO_PRESET: "node-server",
};

test("readiness defaults to offline checks and never exposes configured values", async () => {
  const { checkDemoReadiness } = await import(moduleUrl.href);
  const result = await checkDemoReadiness({
    env,
    ffmpegAvailable: true,
    fetchImpl: () => {
      throw new Error("Network forbidden");
    },
  });
  assert.equal(result.ok, true);
  const output = JSON.stringify(result);
  for (const value of Object.values(env).filter((value) => value.includes("MUST_NOT_PRINT")))
    assert.ok(!output.includes(value));
  assert.ok(
    result.checks.some(
      (check: { name: string; status: string }) =>
        check.name === "remote_tables" && check.status === "skip",
    ),
  );
});

test("opt-in remote readiness makes only zero-row GETs and reports missing tables without raw errors", async () => {
  const { checkDemoReadiness } = await import(moduleUrl.href);
  const paths: string[] = [];
  const result = await checkDemoReadiness({
    env,
    ffmpegAvailable: true,
    remote: true,
    fetchImpl: async (input: URL, init: RequestInit) => {
      const url = new URL(input);
      assert.equal(init.method, "GET");
      assert.equal(init.redirect, "error");
      assert.equal(url.searchParams.get("limit"), "0");
      assert.equal(url.searchParams.get("select"), "company_id");
      paths.push(url.pathname);
      return Response.json(
        { code: "PGRST205", message: "PRIVATE_BACKEND_DETAILS" },
        { status: 404 },
      );
    },
  });
  assert.deepEqual(paths.sort(), [
    "/rest/v1/brand_stories",
    "/rest/v1/marketing_workspaces",
    "/rest/v1/onboarding_drafts",
  ]);
  assert.equal(result.ok, false);
  assert.equal(
    result.checks.filter((check: { code: string }) => check.code === "PGRST205").length,
    3,
  );
  assert.ok(!JSON.stringify(result).includes("PRIVATE_BACKEND_DETAILS"));
});

test("readiness refuses elevated credentials, mismatched projects, and the default worker deployment", async () => {
  const { checkDemoReadiness } = await import(moduleUrl.href);
  for (const overrides of [
    { SUPABASE_PUBLISHABLE_KEY: "sb_secret_FORBIDDEN" },
    { VITE_SUPABASE_URL: "https://another.supabase.co" },
    { NITRO_PRESET: "" },
  ]) {
    let calls = 0;
    const result = await checkDemoReadiness({
      env: { ...env, ...overrides },
      ffmpegAvailable: true,
      remote: true,
      fetchImpl: () => {
        calls++;
        throw new Error();
      },
    });
    assert.equal(result.ok, false);
    assert.equal(calls, 0);
  }
});

test("table exposure is distinguished from signed-in access and ffmpeg availability is required", async () => {
  const { checkDemoReadiness } = await import(moduleUrl.href);
  const result = await checkDemoReadiness({
    env,
    ffmpegAvailable: false,
    remote: true,
    fetchImpl: async () => Response.json({ code: "42501" }, { status: 401 }),
  });
  assert.equal(result.ok, false);
  assert.ok(
    result.checks.some(
      (check: { name: string; status: string }) =>
        check.name === "ffmpeg" && check.status === "fail",
    ),
  );
  assert.equal(
    result.checks.filter((check: { code: string }) => check.code === "exposed_access_restricted")
      .length,
    3,
  );
});
