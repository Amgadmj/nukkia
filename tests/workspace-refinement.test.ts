import test from "node:test";
import assert from "node:assert/strict";
import { demoSchema } from "../src/lib/quick-start.ts";
import * as workspace from "../src/lib/marketing-workspace.ts";
import { briefIssues, composeContent, creativeFingerprint } from "../src/lib/brand-preview.ts";

const fixture = () =>
  demoSchema.parse({
    name: "Movitta",
    segment: "Fisioterapia",
    onboarded: true,
    answers: {
      offers: "Programa de exercícios",
      audience: "Adultos",
      goals: "Atrair novos clientes",
    },
    brand: {
      confirmed: true,
      detail: "Acompanhamento individual com a equipe.",
      visualStyle: "essential",
      identityConfirmed: true,
    },
  });

test("journey credits completed identity and onboarding without claiming an approved post", () => {
  assert.equal(typeof workspace.journeyProgress, "function");
  const data = fixture();
  const progress = workspace.journeyProgress(data);
  assert.equal(progress.xp, 50);
  assert.equal(progress.completed, 3);
  assert.equal(progress.total, 5);
  assert.equal(progress.approved, false);
  assert.equal(progress.exported, false);
  assert.equal(
    workspace.journeyProgress(demoSchema.parse(JSON.parse(JSON.stringify(data)))).xp,
    50,
  );
});

test("historical onboarding credit never authorizes unconfirmed facts or a blank account", () => {
  assert.equal(typeof workspace.journeyProgress, "function");
  const data = fixture();
  data.brand.confirmed = false;
  assert.equal(workspace.journeyProgress(data).context, true);
  assert.equal(workspace.journeyProgress(data).contextNeedsReview, true);
  assert.ok(briefIssues(data).length);
  assert.equal(data.brand.confirmed, false);
  assert.equal(
    workspace.journeyProgress(demoSchema.parse({ name: "", answers: {}, onboarded: true })).xp,
    0,
  );
});

test("photo-dependent identity remains pending without a photo", () => {
  assert.equal(typeof workspace.journeyProgress, "function");
  const data = fixture();
  data.brand.visualStyle = "warm";
  assert.equal(workspace.journeyProgress(data).identity, false);
  assert.equal(workspace.journeyProgress(data).xp, 30);
});

test("approval and download milestones require matching current work", () => {
  assert.equal(typeof workspace.journeyProgress, "function");
  const data = fixture();
  data.brand.creative = composeContent(data, "educate");
  data.brand.creative.approved = creativeFingerprint(data);
  data.brand.creative.exported = creativeFingerprint(data);
  assert.equal(workspace.journeyProgress(data).xp, 120);
  data.brand.creative.copy.title = "Um título que ainda precisa de revisão";
  assert.equal(workspace.journeyProgress(data).xp, 50);
});

test("personal hypotheses survive storage, can be edited and never change confirmed facts", () => {
  assert.equal(typeof workspace.saveHypothesis, "function");
  const data = fixture();
  const saved = workspace.saveHypothesis(data, {
    id: "local-1",
    text: "Mostrar a equipe pode reduzir dúvidas.",
    source: "user",
  });
  assert.equal(saved.hypotheses.length, 1);
  assert.equal(saved.hypotheses[0].source, "user");
  assert.deepEqual(saved.answers, data.answers);
  assert.deepEqual(saved.brand, data.brand);
  const edited = workspace.saveHypothesis(saved, {
    id: "local-1",
    text: "Explicar a avaliação pode facilitar o primeiro contato.",
    source: "user",
  });
  assert.equal(edited.hypotheses.length, 1);
  const restored = workspace.parseStoredWorkspace(
    JSON.stringify({ data: edited, revision: null, dirty: true }),
  );
  assert.equal(
    restored?.data.hypotheses[0].text,
    "Explicar a avaliação pode facilitar o primeiro contato.",
  );
  assert.throws(() => workspace.saveHypothesis(data, { id: "empty", text: "   ", source: "user" }));
  assert.equal(workspace.removeHypothesis(edited, "local-1").hypotheses.length, 0);
});

test("notifications are derived from actual work, not example activity", () => {
  assert.equal(typeof workspace.workspaceNotifications, "function");
  assert.equal(
    workspace.workspaceNotifications(demoSchema.parse({ name: "", answers: {} })).length,
    0,
  );
  const data = fixture();
  assert.equal(workspace.workspaceNotifications(data).length, 0);
  data.brand.research.status = "unavailable";
  assert.ok(workspace.workspaceNotifications(data).some((n) => n.section === "cerebro"));
  data.brand.creative = composeContent(data, "educate");
  assert.ok(workspace.workspaceNotifications(data).some((n) => n.section === "conteudo"));
});
