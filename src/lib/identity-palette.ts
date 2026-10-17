export type PaletteOption = { nome: string; cores: string[]; justificativa?: string };

const valid = (value: unknown): value is string =>
  typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);

/** Local proposals, never evidence of an AI analysis or a confirmed brand choice. */
export function identityPaletteOptions(input: {
  saved?: unknown;
  accent?: string | undefined;
  confirmed?: boolean;
  colors?: string[] | undefined;
}): PaletteOption[] {
  const saved = input.saved as { nome?: unknown; cores?: unknown } | null;
  const savedColors = Array.isArray(saved?.cores) ? saved.cores.filter(valid).slice(0, 12) : [];
  const observed = (input.colors ?? []).filter(valid).slice(0, 8);
  const accent = valid(input.accent) ? input.accent : undefined;
  const colors = savedColors.length
    ? savedColors
    : (input.confirmed ||
          observed.some((color) => color.toLowerCase() === accent?.toLowerCase())) &&
        accent
      ? [accent, ...observed.filter((c) => c.toLowerCase() !== accent.toLowerCase())]
      : observed.length
        ? observed
        : accent
          ? [accent]
          : [];
  if (!colors.length) return [];
  const mix = (color: string, target: number) =>
    "#" +
    [1, 3, 5]
      .map((offset) => {
        const channel = Number.parseInt(color.slice(offset, offset + 2), 16);
        return Math.round(channel * 0.92 + target * 0.08)
          .toString(16)
          .padStart(2, "0")
          .toUpperCase();
      })
      .join("");
  return [
    {
      nome: savedColors.length && typeof saved?.nome === "string" ? saved.nome : "Referência atual",
      cores: colors,
      justificativa: savedColors.length
        ? "Paleta salva na conta."
        : input.confirmed
          ? "Base na cor confirmada da identidade."
          : observed.length
            ? "Cores observadas no site; confirme antes de salvar."
            : "Base na cor atual do espaço de trabalho; confirme antes de salvar.",
    },
    {
      nome: "Proposta · suavizar",
      cores: colors.map((c) => mix(c, 255)),
      justificativa: "Variação local: 8% mais clara. Não gerada por IA.",
    },
    {
      nome: "Proposta · aprofundar",
      cores: colors.map((c) => mix(c, 0)),
      justificativa: "Variação local: 8% mais escura. Não gerada por IA.",
    },
  ];
}
