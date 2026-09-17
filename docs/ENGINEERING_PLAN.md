# Nukkia — Engineering Plan

Source: five-discipline review (architecture, security, engineering, DevOps, UI/UX) run on the
Lovable export dated 2026-09-16; extended 2026-09-16 with a full platform migration off Lovable
(own database, own AI provider) plus resolutions for every previously-deferred item, decided by
the user via a round of MCQ questions (see git history for the exact answers).

Status legend: `[x]` done and verified (typecheck + lint + prod build all clean; smoke-tested in
a running dev server where the page doesn't require login) · `[ ]` todo · `[-]` deferred (reason
noted) · **BLOCKED** = needs the user's action, not more code, to finish.

---

## Decisions made this pass (2026-09-16, round 2)

| Area | Decision |
|---|---|
| Database | New Supabase project, user's own account (not self-hosted Docker — no Docker on this machine) |
| AI provider | Gemini API direct, replacing the Lovable AI gateway entirely |
| Text models | Mixed tier: `gemini-2.5-flash` for drafts (plan/carousel/storyboard/onboarding-research), `gemini-2.5-pro` for the diagnostic report — **superseded 2026-09-17, see below** |
| Image model | `gemini-2.5-flash-image` ("Nano Banana") |
| Video | Veo (`veo-3.1-generate-preview`) wired in for real, async job + polling |
| Google login | Dropped — email/password only |
| Lovable exit scope | Full: Vite config, logo, error reporting, cron secret, all replaced |
| Image/video URLs | Sign-on-read from a stored path, not a cached long-lived URL |
| Onboarding stepper | Built |
| Mobile nav + a11y | Built (bottom tab bar, contrast fix, focus rings) |
| Data export (LGPD) | Built |
| Admin area | Built (minimal, read-only) |
| Instagram/LinkedIn publishing | Deferred (also defers the metrics job, which depends on it) |
| CI/tests/lockfile | CI set up (typecheck/lint/build); npm is now the lockfile of record |

---

## BLOCKED on the user

1. ~~Create the new Supabase project~~ **DONE (2026-09-16).** `Amgadmj's Project` /
   `ihppmpnlpsvxqsqenjfl.supabase.co`. All 6 migrations applied and verified directly against
   `pg_catalog`/`information_schema` (not just trusted from the SQL editor's UI, which had a
   stale-render issue mid-session — caught by cross-checking). `.env` updated with the new
   `SUPABASE_URL`/`SUPABASE_PUBLISHABLE_KEY`/`SUPABASE_SERVICE_ROLE_KEY`. `types.ts` is still the
   hand-written version, though — regenerate for real once a Supabase access token is available:
   `npx supabase gen types typescript --project-id ihppmpnlpsvxqsqenjfl > src/integrations/supabase/types.ts`.
2. ~~Gemini API key~~ **DONE, but see the model swap below** — image/video still use Gemini
   (`GEMINI_API_KEY` in `.env`, went through two bad values first: a non-Gemini-shaped token, then
   a key whose Google Cloud project had the Generative Language API blocked — both confirmed by
   direct test calls before the working key landed).
3. **`ANTHROPIC_API_KEY`** — added by the user (2026-09-17), not yet tested end-to-end at their
   request (they're testing it themselves).
4. **Veo cost.** Video rendering is real, not a stub — every "Gerar roteiro + vídeo" click spends
   actual money once Gemini's key is confirmed working. `src/lib/quota.server.ts` caps it (5/day,
   20/month per company by default) but the per-call cost itself is the user's to monitor.

---

## Round 3 (2026-09-17): text generation moved to Claude

Explicit, scoped request: "all the text and all diagnostic work" → Claude, not Gemini. Image
generation and Veo video were **not** in scope and stay on Gemini.

- `src/lib/ai.server.ts`: `generateJson()` now calls Claude (`claude-sonnet-4-6` by default,
  `ANTHROPIC_TEXT_MODEL` to override) via the official `@anthropic-ai/sdk`, using native
  structured outputs (`messages.parse()` + a Zod schema — confirmed against the bundled
  `claude-api` skill's TypeScript docs, not assumed). The old fast/quality Gemini-model tier
  split is gone — one model for all text now, per the request.
- **Real quality win, not just a provider swap:** every call site previously hand-maintained a
  raw JSON Schema *and* a parallel TypeScript type that could drift (flagged in the original code
  review). They're now one Zod schema each — `diagnostico.ts`, `plano.ts`,
  `content-engine/index.ts` (carousel outline + storyboard), `pesquisa-empresa.ts`.
- **Caught before it shipped:** `@anthropic-ai/sdk`'s structured-output helper is typed against
  `zod/v4`'s internals specifically, while the rest of the app validates request bodies with
  plain `"zod"` (v3 API surface — zod 3.25.x ships both). Fixed by importing `zod/v4` only for
  the AI-output schemas (`import { z as z4 } from "zod/v4"` alongside the existing v3 `z` in each
  route file) rather than migrating the whole app's zod usage as a side effect of this change.
- Gemini's SSE/JSON-schema plumbing in `ai.server.ts` is untouched for image/video; the
  Gemini-only bits were renamed (`getApiKey` → `getGeminiApiKey`) for clarity now that there are
  two providers in one file.
- Verified: clean `tsc`, clean `eslint` on every touched file, a full production build with the
  Anthropic SDK bundled. **Not yet verified: an actual Claude API call** — `ANTHROPIC_API_KEY`
  was added after this was built; the user is testing it themselves rather than me spending their
  API credits on a verification call.

---

## What changed this pass

### Database (prep complete, application blocked — see above)
- Nothing schema-wise changed in *what* the app needs beyond round 1's migrations plus one new
  file: `supabase/migrations/20260917000000_gemini_video_jobs.sql` (`content_items.video_operation`
  /`video_path`/`video_error` for the async Veo job).
- `image_path`/`video_path`/carousel slide paths are now the *only* things the server ever
  writes — `image_url`/`video_url` columns are no longer populated for new content. The client
  signs a fresh 1-hour URL on render (`useSignedUrl`/`useCarouselUrls` in `conteudo.tsx`),
  closing the "long-lived cached URL" gap fully (round 1 only shortened it to 7 days).

### AI: Gemini replaces the Lovable gateway
- `src/lib/ai.server.ts` rewritten: raw REST against `generativelanguage.googleapis.com`
  (verified against Google's own docs before writing, not assumed — a first web-fetch attempt
  returned hallucinated endpoint/model names, caught by cross-checking with a second source
  before any code was written on top of it).
- `generateJson` takes a `tier: "fast" | "quality"` (default fast); `/api/diagnostico` is the
  one call site using `"quality"`.
- No more SSE parsing — Gemini's `generateContent` is a plain JSON response, so the whole
  custom stream parser from round 1's hardening pass is gone (it was solving a problem that no
  longer exists, not a regression).
- New: `startVideoGeneration`/`checkVideoOperation`/`downloadVideoBytes` for Veo's async
  predictLongRunning pattern.

### Content engine: Veo wired in for real
- `docs/CONTENT_ENGINE.md` updated. `renderVideo()`'s old "awaiting_provider" stub is replaced
  by `startVideoRender()` (kicks off the job) + `checkVideoRender()` (polls, downloads, uploads
  once done).
- `/api/arte`'s `reels` branch now: generates the storyboard (quota unit 1: `video_storyboard`),
  then kicks off the actual Veo render (quota unit 2: `video_render` — rendering costs
  meaningfully more than a text call, so it's metered separately).
- New `POST /api/video-status`: Veo takes minutes, well past any single request's budget, so
  this is polled — `conteudo.tsx`'s `useVideoPolling` calls it every 8s while a job is pending
  and invalidates the content-items list once it resolves.

### Lovable exit (full scope)
- `vite.config.ts` rewritten without `@lovable.dev/vite-tanstack-config` — the three actual vite
  plugins it wrapped (`tanstackStart`, `viteReact`, `tailwindcss`, `tsConfigPaths`, `nitro`) were
  already direct dependencies; import paths were verified against the installed packages'
  actual exports before writing the config, not guessed.
- Google OAuth (`@lovable.dev/cloud-auth-js`, `src/integrations/lovable/`) removed entirely from
  `auth.tsx` — email/password only now.
- `src/lib/lovable-error-reporting.ts` → `src/lib/error-reporting.ts`: plain console logging,
  no more dependency on `window.__lovableEvents` (which only ever existed inside Lovable's own
  preview iframe).
- `cron-auth.ts` renamed `LOVABLE_CRON_SECRET*` → `CRON_SECRET*` (never an actual Lovable
  service dependency, just borrowed naming).
- The logo (`/__l5e/assets-v1/...`, 404 on every local run even before this) replaced with an
  inline SVG placeholder mark in `nukkia-logo.tsx` — **not a final design**, swap it for the real
  file whenever one exists.
- `bun.lock`/`bunfig.toml` removed; `package-lock.json` is now the lockfile of record (npm).
- `.github/workflows/ci.yml`: typecheck + lint + build on every push/PR.

### Onboarding, mobile, admin, export (the rest of round 1's "still open" list)
- `src/components/onboarding-progress.tsx`: a step indicator + "continue" card on `/painel`,
  driven by `companies.onboarding_step` (which was already being written correctly, just never
  read). `trilha.tsx` now advances it to `"content"` on a company's first completed mission.
- `app-shell.tsx`: a fixed bottom tab bar below `sm:`, full top nav hidden on mobile instead of
  the old sideways-scrolling row; `--primary` darkened (`oklch 0.623` → `0.52`, same hue/chroma)
  so white button text clears WCAG AA's 4.5:1 (was ~3.7:1); shared button/nav focus rings
  widened from a 1px ring to a 2px ring with an offset.
- `GET /api/exportar-dados` + a button on `/conta`: every row tied to the caller's company as
  one downloadable JSON file (LGPD Art. 18 portability, the round 1 deferral).
- `/admin` (nav-gated on the `admin` role, hidden otherwise): read-only table of every company,
  its owner, latest diagnostic score, and AI call count. Uses the same authenticated client and
  existing RLS (`owns_company`/`has_role` already grant admins cross-company read) — no service
  role needed for this.

---

## Still open (unchanged from round 1, or newly noted)

- Instagram/LinkedIn OAuth + real publishing + the metrics-collection job (explicitly deferred
  this round).
- MFA (`aal2`) on the admin RLS branch — there's a real admin UI now, so this is worth revisiting
  sooner than round 1 assumed.
- The real Nukkia logo file — the SVG mark is a placeholder.
- A DB-side test suite (RLS/constraint tests) and a first Vitest pass (the SSE-parser tests round
  1 flagged are moot now that Gemini's plain-JSON response replaced streaming, but the Veo
  polling logic and quota RPC are exactly the kind of thing worth testing).
- Removing the remaining Lovable-Cloud-specific pieces once the new Supabase project is live:
  `previewAuthStorage.ts`'s Lovable-preview-domain detection is now fully inert outside Lovable
  (falls back to plain `localStorage`), safe to delete once confirmed unneeded, not urgent.
