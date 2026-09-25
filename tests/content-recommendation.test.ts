import test from "node:test";
import assert from "node:assert/strict";
import { unzipSync } from "fflate";
import { demoSchema } from "../src/lib/quick-start.ts";
import * as preview from "../src/lib/brand-preview.ts";
import { publicationZip, postSvg } from "../src/lib/post-art.ts";

const fixture = () =>
  demoSchema.parse({
    name: "Jardim Studio",
    segment: "Pilates",
    answers: {
      offers: "Pilates em pequenos grupos",
      audience: "Adultos que buscam movimento",
      goals: "Atrair novos clientes",
    },
    brand: { confirmed: true, detail: "Turmas de até quatro pessoas, com acompanhamento próximo." },
  });

test("goal matching tolerates case and accents without inventing a different objective", () => {
  const data = fixture();
  for (const [goal, approach] of [
    ["lançar uma oferta", "invite"],
    ["LANCAR UMA OFERTA", "invite"],
    ["fortalecer minha marca", "trust"],
  ]) {
    data.answers.goals = goal;
    assert.equal(preview.recommendContent(data).approach, approach);
  }
  data.answers.goals = "Fidelizar clientes atuais";
  assert.ok(!preview.recommendContent(data).reason.includes("Seu foco é atrair"));
});

test("removing a customer question cannot leak its old hidden answer into the caption", () => {
  const data = fixture();
  data.brand.customerQuestion = "";
  data.brand.questionAnswer = "Esta resposta pertencia a uma pergunta removida.";
  const draft = preview.composeContent(data, "educate");
  assert.ok(!draft.copy.caption.includes(data.brand.questionAnswer));
  assert.ok(draft.copy.caption.includes(data.brand.detail));
});

test("long valid photo-post copy keeps readable body text within the image bounds", () => {
  const data = fixture();
  const copy = {
    title: "Atendimentos individuais, personalizados, acolhedores, especializados",
    body: "Um atendimento com orientação próxima. Conheça nossa equipe e tire suas dúvidas sobre a oferta, os horários disponíveis e como funciona sua primeira visita.",
    caption: "Informações fornecidas pela marca para revisão.",
  };
  assert.equal(preview.postCopySchema.safeParse(copy).success, true);
  const svg = postSvg(preview.firstPostBrief(data), copy, data.brand, {
    approach: "trust",
    page: 1,
    total: 1,
  });
  const body = svg.match(/<text[^>]*font-size="([^"]+)" fill="#53615a">([\s\S]*?)<\/text>/);
  assert.ok(body);
  assert.ok(Number(body[1]) >= 24, `body font too small: ${body[1]}`);
  const baselines = [...body[2].matchAll(/ y="([^"]+)"/g)].map((match) => Number(match[1]));
  assert.ok(Math.max(...baselines) <= 1160);
});

test("recommendation follows the confirmed objective without inventing social metrics", () => {
  assert.equal(typeof preview.recommendContent, "function");
  const data = fixture();
  for (const [goal, expected] of [
    ["Atrair novos clientes", "educate"],
    ["Receber mais agendamentos", "invite"],
    ["Fortalecer minha marca", "trust"],
  ]) {
    data.answers.goals = goal;
    const result = preview.recommendContent(data);
    assert.equal(result.approach, expected);
    assert.ok(result.observation.includes(goal));
    assert.equal(result.coverage.pages, 0);
    assert.equal(result.coverage.socialHistory, "unavailable");
  }
});

test("a supplied buying question guides education but an unanswered one blocks approval", () => {
  assert.equal(typeof preview.composeContent, "function");
  const data = fixture();
  data.brand.customerQuestion = "Preciso de experiência?";
  data.brand.creative = preview.composeContent(data, "educate");
  assert.equal(preview.creativeStatus(data).valid, false);
  data.brand.questionAnswer =
    "A primeira aula inclui uma conversa com a equipe para orientar seu início.";
  data.brand.creative = preview.composeContent(data, "educate");
  assert.equal(data.brand.creative.slides.length, 2);
  assert.equal(data.brand.creative.slides[0].body, data.brand.questionAnswer);
  assert.equal(preview.creativeStatus(data).valid, true);
});

test("photo-led trust content requires a real supplied photo", () => {
  assert.equal(typeof preview.composeContent, "function");
  const data = fixture();
  data.brand.creative = preview.composeContent(data, "trust");
  assert.equal(preview.creativeStatus(data).valid, false);
  data.brand.photo = "data:image/png;base64,AAAA";
  assert.equal(preview.creativeStatus(data).valid, true);
});

test("all carousel pages and customer answers are covered by approval and staleness", () => {
  assert.equal(typeof preview.composeContent, "function");
  const data = fixture();
  data.brand.creative = preview.composeContent(data, "educate");
  data.brand.creative.approved = preview.creativeFingerprint(data);
  assert.equal(preview.creativeStatus(data).approved, true);
  data.brand.creative.slides[1].body = "Fale com nossa equipe para saber mais.";
  assert.equal(preview.creativeStatus(data).approved, false);
  data.brand.creative.slides[1].body = "";
  assert.equal(preview.creativeStatus(data).valid, false);
  data.brand.customerQuestion = "Como começar?";
  assert.equal(preview.creativeStatus(data).stale, true);
});

test("carousel export includes every ordered PNG, not only its cover", () => {
  const bytes = publicationZip(
    [new Uint8Array([1, 2]), new Uint8Array([3, 4]), new Uint8Array([5, 6])],
    "Legenda confirmada",
    [],
  );
  const files = unzipSync(bytes);
  assert.deepEqual(Object.keys(files).sort(), [
    "legenda.txt",
    "publicacao-01.png",
    "publicacao-02.png",
    "publicacao-03.png",
    "referencias.txt",
  ]);
  assert.deepEqual([...files["publicacao-03.png"]], [5, 6]);
});

test("coverage counts only collected web pages and retains their collection dates", () => {
  assert.equal(typeof preview.recommendContent, "function");
  const data = fixture();
  data.brand.research.sources = [
    {
      url: "material:provided",
      title: "Texto fornecido",
      text: "Nossa marca",
      fetchedAt: "2026-09-24",
    },
    {
      url: "https://brand.example/sobre",
      title: "Sobre",
      text: "Nossa marca",
      fetchedAt: "2026-09-23T12:00:00Z",
    },
  ];
  const result = preview.recommendContent(data);
  assert.equal(result.coverage.pages, 1);
  assert.equal(result.coverage.sources[1].fetchedAt, "2026-09-23T12:00:00Z");
  assert.equal(result.coverage.socialHistory, "unavailable");
});

test("education and photo-led layouts are genuinely different from the offer layout", () => {
  const data = fixture();
  const brief = preview.firstPostBrief(data);
  const copy = preview.fallbackCopy(brief);
  const invite = postSvg(brief, copy, data.brand);
  assert.notEqual(
    postSvg(brief, copy, data.brand, { approach: "educate", page: 1, total: 3 }),
    invite,
  );
  assert.notEqual(
    postSvg(brief, copy, data.brand, { approach: "trust", page: 1, total: 1 }),
    invite,
  );
});
