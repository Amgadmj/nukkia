import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as zod from "zod";
import * as onboarding from "../src/lib/onboarding.ts";

const companyId = "00000000-0000-4000-8000-000000000001";
const ownerId = "00000000-0000-4000-8000-000000000002";
const otherOwner = "00000000-0000-4000-8000-000000000003";
type Row = {
  company_id: string;
  owner_id: string;
  draft: unknown;
  revision: string;
  updated_at: string;
};
const compiled = ts.transpileModule(
  readFileSync(new URL("../src/routes/api/onboarding-draft.ts", import.meta.url), "utf8"),
  {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  },
).outputText;

function harness(
  options: { authenticated?: boolean; companyOwner?: string; databaseCode?: string } = {},
) {
  let row: Row | null = null;
  const queries: { table: string; operation: string; filters: Record<string, string> }[] = [];
  const db = {
    auth: {
      getUser: async () => ({
        data: { user: options.authenticated === false ? null : { id: ownerId } },
        error: null,
      }),
    },
    from(table: string) {
      const query = { table, operation: "select", filters: {} as Record<string, string> };
      queries.push(query);
      let values: Omit<Row, "updated_at"> | null = null;
      const chain = {
        select: () => chain,
        eq: (key: string, value: string) => {
          query.filters[key] = value;
          return chain;
        },
        insert: (input: Omit<Row, "updated_at">) => {
          query.operation = "insert";
          values = input;
          return chain;
        },
        update: (input: Omit<Row, "updated_at">) => {
          query.operation = "update";
          values = input;
          return chain;
        },
        maybeSingle: async () => {
          if (table === "companies") {
            const visible =
              query.filters["id"] === companyId &&
              query.filters["owner_id"] === (options.companyOwner ?? ownerId);
            return { data: visible ? { id: companyId } : null, error: null };
          }
          assert.equal(table, "onboarding_drafts");
          if (options.databaseCode) return { data: null, error: { code: options.databaseCode } };
          if (query.operation === "insert") {
            if (row) return { data: null, error: { code: "23505" } };
            row = { ...values!, updated_at: "2026-09-24T12:00:00Z" };
          } else {
            const matches =
              row &&
              Object.entries(query.filters).every(
                ([key, value]) => row![key as keyof Row] === value,
              );
            if (!matches) return { data: null, error: null };
            if (query.operation === "update")
              row = { ...values!, updated_at: "2026-09-24T12:00:01Z" };
          }
          return { data: row, error: null };
        },
      };
      return chain;
    },
  };
  const modules: Record<string, unknown> = {
    "@tanstack/react-router": { createFileRoute: () => (config: unknown) => config },
    zod,
    "@/lib/onboarding": onboarding,
    "@/lib/supabase-request.server": { userClientFromRequest: () => db },
  };
  const exports: Record<string, unknown> = {};
  runInNewContext(compiled, {
    exports,
    Response,
    URL,
    crypto,
    require: (name: string) => {
      assert.ok(name in modules, name);
      return modules[name];
    },
  });
  const handler = exports["handleDraftRequest"] as (request: Request) => Promise<Response>;
  return {
    queries,
    row: () => row,
    request: (method: string, body?: unknown) =>
      handler(
        new Request(`http://test.local/api/onboarding-draft?companyId=${companyId}`, {
          method,
          ...(body === undefined
            ? {}
            : { body: JSON.stringify(body), headers: { "Content-Type": "application/json" } }),
        }),
      ),
  };
}
const content = (offers: string) => ({
  version: 1,
  answers: { offers, restrictions: "Regra antiga" },
  step: 2,
});

test("draft API saves raw text separately from diagnostics and scopes every request to the owner", async () => {
  const h = harness();
  const response = await h.request("POST", {
    companyId,
    baseRevision: null,
    draft: content("  Em andamento \n"),
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  const saved = (await response.json()).draft;
  assert.equal(saved.draft.answers.offers, "  Em andamento \n");
  assert.equal(saved.draft.answers.restrictions, "Regra antiga");
  const read = await h.request("GET");
  assert.deepEqual((await read.json()).draft, saved);
  assert.ok(h.queries.every((query) => ["companies", "onboarding_drafts"].includes(query.table)));
  assert.ok(
    h.queries
      .filter((query) => query.operation === "select")
      .every((query) => query.filters["owner_id"] === ownerId),
  );
  assert.equal(h.row()?.owner_id, ownerId);
});
test("stale updates, duplicate creates and stale completion requests cannot overwrite cloud data", async () => {
  const h = harness();
  const first = await h.request("POST", { companyId, baseRevision: null, draft: content("First") });
  const firstRevision = (await first.json()).draft.revision;
  assert.equal(
    (await h.request("POST", { companyId, baseRevision: firstRevision, draft: content("Second") }))
      .status,
    200,
  );
  const current = h.row();
  for (const [method, baseRevision] of [
    ["POST", firstRevision],
    ["POST", null],
    ["DELETE", firstRevision],
  ] as const) {
    const response = await h.request(method, { companyId, baseRevision, draft: content("Stale") });
    assert.equal(response.status, 409);
    assert.deepEqual(h.row(), current);
  }
  const cleared = await h.request("DELETE", { companyId, baseRevision: current!.revision });
  assert.equal(cleared.status, 200);
  assert.equal((await cleared.json()).draft.draft, null);
  assert.equal(h.row()?.draft, null);
  assert.notEqual(h.row()?.revision, current!.revision);
});
test("missing or inactive schema returns a recoverable local-fallback response", async () => {
  for (const databaseCode of ["42P01", "PGRST205", "PGRST204"]) {
    const h = harness({ databaseCode });
    const response = await h.request("GET");
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { code: "schema-unavailable" });
    assert.equal(h.row(), null);
  }
});
test("unauthenticated callers, another owner's company, invalid revisions and oversized answers cannot save", async () => {
  const unauthenticated = harness({ authenticated: false });
  assert.equal((await unauthenticated.request("GET")).status, 401);
  assert.deepEqual(unauthenticated.queries, []);
  const inaccessible = harness({ companyOwner: otherOwner });
  assert.equal(
    (
      await inaccessible.request("POST", {
        companyId,
        baseRevision: null,
        draft: content("Private"),
      })
    ).status,
    404,
  );
  assert.ok(inaccessible.queries.every((query) => query.table === "companies"));
  const h = harness();
  for (const body of [
    { companyId, baseRevision: "invalid", draft: content("Answer") },
    { companyId, baseRevision: null, draft: content("x".repeat(1001)) },
    { companyId, baseRevision: null, draft: { ...content("Answer"), step: 5 } },
  ])
    assert.equal((await h.request("POST", body)).status, 400);
  assert.equal(h.row(), null);
});
