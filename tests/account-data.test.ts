import test from "node:test";
import assert from "node:assert/strict";
import * as account from "../src/lib/account-data.server.ts";
test("export paginates all owned stores, includes current workspace and reports failed reads", async () => {
  const calls: string[] = [];
  const result = await account.collectAccountData(
    "qa-owner",
    async (table, field, values, offset) => {
      calls.push(table);
      if (table === "companies") {
        assert.equal(field, "owner_id");
        assert.deepEqual(values, ["qa-owner"]);
        return { data: [{ id: "qa-company" }], error: null };
      }
      if (table === "profiles") return { data: [{ id: "qa-owner" }], error: null };
      assert.deepEqual(values, ["qa-company"]);
      if (table === "brand_stories") return { data: null, error: new Error("unavailable") };
      if (table === "content_items" && offset === 0)
        return { data: Array.from({ length: 500 }, (_, i) => ({ id: i })), error: null };
      return { data: [{ id: table }], error: null };
    },
  );
  assert.equal(result.complete, false);
  assert.deepEqual(result.unavailable, ["brand_stories"]);
  assert.equal(result.records.content_items!.length, 501);
  assert.ok(calls.includes("marketing_workspaces"));
  assert.ok(calls.includes("onboarding_drafts"));
  assert.equal(
    calls.some((name) => name.includes("secrets")),
    false,
  );
});
test("failure to determine ownership stops child-table export", async () => {
  const calls: string[] = [];
  await assert.rejects(
    account.collectAccountData("qa", async (table) => {
      calls.push(table);
      return { data: null, error: new Error("failed") };
    }),
    /empresa/,
  );
  assert.ok(calls.every((table) => table === "companies" || table === "profiles"));
});
test("nested and paginated storage files are all purged before account removal", async () => {
  const removed: string[] = [];
  const result = await account.purgeStorageTree(
    {
      list: async (prefix, offset) => ({
        data:
          prefix === "qa-company"
            ? offset === 0
              ? [
                  ...Array.from({ length: 99 }, (_, i) => ({ name: `image-${i}.png`, id: `${i}` })),
                  { name: "nested", id: null },
                ]
              : [{ name: "last.png", id: "last" }]
            : [{ name: "child.png", id: "child" }],
        error: null,
      }),
      remove: async (paths) => {
        removed.push(...paths);
        return { error: null };
      },
    },
    "qa-company",
  );
  assert.equal(result, 101);
  assert.ok(removed.includes("qa-company/nested/child.png"));
  assert.ok(removed.includes("qa-company/last.png"));
});
test("purge errors abort deletion and keep it retryable", async () => {
  let deleted = false;
  await assert.rejects(
    account.deleteOwnedAccount({
      companies: async () => ["qa-company"],
      purge: async () => {
        throw new Error("purge failed");
      },
      deleteUser: async () => {
        deleted = true;
      },
    }),
  );
  assert.equal(deleted, false);
});
