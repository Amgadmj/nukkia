# Amgad — Nukkia production-foundation execution brief

Amgad, execute Nukkia's existing G0/G1 backlog on this laptop. Nicola owns product acceptance and priority; you own technical delivery/integration; Victor is proposed for QA and must accept his availability. The outcome is a qualified authenticated saved-content journey with tenant isolation and recovery, plus the evidence and operating workflow needed to continue safely.

## Read before editing

- Repository: `/Users/nicolacaprirolo/Developer/nukkia`; remote `Amgadmj/nukkia`.
- Working candidate at preparation: `codex/nukkia-onboarding`, `00eecf07d64c6d2658bf7ead27883011e9110f16`. It passed [GitHub CI](https://github.com/Amgadmj/nukkia/actions/runs/38439232165): 640 tests, types, lint and Node-server build. Two existing hook warnings remain. Recheck live branch/remote before work; this identity is a checkpoint, not permission to overwrite newer work.
- Read AGENTS.md, the user-approved Nukkia design skill, `skills/nukkia-release-checks/SKILL.md`, `docs/2026-10-02-app-map.md`, `docs/2026-10-02-backend-handoff-amgad.md`, the existing saved-content journey and screenshot matrix, and `docs/operations/2026-10-13-onboarding-evidence/verification.md`.
- Operating source: [Nukkia backlog](https://docs.google.com/spreadsheets/d/1OFKaIVzQtd-Mk2tXYOxLnsUdM4aJAguJUxj8wfy7MxU/edit), including Daily Updates and Operating Workflow. Owners are proposed until accepted. Latest feature-branch proof does not close current-master or deployed release checks.
- Preserve all tracked/untracked work, drafts and assets, including `docs/tasks/`. Preserve the existing preview on 8082; inspect/reuse it rather than start a duplicate. Do not edit Cortex, command-center, Kidstoon or their services.

## Permission and identity checkpoint — N01/N38

Record current branch, HEAD, remote, dirty paths, runtime and preview source. Establish existing Supabase access by project ID and environment without printing keys. Historical source configuration identifies `ihppmpnlpsvxqsqenjfl`; verify what it currently represents rather than assume it is disposable staging.

Confirm a non-production target, dedicated synthetic users/companies A and B, two independent sessions for A, permission for scoped fixture creation/updates, denied cross-account requests and offline/expired-session testing. Movitta and Amgad Sali workspaces were described by Nicola as disposable test spaces in the session; resolve their actual IDs/environment and fixture accounts before using them. Do not substitute your personal session or a service-role bypass for ordinary-user isolation proof.

Accept assigned technical ownership in Backlog Q; record capacity and the first gate review. Supabase access alone does not authorize production migrations, paid AI/media/Health activation or social publishing. Those boundaries remain separate. Continue allowed local implementation while an external dependency is pending.

## Bounded parallel work

You are the sole integrator. After the checkpoint, run up to three independent workers with disjoint paths/worktrees or patch-only output:

1. **Persistence/recovery worker — N04/N09/N16:** investigate and implement the accepted workspace/draft/version boundary. Own provider/state/API persistence paths assigned after inventory. Return explicit API-contract changes before coding consumers.
2. **Isolation/assets worker — N03/N05:** read deployed schema/policies/buckets; produce drift report and ordinary-user allow/deny tests. Own policy/asset test files; propose additive migration source if needed but do not apply it. Coordinate shared API/SQL contracts with you.
3. **Journey/QA worker — N06/N10:** finish accepted missing UI/state behavior and test the exact saved-content/calendar/export journey. Own assigned UI/test paths; preserve Atlantic/white identity, official logo, Sora/Manrope and clear Portuguese.

An independent reviewer may replace a completed worker. Shared schemas, routes, lockfiles, CI and migration files have one writer. Agents return ID, base SHA, paths, patch, contract implications, tests/results, evidence and unresolved blockers. Never cherry-pick blindly or infer that concurrent green tests prove the integrated candidate. Stop/reassign overlapping writes. Keep agents away from provider activation, real records and infrastructure changes.

## Execution packets and acceptance

### N02 — reproducible candidate and CI

Read package/runtime/workflow and current master. Run `npm run check` under Node 24 using the appropriate build target. Validate actual workflow trigger and reachable tests on the release candidate. Preserve dependency/security fixes already merged. If the target is Vercel, qualify that target independently; historical Node-server build is not deployment proof. Report failures and unrelated lint warnings separately. Push only to the authorized feature branch; merging/deployment follows an explicit accepted candidate decision.

### N03/N05 — schema and isolation

Read source migration history and compare actual deployed tables/functions/policies/buckets without mutating them. Map `auth.users/profiles/user_roles`, `companies`, `marketing_workspaces`, `onboarding_drafts`, `brand_stories`, `brand_kits`, content planning/history and private assets. Distinguish intentional company admin visibility from stricter workspace ownership. Produce the real principal/action/resource matrix.

Under ordinary users, show A can perform supported actions; B cannot read/update/delete A's workspace, drafts, jobs or storage through substituted IDs/paths. Same-tenant insufficient authority and stale sessions must deny privileged writes. Expired signed URLs renew only for an owned durable path. Every exposed function and server endpoint must uphold the selected ownership contract. If a policy mismatch exists, add a focused regression and propose the narrow fix with rollback; no production apply.

### N04/N09/N16 — durability, conflicts and coherent briefs

Prove A's onboarding/context and content persist to the authoritative server. Open a fresh independent session without the first browser's recovery cache; recover exact versions, identity, sources, archive/duplicate state and calendar time/timezone. Two sessions editing the same revision must yield one acknowledged write and a recoverable conflict for the stale writer. Offline, expired session, slow response, logout and company switch preserve scoped edits without false saved state or cross-account callbacks. Legacy diagnostic/report/media consumers must use the selected confirmed brief/revision. Brand-story concurrency remains a named limitation until implemented or explicitly accepted as single-editor scope.

### N06/N10 — complete saved-content journey

Using synthetic local/staging content, exercise website domain/www normalization or no-site→Instagram reference; actual permitted collection and failure/cancel; brand context→brief→options→Brand System→editor→save→library→reopen/edit/v2→duplicate/archive/restore→monthly/day calendar→exact approved export. Calendar represents planned content; do not promise automatic sending.

Go through each newly created control and its normal/error/empty/restored state. Check keyboard navigation/focus, both themes, supported desktop/narrow widths, uploads, cancel/back/retry and reload. Open actual downloaded PNG/ZIP/MP4 where supported and confirm revision/assets/caption. Changes revoke approval. Update one row per original reference screenshot with route, implementation, deliberate adaptation, missing state and exact-candidate evidence; never equate sampled checks with all 18-screen qualification.

### N07/N08 — providers and durable budgets

Inspect existing research/media code and permission configuration read-only. Website research is already integrated; Instagram references are not scraping claims, and editable proposed colours are not automatically extracted brand identity. Provider quality/cost/latency checks require permitted synthetic inputs and an approved spend ceiling. Until approved, complete local fixtures, adapter contracts and failure/limit regressions. In-memory rate limits are burst controls; design durable tenant budgets before multi-instance spend. Do not activate Health/publishing providers.

### N35/N36 — operations and recovery

Document redacted request/job diagnostics, incident ownership, quota alerts and an actual outage/retry scenario. Prepare restore/rollback exercise in the approved synthetic environment, preserve history and measure observed recovery. Record actual RPO/RTO and retention decisions when owners accept them. No destructive production restore or migration contingency executed without separate scope.

## Daily updates and handoff

For every packet update its N ID with evidence URL, current SHA, environment, check result, blocker and next action. Append one Daily Updates row per meaningful item before the weekday reminder. Nicola accepts product outcomes; technical/QA review verifies the exact integrated candidate. A successful CI does not automatically set Qualified/Done for live cloud checks.

On completion deliver current branch/head, integrated diff, local and GitHub results for that SHA, schema/policy comparison, A/B isolation and independent-session recovery evidence, screenshot/button matrix, actual export results, unresolved provider/production permissions and next backlog owners. Stop when the accepted G0/G1 packet is qualified; do not expand into billing, Health beta or publishing merely because those items exist later in the roadmap.
