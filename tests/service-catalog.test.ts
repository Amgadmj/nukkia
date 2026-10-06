import { test } from "node:test";
import assert from "node:assert/strict";
import {
  emptyCatalog,
  parseCatalog,
  putService,
  setServiceStatus,
  selectService,
  emptyService,
} from "../src/lib/service-catalog.ts";
const scope = "demo";
test("service edits are separate from existing brand offers", () => {
  const offers = { offers: "Existing brand offer" };
  const c = emptyCatalog(scope);
  const item = { ...emptyService(), title: "Consulta", source: "Informado pela equipe" };
  const next = putService(c, item);
  assert.equal(next.items[0]?.title, "Consulta");
  assert.equal(c.items.length, 0);
  assert.equal(offers.offers, "Existing brand offer");
  assert.equal(putService(next, { ...item, title: "Consulta revisada" }).items.length, 1);
});
test("archiving selected service clears selection and restoring creates a draft", () => {
  const item = { ...emptyService(), title: "Consulta" };
  const c = selectService(putService(emptyCatalog(scope), item), item.id);
  const archived = setServiceStatus(c, item.id, "archived");
  assert.equal(archived.selectedId, null);
  assert.equal(archived.items[0]?.status, "archived");
  assert.throws(() => selectService(archived, item.id));
  assert.equal(setServiceStatus(archived, item.id, "draft").items[0]?.status, "draft");
});
test("catalog validates scope, version, fields, duplicates and selection", () => {
  const item = { ...emptyService(), title: "Consulta" };
  const c = putService(emptyCatalog(scope), item);
  assert.deepEqual(parseCatalog(JSON.stringify(c), scope), c);
  for (const value of [
    { ...c, version: 2 },
    { ...c, scope: "other" },
    { ...c, items: [item, item] },
    { ...c, selectedId: "missing" },
    { ...c, items: [{ ...item, status: "invented" }] },
    { ...c, items: [{ ...item, title: " ".repeat(3) }] },
    { ...c, items: [{ ...item, conditionsConfirmed: "yes" }] },
    { ...c, items: [{ ...item, summary: "x".repeat(2001) }] },
  ])
    assert.throws(() => parseCatalog(JSON.stringify(value), scope));
  assert.throws(() => parseCatalog("{", scope));
  assert.throws(() => parseCatalog("null", scope));
});
test("catalog limits item counts and refuses invalid user input", () => {
  let c = emptyCatalog(scope);
  for (let n = 0; n < 100; n++) c = putService(c, { ...emptyService(), title: "Service " + n });
  assert.throws(() => putService(c, { ...emptyService(), title: "101" }));
  assert.throws(() => putService(c, { ...emptyService(), title: "" }));
});
