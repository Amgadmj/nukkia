# Nukkia foundation release

Approved direction (2026-09-24): adapt Holi-Labs/holilabs main's compact sidebar and focused dark onboarding to Nukkia. Keep this repository and its existing authentication/data flows.

## Initial foundation delivery

- Flat near-black workspace, compact collapsible desktop navigation, accessible mobile drawer, Nukkia branding, contextual page header and a persistent foundation progress indicator.
- Guided diagnostic in five short chapters: digital footprint; offer; audience; buying journey; goals and brand story. Include the supplied essential questions, allow optional details, and retain existing answers. An explicit local draft is scoped to the company and account, resumes after refresh, and is removed at sign-out. Only the final submit saves answers to the existing diagnostic JSON and generates the report. No schema migration is required for this release.
- Show tangible saved outputs on the dashboard. Foundation completion derives from saved company, ready diagnostic, uploaded logo and saved identity, never simply page visits. Keep server-awarded mission XP separate from questionnaire completeness.
- Six-phase Trilha: actionable foundation plus clearly labelled future phases. Existing content/social/metrics screens stay accessible through navigation. Existing personalized missions remain available with their atomic completion RPC.
- New integrations, automatic regulatory research, document knowledge base, manifesto generation, BrandBook export, payments and advertising remain future work. City/state and Google Business details can be collected in diagnostic answers now; dedicated company columns can follow when required.

## Implementation and proof

1. Add shared question schema and pure progress derivation; test legacy answers, validation, truthful completion, and blank/whitespace handling.
2. Adapt shell, dashboard, auth styling, Trilha and diagnostic wizard using the existing components and Lucide icons.
3. Pass every expanded answer through validated server input into the existing AI report. Advance onboarding only after a report is saved; retain drafts on failure.
4. Verify typecheck, lint on changed code, production build, desktop/mobile browser navigation, wizard validation and resume without writing test data to the shared Supabase project.

Work stays on codex/nukkia-onboarding. No deployment, production migration or push is part of this local delivery.

## Initial foundation verification

- `npm run typecheck`: passed.
- ESLint on every modified TypeScript file and the new tests: passed.
- `npm run test:onboarding`: 10 tests; legacy data, required/optional fields, pending-draft completion, expanded AI input, persistence before progress, AI/database failures, and unauthorized requests. The actual API handler runs with mocked database/AI boundaries; no live records are written by these tests.
- `npm run build`: passed. Existing warnings concern Vite tsconfig-paths, bundle size and Nitro chunk configuration.
- Browser: desktop dashboard, existing diagnostic/report, five-step wizard, required-answer blocking, draft persistence after reload, correct chapter links, 390px mobile layout without horizontal overflow, mobile drawer, and separate-origin login styling verified.
- A temporary local test answer was restored to its original empty value after the persistence check. No test report was submitted to the shared Supabase project.
- Drafts remain on the current device until report generation, and are cleared at sign-out. Completed answers/reports use the existing server persistence. Future cross-device drafts would need a dedicated server draft flow.

## Welcome-flow follow-up

The first authenticated screen is now decided from saved data:

- New account: welcome animation → company setup → five diagnostic chapters.
- Company without a ready report: welcome animation → diagnostic chapters.
- Returning account with a report: Meu painel.
- Explicit replay: `/auth?modo=entrar&inicio=onboarding` keeps the real login form visible, then opens `/boas-vindas?rever=true`. It preserves existing answers, identity and missions. No demo authentication or embedded credentials.

The official Nukkia logo starts large and centered on flat black, then moves and scales into a quiet header mark. The source JPG is unchanged; a CSS dark treatment adapts it for the black background. Reduced-motion preferences skip the movement. The form is inert until revealed. The dashboard shell appears only after entering Meu painel, not around the welcome questions.

Report generation shows a completion screen only after persistence. Existing accounts replaying the flow can explicitly use their saved report to inspect this screen without generating another report. The next page is Meu painel: saved diagnostic, foundation progress, current missions, identity and a recommended next action.

Checks added: new/unfinished/returning/replay routing; real shared-account login; desktop and 390px mobile welcome; large-logo and docked-logo visual checks; chapter navigation; saved-report conclusion; populated dashboard. No new report or company was created during browser verification.

## Persistence and brand-document follow-up

- Dedicated account/company-scoped draft sync, local fallback, cross-device conflict handling, and completion tombstones. Remote responses cannot overwrite newer local edits. Sign-out clears device drafts without deleting cloud drafts.
- Explicit chapter links are preserved across sync acknowledgements. Auth cleanup lives in the shared authenticated layout, including the full-screen welcome. Company-load retries never query diagnostics without a company ID.
- Manual manifesto/MVV editor and saved BrandBook preview. The document combines existing company, diagnostic, logo, palette, typography and voice data. Unsaved edits are excluded. Print and HTML download controls are available; native export in the embedded browser remains unverified.
- Two additive migrations are prepared, not applied: `20260924150000_onboarding_drafts.sql` and `20260924160000_brand_stories.sql`. The current local app correctly indicates that cloud sync/story storage still need activation.
- AI brand-story generation remains unimplemented pending explicit authorization for sending the selected company/diagnostic/identity context to Anthropic. No live AI calls were made during this work.

See [backend activation and acceptance checks](./onboarding-backend-handoff.md) before staging rollout.
