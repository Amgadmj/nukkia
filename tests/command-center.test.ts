import test from "node:test";
import assert from "node:assert/strict";
import { demoSchema } from "../src/lib/quick-start.ts";
import * as workspace from "../src/lib/marketing-workspace.ts";
import { CHAPTERS } from "../src/lib/onboarding.ts";
import { composeContent, creativeFingerprint, reviseCreative } from "../src/lib/brand-preview.ts";
import { replaceBrandReference } from "../src/lib/brand-research.ts";

const ready = () =>
  demoSchema.parse({
    name: "Movitta",
    segment: "Fisioterapia",
    onboarded: true,
    answers: {
      goals: "Receber mais agendamentos",
      offers: "Fisioterapia individual",
      audience: "Adultos da região",
      challenge: "Transformar interesse em contato",
    },
    strategy: { metric: "messages", channel: "instagram" },
    brand: {
      confirmed: true,
      detail: "Atendimento individual com a equipe.",
      visualStyle: "essential",
      identityConfirmed: true,
    },
  });

test("workspace diagnostic corrections stay protected when the website changes", () => {
  const original = ready();
  original.brand.referenceUrl = "https://example.com";
  original.brand.extraLinks = ["https://example.com"];
  original.answers.website = "https://example.com";
  original.brand.suggestedFields = ["audience"];
  const edited = workspace.editWorkspaceAnswers(original, {
    ...original.answers,
    audience: "Público corrigido",
  });
  const replaced = replaceBrandReference(edited, "example.com", "https://example.org");
  assert.equal(replaced.data?.answers.audience, "Público corrigido");
  assert.ok(!edited.brand.suggestedFields.includes("audience"));
  assert.ok(edited.brand.editedFields.includes("audience"));
});

test("legacy workspace preserves answers while new strategy preferences start empty", () => {
  const data = demoSchema.parse({ name: "Marca", answers: { offers: "Oferta existente" } });
  assert.deepEqual(data.strategy, { metric: "", channel: "" });
  assert.equal(data.answers.offers, "Oferta existente");
});
test("essential progress requires actual bottleneck and measurement choice, not onboarding alone", () => {
  const data = ready();
  assert.deepEqual(workspace.essentialDiagnostic(data), { completed: 4, total: 4, complete: true });
  data.answers.challenge = "  ";
  data.strategy.metric = "";
  assert.equal(workspace.essentialDiagnostic(data).completed, 2);
});
test("new account prioritizes diagnosis and brand materials before recommending channels", () => {
  const tasks = workspace.commandPriorities(demoSchema.parse({ name: "", answers: {} }));
  assert.deepEqual(
    tasks.map((t) => t.section),
    ["cerebro", "marca"],
  );
  assert.equal(tasks[0]?.title, "Concluir diagnóstico da marca");
  assert.equal(tasks[1]?.title, "Reunir referências visuais da marca");
  assert.ok(tasks.every((t) => !t.done));
});
test("completed diagnosis turns channel choice into a Nukkia recommendation", () => {
  const data = ready();
  data.strategy.channel = "";
  const tasks = workspace.commandPriorities(data);
  assert.equal(tasks[0]?.section, "redes");
  assert.equal(tasks[0]?.title, "Revisar canais recomendados");
  assert.equal(tasks[0]?.label, "Ver recomendações");
});
test("channel recommendations use the diagnosis without claiming measured performance", () => {
  const recommendations = workspace.recommendChannels(ready());
  assert.deepEqual(
    recommendations.map((item) => item.value),
    ["googleBusiness", "instagram", "website"],
  );
  assert.ok(recommendations.every((item) => item.reason.length > 10));
  assert.ok(recommendations.every((item) => !/melhor|garant/i.test(item.reason)));
});
test("configured account is not trapped on a nonexistent connection and can create content", () => {
  const data = ready();
  data.answers.instagram = "@movitta";
  const tasks = workspace.commandPriorities(data);
  assert.ok(tasks.some((t) => t.section === "conteudo"));
  assert.ok(!tasks.some((t) => t.done && t.id === "connection"));
});

test("a saved account kit still leads to applying identity before creating a piece", () => {
  const data = ready();
  data.brand.identityConfirmed = false;
  const tasks = workspace.commandPriorities(data, { logo: true, tone: true });
  assert.equal(tasks[0]?.section, "marca");
  assert.equal(
    tasks.some((task) => task.section === "conteudo"),
    false,
  );
});
test("editor search only accepts internal return targets and known chapters", () => {
  assert.deepEqual(
    workspace.contextSearch({ editar: "contexto", retorno: "https://evil.example", capitulo: 99 }),
    { editar: "contexto", retorno: "painel" },
  );
  assert.deepEqual(
    workspace.contextSearch({ editar: "diagnostico", retorno: "trilha", capitulo: "2" }),
    { editar: "diagnostico", retorno: "trilha", capitulo: 2 },
  );
});
test("dashboard metrics retain provider and period and do not fill missing metrics with zero", () => {
  const cards = workspace.dashboardMetrics(
    [
      {
        provider: "instagram",
        captured_for: "2026-09-24",
        metrics: { messages: 0, reach: 125, saves: -1 },
      },
    ],
    "messages",
  );
  assert.equal(cards[0]?.value, 0);
  assert.equal(cards[0]?.provider, "instagram");
  assert.equal(cards[0]?.period, "2026-09-24");
  assert.equal(
    cards.some((c) => c.key === "saves"),
    false,
  );
  assert.equal(workspace.dashboardMetrics([], "messages").length, 0);
  assert.equal(
    workspace.dashboardMetrics(
      [{ provider: "instagram", captured_for: "invalid", metrics: { messages: 22 } }],
      "messages",
    ).length,
    0,
  );
});
test("original restrictions question is editable in the diagnostic chapters", () => {
  assert.equal(
    CHAPTERS.flatMap((c) => c.questions).filter((q) => q.key === "restrictions").length,
    1,
  );
});

test("earned XP survives editing without retaining approval or doubling on reload", () => {
  const previous = ready();
  previous.brand.creative = composeContent(previous, "educate");
  previous.brand.creative.approved = creativeFingerprint(previous);
  previous.brand.creative.exported = creativeFingerprint(previous);
  const next = {
    ...previous,
    brand: {
      ...previous.brand,
      creative: reviseCreative(previous.brand.creative, {
        ...previous.brand.creative.copy,
        title: "Novo título para revisar",
      }),
    },
  };
  const retained = workspace.retainWorkspaceAchievements(previous, next);
  const status = workspace.journeyProgress(retained);
  assert.equal(status.xp, 120);
  assert.equal(status.approved, false);
  assert.equal(status.exported, false);
  assert.equal(status.completed, 3);
  assert.equal(
    workspace.journeyProgress(demoSchema.parse(JSON.parse(JSON.stringify(retained)))).xp,
    120,
  );
  assert.equal(
    workspace.journeyProgress(workspace.retainWorkspaceAchievements(retained, retained)).xp,
    120,
  );
});
