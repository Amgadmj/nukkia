# Movitta — local pilot, 2026-09-24

## Hybrid-research follow-up (later on 2026-09-24)

The sections below this follow-up record the earlier pilot, not current implementation status. Public corporate excerpts are now authorized for Anthropic synthesis. See `brand-first-preview.md` for the current architecture and production limits.

- Actual bounded crawl returned five pages (including `clinica.html` and `simulador-de-ski.html`) and identified Facebook `movittasaude`, Instagram `movitta_`, and TikTok `clinicamovitta` without reading their histories.
- Anthropic authentication succeeded. Two Sonnet synthesis attempts exceeded the 20-second timeout; a Haiku synthesis completed in approximately 14.4 seconds. Onboarding now has its own configurable research model. This sample is not a latency SLA.
- Browser QA confirmed grouped links, required confirmation, automatic name/segment/audience drafts, and non-blocking analysis. Unsupported paraphrases are rejected; where possible, a separate short literal excerpt is validated and offered instead. An old campaign never becomes current merely because it was fetched today.
- New regression coverage includes consent cancellation, removed references, newly discovered references requiring confirmation, interrupted requests, sensitive narratives, fabricated offers/units, and historical warnings.
- Privacy filtering remains heuristic, not certified anonymization. Launch still needs policy/contract/retention review, authenticated tenant authorization, quota and a durable worker. Scrapling and social-history APIs remain unimplemented. No deployment, migration, real publication or team sharing occurred.

## Earlier pilot record

Scope: private local `/demo` walkthrough using the operator-supplied public site. No real account created, production records changed, migration applied, release deployed, or social publication made.

## Evidence and changes

Initial live `POST /api/brand-preview` returned one homepage, no logo, and template staff biographies containing Lorem Ipsum. The collector only recognized a narrow URL vocabulary and logos identified by alt/class.

Three failing regression tests reproduced these gaps. Narrow fixes in `src/lib/public-site.server.ts` now recognize clinic/service paths, use an explicit logo filename as a fallback, and exclude placeholder text plus its inert biography card. The collector warns when placeholders were removed. Public-address, same-site, robots, byte, timeout and three-page limits remain unchanged.

The live rerun and browser walkthrough collected:

- https://www.movitta.com.br/
- https://www.movitta.com.br/fisioterapia.html
- https://www.movitta.com.br/condicionamento.html
- Optional raster logo: https://www.movitta.com.br/images/Logo-1.png

No `og:site_name` exists on the homepage. The pilot name was filled manually; the collector does not invent a brand identity from a generic title such as “Inicial”. No semantic AI extraction is claimed.

## Brief and editorial review

- Brand: Movitta; sector: fisioterapia e condicionamento físico.
- Test audience hypothesis: people in São Paulo seeking exercise adapted to their condition and goals. This is our pilot assumption, not an owner-confirmed audience.
- Test goal: receive more bookings. This is a selected test goal, not a finding from the website.
- Offer: individualized physical conditioning.
- Source-supported detail: physical assessment and individualized exercise with physiotherapist supervision.
- Destination: the public conditioning page, rather than assuming which WhatsApp contact is appropriate.
- Selected approach: invitation/offer, consistent with the booking goal.

The initial local rule-based draft was manually edited during QA:

Title: “Seu treino começa com uma avaliação”.

Body: “Exercícios adaptados aos seus objetivos e à sua condição física, com acompanhamento de fisioterapeutas.”

Caption explains the assessment and individualized program, then points to the conditioning page. No guaranteed outcomes, fabricated testimonials, invented pricing or patient data were used. This editorial assistance is not automated in-product AI generation and is not clinic/legal/compliance approval.

## Browser checks

- New fictional demo → website → manual brief → transparent recommendation → editable offer post.
- Source coverage: three dated public pages; social history/reach/conversions correctly unavailable.
- Collected logo applied successfully; draft text edited.
- Approval grants 40 XP in addition to the 20 XP context milestone.
- Editing after approval revokes approval, disables export and returns XP to 20.
- Reload restores the draft, logo and unapproved state in the same browser tab.
- Reapproval enables export. UI reports download initiation and 90 XP; repeated export does not add XP.
- No browser console errors observed. Desktop and 390px mobile layout/menu/trail checked.
- **Export limitation:** the in-app browser showed download initiation, but its download event timed out and no new matching ZIP was observed in Downloads. A completed saved-file download is NOT verified. Archive structure is covered by automated tests; this is not a substitute for the outstanding real-browser download check.
- Native replacement-confirmation cancellation from the previous test remains unverified; this run did not replace the edited draft with another approach.

## Live API checks

| Check | Observed result | Scope / next action |
| --- | --- | --- |
| Local research | Successful, three pages and logo | Local development only |
| Anthropic structured generation | `claude-sonnet-4-6`, parsed `{status: "ok"}`, 199 input / 8 output tokens | Synthetic test only; no Movitta material sent |
| Gemini model listing | HTTP 200; configured default image and video models listed | Listing is not generation proof |
| Gemini actual image generation | HTTP 402 `RESOURCE_EXHAUSTED`: prepaid credits depleted | Operator must manage billing; no billing change made |
| Veo video generation | Not invoked | Model listing only; no expensive asynchronous video job started |
| Supabase auth settings | HTTP 200, email enabled | Does not verify login or account isolation |
| `companies`, `diagnostics` | Zero-row public-key requests returned HTTP 200 | No records read; not an RLS audit |
| `onboarding_drafts`, `brand_stories` | HTTP 404 `PGRST205` | Not available in the exposed schema; DB owner must review migration state |
| Six protected local POST routes | All returned HTTP 401 without a session | Diagnostic, company research, art, plan, onboarding draft, brand story |
| Local login, dashboard, demo HTML | HTTP 200, no server error page | Not proof of authenticated user flow |

No service-role key was used in these live checks; no secret values were printed. The one image test used only a synthetic geometric prompt.

## Verification and remaining intervention

- 89 tests pass, including the three new regressions.
- TypeScript and focused ESLint/Prettier checks pass.
- Local Vercel-preset build passes (existing tsconfig-path plugin advisory remains).
- Gemini credits need replenishment by the operator.
- DB owner must review/apply the two existing migrations through staging before durable draft/story features can be validated.
- Specific authorization was requested before sending public Movitta excerpts and the demo brief to Anthropic. No such transfer was made during this run.
- Pilot usefulness and publication readiness still require the brand owner's review. This is a technical pilot, not validated market demand or measured conversion improvement.
