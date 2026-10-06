import test from "node:test";
import assert from "node:assert/strict";
import { demoSchema } from "../src/lib/quick-start.ts";
import { composeContent } from "../src/lib/brand-preview.ts";
import * as board from "../src/lib/inspirations.ts";
const fixture = () =>
  demoSchema.parse({ name: "QA", answers: {}, brand: { detail: "Texto escrito pelo usuário" } });
test("inspiration drafts survive reload with attribution and cannot imply clearance", () => {
  let data = board.addInspiration(fixture());
  const id = data.inspirations[0]!.id;
  data = board.editInspiration(data, id, {
    title: "Referência",
    url: "https://example.com/design",
    note: "Usar o espaço em branco",
    permission: "unknown",
  });
  data = demoSchema.parse(JSON.parse(JSON.stringify(data)));
  assert.equal(data.inspirations[0]!.permission, "unknown");
  assert.equal(data.inspirations[0]!.note, "Usar o espaço em branco");
  data = board.attachInspiration(data, id);
  assert.equal(data.brand.inspirationBrief[0]!.id, id);
  assert.equal(data.brand.detail, "Texto escrito pelo usuário");
});
test("invalid source cannot attach; editing attached reference invalidates generic approval and preserves human brief", () => {
  let data = board.addInspiration(fixture());
  const id = data.inspirations[0]!.id;
  assert.throws(() => board.attachInspiration(data, id), /HTTPS/);
  data = board.editInspiration(data, id, { title: "QA", url: "https://example.com" });
  data = board.attachInspiration(data, id);
  data.brand.creative = { ...composeContent(data, "invite"), approved: "old", exported: "old" };
  data = board.editInspiration(data, id, { note: "Nova direção" });
  assert.equal(data.brand.creative!.approved, null);
  assert.equal(data.brand.inspirationBrief.length, 0);
  assert.equal(data.brand.detail, "Texto escrito pelo usuário");
});
test("remove and detach never erase written brief or other references", () => {
  let data = board.addInspiration(fixture());
  data = board.addInspiration(data);
  data = board.removeInspiration(data, data.inspirations[0]!.id);
  assert.equal(data.inspirations.length, 1);
  assert.equal(data.brand.detail, "Texto escrito pelo usuário");
});
