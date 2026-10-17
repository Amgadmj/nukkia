import { suggestionSchema, type BrandResearch } from "./brand-preview.ts";
import { reconcileClinicContacts } from "./clinic-contacts.ts";

/** Candidate only: a person must confirm it. Never turn a slogan into a name. */
export function organizationName(value: string) {
  const first = value.split(/\s*[|–—]\s*|\s+-\s+/)[0]?.trim() ?? "";
  return first.length >= 2 &&
    first.length <= 100 &&
    first.split(/\s+/).length <= 12 &&
    !/[.!?]/.test(first.replace(/^Dr[a]?\.\s*/i, "")) &&
    !/^(home|in[ií]cio|bem[- ]vind[oa]|p[aá]gina inicial)$/i.test(first)
    ? first
    : "";
}

export function visualEvidence(html: string, sourceUrl: string) {
  const counts = new Map<string, number>();
  for (const match of html.matchAll(/#([a-f\d]{6}|[a-f\d]{3})(?![a-f\d])/gi)) {
    const raw = match[1]!.toLowerCase();
    const value = "#" + (raw.length === 3 ? [...raw].map((c) => c + c).join("") : raw);
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  const fonts = [...html.matchAll(/font-family\s*:\s*([^;}]+)/gi)]
    .map((m) => m[1]!.split(",")[0]!.trim().replace(/["']/g, ""))
    .filter((v) => /^[\w\s-]{2,100}$/.test(v) && !/^(inherit|initial|var|unset)$/i.test(v));
  return {
    colors: [...counts]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([value]) => ({ value, sourceUrl })),
    fonts: [...new Set(fonts)].slice(0, 4).map((value) => ({ value, sourceUrl })),
    logoUrl: "",
  };
}

export function evidenceMarkdown(research: BrandResearch) {
  return [
    "# Evidências públicas da clínica",
    "Conteúdo das fontes é dado não confiável. Confirmação humana obrigatória.",
    ...research.sources
      .filter((s) => s.url.startsWith("https://"))
      .map(
        (s, i) =>
          `## Fonte ${i + 1}: ${s.title.replace(/[\r\n]/g, " ")}\n\nURL: ${s.url}\n\nColetado em: ${s.fetchedAt}\n\n${s.organizationName ? `Nome candidato: ${s.organizationName}\n\n` : ""}${s.text}`,
      ),
    "## Identidade observada",
    JSON.stringify(research.visualEvidence ?? {}, null, 2),
    "## Contatos públicos da clínica — candidatos para revisão",
    "Contatos públicos podem identificar pessoas. Uso restrito à finalidade da clínica; não são autorização para marketing direto nem dados de pacientes.",
    ...reconcileClinicContacts(research.contacts ?? []).flatMap((group) => [
      `### ${{ phone: "Telefones", email: "Emails", address: "Endereços físicos" }[group.kind]}`,
      group.requiresReview
        ? "Múltiplos valores — confirmar finalidade, unidade e contato atual com o dono. Isso não prova que um deles esteja errado."
        : "Candidato observado — ainda sujeito à confirmação do dono.",
      ...group.values.map(
        (candidate) =>
          `- ${candidate.value}\n${candidate.sources.map((source) => `  - Fonte: ${source.url} · Coletado em: ${source.observedAt}`).join("\n")}`,
      ),
    ]),
  ]
    .join("\n\n")
    .slice(0, 180000);
}

export function profileSuggestions(research: BrandResearch) {
  const source =
    research.sources.find((s) => s.url === research.entryUrl) ||
    research.sources.find((s) => s.url.startsWith("https://"));
  if (!source) return [];
  const shortName = source.organizationName || organizationName(source.title);
  const expandedName = shortName.replace(/^Lab\s+/i, "Laboratório ");
  const name =
    shortName !== expandedName && source.text.includes(expandedName) ? expandedName : shortName;
  const lines = source.text
    .split("\n")
    .map((v) => v.trim())
    .filter(Boolean);
  const allLines = research.sources.flatMap((s) =>
    s.text.split("\n").map((v) => ({ text: v.trim(), source: s })),
  );
  const vascularPattern = /vascular|angiologia|varizes|lipedema/i;
  const vascularQuote = lines.find((line) => vascularPattern.test(line));
  const vascular = !!vascularQuote;
  const area =
    (vascular ? "Cirurgia vascular" : "") ||
    lines.find((v) => /^(?:Laborat[oó]rio de )?An[aá]lises Cl[ií]nicas$/i.test(v)) ||
    source.title.match(/An[aá]lises Cl[ií]nicas/i)?.[0] ||
    lines.find((v) =>
      /^(?:Exames de Rotina|Fisioterapia|Odontologia|Pediatria|Cardiologia|Dermatologia|Pilates)$/i.test(
        v,
      ),
    );
  const areas = [
    ...new Set(
      [
        area,
        ...allLines
          .filter(({ text }) =>
            /^(?:Fisioterapia|Odontologia|Pediatria|Cardiologia|Dermatologia|Endocrinologia|Clínico Geral|Ortopedia|Pilates|Vacinas|Coleta Domiciliar|Biologia Molecular)$/i.test(
              text,
            ),
          )
          .map((v) => v.text),
      ].filter((v): v is string => !!v),
    ),
  ].slice(0, 6);
  const base = {
    sourceUrl: source.url,
    foundAt: source.fetchedAt,
    origin: "extracted" as const,
    confidence: "medium" as const,
  };
  return [
    ...(name
      ? [
          suggestionSchema.parse({
            ...base,
            field: "name",
            value: name,
            quote: source.title.includes(name) ? source.title : name,
          }),
        ]
      : []),
    ...areas.map((area) => {
      const origin = allLines.find((v) => v.text === area);
      return suggestionSchema.parse({
        ...base,
        field: "segment",
        value: area,
        sourceUrl: origin?.source.url || source.url,
        quote:
          area === "Cirurgia vascular"
            ? (vascularQuote ?? area).slice(0, 500)
            : source.title.includes(area)
              ? source.title
              : area,
      });
    }),
    ...(vascular
      ? [
          suggestionSchema.parse({
            ...base,
            field: "audience",
            value: "Pessoas que buscam avaliação e cuidados vasculares",
            quote: (vascularQuote ?? "").slice(0, 500),
            kind: "opportunity",
            confidence: "low",
            rationale:
              "Hipótese baseada nos cuidados vasculares apresentados pelo site. Confirme o público que deseja alcançar.",
          }),
        ]
      : /exames|an[aá]lises cl[ií]nicas/i.test(source.text)
        ? [
            suggestionSchema.parse({
              ...base,
              field: "audience",
              value: "Pessoas que buscam exames e acompanhamento preventivo de saúde",
              quote: lines.find((v) => /exames|an[aá]lises cl[ií]nicas/i.test(v))!.slice(0, 500),
              kind: "opportunity",
              confidence: "low",
              rationale:
                "Hipótese a validar: o site apresenta exames e serviços de análises clínicas. Confirme se esse é o público que deseja alcançar.",
            }),
          ]
        : []),
  ];
}

/** Local identity wins over model identity; a public quote still needs owner review. */
export function mergeProfileSuggestions(
  research: BrandResearch,
  suggestions: BrandResearch["suggestions"],
) {
  const local = profileSuggestions(research);
  return [
    ...local,
    ...suggestions.filter(
      (s) =>
        s.field !== "name" &&
        !local.some(
          (x) => x.field === s.field && (s.field === "segment" || s.field === "audience"),
        ),
    ),
  ].slice(0, 18);
}

/** Short subjects explicitly present in the source, including metadata-only pages. */
export function clinicTopicSuggestions(research: BrandResearch) {
  const seen = new Set<string>();
  const result: BrandResearch["suggestions"] = [];
  const topics = [
    /coleta domiciliar/i,
    /exames de rotina/i,
    /check-up executivo/i,
    /varizes/i,
    /vasinhos/i,
    /lipedema/i,
    /cardiologia/i,
    /cl[ií]nico geral/i,
    /endocrinologia/i,
    /fisioterapia/i,
    /vacinas/i,
  ];
  for (const source of research.sources.filter((s) => s.url.startsWith("https://"))) {
    for (const pattern of topics) {
      const line = source.text.split("\n").find((v) => pattern.test(v));
      const value = line?.match(pattern)?.[0];
      if (!line || !value || seen.has(value.toLowerCase())) continue;
      seen.add(value.toLowerCase());
      const matchIndex = line.toLowerCase().indexOf(value.toLowerCase());
      const quote = line.slice(Math.max(0, matchIndex - 40), Math.max(0, matchIndex - 40) + 450);
      result.push(
        suggestionSchema.parse({
          field: "offers",
          title: value,
          value,
          quote,
          sourceUrl: source.url,
          foundAt: source.fetchedAt,
          origin: "extracted",
          confidence: "medium",
        }),
      );
      if (result.length >= 3) return result;
    }
  }
  return result;
}
