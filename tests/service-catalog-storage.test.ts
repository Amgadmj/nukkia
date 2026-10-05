import { test } from "node:test";
import assert from "node:assert/strict";
import { emptyService, putService } from "../src/lib/service-catalog.ts";
import {
  catalogScopeKey,
  catalogLogoutKey,
  readCatalog,
  saveCatalog,
  resetCatalog,
} from "../src/lib/service-catalog-storage.ts";
const demo = { kind: "demo" } as const;
const account = (ownerId: string, companyId: string) =>
  ({ kind: "account", ownerId, companyId }) as const;
function store() {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (k: string) => values.get(k) ?? null,
    setItem: (k: string, v: string) => {
      values.set(k, v);
    },
    removeItem: (k: string) => {
      values.delete(k);
    },
  };
}
const add = (s: ReturnType<typeof readCatalog>) =>
  putService(s.catalog, { ...emptyService(), title: "Consulta" });
test("owner, company and fictional demo namespaces stay isolated; account logout prefix matches", () => {
  const s = store();
  const scope = account("a", "x");
  const a = readCatalog(s, scope);
  assert.equal(saveCatalog(s, scope, a, add(a)).kind, "saved");
  for (const other of [account("a", "y"), account("b", "x"), demo])
    assert.equal(readCatalog(s, other).catalog.items.length, 0);
  assert.ok(catalogScopeKey(scope).startsWith("nukkia:workspace-recovery:v1:a:"));
  assert.equal(catalogLogoutKey(scope), "nukkia:workspace-recovery:v1:a:logout");
  assert.notEqual(catalogScopeKey(account("a:b", "c")), catalogScopeKey(account("a", "b:c")));
  assert.throws(() => catalogScopeKey(account("", "x")));
});
test("reload recovers a saved catalog and stale second-tab saves preserve the local draft", () => {
  const s = store();
  const a = readCatalog(s, demo);
  const b = readCatalog(s, demo);
  const draft = add(a);
  const result = saveCatalog(s, demo, a, draft);
  assert.equal(result.kind, "saved");
  assert.equal(readCatalog(s, demo).catalog.items.length, 1);
  const conflict = saveCatalog(s, demo, b, add(b));
  assert.equal(conflict.kind, "conflict");
  assert.equal(draft.items[0]?.title, "Consulta");
  assert.equal(readCatalog(s, demo).catalog.items[0]?.id, draft.items[0]?.id);
});
test("corrupt bytes survive reads and saves; reset requires an explicit unchanged snapshot", () => {
  const s = store();
  const key = catalogScopeKey(demo);
  s.setItem(key, "{broken");
  const a = readCatalog(s, demo);
  assert.equal(a.issue, "corrupt");
  assert.equal(saveCatalog(s, demo, a, add(a)).kind, "corrupt");
  assert.equal(s.getItem(key), "{broken");
  const reset = resetCatalog(s, demo, a);
  assert.equal(reset.kind, "saved");
  assert.equal(readCatalog(s, demo).catalog.items.length, 0);
  s.setItem(key, "different");
  assert.equal(resetCatalog(s, demo, a).kind, "conflict");
  assert.equal(s.getItem(key), "different");
});
test("storage failures never erase the draft or report saved", () => {
  const s = store();
  const a = readCatalog(s, demo);
  const draft = add(a);
  s.setItem = () => {
    throw Error("quota");
  };
  assert.equal(saveCatalog(s, demo, a, draft).kind, "unavailable");
  assert.equal(draft.items.length, 1);
  const blocked = {
    getItem: () => {
      throw Error("denied");
    },
    setItem: () => {
      throw Error("denied");
    },
  };
  const initial = readCatalog(blocked, demo);
  assert.equal(initial.issue, "unavailable");
  assert.equal(saveCatalog(s, demo, initial, draft).kind, "unavailable");
});
test("logout marker changes or deletion revoke old snapshots before any write", () => {
  for (const next of ["logout-next", null]) {
    const s = store();
    const scope = account("a", "x");
    const key = catalogLogoutKey(scope)!;
    s.setItem(key, "old");
    const a = readCatalog(s, scope);
    if (next) s.setItem(key, next);
    else s.removeItem(key);
    assert.equal(saveCatalog(s, scope, a, add(a)).kind, "revoked");
    assert.equal(s.getItem(catalogScopeKey(scope)), null);
  }
});
test("logout during setItem revokes the write and removes only the writer's stale bytes", () => {
  const s = store();
  const scope = account("a", "x"),
    key = catalogScopeKey(scope),
    marker = catalogLogoutKey(scope)!;
  s.setItem(marker, "epoch-before");
  const base = readCatalog(s, scope);
  const set = s.setItem;
  s.setItem = (k, v) => {
    set(k, v);
    if (k === key) set(marker, "epoch-after");
  };
  assert.equal(saveCatalog(s, scope, base, add(base)).kind, "revoked");
  assert.equal(s.getItem(key), null);
  assert.equal(readCatalog(s, scope).catalog.items.length, 0);
});
test("account reads reject catalogs belonging to an earlier logout epoch", () => {
  const s = store();
  const scope = account("a", "x"),
    key = catalogScopeKey(scope),
    marker = catalogLogoutKey(scope)!;
  s.setItem(marker, "epoch-before");
  const base = readCatalog(s, scope);
  assert.equal(saveCatalog(s, scope, base, add(base)).kind, "saved");
  const stale = s.getItem(key)!;
  s.setItem(marker, "epoch-after");
  s.setItem(key, stale);
  const read = readCatalog(s, scope);
  assert.equal(read.issue, "revoked");
  assert.equal(read.catalog.items.length, 0);
  assert.equal(s.getItem(key), stale);
});
