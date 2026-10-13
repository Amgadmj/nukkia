# Screenshot-to-screen audit — implemented local candidate

The accepted local screenshot milestone is implemented. All 18 supplied images were visually inspected; the [existing app map](../2026-10-02-app-map.md#current-screenshot-to-screen-implementation-audit--5-october-2026) now records each image, target route/view, required layout/interactions, implementation, deliberate adaptation, remaining gap and actual evidence. The complete saved-content journey's earlier evidence is retained and the changed surfaces have fresh local checks. This is not authenticated or Health production qualification.

Preview remains [the existing Nukkia localhost on 8082](http://127.0.0.1:8082/demo?passo=6&aba=painel). No duplicate server was started. The synthetic fixture belongs to the existing Chrome Work-profile demo session; another tab/profile may not inherit session storage.

## Exact source and preservation

Branch `codex/nukkia-onboarding`; base `5f1a1dab06e003b47614d0597bd8279db2b391c3`. Current candidate comprises **70 changed/untracked source/test files**, aggregate SHA-256 **`cc2a64d6e327af554216289aefae6c9ee2d52481774b131de4e5f7624d824aa1`**. [Source manifest](2026-10-05-screen-audit-evidence/source-manifest.json) uses sorted relative path + NUL + file bytes + NUL; unchanged source is supplied by the base. Docs/evidence are excluded to avoid circular hashes. [Evidence manifest](2026-10-05-screen-audit-evidence/evidence-manifest.json) identifies the reference inventory, browser captures and check logs.

At entry every one of the preceding manifest's 69 files matched aggregate `553b9c03d40de70870830ea78149dfb34875e299c50faefd519e469609653f8e`. Work resumed from its matrix/evidence instead of recreating onboarding or replacing drafts. [Candidate delta](2026-10-05-screen-audit-evidence/candidate-delta.json) lists 13 changed/new source/test paths relative to that evidence. The additional intentional navigation correction in `src/lib/marketing-workspace.ts` changes the primary label from `Estúdio de saúde` to the accepted `Conteúdo`, returning that file to its base bytes. It was not deleted or reset wholesale. All other inherited source/test changes remain unchanged; existing assets/docs were preserved with additive audit updates. No command-center/Kidstoon edits, history rewrite, commit, push, deployment, migration or external send.

## Delivered behavior and definitions of success

| Delivered change | Definition of success | Result |
| --- | --- | --- |
| Working Carousel entry on home | Opens `Explicar` without replacing the current human-edited piece until an explicit subsequent choice | Native navigation observed; real callback regression proves untouched data at entry |
| Saved home gallery | Each thumbnail comes from its saved version, even when the working draft differs; resume uses exact ID/version | Actual v1-copy/v2 previews inspected; saved-versus-live regression passes |
| Three visual approaches | Purpose, thumbnail and radio selection remain legible on mobile; examples are labeled illustrative | 320/light inspected; existing preparation guards and draft-preservation tests pass |
| Preview-first identity | Applied/draft identity is clear; live creative preview sits beside settings on desktop and reflows above them on mobile | 1360/dark and 320/both themes inspected, all controls fit |
| Reusable saved sources in editor | Inspect/select an exact generic version; cancelling leaves the entire working draft intact; confirmed reuse retains current brand context/identity and revokes approval | Native v1 cancel/confirm and v2 restore observed; cancellation and historical-resume regressions pass |
| Library format/status filters and provenance | Image/Carousel/Health classification and creative approval status reflect the inspected snapshot; planned version remains authoritative; source revision/references remain inspectable | Component regressions pass; current planning reload retains v2 and date |
| Coherent surrounding surfaces | Primary destination says Conteúdo; titles match view; account canvas/cards match shared styles with separate danger area; Resultados describes observable data | Source/typecheck/build qualified; authenticated account visual check remains pending |

The reusable strip intentionally projects existing version snapshots. It does not create a new asset store, fetch public references, imply usage rights, or silently replace brand context. Generic approval and a Health professional release remain distinct.

## Saved journey and visual proof

The [preceding complete journey](2026-10-05-saved-content-journey.md) proved synthetic onboarding/context → confirmed service → brief → three approaches → identity → editor → save → library → reopen/edit/v2 → independent duplicate/archive/restore → exact-version monthly plan. Its screenshots remain bound to its earlier source candidate, not retroactively relabeled. Current regressions cover those contracts and fresh native observations verify preserved fixture/reload/reuse on this candidate.

Original item `71555e38-14f1-4608-a5bb-84af4156cf35` still has two immutable versions; independent copy contains v1. Original v2 remains planned for **15/10/2026**, with “Não publicado”. Restoring v1 in the working editor did not change that plan or library history. Working draft was returned to v2 afterwards. No synthetic item or draft was discarded.

[Current browser observations](2026-10-05-screen-audit-evidence/browser-checks.md) include native select/Tab/Enter reuse confirmation, cancellation preservation, mobile menu/theme/Escape focus return, reload and sampled layout. Full-page PNGs were opened and visually inspected. The desktop reuse capture preceded the final whitespace-only route-title formatting; it is labeled contextual evidence in the manifest. Other captures match the frozen candidate:

- [Home 1360/light](2026-10-05-screen-audit-evidence/home-1360-light.png): working format choices and saved snapshot gallery.
- [Identity 1360/dark](2026-10-05-screen-audit-evidence/identity-1360-dark.png), [320/dark](2026-10-05-screen-audit-evidence/identity-320-dark.png), [320/light](2026-10-05-screen-audit-evidence/identity-320-light.png): preview/settings reflow, official identity, controls within viewport.
- [Options 320/light](2026-10-05-screen-audit-evidence/options-320-light.png): three illustrative cards with explicit selection and source/context.
- [Reuse/editor 1360/dark](2026-10-05-screen-audit-evidence/reuse-editor-1360-dark.png), [320/light](2026-10-05-screen-audit-evidence/reuse-editor-320-light.png): historical v1 inspection and restored v2 respectively; source strip, title/caption/assets fit.
- [Planning 1360/light](2026-10-05-screen-audit-evidence/planning-1360-light.png): v2/date retained after reload, exact-version selector locked.

Prior 1024/dark library and 390/light editor/planner evidence is retained in the journey record. This milestone does not claim every screen × theme × width, screen reader, live account screen, or Health media state has passed. Reference crops alone are never layout evidence.

## Checks, resolved failures and separate backlog

Final frozen source checks used Node 24.21.0 (the existing runtime path documented in the preceding journey):

- `npm run test:onboarding`: **551 passed, 0 failed, 0 skipped**. [Log](2026-10-05-screen-audit-evidence/tests.log).
- `npm run typecheck`: exit 0. [Log](2026-10-05-screen-audit-evidence/typecheck.log).
- `npm run build`: exit 0. Existing build warnings retained. [Log](2026-10-05-screen-audit-evidence/build.log).
- Changed/untracked TypeScript source/tests ESLint: **0 errors / 2 existing warnings**, both service effect-dependency warnings at `workspace-services.tsx:122`. [Log](2026-10-05-screen-audit-evidence/scoped-lint.log).
- `git diff --check`: exit 0.

Five meaningful new regressions failed before implementation and pass afterwards: Carousel entry preserves the existing draft; home uses saved snapshot preview; reuse cancellation preserves all data; older-version reuse keeps current identity and revokes approval; status filter follows inspected version. Intentional red logs: [home](2026-10-05-screen-audit-evidence/home-red.log), [library](2026-10-05-screen-audit-evidence/library-red.log). The first full run also had **five test-harness failures** because the mocked content-studio loader lacked the newly imported `SavedContentPicker` module stub. The stub was added to the existing preparation UI harness, then all 551 tests passed. This was a resolved harness failure, not a hidden runtime defect. An introduced title-formatting lint error was fixed and scoped lint rerun.

Repository `npm run lint` remains exit 1: **99 errors / 9 warnings**. The 99 errors remain in unchanged Supabase integration files (98 formatting, one `prefer-const`); seven other existing warnings concern component exports, plus the two service warnings. This is unrelated backlog, not a passing gate. [Fresh full lint log](2026-10-05-screen-audit-evidence/full-lint.log).

Independent read-only review of the implementation delta found no important findings and independently passed 16 focused tests. It did not perform browser/cloud checks. Visible Chrome retained the previously identified extension error; no exhaustive clean-console claim is made.

## Precise remaining qualification

[Authenticated checks and required synthetic-account permissions](2026-10-05-saved-content-journey.md#remaining-authenticated-persistence-checks-and-success-definitions) remain the controlling checklist. None was run or implicitly authorized by local QA.

| Remaining check | Success definition |
| --- | --- |
| Durable cloud round trip | Same synthetic owner opens a fresh independent session without local recovery cache; server revision, context, exact v1/v2, source, duplicate/archive state and v2 date match. Browser-local catalog is not silently migrated. |
| Isolation and lifecycle | Ordinary account B cannot read/mutate A's workspace or logo through substituted IDs; logout/company switch and in-flight saves cannot leak or replay A's data into B. |
| Concurrency/recovery | Two sessions of A produce deliberate 409 reconciliation; offline/expired-session writes never show false success, preserve scoped edits and retry without loss/duplication. |
| Schema and assets | Existing approved schema/policies and client/server marker 2 are verified read-only; legacy data opens additively, old writer returns 426; private-logo expiry renews only the same owned object. No migration is applied. |
| Adjacent account flows | Synthetic export reports complete/partial scope accurately; email/reset and irreversible account purge require their own controlled inbox/disposable-account scope. |
| Broader visual/accessibility qualification | Remaining authenticated screens and Health editor run their own empty/error/conflict/recovered states across 1360/1024/390/320 and both themes, with keyboard and screen-reader evidence. Implemented source is not substituted for those observations. |

Required permissions: name the non-production project/origin and two existing dedicated synthetic accounts/companies A and B, plus a second session for A; authorize scoped fixture create/read/update, controlled denied cross-account requests, stale/offline/session tests and read-only policy inspection under normal RLS. Define retention/cleanup; no service-role bypass, security changes or irreversible deletion. Existing sign-in can be performed by the operator. Real customers, production migrations, publishing, Health providers, reviewer authority and paid renders remain separate authorizations. No request to activate them is part of this local implementation result.


## 13 October 2026 — onboarding refinement

The accepted website/context/brand-direction mapping now includes domain normalization, a separate no-website → Instagram reference step, live source collection, and an editable Brand System replacing sample posts. Authenticated logout moves beside footer theme controls. [Acceptance results and evidence](2026-10-13-onboarding-evidence/verification.md) distinguish automated, browser-observed and still-unverified states on source candidate `50c52a8b83dea74ba4b020020675b0d668c7a52b`. This update does not requalify the other reference screens or authenticated cloud journey. Full lint now passes with two existing hook warnings; the earlier 99-error backlog above is historical.
