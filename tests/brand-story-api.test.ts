import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as zod from "zod/v4";
import * as brandStory from "../src/lib/brand-story.ts";

const companyId = "00000000-0000-4000-8000-000000000001";
const source = readFileSync(new URL("../src/routes/api/brand-story.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;

function harness(
  options: {
    authenticated?: boolean;
    tokenValid?: boolean;
    companyExists?: boolean;
    storyError?: string;
    saveError?: boolean;
    saved?: Record<string, unknown>;
  } = {},
) {
  const reads: string[] = [];
  const filters: [string, string, unknown][] = [];
  const writes: Record<string, unknown>[] = [];
  const client = {
    auth: {
      getUser: async () => ({
        data: { user: options.tokenValid === false ? null : { id: "owner" } },
        error: null,
      }),
    },
    from(table: string) {
      reads.push(table);
      const chain = {
        select: () => chain,
        eq: (column: string, value: unknown) => {
          filters.push([table, column, value]);
          return chain;
        },
        upsert: (values: Record<string, unknown>) => {
          writes.push(structuredClone(values));
          return chain;
        },
        single: async () => ({
          data: options.saveError ? null : { updated_at: "2026-09-24T12:00:00Z" },
          error: options.saveError ? { code: "42501" } : null,
        }),
        maybeSingle: async () =>
          table === "companies"
            ? { data: options.companyExists === false ? null : { id: companyId }, error: null }
            : {
                data: options.saved ?? null,
                error: options.storyError ? { code: options.storyError } : null,
              },
      };
      return chain;
    },
  };
  const modules: Record<string, unknown> = {
    "@tanstack/react-router": { createFileRoute: () => (config: unknown) => config },
    "zod/v4": zod,
    "@/lib/brand-story": brandStory,
    "@/lib/supabase-request.server": {
      userClientFromRequest: () => (options.authenticated === false ? null : client),
    },
  };
  const exports: Record<string, unknown> = {};
  runInNewContext(compiled, {
    exports,
    require: (name: string) => {
      if (!(name in modules)) throw new Error("Unexpected import: " + name);
      return modules[name];
    },
    Response,
    URL,
  });
  const route = exports["Route"] as {
    server: {
      handlers: {
        GET: (context: { request: Request }) => Promise<Response>;
        POST: (context: { request: Request }) => Promise<Response>;
      };
    };
  };
  return {
    reads,
    filters,
    writes,
    handlers: Object.keys(route.server.handlers),
    get: (id = companyId) =>
      route.server.handlers.GET({
        request: new Request(`https://local.test/api/brand-story?companyId=${id}`),
      }),
    post: (body: unknown) =>
      route.server.handlers.POST({
        request: new Request("https://local.test/api/brand-story", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        }),
      }),
  };
}

test("read-only availability endpoint reports missing migration distinctly without AI or writes", async () => {
  for (const code of ["PGRST205", "42P01"]) {
    const h = harness({ storyError: code });
    const response = await h.get();
    assert.equal(response.status, 503);
    assert.equal((await response.json()).code, "BRAND_STORY_UNAVAILABLE");
    assert.deepEqual(h.handlers, ["GET", "POST"]);
    assert.deepEqual(h.reads, ["companies", "brand_stories"]);
    assert.deepEqual(h.filters, [
      ["companies", "id", companyId],
      ["brand_stories", "company_id", companyId],
    ]);
    assert.equal(response.headers.get("Cache-Control"), "private, no-store");
  }
});

test("manual story save validates input and writes only the company's story", async () => {
  const story = {
    manifesto: "Nosso trabalho aproxima produtores e clientes.",
    mission: "Organizar entregas de produtores locais.",
    vision: "Queremos ampliar o acesso na região.",
    values: ["Clareza: confirmar cada entrega antes de sair."],
  };
  const body = { action: "save", companyId, story };
  const h = harness();
  const response = await h.post(body);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { story, updatedAt: "2026-09-24T12:00:00Z" });
  assert.deepEqual(h.writes, [{ company_id: companyId, ...story }]);
  assert.deepEqual(h.reads, ["companies", "brand_stories"]);
  for (const option of [
    { authenticated: false },
    { tokenValid: false },
    { companyExists: false },
    { storyError: "42P01" },
    { storyError: "PGRST205" },
  ]) {
    const blocked = harness(option);
    assert.notEqual((await blocked.post(body)).status, 200);
    assert.deepEqual(blocked.writes, []);
  }
  const missing = harness({ storyError: "PGRST205" });
  const unavailable = await missing.post(body);
  assert.equal(unavailable.status, 503);
  assert.equal((await unavailable.json()).code, "BRAND_STORY_UNAVAILABLE");
  const invalid = harness();
  assert.equal((await invalid.post({ ...body, story: { ...story, manifesto: " " } })).status, 400);
  assert.deepEqual(invalid.writes, []);
  assert.equal((await harness({ saveError: true }).post(body)).status, 500);
});

test("invalid sessions, company IDs and inaccessible companies cannot read stories", async () => {
  for (const option of [{ authenticated: false }, { tokenValid: false }]) {
    const h = harness(option);
    assert.equal((await h.get()).status, 401);
    assert.deepEqual(h.reads, []);
  }
  const invalid = harness();
  assert.equal((await invalid.get("invalid")).status, 400);
  assert.deepEqual(invalid.reads, []);
  const inaccessible = harness({ companyExists: false });
  assert.equal((await inaccessible.get()).status, 404);
  assert.deepEqual(inaccessible.reads, ["companies"]);
});

test("saved story is returned intact and transient storage failures do not masquerade as missing data", async () => {
  const story = {
    manifesto: "Nossa marca aproxima produtores e clientes.",
    mission: "Organizar entregas de produtores locais.",
    vision: "Queremos ampliar o acesso na região.",
    values: ["Clareza: confirmar cada entrega antes de sair."],
  };
  const updated_at = "2026-09-24T12:00:00Z";
  const response = await harness({ saved: { ...story, updated_at } }).get();
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { story, updatedAt: updated_at });
  assert.deepEqual(await (await harness().get()).json(), { story: null, updatedAt: null });
  const unavailable = await harness({ storyError: "42501" }).get();
  assert.equal(unavailable.status, 500);
  assert.equal((await unavailable.json()).code, undefined);
  assert.equal((await harness({ saved: { ...story, values: 123, updated_at } }).get()).status, 500);
});
