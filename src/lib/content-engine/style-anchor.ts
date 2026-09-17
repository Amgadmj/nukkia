import type { BrandKitLike, CompanyLike } from "./types";

/**
 * A persistent, text-only description of a company's visual identity that
 * gets prepended to every image-generation prompt for a piece of content —
 * cover slide, body slides, CTA slide, thumbnail — so they read as one
 * coherent piece instead of independent images.
 *
 * This is a generalization of the pattern proven across two production
 * pipelines this org has run: AgrosTech's Pillow-rendered carousels (fixed
 * brand template + swapped copy per slide) and the Higgsfield/Nano-Banana
 * generation workflow (a persistent reference/character description reused
 * across every generated frame so a series stays visually consistent). The
 * Lovable AI gateway this app calls only exposes text-to-image, not
 * reference-image conditioning, so the "anchor" here is the text-prompt
 * equivalent of that reference image — same role, weaker guarantee. If a
 * reference-image-capable provider is wired in later (see renderVideo() in
 * index.ts for the same seam on the video side), swap this for an actual
 * reference asset instead of describing it in words.
 */
export function buildStyleAnchor(company: CompanyLike, brandKit: BrandKitLike): string {
  const palette = brandKit?.palette;
  const cores = palette?.cores?.length
    ? palette.cores.join(", ")
    : "#2A0845, #3B82F6, #06B6D4, #F8FAFC";
  const tone = brandKit?.tone?.trim() || "profissional e acolhedor";

  return [
    `Identidade visual de ${company.name} (segmento: ${company.segment ?? "serviços"}).`,
    `Use exatamente esta paleta de cores em todas as peças: ${cores}.`,
    `Tom de comunicação: ${tone}.`,
    "Estilo: design profissional, limpo, moderno, com bastante respiro, gradientes sutis e composição centrada.",
    "Sem marcas d'água, sem textos sem sentido, sem rostos distorcidos.",
  ].join(" ");
}
