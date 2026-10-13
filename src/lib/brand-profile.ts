import { z } from "zod/v4";
import { CHAPTERS } from "./onboarding.ts";
import { PROFILE_KEYS, type ProfileKey } from "./brand-profile-keys.ts";
import { profileFieldSchema, type BrandResearch, type ProfileField } from "./brand-preview.ts";
import { brandTokens, hasPersonalData, prepareEvidence } from "./brand-research.ts";

const outputField = z.object({
  key: z.enum(PROFILE_KEYS),
  value: z.string().max(1000),
  basis: z.enum(["site", "inferred"]),
  confidence: z.enum(["high", "medium", "low"]),
  sourceId: z.string().max(10),
  quote: z.string().max(300),
  rationale: z.string().max(300),
});
export const profileOutputSchema = z.object({ fields: z.array(outputField).max(30) });

const options = new Map<string, readonly string[]>(
  CHAPTERS.flatMap((chapter) => chapter.questions)
    .filter((question) => question.options)
    .map((question) => [question.key, question.options!]),
);
// Hard facts are either stated by the site or left blank; a guess would be a
// fabricated price, schedule, address, biography or regulatory rule.
const factOnly = new Set<ProfileKey>([
  "ticket",
  "hours",
  "location",
  "founderStory",
  "restrictions",
]);
const shortKeys = new Set<ProfileKey>(["name", "segment", "ticket"]);
const normalize = (text: string) => text.replace(/\s+/g, " ").trim().toLowerCase();

/**
 * Keeps only drafted answers that are safe to show as editable suggestions.
 * Anything the evidence does not support is dropped or demoted to a labelled
 * hypothesis; nothing here is trusted just because the model produced it.
 */
export function sanitizeProfile(raw: unknown, sources: BrandResearch["sources"]): ProfileField[] {
  const envelope = z.object({ fields: z.array(z.unknown()).max(30) }).safeParse(raw);
  if (!envelope.success) return [];
  const evidence = prepareEvidence(sources);
  const evidenceText = normalize(evidence.map((entry) => entry.text).join("\n"));
  const brand = brandTokens(sources);
  const seen = new Set<string>();
  const result: ProfileField[] = [];
  for (const item of envelope.data.fields) {
    const parsed = outputField.safeParse(item);
    if (!parsed.success) continue;
    const field = parsed.data;
    if (seen.has(field.key)) continue;
    const value = field.value.trim();
    if (value.length < 3 || value.length > (shortKeys.has(field.key) ? 120 : 600)) continue;
    const choices = options.get(field.key);
    if (choices && !choices.includes(value)) continue;
    if (hasPersonalData(value, brand) || hasPersonalData(field.rationale, brand)) continue;
    // Numbers (prices, years, counts) must come from the evidence, never the model.
    if ((value.match(/\d+(?:[.,]\d+)*/g) ?? []).some((n) => !evidenceText.includes(n))) continue;
    const entry = evidence.find((candidate) => candidate.id === field.sourceId);
    const source = sources[Number(field.sourceId.slice(1))];
    const quote = normalize(field.quote);
    const grounded =
      field.basis === "site" &&
      !!entry &&
      !!source &&
      quote.length >= 8 &&
      normalize(entry.text).includes(quote);
    if (factOnly.has(field.key) && !grounded) continue;
    if (!grounded && !field.rationale.trim()) continue;
    seen.add(field.key);
    result.push(
      profileFieldSchema.parse({
        key: field.key,
        value,
        basis: grounded ? "site" : "inferred",
        confidence: grounded
          ? field.confidence
          : field.confidence === "high"
            ? "medium"
            : field.confidence,
        sourceUrl: grounded ? source!.url : "",
        rationale: field.rationale.trim().slice(0, 300),
      }),
    );
  }
  return result;
}
