import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeAnswers } from "../src/lib/onboarding.ts";
import {
  acknowledgeDraft,
  contentOf,
  fromRemote,
  parseLocalDraft,
  reconcileDraft,
  type DraftContent,
  type LocalDraft,
  type RemoteDraft,
} from "../src/lib/onboarding-draft-state.ts";

const draft = (answers = {}, step = 0): DraftContent => ({
  version: 1,
  answers: normalizeAnswers(answers),
  step,
});
const remote = (revision: string, answers = {}, step = 0): RemoteDraft => ({
  revision,
  draft: draft(answers, step),
  updatedAt: "2026-09-24T12:00:00Z",
});
function edit(base: RemoteDraft, answers = {}, step = 0): LocalDraft {
  return { ...fromRemote(base)!, ...draft(answers, step), dirty: true, updatedAt: 1 };
}

test("legacy v1 drafts keep answers and unknown age; malformed storage is safe", () => {
  const old = parseLocalDraft(
    JSON.stringify({
      version: 1,
      answers: { audience: "Clientes", restrictions: "Normas" },
      step: 99,
    }),
  );
  assert.equal(old?.answers.audience, "Clientes");
  assert.equal(old?.answers.restrictions, "Normas");
  assert.equal(old?.step, 0);
  assert.equal(old?.updatedAt, null);
  assert.equal(old?.dirty, true);
  assert.equal(old?.base, null);
  for (const raw of [
    null,
    "{",
    "null",
    '{"version":1,"answers":null}',
    '{"version":1,"answers":[]}',
  ])
    assert.equal(parseLocalDraft(raw), null);
});
test("cloud restores an empty device and a clean previously synced device", () => {
  const cloud = remote("r2", { city: "Recife" }, 3);
  assert.deepEqual(contentOf(reconcileDraft(null, cloud).local), cloud.draft);
  const clean = fromRemote(remote("r1"));
  assert.deepEqual(contentOf(reconcileDraft(clean, cloud).local), cloud.draft);
});
test("normalization and acknowledgement retain in-progress whitespace", () => {
  const raw = "  Minha oferta \n";
  const local = parseLocalDraft(JSON.stringify(draft({ offers: raw })))!;
  assert.equal(local.answers.offers, raw);
  assert.equal(acknowledgeDraft(local, local, remote("r1", { offers: raw })).answers.offers, raw);
});
test("legacy data is uploaded only when cloud is absent or identical", () => {
  const local = parseLocalDraft(JSON.stringify(draft({ offers: "Consultas" })))!;
  assert.equal(reconcileDraft(local, null).action, "push");
  assert.equal(reconcileDraft(local, remote("r1", { offers: "Consultas" })).action, "synced");
  assert.equal(reconcileDraft(local, remote("r1", { offers: "Outra oferta" })).action, "conflict");
});
test("disjoint edits merge, including explicit clearing and step changes", () => {
  const base = remote("r1", { city: "Recife", offers: "Consultas" });
  const local = edit(base, { city: "", offers: "Consultas" }, 2);
  const result = reconcileDraft(local, remote("r2", { city: "Recife", offers: "Serviços" }, 1));
  assert.equal(result.action, "push");
  assert.equal(result.local?.answers.city, "");
  assert.equal(result.local?.answers.offers, "Serviços");
  assert.equal(result.local?.step, 2);
  assert.equal(result.local?.base?.revision, "r2");
});
test("overlapping changes retain both snapshots without timestamp arbitration", () => {
  const base = remote("r1", { offers: "Antigo" });
  const local = edit(base, { offers: "Local" });
  local.updatedAt = Number.MAX_SAFE_INTEGER;
  const cloud = remote("r2", { offers: "Nuvem" });
  assert.deepEqual(reconcileDraft(local, cloud), { action: "conflict", local });
  assert.equal(cloud.draft?.answers.offers, "Nuvem");
});
test("a late acknowledgement preserves edits and completion made in flight", () => {
  const base = remote("r1");
  const sent = edit(base, { offers: "Enviado" });
  const saved = remote("r2", { offers: "Enviado" });
  const newer = edit(base, { offers: "Mais novo" });
  const result = acknowledgeDraft(newer, sent, saved);
  assert.equal(result.answers.offers, "Mais novo");
  assert.equal(result.dirty, true);
  assert.equal(result.base?.revision, "r2");
  const deleted = acknowledgeDraft({ ...newer, deleted: true }, sent, saved);
  assert.equal(deleted.deleted, true);
  assert.equal(deleted.dirty, true);
  assert.equal(acknowledgeDraft(sent, sent, saved).dirty, false);
});
test("completion tombstones clear clean clients but never resurrect stale dirty data", () => {
  const base = remote("r1", { offers: "Antigo" });
  const deleted: RemoteDraft = { revision: "r2", draft: null, updatedAt: "2026-09-24T12:01:00Z" };
  const clean = reconcileDraft(fromRemote(base), deleted);
  assert.equal(clean.action, "synced");
  assert.equal(contentOf(clean.local), null);
  assert.equal(reconcileDraft(edit(base, { offers: "Offline" }), deleted).action, "conflict");
  const completing = { ...fromRemote(base)!, dirty: true, deleted: true };
  assert.equal(reconcileDraft(completing, base).action, "push");
  assert.equal(reconcileDraft({ ...completing, base: null }, null).action, "push");
  assert.equal(reconcileDraft({ ...completing, base: null }, base).action, "conflict");
  assert.equal(reconcileDraft(completing, remote("r3", { offers: "Novo" })).action, "conflict");
});
