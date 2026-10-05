# Nukkia Health: local prototype handoff

The product name remains **Nukkia**. The later
[studio visibility fix](2026-10-02-studio-visibility-fix.md) supersedes the
initial navigation below; the demo now opens the studio directly.

Implemented in the existing Nukkia app on October 2, 2026, from the supplied
38-page Health v3 blueprint and its companion catalog. Brazil and medicine are
the operator-confirmed launch scope. This is the first synthetic-first stage,
not the complete production blueprint.

## Open and use

- Local app: http://127.0.0.1:8082/conteudo?aba=saude. Sign in, then use
  Content → Estúdio de saúde; drafts use the existing company workspace.
- Fictional demo: http://127.0.0.1:8082/demo?passo=6&aba=conteudo. Choose
  Estúdio de saúde; demo drafts use the existing session storage.
- Local application dashboard: http://127.0.0.1:8787/. Its application links
  and endpoint observations do not prove worker or production readiness.

Choose a proposed video template, duration and frame shape. Generate the three
fictional example approaches, choose one, edit scenes and play its text-card
animatic. The examples are deterministic and do not call an AI provider. Invalid
timing, excessive text, or an unmeasured/overflowing frame pauses playback and
requires correction. Undo/redo preserves up to 20 draft changes.

To restart from this repository:

```sh
npm run dev -- --host 127.0.0.1 --port 8082 --strictPort
```

Press Ctrl+C in the preview terminal to stop it. This is an owned foreground
development server on the MacBook, not a startup service, public site, Mini
deployment or Studio deployment. Do not change ports without updating the local
dashboard descriptor and probe.

## What exists

| Item                                   | Delivered behavior or measured result                                                               |
| -------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Proposed catalog                       | 24 videos, 12 images, 6 carousels and 6 email drafts: 48 entries                                    |
| Proposed video matrix                  | 330 baseline presets; 156 beta presets; 13 twin-eligible structures                                 |
| Qualified production presets           | Unmeasured; catalog counts are specification counts                                                 |
| Draft editor                           | 1–12 scenes; script, heading, timing, add, duplicate, split, merge, reorder, delete                 |
| Local preview                          | Text cards, play/pause/restart/seek, three frame ratios, timing and fit checks                      |
| Persistence                            | Existing owner/company workspace, cloud revision conflict checks and revisioned undo/redo           |
| Health production                      | No production API, provider render, avatar enrollment, medical approval, export or publication path |
| Cost / automation / production quality | Unmeasured; no synthetic success metrics                                                            |

Images, carousels and email entries remain planned. The video implementation is
a local text-card prototype, not a qualified renderer for every catalog preset.
Client drafts cannot grant consent, verify a credential, activate policy or
approve release. The existing generic marketing pipeline is not qualified for
regulated Health production.

## Verification and review

- `npm run test:onboarding`: **458 passed**, zero failures, skips or cancellations.
  The baseline had 446 tests; 12 Health domain/UI tests were added.
- `npm run typecheck`, `npm run build`, changed-file ESLint and `git diff --check`:
  passed. Full repository lint still has **99 pre-existing errors** in unchanged
  Supabase authentication files; those files were checked against HEAD.
- Independent review covered the ten implementation files, including untracked
  additions. Important findings were corrected; none remained at handoff.
- HTTP checks at **2026-10-02 04:22:15 UTC**: both application routes above
  returned 200 HTML. PID 76307 listened on **127.0.0.1:8082** at that observation.
  An HTML response does not prove client interaction or authenticated rendering.
- Actual browser layout, keyboard focus and playback visual checks remain
  outstanding. Automatic approval review blocked native browser inspection
  because unrelated private browser content was present. No visual QA claim is
  made; domain tests, controlled UI-handler tests and HTTP checks are separate.

Reviewed base/HEAD: `5f1a1dab06e003b47614d0597bd8279db2b391c3` on
`codex/nukkia-onboarding`. Reviewed ten-file aggregate SHA-256:
`c5eecf920bc40257d6dfd02affa72828196143de0215f9d8ee9a065142942627`
(sorted relative path + NUL + file bytes + NUL). Scope is documented in
[the implementation plan](../plans/2026-10-02-health-studio-v3.md).
No commit, push, deployment or remote database migration was performed.

## Explain the remaining choices simply

An avatar provider is a company that makes a video puppet look and sound like
the real doctor. The doctor must give permission to use their face and,
separately, their voice. The provider also needs to support the required
ownership, deletion and revocation behavior.

Professional reviewers are real people who check the medical facts and the
advertising rules before anything leaves Nukkia. An animated worker can help
prepare a draft; it cannot serve as the accountable professional reviewer.
No provider/account or accountable reviewers have been designated yet.

## Remaining production sequence

1. Server-owned identity, current credentials and reviewed Brazil/medicine
   policy activation; select accountable professional reviewers.
2. Input quarantine and evidence/claims review, including rights and source
   applicability. Do not submit patient data to this prototype.
3. Canonical confirmed briefs and provenance for genuinely generated options.
4. Fenced jobs, idempotency, quota/cost reservations and reconciliation before
   paid rendering; client revision counters are not job authority.
5. Owned-avatar provider/account, separate face/voice consent and revocation.
6. Qualified media rendering and three-option production previews.
7. Exact immutable package review and authenticated, revocation-aware delivery;
   the initial approved export remains manual.
8. Non-video production/planning, K01–K72 instrumentation and observed beta
   qualification before catalog expansion.

The blueprint's proposed QA workloads and automation targets are not observed
results. The policy references in the plan are review inputs, not an activated
rule pack or legal permission for a digital twin.
