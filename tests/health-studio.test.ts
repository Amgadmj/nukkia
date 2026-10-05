import test from "node:test";
import assert from "node:assert/strict";
import {
  HEALTH_CATALOG,
  catalogStats,
  healthStudioSchema,
  prepareHealthOptions,
  changeHealthScene,
  undoHealthEdit,
  redoHealthEdit,
  timingIssues,
  healthProductionStatus,
  previewFramesFit,
} from "../src/lib/health-studio.ts";
import { demoSchema } from "../src/lib/quick-start.ts";

test("the proposed catalog counts structures and presets separately", () => {
  assert.equal(HEALTH_CATALOG.length, 48);
  assert.equal(new Set(HEALTH_CATALOG.map((t) => t.id)).size, 48);
  assert.deepEqual(catalogStats(), {
    videos: 24,
    images: 12,
    carousels: 6,
    emails: 6,
    betaVideos: 12,
    baselinePresets: 330,
    betaPresets: 156,
    twinEligibleVideos: 13,
    qualifiedPresets: null,
  });
});
test("every measured scene must fit both dimensions before playback", () => {
  const frame = { clientHeight: 180, scrollHeight: 180, clientWidth: 320, scrollWidth: 320 };
  assert.equal(previewFramesFit([frame]), true);
  assert.equal(previewFramesFit([frame, { ...frame, scrollHeight: 240 }]), false);
  assert.equal(previewFramesFit([{ ...frame, scrollWidth: 600 }]), false);
  assert.equal(previewFramesFit([{ ...frame, clientHeight: 0 }]), false);
  assert.equal(previewFramesFit([]), false);
});
test("three synthetic options differ and start with three editable scenes", () => {
  const draft = prepareHealthOptions(healthStudioSchema.parse({}));
  assert.equal(draft.options.length, 3);
  assert.equal(new Set(draft.options.map((o) => o.title)).size, 3);
  assert.equal(new Set(draft.options.map((o) => o.scenes.map((s) => s.script).join(" "))).size, 3);
  assert.ok(draft.options.every((o) => o.scenes.length === 3));
  assert.ok(draft.options.every((o) => o.scenes.every((s) => s.kind === "text_card")));
  assert.deepEqual(timingIssues(draft), []);
});
test("scene editing preserves other options and rejects stale revisions", () => {
  const draft = prepareHealthOptions(healthStudioSchema.parse({}));
  const scene = draft.options[0]!.scenes[0]!;
  const next = changeHealthScene(
    draft,
    { type: "script", sceneId: scene.id, value: "Texto revisado no exemplo." },
    draft.revision,
  );
  assert.equal(next.options[0]!.scenes[0]!.script, "Texto revisado no exemplo.");
  assert.deepEqual(next.options[1], draft.options[1]);
  assert.throws(
    () => changeHealthScene(next, { type: "delete", sceneId: scene.id }, draft.revision),
    /revision/,
  );
  assert.equal(draft.options[0]!.scenes[0]!.script, scene.script);
});
test("split, compatible merge, reorder and delete preserve timeline semantics", () => {
  let draft = prepareHealthOptions(healthStudioSchema.parse({}));
  const original = draft.options[0]!.scenes[0]!;
  draft = changeHealthScene(draft, { type: "split", sceneId: original.id }, draft.revision);
  assert.equal(draft.options[0]!.scenes.length, 4);
  assert.equal(
    draft.options[0]!.scenes[0]!.seconds + draft.options[0]!.scenes[1]!.seconds,
    original.seconds,
  );
  draft = changeHealthScene(draft, { type: "merge", sceneId: original.id }, draft.revision);
  assert.equal(draft.options[0]!.scenes.length, 3);
  const id = draft.options[0]!.scenes[2]!.id;
  draft = changeHealthScene(draft, { type: "move", sceneId: id, offset: -1 }, draft.revision);
  assert.equal(draft.options[0]!.scenes[1]!.id, id);
  draft = changeHealthScene(draft, { type: "delete", sceneId: id }, draft.revision);
  assert.equal(draft.options[0]!.scenes.length, 2);
});
test("scene limits and reading time prevent impossible previews", () => {
  let draft = prepareHealthOptions(healthStudioSchema.parse({}));
  const id = draft.options[0]!.scenes[0]!.id;
  draft = changeHealthScene(draft, { type: "seconds", sceneId: id, value: 3 }, draft.revision);
  assert.throws(
    () => changeHealthScene(draft, { type: "split", sceneId: id }, draft.revision),
    /split/,
  );
  draft = changeHealthScene(
    draft,
    { type: "script", sceneId: id, value: "palavra ".repeat(80) },
    draft.revision,
  );
  assert.ok(timingIssues(draft).some((issue) => issue.includes("leitura")));
  while (draft.options[0]!.scenes.length < 12)
    draft = changeHealthScene(draft, { type: "duplicate", sceneId: id }, draft.revision);
  assert.throws(() => changeHealthScene(draft, { type: "add", sceneId: id }, draft.revision), /12/);
  while (draft.options[0]!.scenes.length > 1)
    draft = changeHealthScene(
      draft,
      { type: "delete", sceneId: draft.options[0]!.scenes[0]!.id },
      draft.revision,
    );
  assert.throws(
    () =>
      changeHealthScene(
        draft,
        { type: "delete", sceneId: draft.options[0]!.scenes[0]!.id },
        draft.revision,
      ),
    /last/,
  );
});
test("undo and redo persist but do not roll the root revision backward", () => {
  const initial = prepareHealthOptions(healthStudioSchema.parse({}));
  const id = initial.options[0]!.scenes[0]!.id;
  const edited = changeHealthScene(
    initial,
    { type: "script", sceneId: id, value: "Minha revisão." },
    initial.revision,
  );
  const restored = undoHealthEdit(edited);
  assert.deepEqual(restored.options, initial.options);
  assert.ok(restored.revision > edited.revision);
  const reloaded = demoSchema.parse(
    JSON.parse(
      JSON.stringify(demoSchema.parse({ name: "Demo", answers: {}, healthStudio: restored })),
    ),
  );
  assert.deepEqual(redoHealthEdit(reloaded.healthStudio).options, edited.options);
  const newEdit = changeHealthScene(
    restored,
    { type: "script", sceneId: id, value: "Outra revisão." },
    restored.revision,
  );
  assert.equal(newEdit.future.length, 0);
});
test("draft JSON never grants consent or enables health release", () => {
  const forged = healthStudioSchema.parse({
    approved: true,
    policyActive: true,
    twin: { consent: true },
    providerReady: true,
  });
  assert.equal("approved" in forged, false);
  assert.equal("twin" in forged, false);
  const status = healthProductionStatus();
  assert.equal(status.available, false);
  assert.equal(status.cost, null);
  assert.equal(status.automationPercent, null);
  assert.ok(status.missing.length >= 5);
});
