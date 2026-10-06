# Saved-content journey — local qualification, 5 October 2026

The bounded synthetic local journey is implemented and exercised: onboarding/context → confirmed service → explicit brief → three approaches → identity → editor → save → library → reopen/edit/version → monthly intention. Existing changes were preserved. No commit, push, deployment, production migration, customer record, publishing or Health provider activation occurred.

Preview: http://127.0.0.1:8082/demo?passo=6&aba=conteudo&vista=biblioteca . The existing localhost listener serves this repository. The synthetic fixture lives in the current demo tab's browser storage; another browser/tab is not guaranteed to inherit session storage.

## Exact candidate and evidence boundary

Branch `codex/nukkia-onboarding`, base HEAD `5f1a1dab06e003b47614d0597bd8279db2b391c3`, plus **69 changed/untracked source and test files**, aggregate SHA-256 **`553b9c03d40de70870830ea78149dfb34875e299c50faefd519e469609653f8e`**. The [source manifest](2026-10-05-saved-content-evidence/source-manifest.json) lists every file hash. Algorithm: sorted relative path + NUL + file bytes + NUL. Unchanged files come from the base commit. Documentation and generated evidence are excluded to avoid a circular identity. This identity includes preserved work predating this milestone; it does not attribute all 69 files to this session.

Final automated commands and final screenshots below ran against this frozen source. Earlier screenshots named `*-before.png` are defect evidence, not passing candidate qualification. The earlier `approaches-320-light.png` and `planning-320-dark.png` were observed before the final editor-only CSS correction; they support those unchanged surfaces and are not represented as fresh final-candidate screenshots. Full journey interaction observations preceded the last CSS correction; final reloads and screenshots confirm the saved fixture on the frozen candidate. [Evidence manifest](2026-10-05-saved-content-evidence/evidence-manifest.json) binds files to their hashes and states.

Native Chrome was used only after the user's explicit localhost QA permission. Chrome/IAB connectors remain unavailable; that earlier infrastructure limitation no longer blocks native local QA. Tests and screenshots do not qualify a hosted Supabase environment, other browsers, screen readers, or every screen/theme/width combination.

## Implemented and actually qualified states

| Surface / definition of success | Observed result | Qualification |
| --- | --- | --- |
| Onboarding/context: manual synthetic answers reach the workspace and survive navigation | Created `Ateli Horizonte QA`, synthetic ceramics workshop, audience and goal; no research/provider fetch | Native local journey observed; authenticated onboarding pending |
| Service → brief: confirmed service applies deliberately, with source/revision retained; original brand context is not silently rewritten | Saved `Oficina de cerâmica QA — outubro`; explicit apply reached approaches. Editor and reload show source `Informado pela equipe` and catalog revision `57456e8a-8100-4ba2-9298-bbece07b6b8c` | Native local + regressions; catalog remains browser-local |
| Options → identity → editor: identity save returns to the requested generic approach; selection and edits persist | Chose `Convidar para agir`, saved Essential identity; repaired return path and repeated it at 320px. Existing revised text stayed intact | Native local + callback regression |
| Editor recovery: entered title/caption survive a real reload and retain the service snapshot | Version 1 title/caption survived reload before save; version 2 reopened on final candidate with its revised caption | Native local; no cloud/offline claim |
| Save/library: save immutable v1, reopen it, edit and save v2 without replacing v1 | Original item `71555e38-14f1-4608-a5bb-84af4156cf35`, v1 at 12:59:40, v2 at 13:01:18 local time on 5 October. Historical inspection shows v1 title/text, latest shows v2 | Native local + immutable snapshot/domain and real component callback tests |
| Duplicate/archive: duplicate selected v1 independently without inheriting its plan/approval; archive hides active plan, restore recovers exact date/version | Independent one-version copy retained v1 content and `(cópia)` item label. Archived original retained date; restored original returned to active planning | Native local + regressions |
| Monthly planning: selected library history cannot change the scheduled snapshot; archived filter cannot hide active plans | After selecting v1, archiving/restoring, then opening planning, original displays **v2, 15/10/2026**. Real reload retained both. Empty planner action now opens the library | Native local populated flow; empty action qualified by actual component callback test |
| Keyboard: key controls reachable with visible focus and usable without pointer | Tab/Enter opened library after save; skip link/content tab/editor title reached with visible focus. Mobile menu opened with keyboard, Escape returned focus. Theme toggle reached with Tab and activated with Enter | Bounded keyboard sample; not an exhaustive accessibility audit or focus-trap certification |
| Narrow layout/themes: tested content fits viewport, controls and text remain readable | Final editor 320/dark and 390/light (also 390/dark), planner 390/light, library 1024/dark and 1360/light fit full-page capture widths | Final-candidate visual sample; full screen × width × theme matrix remains unqualified |

Synthetic copy: v1 `Oficina QA — versão 1`, caption `Conteúdo sintético QA. Oficina de duas horas, com materiais incluídos. Esta legenda não representa uma oferta real.` V2 `Oficina QA — versão 2 revisada`, caption `Revisão sintética QA: encontro de duas horas. Versão 2 para planejamento, sem publicação.` These are test fixtures, not customer offers.

## Defects repaired in this milestone

- Monthly planning no longer inherits the library's archived filter or historical version selection. Its preview/title/edit action stays bound to the planned version; historical selection is disabled there.
- Empty planning leads to saved content. Historical cards use snapshot titles, while a distinct item label keeps duplicates recognizable.
- Archive preserves the intended date/version; restoring brings the plan back. Archived UI explains the retained date.
- Saving identity returns to the requested content view instead of resetting to the Health tab.
- Content tabs are constrained to their container. Narrow editor asset controls stack and native file inputs can shrink. Before the repair, 320px editor capture was 746 physical pixels wide (373 CSS px at DPR2); final is 640 (320 CSS px). At 390px, 816 became 780 physical pixels. No blanket overflow clipping hides controls.

Seven meaningful regressions were added: five real ContentLibrary callback/rerender cases, one archive/restore domain case, one real demo identity-return callback. Each failed before its repair and passed afterward. Intentional red runs are preserved separately (`regressions-red.log`, `duplicate-red.log`, `identity-red.log`; initial three red results are in the session transcript). They are not unresolved final failures. CSS fixes were verified through actual browser before/after full-page captures rather than source-string assertions.

Read-only independent review found no critical/important issues, independently passed 21 focused tests, and reviewed the final narrow CSS correction without further findings. That review did not perform cloud or browser qualification.

## Final checks and separate backlog

Node **24.21.0** was selected using:

```sh
export PATH=/Users/nicolacaprirolo/Developer/holilabs-cortex-worktrees/engineering-command-center-plan-repair/state/paperclip-openhands/runtime/node-v24.21.0-darwin-arm64/bin:$PATH
npm run test:onboarding
npm run typecheck
npm run build
```

- [Tests](2026-10-05-saved-content-evidence/tests.log): **546 passed, 0 failed, 0 skipped** on final source.
- [Typecheck](2026-10-05-saved-content-evidence/typecheck.log) and [build](2026-10-05-saved-content-evidence/build.log): exit 0. Build warnings are retained in the log.
- Changed/untracked TypeScript source/tests [scoped lint](2026-10-05-saved-content-evidence/scoped-lint.log): **0 errors, 2 existing warnings**, both `workspace-services.tsx:122` effect dependencies.
- Repository-wide `npm run lint`: exit 1, **99 errors / 9 warnings**. All 99 errors are unchanged `src/integrations/supabase/{auth-attacher.ts,auth-middleware.ts,client.server.ts,client.ts,previewAuthStorage.ts}`: 98 formatting errors and one `prefer-const`. Seven other warnings concern existing component export conventions, plus the two service warnings. [Full log](2026-10-05-saved-content-evidence/full-lint.log). This unrelated backlog was preserved, not silently reformatted.
- `git diff --check`: passed.
- Visible Chrome console included an unrelated extension error, `Search engine null is not supported`, from `chrome-extension://cfnpidifppmenkapgihekkeednfoenal/content/searchAnalyzer.js:2`. No Nukkia exception was observed in the sampled visible console; this is not a complete console/network audit.

Final full-page PNGs (DPR2): [library 1360/light](2026-10-05-saved-content-evidence/library-1360-light.png) 2720px wide; [library 1024/dark](2026-10-05-saved-content-evidence/library-1024-dark.png) 2048px; [editor 320/dark](2026-10-05-saved-content-evidence/editor-320-dark.png) 640px; [editor 390/light](2026-10-05-saved-content-evidence/editor-390-light.png) 780px; [planner 390/light](2026-10-05-saved-content-evidence/planning-390-light.png) 780px. These verify sampled layout and saved data, not server persistence.

## Remaining authenticated-persistence checks and success definitions

None of these cloud checks ran in this milestone. Local demo reload is session recovery, not durable authenticated qualification.

| Check | Definition of success |
| --- | --- |
| Same-owner durable round trip | In named QA company A, create context/service snapshot, identity, generic v1/v2, independent copy, archive/restore and v2 monthly date. Receive successful server revision; sign in through a fresh independent browser session with no inherited recovery cache. IDs, immutable version text/source, active draft and intended version/date match exactly. Browser-local service catalog is not silently imported; only explicitly selected snapshot travels with workspace. |
| Tenant and asset isolation | Dedicated account B cannot read/update A's workspace or private logo by substituting IDs/paths using normal authenticated credentials; requests deny/not-found, do not disclose rows, and do not mutate A. Each account can still access its own fixture. |
| Concurrent writes | Two sessions of A start at same revision. First save succeeds; stale second save returns 409, preserves its draft and offers deliberate reconciliation. Neither snapshot history nor plan is silently overwritten or duplicated. |
| Interrupted/expired session recovery | Offline/network failure and expired-session save never display false cloud success. Owner/company-scoped draft survives; reconnect/re-auth saves once against current revision or reports conflict. No cross-account replay. |
| Logout/company switch | In-flight requests and scoped cache cannot apply to the next owner/company. A's draft/library/assets are absent in B. Returning to A recovers only A's state. |
| Schema/deployment compatibility | Approved environment exposes expected tables/policies and matching client/server schema 2. Existing legacy workspace loads with additive defaults and preserves all fields. Old update writer without marker receives 426; stale writer cannot strip library/inspirations. Missing store fails visibly (503), not a fabricated cloud save. Verify schema read-only; do not apply a migration as part of QA. |
| Related context/identity recovery | Onboarding tombstone prevents stale draft resurrection. Saved identity applies correctly; expired owned private-logo URL refreshes to the same company object, failure remains retryable. Manual brand story has its existing separate persistence semantics; do not claim workspace CAS covers it. |
| Account export (separate adjacent qualification) | Authorized synthetic account export includes scoped newer stores and nested relations, omits tokens, reports partial 206 failure instead of false completeness. Export is a read-time collection, not a transaction snapshot. Destructive deletion/nested purge requires its own disposable-account authorization and is outside this saved-content milestone. |

Required permission package for the next authenticated milestone:

1. Identify an approved **disposable non-production Supabase project** (project ref and app origin), or explicitly named isolated synthetic QA tenants in an approved environment. Confirm scope before cloud writes; production migrations remain excluded.
2. Provide two existing dedicated synthetic accounts A/B, each with its own test company, plus a second independent browser session for A. Credential entry can be handed to the operator. Ordinary authenticated permissions/RLS are required; service-role credentials must not be used to bypass isolation checks.
3. Authorize create/read/update of those accounts' synthetic `companies`, `marketing_workspaces`, onboarding/diagnostic context, `brand_kits`/`brand_stories`, and owned `brand-assets` fixtures as needed; limit any existing `content_plans`/`content_items` parity checks to the same named QA companies. Permit controlled denied cross-account requests, stale-write, offline/session-expiry and read-only schema/policy checks. Do not alter auth/security configuration or grant roles.
4. Specify fixture retention/cleanup. No irreversible deletion is included by default. If recovery-email delivery is later tested, separately authorize controlled QA inboxes and return URLs; no email is necessary for the saved-content persistence round trip using existing accounts.

No publishing OAuth, live scheduling, external Health render/twin provider, clinical review authority, spend budget or production migration permission is needed for these persistence checks. Those remain separately authorized work.
