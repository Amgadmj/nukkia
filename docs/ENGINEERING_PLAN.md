# Nukkia — Engineering Plan

Source: five-discipline review (architecture, security, engineering, DevOps, UI/UX) run on the
Lovable export dated 2026-09-16, plus new scope requested the same day: AI-driven
onboarding auto-fill, and a generalized carousel/video content engine.

Status legend: `[ ]` todo · `[x]` done and verified (typecheck + lint + prod build all clean;
the app was also smoke-tested in a running dev server) · `[-]` deferred (reason noted)

**⚠ Before any of the `[x]` database items take effect: the two new migrations have not been
applied to the live Supabase project.** See "Applying the migrations" at the bottom — this
needs a decision (push now vs. review first) that's the user's to make, not something to do
unattended against production.

**AI-dependent code paths (diagnostic, plan, art/carousel/video-storyboard generation,
onboarding auto-fill) could not be exercised end-to-end locally** — `.env` has no
`LOVABLE_API_KEY`, and that key only exists inside Lovable's environment. Everything below
marked done was verified by type-checking, linting, a full production build, and direct code
review, not by an actual AI round-trip.

---

## P0 — Data integrity & unblock the funnel

- [x] `brand_kits` has no `UNIQUE(company_id)` but code upserts on it → save always fails,
      which blocks content generation entirely. Added the constraint (with a defensive
      dedupe first). `supabase/migrations/20260916210000_p0_data_integrity.sql`
- [x] `content_plans` double-click duplicated a month's content. `/api/plano` now upserts on
      `(company_id, month)` and replaces that plan's items instead of insert-and-ignore.
- [x] Mission/XP fields were client-writable — revoked, moved to `complete_mission()`, a
      `SECURITY DEFINER` RPC. `trilha.tsx` calls it via `supabase.rpc(...)`.
- [x] Status/format free-text columns disagreed with what code wrote (`pending` vs `todo`).
      Added CHECK constraints; `/api/diagnostico` now writes `'pending'`.
- [x] Missing indexes on every `company_id` FK; missing `updated_at` triggers on
      `missions`/`user_progress`.
- [x] Storage buckets (`brand-assets`, `content-media`) are now created in the migration
      (private, size-capped, image-mime-only) instead of only referenced by policy.
- [x] `social_accounts.access_token`/`refresh_token` were plain text and client-readable.
      Split into `social_account_secrets`, service-role only, zero client grants.
- [x] Storage policy UUID cast (`::uuid`) now goes through `owns_company_folder()`, which
      returns false instead of throwing on a non-UUID folder name.

## P1 — Security & cost control

- [x] No quota/rate limit on the AI endpoints → unlimited spend per account. Added
      `ai_usage` + `check_and_record_ai_usage()` (atomic, advisory-locked) and
      `src/lib/quota.server.ts` with per-format daily/monthly caps, enforced in every route.
- [x] AI gateway raw error bodies were relayed to the browser. `AiError` in `ai.server.ts`
      now separates a logged internal message from a generic Portuguese `userMessage`.
- [x] `ai.server.ts`'s SSE parser dropped `response.failed`/`incomplete`/`error` events, had
      no timeout/retry, and trusted the model's JSON blindly. Rewrote the parser (CRLF-safe,
      flushes the final frame, handles all three failure event types), added
      `AbortSignal.timeout` + one retry on 429/5xx.
- [x] User-writable fields feeding straight into image prompts (`content_items.title`,
      `brand_kits.tone`, …) had no length limit. Added CHECK constraints.
- [x] Signed URLs for logos/art were saved with a 1-year expiry, unrevocable. Now the
      storage **path** is persisted (`content_items.image_path`); a 7-day URL is kept
      alongside for immediate display as a bounded interim fix — see "Still open" below for
      the full fix.
- [x] No security headers. Verified two implementation attempts against a real response
      before shipping — see `src/lib/security-headers.ts` for exactly what didn't work and
      why; applied in `src/server.ts`, confirmed present on both SSR pages and `/api/*`.
- [x] Composite FKs added so `scheduled_posts`/`content_items.plan_id` can only reference a
      row in the *same* company.
- [ ] Admin RLS branch should require MFA (`aal2`) once an admin UI exists. *(deferred: no
      admin UI yet)*

## P1 — LGPD

- [x] Signup requires a consent checkbox linking to real `/termos`/`/privacidade` pages;
      version + timestamp recorded on `profiles` (via signup metadata → `handle_new_user`
      for email signup, via a one-time client-side backfill for Google signup).
- [x] `/privacidade` discloses AI processing outside Brazil and advises against entering
      patient/client PII in the diagnostic.
- [x] Self-serve account deletion (`/conta`, `DELETE /api/conta`): purges storage, then
      deletes the `auth.users` row via the admin API, which cascades every DB row.
- [ ] Data export (JSON download of everything tied to a company). *(deferred — deletion is
      the higher-severity gap and is done)*

## P2 — Correctness / UX bugs from the code review

- [x] `marca.tsx`/`diagnostico.tsx` seeded `useState`/`defaultValue` before the query
      resolved. Both now gate rendering the interactive form until the query settles, so
      initial state is always read from real data.
- [x] Cross-account cache leak: sign-out (button, and an `onAuthStateChange` listener for
      `SIGNED_OUT` from any tab/expiry) now calls `queryClient.clear()`.
- [x] Write-during-render in `painel.tsx` removed — `user_progress` is now seeded by a
      trigger on company creation (`handle_new_company`), not a client mutation in render.
- [ ] Onboarding step (`onboarding_step`) is still written but not read for routing/gating.
      A real guided-onboarding stepper is UI scope beyond this pass — see "Still open".
- [ ] Mobile bottom nav + a full accessibility/contrast pass. *(deferred — large UI surface)*

## New capability 1 — AI-assisted onboarding auto-fill

- [x] `companies.research` jsonb column (raw AI draft + confidence).
- [x] `POST /api/pesquisa-empresa` — from just the name + whatever handle/site the client
      already gave, drafts plausible answers for the diagnostic's open fields.
- [x] `diagnostico.tsx`: a "Sugerir com IA" button, pre-filled fields marked with a visible
      "Sugestão da IA — revise" badge that clears the moment the user edits that field;
      `painel.tsx` fires this automatically in the background right after company creation
      if a site/handle was given.
- [ ] Actual web fetch of the given URL/handles for grounding. Deliberately not built: it
      needs the SSRF-hardened fetcher from the security review (private-IP/DNS-rebinding
      guards, redirect limits, size caps) *first* — building the fetch without those guards
      just to hit this checkbox would recreate the exact hole that review flagged.

## New capability 2 — Generalized content engine (carousel + video)

Full design in `docs/CONTENT_ENGINE.md`.

- [x] `src/lib/content-engine/style-anchor.ts` — a persistent brand-identity text prompt
      (palette/tone/segment) prepended to every generated image/frame for one piece, so a
      carousel's slides read as one brand.
- [x] `generateCarousel()` — 4–6 slides (cover → body → CTA), each rendered through the
      image gateway with the shared anchor + per-slide copy.
- [x] `generateVideoStoryboard()` — script + shot list (10-second blocks), always generated
      and always saved regardless of render-provider availability.
- [x] `renderVideo()` — explicit pluggable seam. **No video provider is wired in** (no API
      key, that's a cost/vendor decision for the user) — every call today returns the
      storyboard with `status: "awaiting_provider"` rather than faking a render.
- [x] `content_items` extended: `slides`, `storyboard`, `video_url`, `image_path`.
- [x] `/api/arte` now branches on format (`carrossel`/`reels`/other) instead of always
      generating one square image; `conteudo.tsx` renders slides/storyboard/video
      accordingly.
- [ ] Actual video rendering — needs `VIDEO_PROVIDER` configured (see `.env.example`) and a
      real integration written into `renderVideo()`.

---

## Still open (real gaps, not accidentally skipped)

- **Sign-on-read for images**, not a 7-day signed URL cached in the DB. The path is now
  stored (`image_path`), so this is a client-side change (fetch a fresh signed URL when
  displaying, the way `conteudo.tsx` already does for carousel slides via
  `createSignedUrls`) — same pattern, not yet applied to the single-image case.
- **Guided onboarding stepper.** `onboarding_step` is written correctly through the whole
  flow now but nothing routes or gates on it yet.
- Instagram/LinkedIn OAuth + real publishing + `/api/public/cron/publish`.
- Metrics collection job + charts.
- Admin area / MFA-gated admin RLS.
- Mobile bottom nav + full accessibility/contrast pass.
- Data export (LGPD Art. 18 portability) endpoint.
- Removing Lovable lock-in (Vite config, Google OAuth broker, asset hosting).
- Dependency/CI hardening (lockfile choice, pinned nitro beta, GitHub Actions, tests).

---

## Applying the migrations

Two new files, both additive (nothing already-applied is touched):
`supabase/migrations/20260916210000_p0_data_integrity.sql` and
`supabase/migrations/20260916210100_p1_security_and_features.sql`.

This session has no service-role key or DB password for the live project — only the
publishable key in `.env` — so these were **not** pushed to production. To apply them:

```bash
npx supabase login
npx supabase link --project-ref zvnkjiqdqssztveevyhc
npx supabase db push
```

Then regenerate the real types (this repo's `src/integrations/supabase/types.ts` was hand-
edited to match what the migrations *should* produce — regenerate to confirm):

```bash
npx supabase gen types typescript --project-id zvnkjiqdqssztveevyhc > src/integrations/supabase/types.ts
```

Review the SQL first if you'd rather not run it blind — both files are short and commented.
