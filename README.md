# Nukkia — Technical Handover

> **Audience:** incoming CTO / engineering lead.
> **State as of:** 2026-09-22, `master` @ `7ff77e2` + this README commit.
> **Author of this handover:** outgoing founder (Amgad), compiled from the codebase, the git
> history, the live Vercel project and the docs in [`docs/`](docs/).

Nukkia is a Brazil-first, Portuguese-language **AI marketing SaaS for small businesses and
clinics**. A business owner signs up, the app researches the company, runs an AI marketing
diagnostic, turns it into gamified "missions", captures a brand identity, then generates a
monthly content calendar and the actual assets (single images, multi-slide carousels, short
vertical videos) — all brand-consistent and compliance-aware (CFM for clinics, OAB for law firms).

This README is the single entry point. Deeper dives:

| Doc | What it covers |
|---|---|
| [`docs/ENGINEERING_PLAN.md`](docs/ENGINEERING_PLAN.md) | Decision log of every engineering round (Lovable export → own infra → Claude for text), what was fixed and why |
| [`docs/AI_AUDIT.md`](docs/AI_AUDIT.md) | Every AI touchpoint in the user journey, prompts, guardrails, what's automated vs. human-reviewed |
| [`docs/CONTENT_ENGINE.md`](docs/CONTENT_ENGINE.md) | The image / carousel / video generation pipeline (**partly stale** — see §11) |
| [`src/routes/README.md`](src/routes/README.md) | TanStack file-based routing conventions |

---

## Table of contents

1. [TL;DR for day one](#1-tldr-for-day-one)
2. [Tech stack](#2-tech-stack)
3. [Architecture](#3-architecture)
4. [Repository layout](#4-repository-layout)
5. [Local development](#5-local-development)
6. [Environment variables](#6-environment-variables)
7. [Database (Supabase / Postgres)](#7-database-supabase--postgres)
8. [Server API (`/api/*`)](#8-server-api-api)
9. [AI layer](#9-ai-layer)
10. [Frontend](#10-frontend)
11. [Known issues & tech debt (read this)](#11-known-issues--tech-debt-read-this)
12. [Security & LGPD posture](#12-security--lgpd-posture)
13. [Deployment & infrastructure](#13-deployment--infrastructure)
14. [CI](#14-ci)
15. [Access & accounts to transfer](#15-access--accounts-to-transfer)
16. [Roadmap / not built yet](#16-roadmap--not-built-yet)
17. [History](#17-history)

---

## 1. TL;DR for day one

- **Stack:** TanStack Start (React 19, SSR) + Vite 8 + Tailwind 4 + shadcn/ui, Supabase
  (Postgres + Auth + Storage, all authorization via RLS), **Anthropic Claude** for all text,
  **Google Gemini** (Nano Banana) for images and **Veo** for video.
- **Production:** Vercel project `nukkia` (team `amgadmjs-projects`), auto-deploys `master`.
  URL: `https://nukkia.vercel.app` (currently behind Vercel SSO protection — see §13).
- **Database:** Supabase project `ihppmpnlpsvxqsqenjfl`. Schema is fully reproducible from
  [`supabase/migrations/`](supabase/migrations/).
- **Build health (verified 2026-09-22):** `typecheck` ✅ · `build` ✅ · `lint` ❌ (Prettier
  formatting only — CI is red, see §11 #2).
- **There are no automated tests.** CI runs typecheck + lint + build only.
- **Fix first (§11):** Veo video upload is rejected by the storage bucket's MIME whitelist;
  CI only runs on `main` but the branch is `master`; `supabase/config.toml` points at the old
  Lovable project; logo URLs expire after 7 days.
- **Origin:** exported from Lovable on 2026-09-16, then fully de-Lovabled (own Vite config, own
  Supabase, own AI keys). Some auto-generated files still say "Lovable Cloud" in error strings.

---

## 2. Tech stack

| Layer | Choice | Version (package.json) | Notes |
|---|---|---|---|
| Framework | TanStack Start | `@tanstack/react-start` 1.168.32 (pinned) | SSR + server routes; file-based routing |
| Router | TanStack Router | 1.170.18 (pinned) | `src/routeTree.gen.ts` is generated — never edit |
| UI | React | ^19.2 | |
| Build | Vite | 8.1.5 (pinned), `rolldown` overridden to 1.2.1 | |
| Server bundler | Nitro | 3.0.260603-beta | preset auto-selects `vercel` on Vercel, else `cloudflare-module` |
| Styling | Tailwind CSS 4 + shadcn/ui (Radix) | ^4.2 | tokens in `src/styles.css` (OKLCH) |
| Data fetching | TanStack Query | ^5.101 | |
| Forms/validation | react-hook-form + Zod | zod ^3.25 | **Zod v3 API for request bodies, `zod/v4` for AI schemas** (§9) |
| DB / Auth / Storage | Supabase | supabase-js ^2.116 | RLS is the authorization layer |
| Text AI | Anthropic Claude | `@anthropic-ai/sdk` ^0.126 | default model `claude-sonnet-4-6` |
| Image AI | Gemini `gemini-3.1-flash-image` | raw REST | "Nano Banana 2" (GA). `gemini-2.5-flash-image` shuts down 2026-10-02 |
| Video AI | Veo `veo-3.1-generate-preview` | raw REST | async long-running op (no GA Veo id yet) |
| Promo MP4 export | ffmpeg via `ffmpeg-static` | child process | `FFMPEG_PATH` → PATH → bundled binary; traced into the Vercel function |
| Package manager | **npm** (`package-lock.json` is the lockfile of record) | Node 22 in CI, 24.x on Vercel | |

---

## 3. Architecture

```
 Browser (React SPA after first SSR paint)
   │
   ├── supabase-js (publishable key + user JWT) ──► Supabase REST/Storage   ← most reads/writes
   │        RLS enforces tenant isolation (owns_company / has_role)
   │
   └── apiFetch('/api/*', Bearer <user JWT>) ──► TanStack Start server routes (Vercel function)
                                                    │  userClientFromRequest(): a per-request
                                                    │  supabase client *as the user* (RLS still applies)
                                                    ├── check_and_record_ai_usage()  (quota RPC, fail-closed)
                                                    ├── Anthropic Claude  (text / structured JSON)
                                                    ├── Gemini Nano Banana (images) ─► upload to Storage
                                                    └── Veo (video, async)  ─► poll ─► upload to Storage
                                                    (service-role client ONLY in /api/conta)
```

Key design principles (keep these when extending):

1. **RLS is the authorization layer.** Server routes deliberately use a *user-scoped* Supabase
   client, not the service role, so a bug in a handler cannot cross tenants. The service role is
   used in exactly one place: account deletion (`src/routes/api/conta.ts`).
2. **Tenant = company.** Every business table has `company_id`, and every policy is
   `owns_company(company_id)`. Storage paths are `<company_id>/<file>` and policies check the
   first folder segment.
3. **All paid AI calls go through `/api/*`** and are metered by the quota RPC *before* the call.
   API keys never reach the browser.
4. **Persist storage paths, never long-lived URLs.** Client signs 1-hour URLs on render.
5. **Provider errors never leak to users.** `AiError.userMessage` (short, Portuguese) is returned;
   the upstream error is only logged.

### Request pipeline

- `src/server.ts` — custom server entry wrapping TanStack's handler: normalizes h3's swallowed SSR
  errors into an HTML error page and **applies security headers to every response**
  (`src/lib/security-headers.ts`: CSP, HSTS, nosniff, frame-ancestors none, …).
- `src/start.ts` — request middleware (error page + CSRF protection for server functions) and
  function middleware `attachSupabaseAuth` (attaches the bearer token to serverFn RPCs).
- `src/routes/_authenticated/route.tsx` — client-only (`ssr: false`) layout guard; redirects to
  `/auth` if `supabase.auth.getUser()` fails.

---

## 4. Repository layout

```
.github/workflows/ci.yml       typecheck + lint + build
docs/                          engineering plan, AI audit, content-engine notes
public/                        favicon, robots.txt
supabase/
  config.toml                  ⚠ stale project_id (§11)
  migrations/                  6 migrations, apply in filename order
src/
  server.ts                    server entry (security headers, SSR error normalization)
  start.ts                     TanStack Start middleware registration
  router.tsx                   router + QueryClient
  styles.css                   Tailwind 4 theme tokens (light/dark)
  routes/
    __root.tsx                 HTML shell, theme, 404/error boundaries
    index.tsx                  public landing page
    auth.tsx                   email/password sign-in / sign-up (+ LGPD consent)
    privacidade.tsx, termos.tsx
    _authenticated/            logged-in app (client-rendered)
      route.tsx                auth guard + AppShell
      painel.tsx               dashboard, company creation, onboarding progress
      diagnostico.tsx          questionnaire (AI-prefilled) → AI report
      marca.tsx                logo, AI palettes, fonts, tone
      trilha.tsx               gamified missions (XP/levels)
      conteudo.tsx             monthly plan + asset generation + video polling
      redes.tsx                social accounts (UI only; OAuth not built)
      metricas.tsx             metrics (placeholder; depends on publishing)
      conta.tsx                LGPD export + account deletion
      admin.tsx                read-only admin overview (role-gated)
    api/                       server routes (§8)
  lib/
    ai.server.ts               Claude + Gemini + Veo wrappers
    quota.server.ts            per-company AI quota limits
    content-engine/            image / carousel / storyboard / video pipeline
    supabase-request.server.ts user-scoped Supabase client from a Bearer token
    api.ts                     apiFetch() — attaches the session JWT
    company.ts                 React Query hooks for company/diagnostic/brand/progress/missions
    roles.ts                   useIsAdmin()
    consent.ts                 CONSENT_VERSION
    security-headers.ts, error-*.ts
  integrations/supabase/
    client.ts                  browser client (Lovable-generated, still used)
    client.server.ts           service-role client (lazy Proxy; import dynamically only)
    types.ts                   ⚠ hand-written DB types (§11)
    auth-middleware.ts, auth-attacher.ts, cron-auth.ts, previewAuthStorage.ts
  components/                  app-shell (nav), logo (placeholder SVG), onboarding-progress, ui/ (shadcn)
```

---

## 5. Local development

Requirements: Node 22+ and npm.

```bash
git clone https://github.com/Amgadmj/nukkia.git
cd nukkia
npm ci
cp .env.example .env      # fill in values (§6)
npm run dev               # http://localhost:8080
```

| Script | Does |
|---|---|
| `npm run dev` | Vite dev server on port **8080** (fixed in `vite.config.ts`) |
| `npm run build` | Production build (Nitro; `cloudflare-module` preset locally, `vercel` on Vercel, override with `NITRO_PRESET`) |
| `npm run preview` | Serve the build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint (flat config, `eslint.config.js`) |
| `npm run format` | Prettier |

**Pointing at a fresh database:** create a Supabase project, apply every file in
`supabase/migrations/` in filename order (SQL editor or `supabase db push` after
`supabase link --project-ref <ref>`), then set the Supabase vars in `.env`.

**Making yourself admin:**

```sql
insert into public.user_roles (user_id, role)
select id, 'admin' from auth.users where email = 'you@example.com'
on conflict do nothing;
```

**Regenerating DB types** (recommended, see §11):

```bash
npx supabase gen types typescript --project-id ihppmpnlpsvxqsqenjfl > src/integrations/supabase/types.ts
```

---

## 6. Environment variables

Template: [`.env.example`](.env.example). `.env` is git-ignored — **real secrets are not in the
repo**; they live in the local `.env` of the outgoing owner and in Vercel (production target).

| Variable | Side | Required | Used for |
|---|---|---|---|
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` / `VITE_SUPABASE_PROJECT_ID` | client (inlined at build) | yes | browser Supabase client |
| `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_PROJECT_ID` | server | yes | per-request user client in `/api/*`, SSR |
| `SUPABASE_SERVICE_ROLE_KEY` | server only | yes (for account deletion) | `DELETE /api/conta` |
| `ANTHROPIC_API_KEY` | server | yes | all text generation |
| `ANTHROPIC_TEXT_MODEL` | server | no | default `claude-sonnet-4-6` |
| `GEMINI_API_KEY` | server | yes | images + Veo |
| `GEMINI_IMAGE_MODEL` | server | no | default `gemini-3.1-flash-image` |
| `GEMINI_VIDEO_MODEL` | server | no | default `veo-3.1-generate-preview` (preview model — verify availability) |
| `FFMPEG_PATH` | server | no | override the ffmpeg binary for `/api/promo-video`; default resolves PATH, then the `ffmpeg-static` package |
| `CRON_SECRET` / `CRON_SECRET_PREVIOUS` | server | not yet | future scheduled-publish endpoint (`cron-auth.ts`, rotation-friendly) |
| `NITRO_PRESET` | build | no | force a deploy target |

**Vercel today:** the 9 required vars are set for the **Production** target only. Preview
deployments (PR branches) have **no env vars**, so AI/DB features won't work on preview URLs.
`SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY` and `GEMINI_API_KEY` are flagged by Vercel as
"readable-secret" — re-add them as **Sensitive** variables.

> Rotate all three secret keys (Supabase service role, Anthropic, Gemini) as part of the handover.

---

## 7. Database (Supabase / Postgres)

### Migrations (apply in order)

| File | Purpose |
|---|---|
| `20260916201550_…sql` | Base schema: roles, profiles, companies, diagnostics, brand_kits, missions, user_progress, content_plans, content_items, social_accounts, scheduled_posts, metrics_snapshots; `has_role`, `owns_company`, signup trigger |
| `20260916201608_…sql` | Locks down `EXECUTE` on helper functions |
| `20260916202457_…sql` | Storage RLS policies (superseded by P0 #7) |
| `20260916210000_p0_data_integrity.sql` | `UNIQUE(brand_kits.company_id)`, CHECK constraints on status/format, length caps, FK indexes, `updated_at` triggers, **creates storage buckets**, UUID-safe storage policies, composite same-company FKs |
| `20260916210100_p1_security_and_features.sql` | OAuth tokens moved to server-only `social_account_secrets`; revokes client writes on scored data; `complete_mission()` RPC; `ai_usage` + `check_and_record_ai_usage()`; `companies.research`; content-engine columns; LGPD consent columns |
| `20260917000000_gemini_video_jobs.sql` | `content_items.video_operation / video_path / video_error` |

### Tables

| Table | Key columns | Client access (authenticated) |
|---|---|---|
| `user_roles` | `user_id`, `role app_role ('admin'\|'client')` | read own |
| `profiles` | `id = auth.users.id`, email, `consent_version`, `consent_accepted_at` | self read/write |
| `companies` | `owner_id`, name, segment, socials, `onboarding_step` (`diagnostic→brand→missions→content`), `research jsonb` (AI draft, ≤20 KB) | owner full CRUD |
| `diagnostics` | `answers jsonb`, `report jsonb`, `score 0–100`, `status draft\|ready` | select/insert only (immutable) |
| `brand_kits` | one per company; `logo_url`, `options jsonb` (AI palettes), `palette`, `fonts`, `tone` | full CRUD |
| `missions` | title, category, `xp`, `order_index`, `status pending\|done` | select/insert only; completion via RPC |
| `user_progress` | `xp`, `level` (created by trigger on company insert) | select only |
| `content_plans` | `UNIQUE(company_id, month)`, `frequency jsonb` | full CRUD |
| `content_items` | scheduled_for, channel, `format post\|carrossel\|reels\|stories\|artigo\|arte`, copy fields, `image_path`, `slides jsonb [{path,order}]`, `storyboard jsonb`, `video_operation`, `video_path`, `video_error` | full CRUD |
| `social_accounts` | provider, username, status (no tokens) | full CRUD |
| `social_account_secrets` | access/refresh tokens | **no client grant** — service role only |
| `scheduled_posts` | provider, scheduled_for, status, external_post_id | full CRUD (unused yet) |
| `metrics_snapshots` | `(company, provider, captured_for)` unique, `metrics jsonb` | select only (unused yet) |
| `ai_usage` | `(company_id, kind, created_at)` ledger | select only |

### Functions & triggers

- `has_role(uid, role)`, `owns_company(company_id)`, `owns_company_folder(text)` — SECURITY
  DEFINER helpers used by every policy. `owns_company` returns true for admins on **any** company.
- `handle_new_user()` (on `auth.users` insert) — creates `profiles` row (+ consent) and `client` role.
- `handle_new_company()` (on `companies` insert) — seeds `user_progress`.
- `complete_mission(mission_id)` — atomic, idempotent; `level = floor(xp/500)+1`.
- `check_and_record_ai_usage(company, kind, daily, monthly)` — advisory-locked per company,
  rolling 1-day / 30-day windows; returns false over quota.

### Storage buckets (private)

| Bucket | Limit | MIME whitelist | Contents |
|---|---|---|---|
| `brand-assets` | 5 MB | png, jpeg, webp | logos: `<company_id>/logo-<ts>-<name>` |
| `content-media` | 10 MB | png, jpeg, webp ⚠ | generated images `<company_id>/<item>-<slide>-<ts>.png`, videos `…mp4` (**blocked**, §11) |

---

## 8. Server API (`/api/*`)

All handlers live in `src/routes/api/*.ts` as TanStack server routes. Common contract:

- Auth: `Authorization: Bearer <supabase access token>` (sent by `apiFetch()` in `src/lib/api.ts`).
  Missing/malformed → `401`.
- Body validated with Zod v3 → `400` on failure.
- Ownership: rows are loaded through the user-scoped client (RLS) and checked against the given
  `companyId` → `404` if not visible.
- Quota exceeded → `429` (plain-text Portuguese message).
- AI/provider failure → `502` with `AiError.userMessage`.

| Method & path | Body | Quota kind(s) | What it does |
|---|---|---|---|
| `POST /api/pesquisa-empresa` | `{companyId}` | `pesquisa_empresa` | Claude drafts likely diagnostic answers from name/segment/handles (**does not fetch the URLs**), saves to `companies.research`. Fired in background after company creation. |
| `POST /api/diagnostico` | `{companyId, answers{…}}` | `diagnostico` | Claude report (summary, strengths, opportunities, recommendations, pillars, score, missions). Inserts `diagnostics`; seeds up to 8 `missions` once per company. |
| `POST /api/paleta` | `{companyId}` | `paleta` | Claude proposes 3 palettes × 4 hex colors; stored in `brand_kits.options`. |
| `POST /api/plano` | `{companyId, postsPorSemana?}` | `plano` | Requires a brand kit (`409` otherwise). Claude plans ≤12 posts for **next month**; idempotent upsert of `content_plans` + replace its `content_items`. |
| `POST /api/arte` | `{companyId, contentItemId}` | `arte` / `carrossel` / `video_storyboard` + `video_render` | Generates the asset for one item by format (see §9). |
| `POST /api/video-status` | `{companyId, contentItemId}` | — | Polls the Veo operation; on completion downloads the MP4 and uploads to storage. Client polls every 8 s. |
| `GET /api/exportar-dados` | — | — | LGPD portability: JSON of profile, companies and all company rows. |
| `DELETE /api/conta` | — | — | LGPD erasure: purges both buckets per company (service role), then `auth.admin.deleteUser` → cascades all rows. |

### Quotas (`src/lib/quota.server.ts`, tune there — no migration needed)

| Kind | Daily | 30-day |
|---|---|---|
| `diagnostico` | 10 | 20 |
| `plano` | 10 | 10 |
| `arte` | 20 | 150 |
| `carrossel` | 20 | 60 |
| `video_storyboard` | 10 | 60 |
| `video_render` | 5 | 20 |
| `pesquisa_empresa` | 15 | 60 |
| `paleta` | 15 | 60 |

Limits are global (no plan tiers yet). Quota check **fails closed** if the RPC errors.

---

## 9. AI layer

All provider code is in [`src/lib/ai.server.ts`](src/lib/ai.server.ts); the generation pipeline
is in [`src/lib/content-engine/`](src/lib/content-engine/).

### Text — Claude

- `generateJson({instructions, input, schema})` → `client.messages.parse()` with
  `output_config.format = zodOutputFormat(schema)` (native structured outputs). Returns an
  already-validated, typed object. `max_tokens` 16000.
- **Schemas passed to `generateJson` must be built with `import { z } from "zod/v4"`**; the SDK
  helper is typed against v4 internals. Request-body validation elsewhere uses plain `"zod"` (v3
  API). Both come from the same `zod@3.25` package. Don't mix them up.
- Error mapping: refusal / missing parse → `AiError`; `AuthenticationError`, `RateLimitError`,
  `APIError` mapped to generic Portuguese messages. No retries on the Claude path (SDK defaults apply).
- Call sites: `pesquisa-empresa`, `diagnostico`, `paleta`, `plano`, carousel outline and video
  storyboard in `content-engine/index.ts`.
- Prompts are **inline in each route** (pt-BR). Compliance language ("no outcome promises",
  "respect CFM/OAB") is duplicated per prompt, not centralized — update every site if rules change.

### Images — Gemini Nano Banana

- `generateImageBase64(prompt)` → `POST /v1beta/models/{model}:generateContent` with
  `responseModalities: ["IMAGE"]`; 45 s timeout; 1 retry on 429/5xx.
- Text-to-image only. Brand consistency comes from `buildStyleAnchor()`
  (`content-engine/style-anchor.ts`): a text preamble with company name, segment, **palette hex
  codes**, tone, and style rules, prepended to every image/video prompt. The uploaded logo is
  **not** used in generation.

### Video — Veo

- `startVideoGeneration()` → `:predictLongRunning` (9:16) returns an operation name, stored in
  `content_items.video_operation`.
- `checkVideoOperation()` polls; `downloadVideoBytes()` fetches the result URI (API key as query
  param, per Google docs); uploaded to `content-media`.
- The storyboard (2–6 shots) is collapsed into **one** Veo prompt — no multi-clip stitching.
- Polling is client-driven (`useVideoPolling` in `conteudo.tsx`). If nobody opens the page the
  job stays pending; Google-hosted outputs expire (~2 days), so an abandoned job can be lost.

### `/api/arte` branches

| Format | Pipeline | Quota units |
|---|---|---|
| `post`, `stories`, `artigo`, `arte` | `generateStaticArt` → 1 image → `image_path` | 1 × `arte` |
| `carrossel` | Claude outline (4–6 slides) → one image per slide, **sequential** → `slides[]`, cover in `image_path` | 1 × `carrossel` |
| `reels` | Claude storyboard (saved even if render quota is exhausted) → Veo start | 1 × `video_storyboard` + 1 × `video_render` |

Worst-case latency: a 6-slide carousel = 1 Claude call + 6 sequential image calls (up to 45 s
each + retry). Check your function timeout on Vercel (§13).

---

## 10. Frontend

- **Language:** all UI copy is Brazilian Portuguese; route names are Portuguese.
- **User journey / onboarding** (`companies.onboarding_step`, rendered by
  `components/onboarding-progress.tsx` on `/painel`):
  `/auth` → `/painel` (create company; background research) → `/diagnostico` (step
  `diagnostic→brand`) → `/marca` (`brand→missions`) → `/trilha` (first mission done:
  `missions→content`) → `/conteudo`.
- **Navigation:** `components/app-shell.tsx` — 8-item top nav on desktop, 5-item bottom tab bar
  on mobile; `/admin` link only for admins (`useIsAdmin`). Cache is cleared on sign-out/session change.
- **Data:** React Query hooks in `lib/company.ts`; direct `supabase.from(...)` for simple CRUD;
  `apiFetch()` for anything that costs money.
- **Media display:** `useSignedUrl` / `useCarouselUrls` in `conteudo.tsx` sign 1-hour URLs from
  stored paths.
- **Theme:** light/dark via `components/theme-provider.tsx` (no-flash init script in `__root.tsx`);
  tokens in `styles.css`. `--primary` was darkened for WCAG AA.
- **Logo:** `components/nukkia-logo.tsx` is a **placeholder SVG** — replace with the real mark.
- **Admin (`/admin`):** read-only table of companies, owner email, latest score, AI call count.

---

## 11. Known issues & tech debt (read this)

Found during the handover review. Ordered by priority.

### P0 — broken today

1. **Veo video can never be saved.** `content-media` only allows `image/png|jpeg|webp` with a
   10 MB cap (migration `…210000_p0_data_integrity.sql` §6), but `uploadGeneratedVideo()` uploads
   `video/mp4`. Every completed render will fail at upload and surface as a 502 on
   `/api/video-status` — after the Veo cost is already spent. Fix: new migration adding
   `video/mp4` and raising `file_size_limit` (or a dedicated video bucket). *(Verify against the
   live bucket settings — they may have been changed in the dashboard.)*
2. **CI is red, and doesn't run on `master` anyway.** `npm run lint` fails with Prettier
   formatting errors (single quotes / missing semicolons) in `src/integrations/supabase/*.ts`
   (Lovable-generated), plus `lib/quota.server.ts`, `routes/api/paleta.ts`,
   `routes/_authenticated/marca.tsx`, `routes/_authenticated/redes.tsx`. The last CI run (PR #1,
   run `35627173519`) failed on exactly this. Separately, `ci.yml` triggers on
   `push: branches: [main]` but the default branch is `master`, so only PRs are checked.
   Fix: `npx prettier --write src` then change the trigger to `master`.
   *Windows note:* with `core.autocrlf=true`, a local checkout also reports hundreds of
   `Delete ␍` errors — add `"endOfLine": "auto"` to `.prettierrc` or a `.gitattributes` with
   `* text=auto eol=lf`.

### P1 — wrong / will bite soon

3. **`supabase/config.toml` has `project_id = "zvnkjiqdqssztveevyhc"`** (the old Lovable Cloud
   project). The live project is `ihppmpnlpsvxqsqenjfl`. Any `supabase` CLI command will target
   the wrong project.
4. **Logo URL expires after 7 days.** `/marca` stores a 7-day signed URL in `brand_kits.logo_url`
   instead of the storage path — the same bug already fixed for content images. Store the path and
   sign on read.
5. **`src/integrations/supabase/types.ts` is hand-written.** Regenerate from the live schema (§5).
6. **Vercel preview deployments have no env vars** and secrets aren't marked Sensitive (§6).
7. **Production is behind Vercel SSO** (`ssoProtection: all_except_custom_domains`) and there is
   no custom domain — the public can't reach `nukkia.vercel.app`. Attach a custom domain or
   change protection before launch.
8. **Admins have broad write power with no MFA.** `owns_company()` is true for admins on every
   company, so an admin session can delete any company (and cascade its data) via the REST API.
   Consider requiring `aal2` for the admin branch of the policies.
9. **Account deletion purges at most 100 files per bucket per company** (`storage.list()` default
   limit, no pagination) — orphaned files remain for heavy users. Paginate.

### P2 — debt

10. **No tests.** Highest-value first targets: quota RPC, `complete_mission`, RLS policies
    (pgTAP), Veo polling state machine.
11. `docs/CONTENT_ENGINE.md` still describes the video renderer as an unconfigured stub and a
    7-day URL cap — both superseded (see `docs/ENGINEERING_PLAN.md`). `docs/AI_AUDIT.md` refers
    to `main`; the branch is `master`.
12. `check_and_record_ai_usage` takes limits as arguments and is executable by `authenticated`,
    so a user can call it directly. This can only *consume* their own quota (no cost bypass —
    AI calls happen server-side after the check), but the limits would ideally live server-side.
13. Admin AI-call counts read the whole `ai_usage` table client-side (Supabase default 1000-row
    cap) — counts will be wrong at scale; replace with an aggregate view/RPC.
14. Lovable leftovers: auto-generated Supabase files still say "Connect Supabase in Lovable
    Cloud" in errors; `previewAuthStorage.ts` is inert outside Lovable; `.lovable/` folder;
    `auth-middleware.ts` (`requireSupabaseAuth`) is currently unused.
15. `/api/pesquisa-empresa` does not actually read the company's website/Instagram — it infers
    from the name only. Real grounding requires an SSRF-hardened fetcher first.
16. Compliance prompts duplicated per call site (§9).
17. `veo-3.1-generate-preview` is a preview model — pin/verify before relying on it.
18. No error monitoring (Sentry etc.) — `lib/error-reporting.ts` only logs to console.

---

## 12. Security & LGPD posture

- **AuthN:** Supabase email/password only (Google OAuth removed). Session in `localStorage`.
- **AuthZ:** Postgres RLS on every table; SECURITY DEFINER helpers with `search_path` pinned and
  `EXECUTE` revoked from `anon`/`PUBLIC`.
- **Trust-sensitive data is server-computed:** XP/levels (RPC), diagnostic score (immutable to
  clients), metrics (no client writes).
- **Secrets:** OAuth tokens isolated in `social_account_secrets` (no client grant). Service role
  only in `/api/conta`, loaded via dynamic import so it never enters the client bundle.
- **Headers:** CSP, HSTS (preload), nosniff, `frame-ancestors 'none'`, strict referrer,
  permissions policy — applied in `src/server.ts`. CSP allows `'unsafe-inline'` scripts (theme
  init script); tighten with nonces if feasible.
- **CSRF:** TanStack CSRF middleware on server functions; `/api/*` uses bearer tokens (not cookies).
- **Cost abuse:** per-company quotas, input length caps (Zod + DB CHECKs), fail-closed.
- **LGPD:** consent version + timestamp captured at signup (`lib/consent.ts`, bump on policy
  change); self-serve export (`/api/exportar-dados`) and deletion (`/api/conta`); privacy policy
  and terms pages (`/privacidade`, `/termos`) — have them reviewed by counsel.

---

## 13. Deployment & infrastructure

| Item | Value |
|---|---|
| Host | **Vercel**, project `nukkia`, team `amgadmjs-projects` (`team_12rziKj0SEAzKdAKfzG8S7mn`) |
| Git integration | GitHub `Amgadmj/nukkia`; `master` → Production, other branches → Preview |
| Framework preset | `tanstack-start`, Node 24.x |
| Build | `vite build` with Nitro `vercel` preset (auto via `VERCEL=1`) |
| Domains | `nukkia.vercel.app` (+ team/branch aliases). No custom domain. |
| Protection | Vercel SSO on all deployments except custom domains (§11 #7) |
| Latest prod deploy | `7ff77e2` (PR #1 merge), state READY |
| Database | Supabase `ihppmpnlpsvxqsqenjfl` (region/plan: check dashboard) |
| Alt target | Code still builds for Cloudflare Workers (`cloudflare-module` preset; `.wrangler/` is ignored) |

Operational notes:
- Check the Vercel function **max duration** for `/api/arte` (carousels can take minutes of
  sequential image calls) and `/api/video-status` (downloads up to 120 s).
- Rollback: Vercel dashboard → Deployments → promote a previous READY deployment.
- Migrations are **not** applied by CI/CD — apply manually to Supabase before deploying code that
  depends on them.
- Monitor spend on the Anthropic console and Google AI Studio (Veo is the expensive path).

---

## 14. CI

`.github/workflows/ci.yml` — Ubuntu, Node 22, `npm ci` → `typecheck` → `lint` → `build`
(placeholder Supabase env vars; no secrets needed to build). Runs on pull requests, and on pushes
to `main` only (**should be `master`**, §11 #2).

Verified locally on 2026-09-22 (Node 26, npm 11): `typecheck` passes, `build` passes
(Cloudflare preset locally; Vercel builds the same code successfully — latest prod deploy READY),
`lint` fails on formatting (§11 #2).

---

## 15. Access & accounts to transfer

Checklist for the handover (owner: outgoing founder):

- [ ] GitHub: admin on `Amgadmj/nukkia` (or transfer the repo to an org)
- [ ] Vercel: member/owner on team `amgadmjs-projects`, project `nukkia`
- [ ] Supabase: owner on the organization holding project `ihppmpnlpsvxqsqenjfl`
- [ ] Anthropic Console: org access + billing (then rotate `ANTHROPIC_API_KEY`)
- [ ] Google AI Studio / GCP project with Generative Language API (then rotate `GEMINI_API_KEY`)
- [ ] Rotate `SUPABASE_SERVICE_ROLE_KEY`; update Vercel + local `.env`
- [ ] Grant the new CTO the `admin` role in `user_roles` (§5)
- [ ] Disconnect Lovable's GitHub integration if still connected (it can push to `master`)
- [ ] Domain registrar (if a domain was bought) + DNS

---

## 16. Roadmap / not built yet

- Instagram / LinkedIn OAuth, scheduled publishing (`scheduled_posts` + cron via `cron-auth.ts`)
  and the metrics collector (`metrics_snapshots`, `/metricas`) — schema exists, no code.
- Plan tiers / billing (quotas are one global set today).
- Real web grounding for company research (needs SSRF-safe fetcher).
- Reference-image conditioning (use the actual logo / a style image instead of the text anchor).
- Multi-shot video (stitch per-shot clips instead of one collapsed Veo prompt).
- Server-side video polling (cron) so renders complete without the user on the page.
- Test suite (Vitest + pgTAP), error monitoring, real logo/brand assets.

---

## 17. History

| Date | Commit | Change |
|---|---|---|
| 2026-09-16 | `8ed4beb` | Baseline import of the Lovable export |
| 2026-09-16 | `57c0753` | P0/P1: data integrity, security hardening, LGPD basics, AI onboarding auto-fill, content engine |
| 2026-09-16 | `df11ef1` | Migration to Gemini (text/image/Veo), own Supabase, full Lovable exit |
| 2026-09-16 | `bc81953` | CI workflow |
| 2026-09-17 | `39b62c3` | Text/diagnostic generation moved to Claude (Sonnet 4.6) with structured outputs |
| 2026-09-17 | `a7bcb1c` | Auto-select Vercel Nitro preset |
| 2026-09-19 | `5fd7330`, `b8d40b7` | AI audit doc; AI-generated brand palettes (`/api/paleta`) — PR #1 |
| 2026-09-22 | — | This handover README |
