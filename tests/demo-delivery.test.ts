import { test } from "node:test";
import assert from "node:assert/strict";
import * as quickStart from "../src/lib/quick-start.ts";
import {
  demoSchema,
  deliveryStatus,
  editDelivery,
  approveDelivery,
  exportDelivery,
  canEnterDemo,
} from "../src/lib/quick-start.ts";

function fixture() {
  return demoSchema.parse({
    name: "Aurora",
    segment: "Pilates",
    answers: { goals: "Atrair novos clientes", offers: "Aulas", audience: "Adultos" },
  });
}

test("legacy demo restores answers without fabricating approvals or publication", () => {
  const restored = demoSchema.parse({
    name: "Aurora",
    answers: { goals: "Atrair novos clientes", offers: "Aulas", audience: "Adultos" },
  });
  assert.equal(restored.segment, "");
  assert.equal(restored.answers.offers, "Aulas");
  assert.equal(deliveryStatus(restored).approved, false);
  assert.equal(deliveryStatus(restored).exported, false);
});

test("approval and export count once and require a nonempty reviewed version", () => {
  let data = fixture();
  assert.equal(deliveryStatus(data).xp, 20);
  assert.equal(deliveryStatus(exportDelivery(data)).exported, false);
  data = approveDelivery(editDelivery(data, "Uma publicação revisada."));
  assert.equal(deliveryStatus(data).xp, 60);
  data = approveDelivery(data);
  assert.equal(deliveryStatus(data).xp, 60);
  data = exportDelivery(data);
  assert.equal(deliveryStatus(data).xp, 90);
  assert.equal(deliveryStatus(exportDelivery(data)).xp, 90);
  assert.equal(deliveryStatus(approveDelivery(editDelivery(data, "   "))).approved, false);
});

test("editing approved content or context requires approval again and preserves human edits", () => {
  const original = exportDelivery(approveDelivery(editDelivery(fixture(), "Meu texto aprovado")));
  const changedText = editDelivery(original, "Meu novo texto");
  assert.equal(deliveryStatus(changedText).approved, false);
  assert.equal(deliveryStatus(changedText).exported, false);
  const changedContext = { ...original, answers: { ...original.answers, offers: "Nova oferta" } };
  assert.equal(deliveryStatus(changedContext).approved, false);
  assert.equal(deliveryStatus(changedContext).exported, false);
  assert.equal(deliveryStatus(changedContext).text, "Meu texto aprovado");
  assert.equal(deliveryStatus(changedContext).contextChanged, true);
  assert.equal(deliveryStatus(approveDelivery(changedContext)).exported, false);
  assert.equal(deliveryStatus(approveDelivery(original)).exported, true);
});

test("refresh preserves delivery state, while a new demonstration starts without achievements", () => {
  const data = exportDelivery(approveDelivery(editDelivery(fixture(), "Rascunho confirmado")));
  const restored = demoSchema.parse(JSON.parse(JSON.stringify(data)));
  assert.equal(deliveryStatus(restored).exported, true);
  assert.equal(deliveryStatus(restored).text, "Rascunho confirmado");
  assert.equal(deliveryStatus(fixture()).exported, false);
});

test("an entered workspace remains editable while a required answer is temporarily cleared", () => {
  const incomplete = demoSchema.parse({ name: "", answers: {} });
  assert.equal(canEnterDemo(incomplete), false);
  assert.equal(canEnterDemo(fixture()), true);
  assert.equal(canEnterDemo({ ...incomplete, onboarded: true }), true);
});

test("restoration normalizes answer whitespace without invalidating an unchanged approved delivery", () => {
  const raw = fixture();
  raw.name = " Aurora ";
  raw.segment = " Pilates ";
  raw.answers.offers = "Aulas ";
  const approved = exportDelivery(approveDelivery(editDelivery(raw, "Meu texto revisado")));
  const restored = demoSchema.parse(JSON.parse(JSON.stringify(approved)));
  assert.equal(deliveryStatus(restored).approved, true);
  assert.equal(deliveryStatus(restored).exported, true);
  assert.equal(deliveryStatus(restored).contextChanged, false);
});

test("changing context and changing it back never resurrects approval or export", () => {
  const original = exportDelivery(approveDelivery(editDelivery(fixture(), "Texto manual")));
  for (const patch of [
    { name: "Nova marca" },
    { segment: "Outro setor" },
    { answers: { ...original.answers, offers: "Outra oferta" } },
  ]) {
    const changed = quickStart.changeDemoContext(original, patch);
    const reverted = quickStart.changeDemoContext(changed, {
      name: original.name,
      segment: original.segment,
      answers: original.answers,
    });
    assert.equal(deliveryStatus(reverted).text, "Texto manual");
    assert.equal(deliveryStatus(reverted).approved, false);
    assert.equal(deliveryStatus(reverted).exported, false);
  }
});
