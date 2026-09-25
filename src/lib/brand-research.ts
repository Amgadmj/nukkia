import { z } from "zod/v4";
import {
  applyBrandResearch,
  suggestionSchema,
  researchSchema,
  updateBrand,
  type BrandResearch,
  type BrandSuggestion,
} from "./brand-preview.ts";
import { changeDemoContext, type DemoData } from "./quick-start.ts";
import {
  brandReferencesFingerprint,
  editedSourceIdentity,
  groupBrandSources,
  sourceIdentity,
} from "./brand-sources.ts";

// Deliberately conservative minimization, not a guarantee of anonymization.
// Ambiguous material stays local and can be entered manually instead.
const excluded =
  /@|https?:|www\.|\b(?:cpf|rg|crm|cro|crefito|dr[a]?\.?|doutor[a]?|paciente|depoimento|testimonial|review|diagnosticado|cirurgia|meu filho|minha filha|nome completo|whatsapp|telefone|e-?mail|cookie|privacidade|política|consentimento)\b|\+?\d[\d\s().-]{7,}\d|ignore.{0,50}instru|system prompt|api.?key|chave secreta|<\/?(?:script|system)/i;
const business =
  /pilates|fisioterapia|servi[çc]o|produto|oferta|promo[çc]|desconto|pre[çc]o|aula|grupo|atendimento|especialidade|curso|consulta|agendamento|equipe|experi[êe]ncia|anos|cl[ií]nica|est[uú]dio|loja|marca|empresa|neg[oó]cio|solu[çc]|tecnologia|entrega|qualidade|plano|mensal|treinamento|pergunt|\?/i;
const fold = (text: string) => text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
const corporateHeading =
  /^(?:quem somos|sobre(?: nos| a (?:empresa|marca))?|nossa historia|(?:nossos? |nossas? )?(?:servicos|produtos|ofertas|especialidades|aulas|planos)|precos(?: e planos)?|perguntas frequentes|faq)[:.!?]?$/;
const personalHeading =
  /^(?:casos? clinicos?|historias? (?:reais|de vida)|relatos?|depoimentos?(?: de clientes)?|testimonials?|reviews?|(?:nossa |our )?(?:equipe|team)|prontuario|dados (?:pessoais|do paciente))[:.!?]?$/;
const personField =
  /\b(?:nome(?: completo)?|sobrenome|idade|(?:data de )?nascimento|sexo|genero|profissao|responsavel|paciente|cliente|beneficiario|diagnostico)\s*[:=]/;
const personalContent =
  /\b(?:diagnostic\w*|cancer|tumor\w*|prontuario\w*|laudo\w*|doenca\w*|sintoma\w*|medicac\w*|diabet\w*|depress\w*|hiv|soropositiv\w*|internac\w*|gestante\w*|gravidez|eu|meus?|minhas?|tenho|tive|sofro|sofria|fui|fiz|faco|relatou|iniciou|recebeu|recuperac\w*)\b|\b\d{1,3}\s*(?:anos|aninhos|meses|years?|months?)\b/;
// Generic corporate title words are not person names. Unknown adjacent names
// (including ambiguous company names) stay local rather than being guessed safe.
const corporateWord =
  /^(?:marca|empresa|clinica|estudio|loja|servicos?|produtos?|aulas?|pilates|fisioterapia|precos?|planos?|mensal|nossos?|nossas?|perguntas?|frequentes)$/;
function hasPersonalData(text: string) {
  const folded = fold(text);
  if (excluded.test(text) || personField.test(folded) || personalContent.test(folded)) return true;
  if (corporateHeading.test(folded)) return false;
  const names = text.matchAll(
    /(?<!\p{L})\p{Lu}[\p{L}\p{M}'’-]+(?:\s+(?:d[aeo]s?\s+)?\p{Lu}[\p{L}\p{M}'’-]+)+/gu,
  );
  return [...names].some(
    ([sequence]) =>
      (sequence.match(/\p{Lu}[\p{L}\p{M}'’-]+/gu) ?? []).filter(
        (word) => !corporateWord.test(fold(word)),
      ).length >= 2,
  );
}
export function prepareEvidence(sources: BrandResearch["sources"]) {
  let remaining = 18000;
  return sources.flatMap((source, index) => {
    if (source.url === "material:fornecido" || remaining <= 0) return [];
    const lines: string[] = [];
    let personalSection = false;
    for (const rawLine of source.text.split(/\n+/)) {
      const line = rawLine.trim();
      const folded = fold(line);
      if (personalHeading.test(folded) || personField.test(folded)) {
        personalSection = true;
        continue;
      }
      const heading = corporateHeading.test(folded);
      if (heading) personalSection = false;
      if (
        personalSection ||
        line.length > 700 ||
        hasPersonalData(line) ||
        (!heading && (line.length < 10 || !business.test(line)))
      )
        continue;
      lines.push(line);
      if (lines.length >= 12) break;
    }
    const text = lines.join("\n").slice(0, Math.min(1800, remaining));
    remaining -= text.length;
    return text ? [{ id: `s${index}`, text }] : [];
  });
}
const candidateSchema = z.object({
  field: z.enum(["name", "segment", "audience", "offers", "detail", "faq"]),
  title: z.string().trim().max(80).default(""),
  excerptId: z.string().max(24).default(""),
  value: z.string().trim().min(2).max(300),
  quote: z.string().trim().min(8).max(500),
  sourceId: z.string().max(10),
  kind: z.enum(["fact", "past-campaign", "opportunity"]),
  rationale: z.string().max(400),
  publishedAt: z.string().max(80).nullable(),
});
export const synthesisOutputSchema = z.object({ suggestions: z.array(candidateSchema).max(18) });
export function prepareSynthesisExcerpts(sources: BrandResearch["sources"]) {
  return prepareEvidence(sources).flatMap((source) => {
    const excerpts: { id: string; sourceId: string; text: string }[] = [];
    for (const line of source.text.split("\n")) {
      for (const match of line.matchAll(/[^.!?]+(?:[.!?]+|$)/g)) {
        let text = match[0].trim();
        if (text.length > 300) {
          const prefix = text.slice(0, 300);
          const clause = Math.max(prefix.lastIndexOf(","), prefix.lastIndexOf(";"));
          text = prefix.slice(0, clause >= 100 ? clause : prefix.lastIndexOf(" ")).trim();
        }
        if (
          text.length < 30 ||
          unsupportedClaim.test(text) ||
          excerpts.some((item) => item.text === text)
        )
          continue;
        excerpts.push({ id: `${source.id}-e${excerpts.length}`, sourceId: source.id, text });
        if (excerpts.length >= 6) break;
      }
      if (excerpts.length >= 6) break;
    }
    return excerpts;
  });
}

function resolveSelectedExcerpts(raw: unknown, sources: BrandResearch["sources"]) {
  const envelope = z.object({ suggestions: z.array(z.unknown()).max(18) }).safeParse(raw);
  if (!envelope.success) return raw;
  const excerpts = prepareSynthesisExcerpts(sources);
  return {
    suggestions: envelope.data.suggestions.flatMap((candidate) => {
      if (!candidate || typeof candidate !== "object") return [candidate];
      const item = candidate as Record<string, unknown>;
      if (!item["excerptId"]) return [item];
      const excerpt = excerpts.find((entry) => entry.id === item["excerptId"]);
      // IDs can only select complete, pre-extracted source text, not create it.
      if (!excerpt || !["offers", "detail"].includes(String(item["field"]))) return [];
      return [{ ...item, sourceId: excerpt.sourceId, value: excerpt.text, quote: excerpt.text }];
    }),
  };
}
function synthesisCandidates(raw: unknown) {
  const envelope = z.object({ suggestions: z.array(z.unknown()).max(18) }).safeParse(raw);
  if (!envelope.success) return [];
  // Validate independently: one malformed suggestion must not erase the
  // other grounded options. Every accepted item still passes the same limits.
  return envelope.data.suggestions.flatMap((item) => {
    const parsed = candidateSchema.safeParse(item);
    return parsed.success ? [parsed.data] : [];
  });
}
const normalize = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();
const unsupportedClaim = /\b(?:garantid\w*|melhor(?:es)?|cura|sem risco)\b/i;
// Keep numbers attached to their currency/unit (or following word). A duration
// cannot substantiate a percentage, price, age, or a different quantity.
const quantities = (text: string) =>
  [
    ...text.matchAll(
      /(?:R\$\s*|US\$\s*|[$€£]\s*)?\d+(?:[.,]\d+)*(?:\s*(?:%|por\s+cento\b|\p{L}+))?/giu,
    ),
  ].map(([quantity]) => normalize(quantity).replace(/\s+/g, ""));
export function validateSynthesis(raw: unknown, sources: BrandResearch["sources"]) {
  const evidence = prepareEvidence(sources);
  const perField = new Map<string, number>();
  const seenValues = new Set<string>();
  return synthesisCandidates(raw).flatMap((item) => {
    const entry = evidence.find((x) => x.id === item.sourceId);
    const source = sources[Number(item.sourceId.slice(1))];
    if (!entry || !source || !normalize(entry.text).includes(normalize(item.quote))) return [];
    if (hasPersonalData(item.value) || hasPersonalData(item.rationale)) return [];
    const inference = item.field === "audience" || item.kind === "opportunity";
    const literal = normalize(item.quote).includes(normalize(item.value));
    // An opportunity may suggest an audience or use, not invent the underlying
    // offer or differentiator. Facts are literal apart from whitespace/case.
    if ((!inference || item.field === "offers" || item.field === "detail") && !literal) return [];
    if (inference && !item.rationale.trim()) return [];
    const supportedQuantities = new Set(quantities(item.quote));
    if (
      [...quantities(item.value), ...quantities(item.rationale)].some(
        (quantity) => !supportedQuantities.has(quantity),
      )
    )
      return [];
    if (unsupportedClaim.test(item.value)) return [];
    const title =
      item.title &&
      item.title.split(/\s+/).length <= 7 &&
      !/[.…]$/.test(item.title) &&
      !hasPersonalData(item.title) &&
      !unsupportedClaim.test(item.title) &&
      quantities(item.title).every((quantity) => supportedQuantities.has(quantity))
        ? item.title
        : "";
    let kind = item.kind;
    if (item.field === "audience") kind = "opportunity";
    const dated = /\b20\d{2}\b|\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/.test(item.quote);
    if (item.field === "offers" && dated && /promo|desconto|oferta|campanha/i.test(item.quote))
      kind = "past-campaign";
    if (kind === "past-campaign" && !dated) return [];
    // Date labels are copied from the evidence, never inferred from fetch time.
    const publishedAt =
      item.publishedAt && normalize(item.quote).includes(normalize(item.publishedAt))
        ? item.publishedAt
        : kind === "past-campaign"
          ? (item.quote.match(/(?:\w+ de )?20\d{2}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4}/)?.[0] ?? null)
          : null;
    const count = perField.get(item.field) ?? 0;
    const identity = `${item.field}:${normalize(item.value).replace(/[.!?]+$/, "")}`;
    if (seenValues.has(identity)) return [];
    if (
      count >= (item.field === "offers" || item.field === "detail" || item.field === "faq" ? 3 : 1)
    )
      return [];
    perField.set(item.field, count + 1);
    seenValues.add(identity);
    return [
      suggestionSchema.parse({
        ...item,
        title,
        kind,
        rationale:
          kind === "opportunity"
            ? `Hipótese a validar: ${item.rationale.trim()}`.slice(0, 400)
            : item.rationale,
        sourceUrl: source.url,
        foundAt: source.fetchedAt,
        publishedAt,
        origin: "ai",
        confidence: kind === "opportunity" ? "low" : literal ? "high" : "medium",
      }),
    ];
  });
}
export function sourcedSynthesis(raw: unknown, sources: BrandResearch["sources"]) {
  raw = resolveSelectedExcerpts(raw, sources);
  const accepted = validateSynthesis(raw, sources);
  // Preserve useful extraction when a model paraphrases despite instructions.
  // The rejected claim and explanation are discarded, not silently trusted.
  // Only a complete short quotation may become a separately validated option.
  for (const item of synthesisCandidates(raw)) {
    if (!["offers", "detail"].includes(item.field) || item.quote.length > 300) continue;
    if (accepted.filter((x) => x.field === item.field).length >= 3) continue;
    const fallback = validateSynthesis(
      {
        suggestions: [
          {
            ...item,
            // A title attached to a rejected claim is not trusted either.
            title: "",
            value: item.quote,
            kind: item.kind === "opportunity" ? "opportunity" : "fact",
            rationale:
              item.kind === "opportunity"
                ? "Este trecho pode orientar uma apresentação do serviço. Confirme se ele faz sentido para sua próxima comunicação."
                : "Trecho direto do site para você selecionar e revisar. A redação sugerida foi substituída pela evidência literal.",
          },
        ],
      },
      sources,
    )[0];
    if (
      fallback &&
      !accepted.some(
        (x) =>
          x.field === fallback.field &&
          (normalize(x.value).includes(normalize(fallback.value)) ||
            normalize(fallback.value).includes(normalize(x.value))),
      )
    )
      accepted.push(fallback);
  }
  return accepted;
}
export function applyResearchToData(
  data: DemoData,
  reference: { url: string; material: string },
  research: BrandResearch,
): DemoData {
  const brand = applyBrandResearch(data.brand, reference, research);
  if (brand === data.brand) return data;
  const next = {
    ...data,
    brand: { ...brand, suggestedFields: [...brand.suggestedFields] },
    answers: { ...data.answers },
  };
  if (!brand.confirmed)
    for (const item of allowedSuggestions(next)) {
      if (brand.editedFields.includes(item.field)) continue;
      if ((item.field === "name" || item.field === "segment") && !next[item.field].trim()) {
        next[item.field] = item.value.slice(0, 120);
        next.brand.suggestedFields.push(item.field);
      }
      if (item.field === "audience" && !next.answers.audience.trim()) {
        next.answers.audience = item.value;
        next.brand.suggestedFields.push("audience");
      }
    }
  next.brand.suggestedFields = [...new Set(next.brand.suggestedFields)];
  return next;
}
export function referenceFingerprint(data: DemoData) {
  return brandReferencesFingerprint(data.brand);
}

export function replaceBrandReference(
  data: DemoData,
  key: string,
  value: string,
): { data: DemoData; error?: never } | { error: string; data?: never } {
  const brand = data.brand;
  const original = groupBrandSources(brand.research, brand.extraLinks).find(
    (group) => group.key === key && !brand.excludedReferences.includes(key),
  );
  const identity = original?.url ? editedSourceIdentity(original.url, value) : null;
  if (!identity) return { error: "Informe um link HTTPS válido ou o @perfil desta rede." };
  const official = sourceIdentity(brand.referenceUrl);
  const officialChanged = official?.key === key && identity.url !== official.url;
  if (identity.key === key && !officialChanged)
    return {
      data: { ...data, brand: updateBrand(brand, { referencesConfirmed: "", confirmed: false }) },
    };

  if (official?.key === key) {
    // A new official site needs new authorization. Never relabel the old site's
    // evidence or send the replacement for analysis behind the user's back.
    if (identity.url.length > 200)
      return { error: "O site principal deve ter até 200 caracteres." };
    const untouchedSuggestion = (field: string) =>
      brand.suggestedFields.includes(field) && !brand.editedFields.includes(field);
    const next = changeDemoContext(data, {
      name: untouchedSuggestion("name") ? "" : data.name,
      segment: untouchedSuggestion("segment") ? "" : data.segment,
      answers: {
        ...data.answers,
        website: identity.url,
        audience: untouchedSuggestion("audience") ? "" : data.answers.audience,
      },
    });
    return {
      data: {
        ...next,
        brand: updateBrand(next.brand, {
          referenceUrl: identity.url,
          research: researchSchema.parse({}),
          referencesConfirmed: "",
          confirmed: false,
          siteAuthorized: false,
          aiAuthorized: false,
          suggestedFields: [],
        }),
      },
    };
  }

  const extraLinks = [
    ...new Set([
      ...brand.extraLinks.filter((url) => sourceIdentity(url)?.key !== key),
      identity.url,
    ]),
  ];
  const excludedReferences = [
    ...new Set([
      ...brand.excludedReferences.filter((excluded) => excluded !== identity.key),
      // Manual links may also exist in legacy answers; keep their old identity excluded.
      key,
    ]),
  ];
  if (extraLinks.length > 12)
    return { error: "Limite de 12 links adicionais. Remova um antes de salvar." };
  if (excludedReferences.length > 24)
    return {
      error: "Limite de correções atingido. Analise o site novamente antes de editar mais links.",
    };
  return {
    data: {
      ...data,
      brand: updateBrand(brand, {
        extraLinks,
        excludedReferences,
        referencesConfirmed: "",
        confirmed: false,
      }),
    },
  };
}
function allowedSource(data: DemoData, item: BrandSuggestion) {
  const key =
    item.sourceUrl === "material:fornecido" ? item.sourceUrl : sourceIdentity(item.sourceUrl)?.key;
  return !!key && !data.brand.excludedReferences.includes(key);
}
export function allowedSuggestions(data: DemoData) {
  return data.brand.research.suggestions.filter((item) => allowedSource(data, item));
}
export function applyResearchSuggestion(data: DemoData, item: BrandSuggestion): DemoData {
  if (!allowedSource(data, item)) return data;
  let next = data;
  if (item.field === "name" || item.field === "segment")
    next = changeDemoContext(data, { [item.field]: item.value.slice(0, 120) });
  else if (item.field === "audience" || item.field === "offers")
    next = changeDemoContext(data, { answers: { ...data.answers, [item.field]: item.value } });
  const patch =
    item.field === "detail"
      ? { detail: item.value }
      : item.field === "faq"
        ? { customerQuestion: item.value.slice(0, 240) }
        : item.field === "offers"
          ? { offerReviewRequired: true, selectedOfferKind: item.kind ?? "fact" }
          : { confirmed: false };
  return { ...next, brand: updateBrand(next.brand, patch) };
}
