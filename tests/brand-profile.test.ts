import test from "node:test";
import assert from "node:assert/strict";
import { prepareEvidence, applyResearchToData } from "../src/lib/brand-research.ts";
import { sanitizeProfile } from "../src/lib/brand-profile.ts";
import { prioritizePageLinks } from "../src/lib/public-site.server.ts";
import { generateBrandProfile } from "../src/lib/brand-profile.server.ts";
import { handleBrandPreview } from "../src/lib/brand-preview.server.ts";
import { researchSchema, brandPreviewSchema } from "../src/lib/brand-preview.ts";
import { demoSchema } from "../src/lib/quick-start.ts";

const origin = "https://agrostech.xyz";
const page = (path: string, text: string) => ({
  url: origin + path,
  title: "",
  text,
  fetchedAt: "2026-10-13T12:00:00Z",
});
// Text captured from agrostech.xyz on 2026-10-13: a drone-mapping company that the
// pilates/clinic-era filters used to discard almost entirely.
const sources = [
  page(
    "/sobre",
    [
      "AgroS Tech",
      "Sobre — AgroS Tech",
      "Joint venture entre AgroSul Hortifruti e Nourdrones, reunindo mais de 7 anos de experiência em drones agrícolas e uma rede comercial consolidada no Brasil.",
      "O diferencial da AgrosTech está em sua equipe, um grupo seleto de especialistas que dominaram a cadeia da inovação agrícola.",
    ].join("\n"),
  ),
  page(
    "/solucoes",
    [
      "AgroS Tech",
      "Mapeamento por drones com relatórios agronômicos acionáveis: linhas de plantio, NDVI, topografia e drenagem para eliminar desperdício na lavoura.",
    ].join("\n"),
  ),
];

test("crawler reads pages named in the brand's own words, not only clinic vocabulary", () => {
  const links = prioritizePageLinks(
    ["/solucoes", "/ecossistema", "/tecnologia", "/sobre", "/privacidade", "/login", "/blog/a/b/c"],
    origin,
  );
  for (const path of ["solucoes", "ecossistema", "tecnologia", "sobre"])
    assert.ok(links.includes(`${origin}/${path}`), path);
  assert.ok(!links.some((link) => /privacidade|login|blog/.test(link)));
});

test("a company's brand names and years of experience are not treated as personal data", () => {
  const evidence = prepareEvidence(sources)
    .map((entry) => entry.text)
    .join("\n");
  assert.match(evidence, /Joint venture entre AgroSul Hortifruti e Nourdrones/);
  assert.match(evidence, /mapeamento por drones|Mapeamento por drones/);
  assert.match(evidence, /grupo seleto de especialistas/);
});

test("a person's age and a patient name still stay out of evidence", () => {
  const evidence = prepareEvidence([
    page("/sobre", "Maria Silva, 42 anos, recomenda o mapeamento por drones da empresa."),
    page("/c", "A criança de 18 meses participou do programa de treinamento."),
  ]);
  assert.deepEqual(evidence, []);
});

const field = (patch: Record<string, unknown>) => ({
  key: "offers",
  value: "Mapeamento por drones com relatórios agronômicos",
  basis: "site",
  confidence: "high",
  sourceId: "s1",
  quote: "Mapeamento por drones com relatórios agronômicos acionáveis",
  rationale: "",
  ...patch,
});

test("profile keeps site-grounded answers with their source and labels the rest as inferred", () => {
  const result = sanitizeProfile(
    {
      fields: [
        field({}),
        field({
          key: "audience",
          value: "Produtores rurais que querem decidir com dados",
          basis: "inferred",
          confidence: "high",
          sourceId: "",
          quote: "",
          rationale: "O site fala em dono e agrônomo decidindo com dado de cada hectare.",
        }),
      ],
    },
    sources,
  );
  assert.equal(result.length, 2);
  assert.deepEqual([result[0]!.basis, result[0]!.sourceUrl], ["site", `${origin}/solucoes`]);
  assert.deepEqual([result[1]!.basis, result[1]!.confidence], ["inferred", "medium"]);
});

test("profile drops invented numbers, unsupported hard facts, bad options and personal data", () => {
  const result = sanitizeProfile(
    {
      fields: [
        field({ value: "Mapeamento de 5000 hectares por mês" }),
        field({ key: "ticket", value: "R$ 350 por hectare", basis: "inferred", rationale: "x" }),
        field({ key: "hours", value: "Seg a sex, 9h às 18h", basis: "inferred", rationale: "x" }),
        field({ key: "age", value: "30 a 40 anos", basis: "inferred", rationale: "x" }),
        field({
          key: "problems",
          value: "Atendemos o Dr. João Pereira",
          basis: "inferred",
          rationale: "x",
        }),
        field({
          key: "praise",
          value: "Clientes elogiam a precisão",
          basis: "inferred",
          rationale: "",
        }),
        field({ key: "ticket", value: "R$ 350", quote: "inventado que não existe no site" }),
      ],
    },
    sources,
  );
  assert.deepEqual(result, []);
});

test("a quote the evidence does not contain demotes a site claim to an inferred hypothesis", () => {
  const [item] = sanitizeProfile(
    {
      fields: [
        field({ quote: "texto inventado que não existe no site", rationale: "Parece provável." }),
      ],
    },
    sources,
  );
  assert.equal(item?.basis, "inferred");
  assert.equal(item?.sourceUrl, "");
});

test("generateBrandProfile sends only minimized evidence and returns sanitized answers", async () => {
  let sent = "";
  const research = researchSchema.parse({ status: "ready", sources });
  const result = await generateBrandProfile(research, new AbortController().signal, {
    client: {
      messages: {
        create: async (body) => {
          sent = JSON.stringify(body.messages);
          return {
            stop_reason: "end_turn",
            content: [{ type: "text", text: JSON.stringify({ fields: [field({})] }) }],
          } as never;
        },
      },
    },
  });
  assert.match(sent, /drones/);
  assert.equal(result[0]?.key, "offers");
});

const requestFor = () =>
  new Request("http://localhost/api/brand-preview", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "http://localhost" },
    body: JSON.stringify({
      action: "research",
      url: origin,
      material: "",
      stream: true,
      siteAuthorized: true,
      aiAuthorized: true,
    }),
  });
async function lastResearch(response: Response) {
  const lines = (await response.text()).trim().split("\n");
  return researchSchema.parse(JSON.parse(lines.at(-1)!).research);
}
const collected = researchSchema.parse({ status: "ready", sources });
const profileField = {
  key: "offers" as const,
  value: "Mapeamento por drones",
  basis: "site" as const,
  confidence: "high" as const,
  sourceUrl: `${origin}/solucoes`,
  rationale: "",
};

test("the stream carries the drafted profile through to completion", async () => {
  const response = await handleBrandPreview(requestFor(), true, {
    collect: async () => collected,
    synthesize: async () => [],
    profile: async () => [profileField],
  });
  const research = await lastResearch(response);
  assert.equal(research.phase, "complete");
  assert.deepEqual(research.profile, [profileField]);
});

test("a failing profile step does not take down the rest of the reading", async () => {
  const response = await handleBrandPreview(requestFor(), true, {
    collect: async () => collected,
    synthesize: async () => [],
    profile: async () => {
      throw new Error("provider down");
    },
  });
  const research = await lastResearch(response);
  assert.equal(research.phase, "complete");
  assert.deepEqual(research.profile, []);
  assert.ok(research.sources.length > 0);
});

const seed = () => {
  const data = demoSchema.parse({ name: "", library: { items: [] }, answers: {} });
  return {
    ...data,
    brand: brandPreviewSchema.parse({
      referenceUrl: origin,
      siteAuthorized: true,
      aiAuthorized: true,
    }),
  };
};
const withProfile = (profile: (typeof profileField)[]) =>
  applyResearchToData(
    seed(),
    { url: origin, material: "" },
    researchSchema.parse({
      status: "ready",
      sources,
      profile,
      phase: "complete",
    }),
  );

test("research prefills empty diagnostic answers once and never overwrites the user", () => {
  const filled = withProfile([
    profileField,
    { ...profileField, key: "differentials", value: "Equipe com certificações internacionais" },
  ]);
  assert.equal(filled.answers.offers, "Mapeamento por drones");
  assert.equal(filled.answers.differentials, "Equipe com certificações internacionais");
  assert.deepEqual(filled.brand.profileApplied.sort(), ["differentials", "offers"]);
  // The user clears a field; a later progress event must not refill it.
  const cleared = { ...filled, answers: { ...filled.answers, offers: "" } };
  const again = applyResearchToData(
    cleared,
    { url: origin, material: "" },
    researchSchema.parse(filled.brand.research),
  );
  assert.equal(again.answers.offers, "");
  // A typed answer wins over a draft.
  const typed = applyResearchToData(
    { ...seed(), answers: { ...seed().answers, offers: "Meu texto" } },
    { url: origin, material: "" },
    researchSchema.parse({ status: "ready", sources, profile: [profileField], phase: "complete" }),
  );
  assert.equal(typed.answers.offers, "Meu texto");
});
