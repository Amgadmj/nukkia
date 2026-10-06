# Partner handoff: demo deployment

This guide authorizes no automatic database or billing change. The partner/database owner applies reviewed remote changes. Do not reset the database, drop tables, replay every migration blindly, delete drafts, or change provider billing automatically. Preserve backups and the previous release.

## Current evidence and limits — 25 September 2026

- Read-only zero-row probes against the configured project returned HTTP 404 / `PGRST205` for `marketing_workspaces`, `brand_stories`, and `onboarding_drafts`; a `companies` control returned 200. This proves unavailable REST schema entries, not physical table absence. Verify migration history, grants and schema exposure before deciding which SQL is pending.
- Browser QA: an approved/exported workspace retained 120 XP / 5-of-5 after reload in its original tab, but another authenticated tab saw 0 XP and no creative. Session recovery was not account persistence.
- The new fallback keeps recovery records scoped to authenticated user/company in this browser profile. Original tab drafts are imported only in their own scope. Concurrent divergent copies require a choice; original recovery records remain until logout. Remote writes still require revision comparison. This is not cross-device backup or encryption against someone sharing the browser profile. Quotas/private browsing can prevent recovery storage; a tab-only or memory-only warning then applies. Many retained originals can exhaust storage: do not silently prune them before the account save is verified.
- Operator-reported live provider evidence: Gemini generation returned HTTP 402 `RESOURCE_EXHAUSTED` (prepaid credits depleted); the partner must fund Google if paid generation is needed. No automatic top-up. A minimal Anthropic text request returned 200 (12 input / 4 output tokens); this does not prove a full diagnostic flow. The Node/ffmpeg promotional MP4 fallback does not call paid AI providers; it still consumes host CPU/time.
- `gemini-2.5-flash-image` shuts down on 2 October 2026. On 25 September 2026 the default image model was switched to `gemini-3.1-flash-image` (GA, listed for the configured key); `GEMINI_IMAGE_MODEL` still overrides it. The response parser now skips Gemini 3 interim `thought` images, and stored images are labelled by their actual bytes (PNG/JPEG/WebP). A live generation could **not** be verified: the configured key's Google project returned HTTP 403 `PERMISSION_DENIED` ("project has been denied access") for every image model, including the old one — resolve that with Google before relying on paid image generation. Veo stays on `veo-3.1-generate-preview` (still listed; no GA Veo id exists yet).
- Public-site research remains restricted to localhost development. Deploying the Node server does not enable production research, OAuth, publishing or measured analytics.

### Post-fix local UI proof

- Clicked through the authenticated Movitta context → saved identity kit → identity confirmation → explanatory carousel → editing all three pages → approval. A long diagnostic objective no longer blocks the editor with a generic validation error.
- Initiating the PNG/legend export advanced the current piece to 5/5. Reload and a new authenticated tab recovered its title, caption, approval and 120 XP. This remains browser recovery, not a verified account save.
- The MP4 was composed through the real UI endpoint. After adding a restricted `media-src` policy for blob previews, the browser reported 720×900, 12 seconds, `readyState=4`, no media error, and playback reached 12 seconds. It is a slideshow of approved pages with fades, not AI-generated footage or narration.
- Download controls were clicked, but the integrated browser did not yield a download event or a confirmed local file in this run. The partner must verify actual ZIP/MP4 file delivery in the deployment browser before calling the export fully end-to-end. Codec/ZIP byte checks are also covered by automated tests; they do not replace that browser gate.
- The test copy was manually reviewed and edited. This does not establish unattended creative quality, clinical compliance, live social connectivity, or a full diagnosis-to-paid-media production flow.

## Database: review history, then apply only pending SQL

Confirm the exact Supabase project and take a restorable backup/snapshot first. Compare the partner's applied migration history and actual schema with this chronological inventory. Keep a record of reviewed/applied IDs. On existing installations do not replay earlier files simply because three newer tables are unavailable.

1. `supabase/migrations/20260916201550_4f447c55-58c9-423b-a4b3-11804e98aaf0.sql` — base application schema, ownership helpers, triggers and grants.
2. `supabase/migrations/20260916201608_8ae20384-5d4a-4fc7-91ee-3b256c2083c9.sql` — function execution grants.
3. `supabase/migrations/20260916202457_9c2306ca-a13d-40c4-8e11-031bf9a79d03.sql` — storage object policies.
4. `supabase/migrations/20260916210000_p0_data_integrity.sql` — constraints and identity uniqueness. **Contains a duplicate-brand-kit DELETE. If pending on a populated database, stop for a separate preservation/reconciliation review; this guide does not authorize that deletion.**
5. `supabase/migrations/20260916210100_p1_security_and_features.sql` — protected tokens, quotas, mission RPCs and content fields. **Contains DROP COLUMN operations on legacy social tokens. If pending with data, stop for an explicit preservation/compatibility plan; do not discard credentials under this handoff.** Never call `check_and_record_ai_usage` as a health probe: it records usage.
6. `supabase/migrations/20260917000000_gemini_video_jobs.sql` — asynchronous video tracking fields.
7. `supabase/migrations/20260924150000_onboarding_drafts.sql` — versioned drafts and owner RLS.
8. `supabase/migrations/20260924160000_brand_stories.sql` — manual brand story storage and RLS.
9. `supabase/migrations/20260924170000_marketing_workspaces.sql` — workspace document, revision and owner RLS.

For the three missing-schema tables, review/apply only the corresponding pending migrations after confirming their base functions/tables exist. Verify SELECT/INSERT/UPDATE grants, RLS, foreign keys and timestamp/revision triggers. Confirm the REST schema cache exposes them; refreshing schema metadata, if needed, is a partner operation. A migration file existing in Git is not deployment evidence.

Storage: provision/verify private `brand-assets` and `content-media` buckets in the intended project, with the existing company-folder ownership policies. Policies referencing bucket names do not create buckets. Confirm MIME/size limits support the enabled uploads. Do not make buckets public to bypass failures. Avoid service-role keys in the browser.

## Runtime and environment

Use a maintained Node runtime compatible with the lockfile/toolchain (Node 22.12+ or a compatible newer version; current local verification used Node 26). Install dependencies from the committed lockfile with `npm ci`.

- Build-time public values: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` (and project ID where configured).
- Runtime server values: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, same project as the browser build. Supply them through the host's secret/environment manager; the generated server does not promise to load a local `.env` automatically.
- Server-only: `ANTHROPIC_API_KEY` for text generation; `GEMINI_API_KEY` only for paid image/video features; optional model overrides as documented in `.env.example`. Key presence is not evidence of billing, model availability or generation success.
- `SUPABASE_SERVICE_ROLE_KEY` is privileged and only needed by the existing server-side administrative/storage paths; never use it for this readiness checker, never give it a `VITE_` prefix. Do not enable account deletion/admin/cron features without their separate configuration and validation. Cron secrets remain server-only.
- `/api/promo-video` needs ffmpeg with libx264. Resolution order: `FFMPEG_PATH`, then `ffmpeg` on PATH, then the `ffmpeg-static` npm dependency. `ffmpeg-static`'s install script downloads the binary for the OS/arch of the machine running `npm ci`, so the build machine must match the runtime (Vercel builds on Linux x64 and runs on Linux x64; a Docker image must run `npm ci` inside the image, not copy a Windows/macOS `node_modules`). Installs with `--ignore-scripts` get no binary; set `FFMPEG_PATH` then. The runtime needs child-process execution, writable temporary space, and sufficient bounded request time/memory. Verify an actual small local MP4 export with the partner's smoke-test fixture; binary presence alone does not prove encoding.
- **Vercel:** `vite.config.ts` sets Nitro `traceDeps: ["ffmpeg-static*"]`, which externalizes the package and copies it (binary included, ~80 MB uncompressed; Vercel's function limit is 250 MB) into `.vercel/output/functions/__server.func/node_modules/ffmpeg-static/`. Rendering writes to `/tmp` and is capped at 60 s per job.

The current Vite config defaults to a Cloudflare worker outside Vercel (on Vercel, `VERCEL=1` selects the Node-based `vercel` preset automatically). **Outside Vercel, an explicit Node preset is mandatory for the ffmpeg endpoint:**

```sh
npm ci
npm run test:onboarding
npm run typecheck
NITRO_PRESET=node-server npm run build
NITRO_PRESET=node-server npm run check:demo
node .output/server/index.mjs
```

Provide runtime secrets before starting the final command. Put the Node process behind HTTPS, configure the production authentication redirect/site URLs in Supabase, and retain the previous build for rollback. Do not substitute `vite preview` or a Cloudflare/edge runtime for this deployment.

## Read-only readiness check

`npm run check:demo` is offline by default: it reports configuration presence/consistency and local ffmpeg availability. It reads `.env` without printing its values; explicitly supplied process environment wins. It does not print credentials, URLs, raw server messages or data rows.

The partner may explicitly opt into three zero-row GET requests:

```sh
NITRO_PRESET=node-server npm run check:demo -- --remote
```

Only the configured public/anon key is used; elevated keys and unexpected/mismatched targets are rejected. No provider, quota RPC, login, refresh, data mutation or migration is called. HTTP 200 establishes table exposure only. `42501` establishes exposure with access restricted to the probing role, not authenticated RLS success. `PGRST205` remains a schema-exposure blocker. The check deliberately leaves signed-in saves and private bucket access unverified. Exit 1 means a checked requirement failed; exit 0 is **not** full E2E approval.

## Partner smoke-test gates

Use an approved test account/company, not production customer records. These tests include explicit test-data writes by the partner; the readiness script does not perform them.

1. Confirm `/auth` serves without a server error and unauthenticated protected routes redirect. Confirm no secret/error payload appears in browser output.
2. In the original draft tab, verify the creative/answers/earned XP before any reload. Do not sign out while its only copy is local. After deploying the app, wait for **Salvo na conta**, not **Salvo neste navegador**.
3. Open a separate authenticated tab and then a separate browser/device: answers, identity, creative and earned XP must recover. Close/reopen only after account saving is confirmed. Local fallback is a safety net, not acceptance for multi-device persistence.
4. Exercise concurrent edits: require explicit choice for divergent browser or remote revisions; neither copy may silently replace the other. Retry a failed save and check it reconciles before writing.
5. Sign out: remove this user's session/browser recovery, revoke other open tabs, and prevent late responses from recreating drafts. Sign in as another user: no previous user's draft may appear. Browser-profile users can inspect local storage; do not store sensitive client/patient data there.
6. Verify manual brand-story save/reload and onboarding recovery against the newly exposed tables. A second user must not access the first user's data. Do not run paid generation without separate authorization/billing readiness.
7. Export a short promotional MP4 and verify download/playback. Test layout/status disclosure on desktop/mobile and both themes. Check approved content and XP survive reload and new-tab recovery.

## Rollback without destructive database actions

Roll back the application artifact/environment to the previous known-good release. Retain additive tables, records, storage objects and original local recovery records. Do not run down migrations, reset, DROP, TRUNCATE, delete buckets or clear browser storage as a rollback shortcut. An older app may only read its legacy tab cache: keep original tabs open until the new recovery/account state is verified. Any restoration or destructive reconciliation needs its own explicit partner approval and backup plan.
