import { test } from "node:test";
import assert from "node:assert/strict";
import { CHAPTERS, normalizeAnswers } from "../src/lib/onboarding.ts";
import {
  diagnosticCoverage,
  QUICK_DIAGNOSTIC_KEYS,
  QUICK_TEXT_SUGGESTIONS,
  starterPlan,
} from "../src/lib/quick-start.ts";

test("the short journey retains three core diagnostic answers and defers the deeper diagnostic", () => {
  const answers = normalizeAnswers({
    goals: "Atrair novos clientes",
    offers: "Pilates",
    audience: "Adultos",
  });
  const progress = diagnosticCoverage(answers);
  assert.equal(progress.answered, 3);
  assert.equal(progress.total, 28);
  assert.equal(progress.xp, 20);
  assert.equal(QUICK_DIAGNOSTIC_KEYS.includes("problems"), false);
  assert.equal(
    CHAPTERS.flatMap((chapter) => chapter.questions).filter(
      (question) =>
        !QUICK_DIAGNOSTIC_KEYS.includes(question.key as (typeof QUICK_DIAGNOSTIC_KEYS)[number]),
    ).length,
    24,
  );
});

test("each open onboarding prompt offers concrete, distinct starting suggestions", () => {
  for (const suggestions of Object.values(QUICK_TEXT_SUGGESTIONS)) {
    assert.equal(suggestions.length, 4);
    assert.equal(
      new Set(suggestions.map((suggestion) => suggestion.value)).size,
      suggestions.length,
    );
    assert.equal(
      suggestions.every((suggestion) => suggestion.label.trim() && suggestion.value.trim()),
      true,
    );
  }
});

test("answering an entire chapter does not claim a marketing delivery", () => {
  const answers = normalizeAnswers({
    goals: "Atrair novos clientes",
    offers: "Pilates",
    audience: "Adultos",
  });
  for (const question of CHAPTERS[1]!.questions) answers[question.key] = "Resposta da demonstração";
  assert.equal(diagnosticCoverage(answers).xp, 20);
  assert.equal(diagnosticCoverage({ ...answers }).xp, 20);
  answers.problems = "";
  assert.equal(diagnosticCoverage(answers).xp, 20);
});

test("every diagnostic answer remains available and full completion is bounded", () => {
  const answers = normalizeAnswers({});
  for (const chapter of CHAPTERS)
    for (const question of chapter.questions) answers[question.key] = "Resposta";
  assert.deepEqual(diagnosticCoverage(answers), { answered: 28, total: 28, percent: 100, xp: 20 });
});

test("first plan reflects the goal, offer, audience and time constraint", () => {
  const answers = normalizeAnswers({
    goals: "Receber mais agendamentos",
    offers: "pilates",
    audience: "trabalhadores locais",
    challenge: "Falta tempo para o marketing",
  });
  const plan = starterPlan("Aurora", answers);
  assert.match(plan.brief, /Aurora.*agendamentos.*pilates.*trabalhadores locais/);
  assert.match(plan.headline, /primeira conversa/);
  assert.match(plan.rhythm, /uma publicação nesta semana/);
  answers.goals = "Fortalecer minha marca";
  assert.notEqual(starterPlan("Aurora", answers).headline, plan.headline);
});

test("an unknown audience is acknowledged without fabricating a customer profile", () => {
  const plan = starterPlan(
    "Aurora",
    normalizeAnswers({
      audience: "Ainda estou descobrindo",
      offers: "pilates",
      goals: "Atrair novos clientes",
    }),
  );
  assert.match(plan.brief, /público que você quer descobrir/);
  assert.match(plan.post, /faz sentido para você/);
});

test("deferred answers improve the first draft without inventing missing facts", () => {
  const answers = normalizeAnswers({
    offers: "Pilates",
    audience: "Adultos",
    goals: "Atrair novos clientes",
  });
  const initial = starterPlan("Aurora", answers).post;
  assert.equal(initial.includes("Nosso diferencial"), false);
  answers.problems = "Crie uma rotina de movimento.";
  answers.differentials = "Turmas pequenas.";
  const refined = starterPlan("Aurora", answers).post;
  assert.match(refined, /Crie uma rotina de movimento/);
  assert.match(refined, /Turmas pequenas/);
  assert.notEqual(refined, initial);
});

test("the first delivery includes three usable directions grounded in the owner's offer", () => {
  const plan = starterPlan(
    "Aurora",
    normalizeAnswers({
      offers: "pilates em pequenos grupos",
      audience: "adultos",
      goals: "Atrair novos clientes",
      differentials: "Turmas com até quatro pessoas",
    }),
    "Estúdio de pilates",
  );
  assert.equal(plan.ideas.length, 3);
  assert.match(plan.brief, /Estúdio de pilates/);
  assert.match(plan.ideas[0].draft, /pilates em pequenos grupos/);
  assert.match(plan.ideas[1].draft, /Turmas com até quatro pessoas/);
  assert.match(plan.ideas[2].draft, /pilates em pequenos grupos/);
});

test("a skipped differentiator generates a question, never invented brand superiority", () => {
  const plan = starterPlan(
    "Aurora",
    normalizeAnswers({ offers: "Pilates", goals: "Atrair novos clientes", audience: "Adultos" }),
  );
  assert.match(plan.ideas[1].draft, /pergunta|dúvida/i);
  assert.doesNotMatch(plan.ideas[1].draft, /melhor|certificad|líder/i);
});
