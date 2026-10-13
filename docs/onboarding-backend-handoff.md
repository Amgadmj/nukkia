# Onboarding backend activation

Local code only. Nothing in this change has been pushed, deployed, or applied to a remote database.

## What can be reviewed now

- Real login and the full-screen welcome: `/auth?modo=entrar&inicio=onboarding`.
- Large centered Nukkia logo, upward transition, company setup and diagnostic chapters.
- Completion using an existing report during replay, then the populated Meu painel.
- Device-local draft saving when the new database schema is absent.
- BrandBook preview assembled from saved company, diagnostic and brand identity data. Missing story sections are explicitly marked, not invented.

## Activate in staging first

The migrations in this change add dedicated `onboarding_drafts` and `brand_stories` tables. They must be reviewed and applied by the project's database owner through the team's normal migration workflow. Confirm the target project and pending migration history before executing anything. Do not run a blind push against production.

No new credentials are needed for these features: requests use the existing signed-in user's session and the existing server-side AI configuration. Never expose a service-role key in Vite variables.

After activation:

1. Log in as a fresh test user and create a test company.
2. Enter a draft on device A, then log in on device B and confirm recovery. Check overlapping edits require a version choice and disjoint edits are merged.
3. Sign out and confirm local drafts are cleared without deleting the saved cloud draft.
4. Submit a valid diagnostic. Confirm the report is persisted before the completion screen, and the draft is cleared without deleting the report or existing missions.
5. Write/edit a brand manifesto, mission, vision and values, save, and reload. Confirm the BrandBook uses saved text rather than unsaved edits.
6. Verify a second user cannot read or modify the first user's drafts or brand story.
7. Review the BrandBook preview/export in the intended browser. Print-to-PDF availability depends on the browser/operating system; embedded browsers may not open a print dialog or handle a blob download. The HTML download control is covered by a local component test, but no native download/print result was observed in the Codex embedded browser.
8. Re-run typecheck, tests and build before merging/deploying through the existing workflow.

## Failure and rollback

Missing tables must remain a recoverable state: drafts continue locally and story editing/saving is unavailable, while existing identity editing and diagnostic/report flows continue working. A database error must not replace a saved story with partial output or advance onboarding.

For application rollback, restore the previous application release and retain the additive tables and data. Dropping them would destroy saved drafts/stories and requires a separate reviewed backup/removal decision.

## Not covered by this activation

AI brand-story generation is NOT implemented. Approval review blocked adding the flow that would send saved company details, selected diagnostic answers and palette/fonts/tone to Anthropic. No live AI requests were executed for this work. Obtain explicit authorization for that payload and destination before implementing/enabling this additional flow. The current story API accepts manual save only; applying the migration does not enable AI generation.

The six-phase Trilha roadmap is not a fully unlocked game economy. Question completion is separate from mission XP. Checkout, Google/social research, CRM/WhatsApp connections, document ingestion, advertising automation, full landing-page redesign and production rollout remain separate work.

## Brand research: profile drafting (2026-10-13)

With the user's AI authorization ticked, `/api/brand-preview` now also sends the already-minimized public site excerpts (`prepareEvidence`) to Anthropic once more, to draft answers to the diagnostic questions (`src/lib/brand-profile.server.ts`). Same destination, model and consent as the existing quote synthesis; the on-screen consent copy names the diagnostic prefill. Output is validated in `sanitizeProfile`: numbers must appear in the evidence, price/hours/location/founder story/restrictions need a literal site quote, option fields must match an allowed option, personal data is dropped, and ungrounded claims are shown as labelled hypotheses. Answers prefill only empty fields, once, and are labelled "Sugestão da IA" in the diagnostic until edited.

Crawler and filter changes behind this: pages are no longer limited to clinic vocabulary (`pagePriority`), and `prepareEvidence` no longer needs a business-keyword whitelist; company names (camel-case, domain-derived) and "N anos de experiência" are no longer mistaken for a person. Patient/person protections and their tests are unchanged.
