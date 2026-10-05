# Nukkia database handoff for Amgad

Prepared on 2 October 2026 for Amgad, owner of `Amgadmj/nukkia`. Connect and qualify the **existing** Nukkia app first. Supabase Auth, company tables, private assets, server handlers and three dedicated draft/story stores are already designed. Health production needs additional authority/job/review work; it is not enabled by attaching a database to the current editor.

**Handoff held at Nicola's request:** finish and review the [UI proposal](superpowers/specs/2026-10-02-ui-proposal-design.md) before sending this to Amgad. No handoff branch, PR, issue or message has been created. This document remains a local preparation artifact.

Read the [app and screen map](2026-10-02-app-map.md) alongside this document. The handoff snapshot includes the current local interface changes beyond `codex/nukkia-onboarding` commit `5f1a1dab06e003b47614d0597bd8279db2b391c3`. A separate draft handoff PR can be reviewed against that branch without merging or deploying it. No database migrations or customer-account mutations were performed to prepare this handoff.

## First deliverable

Two dedicated QA users with synthetic companies can sign in, finish onboarding, save and resume Cérebro/identity/content drafts from a fresh browser, encounter recoverable version conflicts, export their own complete data and access only their own private files. Keep the name **Nukkia**, the existing navigation and current form/editor contracts.

The project identified by local browser and server configuration is `ihppmpnlpsvxqsqenjfl`, described in the historical engineering notes as **Amgadmj's Project**. This is configuration evidence, not permission to test on real customer data or proof of its applied migration history. Confirm whether dedicated QA accounts there or a separate staging project are intended. Do not use Amgad's personal authenticated session as a test fixture.

## Ownership and source of truth

| Concern | Authoritative store | Access and implementation notes |
| --- | --- | --- |
| Login and consent | Supabase `auth.users`, `profiles`, `user_roles` | Signup trigger creates the profile/client role from metadata. Current login/registration exist; recovery/resend UI is missing. |
| Company identity/contact | `companies` | Owned by `owner_id`. Existing SQL permits configured admins to read other companies; write rules vary by operation. Current `useCompany()` selects the first visible row, not an explicit company switcher. |
| Cérebro, creative draft and Health editor | `marketing_workspaces.data` | One row per company; `DemoData` validation; strict owner-only policies and explicit server owner check. Admin visibility elsewhere does not grant workspace access. |
| Diagnostic form in progress | `onboarding_drafts` | One row per company; strict owner/company policies. Nullable draft is a completion tombstone; never store in `diagnostics`. |
| Completed reports | `diagnostics` | Separate historical completed reports; latest-report queries must not accidentally return drafts. |
| Saved identity kit | `brand_kits` | Saved kit is distinct from workspace draft `data.brand`; apply-to-piece is explicit and invalidates affected approval. Logo needs a durable object reference. |
| Manual brand story | `brand_stories` | One row per company; manifesto, mission, vision and values. Uses `owns_company()` policies, including admins; current save is upsert without revision compare-and-swap. |
| Generic content planning | `content_plans`, `content_items` | Existing monthly planner and generic media generation/status. Preserve content-item object paths and short-lived signed URL reads. |
| Generic missions/progress | `missions`, `user_progress` | Completion via `complete_mission`; direct progress writes restricted. Workspace achievements are not a replacement database XP ledger. |
| Channel status and metrics | `social_accounts`, `scheduled_posts`, `metrics_snapshots` | Displays exist; operational connector, collection and publishing services are not established by this handoff. Social secrets are server-only in `social_account_secrets`. |
| AI usage | `ai_usage`, `check_and_record_ai_usage` RPC | Existing call-count limits via [quota.server.ts](../src/lib/quota.server.ts). Quota failure blocks provider spend. This is not the proposed Health reservation/attempt/cost ledger. |
| Uploaded/rendered files | Private `brand-assets`, `content-media` | Company-prefixed object paths and storage RLS; re-sign paths on read. Existing logo upload persists an expiring URL instead of a durable path. |

Browser session storage and local recovery witnesses are fallbacks/caches. They must never be used as proof that a draft was saved to Supabase. The demo is fictional browser state. Authenticated workspace state is scoped by owner/company, and logout/account-switch invalidates old save generations and recovery context.

## Existing wire contracts

Client calls using [api.ts](../src/lib/api.ts) attach the current bearer token when a session exists. Authenticated server handlers use the request-scoped Supabase client and verify `auth.getUser()`; see [supabase-request.server.ts](../src/lib/supabase-request.server.ts). Keep those user-scoped reads/writes under RLS. `/api/brand-preview` is a distinct local-only development flow. Do not substitute a service-role client to make ordinary screens work.

### Marketing workspace

Source: [marketing-workspace.ts](../src/routes/api/marketing-workspace.ts), [quick-start.ts](../src/lib/quick-start.ts), [MarketingProvider](../src/components/marketing-provider.tsx).

```ts
// GET /api/marketing-workspace?companyId=<uuid>
// POST /api/marketing-workspace
type SaveWorkspace = {
  companyId: string;       // UUID
  data: DemoData;          // complete validated workspace document
  expectedRevision: string | null; // UUID, null only for first insert
};
type WorkspaceResponse = {
  data: DemoData | null;
  revision: string | null;
  updatedAt: string | null;
};
```

`DemoData` includes `healthStudio`, name/segment/onboarded, answers, hypotheses, strategy, draft brand, achievements, events and generic delivery state. `healthStudio` contains template/duration/ratio/style/options/scenes/edit history; its numeric editing revision does **not** grant production or review authority. No extra `health_drafts` table is required for this prototype.

First save is a unique insert; later saves atomically compare the expected UUID revision. Stale/duplicate writes return **409 `WORKSPACE_CONFLICT`**. Schema unavailable returns **503 `WORKSPACE_UNAVAILABLE`**; unauthorized requests return 401, nonowned/missing company 404, malformed data 400, request over 5,000,000 bytes 413. Never retry over a newer cloud revision or replace this with unconditional upsert. Preserve the existing user-visible version-choice/recovery behavior.

### Diagnostic onboarding draft

Source: [onboarding-draft.ts](../src/routes/api/onboarding-draft.ts).

```ts
// GET /api/onboarding-draft?companyId=<uuid>
// POST /api/onboarding-draft
type SaveOnboardingDraft = {
  companyId: string;
  baseRevision: string | null;
  draft: { version: 1; answers: Record<string, string>; step: 0 | 1 | 2 | 3 | 4 };
};
// DELETE /api/onboarding-draft receives { companyId, baseRevision }.
type OnboardingDraftResponse = {
  draft: { draft: unknown | null; revision: string; updatedAt: string } | null;
};
```

Answers are checked against known onboarding fields, at most 40 keys and 1,000 characters per input. SQL also limits the JSON draft to 131,072 bytes. DELETE writes a revisioned **null tombstone**; it does not remove the row and allow stale devices to recreate completed answers. The SQL update trigger rotates revision even for writes outside the API. Stale writes return **409 `conflict`**, missing schema **503 `schema-unavailable`**, unavailable access **503 `unavailable`**, invalid input 400, unauthenticated 401, nonowned company 404.

### Manual brand story

Source: [brand-story.ts](../src/routes/api/brand-story.ts), [brand-story.ts schema](../src/lib/brand-story.ts).

```ts
// GET /api/brand-story?companyId=<uuid>
// POST /api/brand-story
type SaveBrandStory = {
  action: "save";
  companyId: string;
  story: { manifesto: string; mission: string; vision: string; values: string[] };
};
// Response: { story, updatedAt }; absent row: both null.
```

Nonempty manifesto ≤4,000 characters; mission/vision ≤1,000 each; 1–8 nonempty values, each ≤300 characters, with database combined-text limit 2,400. Missing schema returns **503 `BRAND_STORY_UNAVAILABLE`** and keeps unsaved text in the editor. Existing saves upsert by company; simultaneous manual story edits do not currently have CAS protection. Decide whether a single-editor limitation is sufficient for launch or add a separately reviewed revision contract. Do not invent an AI story-generation endpoint.

## Migration and configuration sequence

1. **Confirm target and compare history.** Check the cloud project name/reference, existing schema, policies and applied versions with Supabase's migration history. There are nine files in [supabase/migrations](../supabase/migrations); six earlier base/security/video files and three later dedicated-store files. Presence in Git and anonymous 401 responses do not establish that all nine were applied. `supabase/config.toml`'s `project_id` is a local stack identifier, not sufficient proof of the cloud target.
2. **Select a disposable test environment.** Use two dedicated QA identities and synthetic companies/files. Do not create or delete customer rows merely to prove the integration. No credentials belong in the handoff, issue body, worker prompts or browser screenshots.
3. **Review and apply only pending migrations through the normal workflow.** The dedicated files are `20260924150000_onboarding_drafts.sql`, `20260924160000_brand_stories.sql`, and `20260924170000_marketing_workspaces.sql`. They create tables; blindly replaying them against an existing schema will fail. Inspect schema drift before activation; preserve existing kits/reports and data. No automatic activation is included in this handoff.
4. **Regenerate and review database types.** Generate `public` types from the confirmed target into a temporary file, compare with [types.ts](../src/integrations/supabase/types.ts), then integrate the reviewed output. Three route-local additive type aliases currently bridge the newer tables. Remove those only when the generated types and migration state are aligned.
5. **Configure Auth and the Node server.** Set real hosted/local return URLs and email confirmation/recovery settings. Use matching browser `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` and server `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY`. Keep `SUPABASE_SERVICE_ROLE_KEY` and provider keys server-only. Deployment uses `NITRO_PRESET=node-server`; setting that for a checker does not deploy the running dev server. See [.env.example](../.env.example), [DEPLOY-DEMO.md](DEPLOY-DEMO.md) and [routes README](../src/routes/README.md).
6. **Qualify storage and selected-company behavior.** Verify private buckets, object prefixes, owner/admin behavior, signed URL expiry/refresh and blocked cross-company reads. Resolve durable logo lookup. Explicitly decide single-company launch behavior; current first-visible-row selection plus strict owner-only MarketingProvider can obstruct an admin when the oldest visible company belongs to someone else. This is a source-level integration concern, not a reproduced QA failure.
7. **Close the existing-screen gaps.** Add password recovery/resend; include newer data stores in account export; make partial read/purge failures visible; qualify production research or retain an explicit unavailable state. Then execute the acceptance table below and record observed results before declaring cloud readiness.

Safe type-generation example after the project has been confirmed (not executed by this handoff):

```sh
npx supabase gen types typescript --project-id '<confirmed-project-ref>' --schema public > /private/tmp/nukkia-database-types.ts
diff -u src/integrations/supabase/types.ts /private/tmp/nukkia-database-types.ts
```

Use the official [migration workflow](https://supabase.com/docs/guides/deployment/database-migrations), [type-generation instructions](https://supabase.com/docs/guides/api/rest/generating-types), [RLS guidance](https://supabase.com/docs/guides/database/postgres/row-level-security) and [TanStack Start server-route documentation](https://tanstack.com/start/latest/docs/framework/react/guide/server-routes). This repository uses TanStack Start, not Next.js route conventions.

## Specific fixes to qualify

| Gap | Source evidence | Expected resolution |
| --- | --- | --- |
| Export coverage and partial-query errors | [exportar-dados.ts](../src/routes/api/exportar-dados.ts) selects profile/company plus seven legacy tables, excludes the three newer stores, and company-table helper discards query errors | Inventory all caller-owned records, add workspace/draft/story and other applicable records; exclude secrets; surface unavailable tables/partial export instead of returning a falsely complete payload. |
| Storage purge outcome | [conta.ts](../src/routes/api/conta.ts) lists one folder level and continues auth deletion after logged removal errors | Test nested/paginated object inventory and failure paths; track unfinished purge or stop/retry before claiming complete removal. Auth/database cascade alone does not purge storage or external suppliers. |
| Logo expiry | [marca.tsx](../src/routes/_authenticated/marca.tsx) uploads object then saves a seven-day signed `logo_url`; the supplied schema has no `logo_path` | Persist a durable object reference through a reviewed compatible migration and re-sign on read; qualify old rows and expiry behavior. Generic content-item path support already exists. |
| Hosted site research | [brand-preview.server.ts](../src/lib/brand-preview.server.ts) requires development, localhost and exact same origin | Production request must stay blocked until tenant authorization/retention/deployment are designed and tested; provide a clear UI limitation meanwhile. Do not simply delete the localhost gate. |
| Admin company selection | [company.ts](../src/lib/company.ts) selects first visible company; [MarketingProvider](../src/components/marketing-provider.tsx) rejects a nonowned selected company; layout wraps `/admin` | Test owner and admin journeys, select the intended owned company or isolate admin overview from an owned marketing workspace. Preserve stricter draft/workspace access policies. |

These are backlog items established from source inspection. They have not been fixed by preparing the map.

## Acceptance checks

Use normal authenticated clients for RLS tests, not service-role credentials. For each case record test identity/company, initial revision, action, expected result, observed result and evidence. Do not mark a test passed because the UI displayed a success toast.

| Check | Success definition | Current evidence |
| --- | --- | --- |
| Account entry and recovery | Register/confirm, sign in/out, resend and recover password with allowed redirect; invalid/expired links recover cleanly | Login/register implemented; missing recovery surfaces; authenticated end-to-end pending. |
| New company | QA A and QA B each create synthetic owned company; expected profile/role/progress exists | Source present; authenticated execution pending. |
| Cloud Cérebro and Health draft | A saves valid workspace; fresh browser/device retrieves matching content and returned cloud UUID revision; local fallback labeled correctly | Contracts/tests present; actual two-device persistence pending. |
| Account isolation | B cannot read/change A's company workspace/draft or assets through both app APIs and ordinary Supabase access; reject forged owner/company IDs | Source policies present; two-user runtime proof pending. |
| Concurrent workspace saves | Two A sessions read one revision; first save succeeds; stale second receives 409; newer cloud content survives; edited draft remains recoverable | Local/unit behavior exists; authenticated runtime proof pending. |
| Onboarding completion | Save/resume all chapters; successful completion leaves null tombstone; stale session cannot resurrect old answers | Contract present; database-trigger/CAS runtime proof pending. |
| Manual brand story | Save/read per intended owner/admin rules; fresh session sees same values; unavailable schema retains editor text | Contract present; authenticated runtime proof pending. |
| Identity application | Saved kit/logo reload; deliberate apply updates piece context; changed identity invalidates prior generic approval; expired links recover | Local demo generic flow passed; real kit/storage parity and expiry pending. |
| Generic creative export | Edit → save/reload → approve exact version → inspect ZIP/MP4; unapproved/changed version blocked | Anonymous ZIP/browser flow passed; authenticated export and MP4 runtime proof pending. |
| Planner and status | Saved dated items load; generation/429/failure/status states behave honestly; no automatic Health permission | Sources present; provider smoke test requires configured provider and bounded spend, not included here. |
| Logout/account/admin switch | Clear old owner/company caches and revoke in-flight saves; no cross-user draft recovery; admin overview accessible under intended role | Sources/tests present; live role-switch execution pending. |
| Complete account export | Owned synthetic data from current stores appears; foreign data and tokens absent; unavailable/failed reads not hidden | Existing export incomplete; pending fix and test. |
| Account deletion and private assets | Destructive confirmation; intended DB cascade; nested/private object cleanup; purge failure and external retention status truthful | Existing flow present; failure/pagination/nesting qualification pending. |
| Health boundary | Synthetic draft can be edited; no client-supplied flag/revision bypasses eligibility, paid job, professional review or delivery authority | Local generation-disabled state observed; production domain remains unimplemented. |

## Validation commands and limits

```sh
npm ci
npm run test:onboarding
npm run typecheck
npm run build
npm run lint
NITRO_PRESET=node-server npm run check:demo -- --remote
```

The remote readiness checker is a configuration/schema-exposure check, not an authenticated RLS or customer-flow test. Run it only against the confirmed target. Existing T00 evidence: 467 passing tests, 1 skipped, no failures; typecheck/build passed; lint has a pre-existing backlog of 99 errors and 7 warnings. The [T01 record](operations/T01-first-customer-qualification.md) documents actual local anonymous browser and generic ZIP checks. Fresh handoff verification should name its exact snapshot and results; neither record proves Health production readiness.

## Health production follows the current app baseline

The selected launch scope is **Brazil and medicine**. Build professional/clinic eligibility, input clearance and rights, owned-twin consent/readiness, durable jobs and spend reservations, professional review of the exact package, immutable/revocable delivery, editorial review dates and incident/deletion tracking. The [missing-screen table](2026-10-02-app-map.md#missing-screens-and-states-in-priority-order) specifies the minimum success definitions.

Reuse React/TanStack/Supabase and the existing editor; introduce server-owned domain records only where production authority and lifecycle require them. Models draft content; server code determines membership, eligibility, budget, approvals and delivery. No model or browser draft receives service-role, signing, publishing or arbitrary job authority. Generic creative approval, the client Health revision and a monthly calendar slot are not medical release approval.

Amgad's handoff is complete when the current-app acceptance checks have recorded results, unresolved items have explicit owners and the Health boundary remains visible. Production activation and any merge/deployment are separate steps after review.
