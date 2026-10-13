/** Diagnostic answers the research may draft. Contact handles and the free-text
 * `goals` stay manual: handles are reference links, and `goals` is a selector in
 * the first onboarding chapter. */
export const PROFILE_KEYS = [
  "name",
  "segment",
  "offers",
  "problems",
  "ticket",
  "market",
  "differentials",
  "audience",
  "gender",
  "age",
  "location",
  "income",
  "interests",
  "physical",
  "online",
  "hours",
  "objections",
  "praise",
  "preferredChannel",
  "challenge",
  "purpose",
  "founderStory",
  "restrictions",
] as const;
export type ProfileKey = (typeof PROFILE_KEYS)[number];
