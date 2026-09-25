# Command center implementation plan

Execution: user explicitly requested implementation now, with feedback after seeing the result. No further design approval pause. Work in the existing Nukkia checkout; preserve unrelated changes.

Spec: ../specs/2026-09-25-command-center-design.md

## Constraints

No push/deploy, remote migration, external AI generation or fabricated OAuth/metrics. Preserve saved brand kit, creative drafts, answers and account isolation. Reuse existing providers and schemas.

## Work and verification

- [x] Shared strategy preferences, essential diagnostic progress and priority rules in `src/lib/marketing-workspace.ts` and `src/lib/quick-start.ts`; behavioral tests in `tests/command-center.test.ts`. RED before implementation, then GREEN.
- [x] In-workspace context/diagnostic editor with explicit return destination, preserved answers and reference confirmation. New `src/components/workspace-context-editor.tsx`; route adapters in demo, painel, diagnostico, conteudo and trilha. Behavior tests plus browser forward/back/reload.
- [x] Replace dashboard and journey views in `src/components/marketing-views.tsx`; targeted styles in `src/workspace.css`. Existing snapshots remain available, no first-piece promise. Test priorities, completed states and real/absent metric rendering.
- [x] Identity sidecar: consolidate authenticated marca route, retain explicit kit application and piece override review. Owned by independent agent; tests in its own files.
- [x] Save-status sidecar: compact disclosure preserving retry/conflict/memory-only risk; owned by independent agent in marketing-provider and separate styles/tests.
- [x] Channel priority and results adapters, without introducing OAuth. Show unavailable connection status accurately.
- [x] Run full `npm run test:onboarding`, typecheck, changed-scope lint, build. Fresh code review and actual browser walkthrough, desktop/mobile and themes.

## Review focus

Legacy state lacks strategy preferences: defaults must not reset data. Direct editor link/return cannot restart onboarding or redirect externally. Edits must invalidate approval only where relevant. Missing remote persistence must stay visible/recoverable. Kit changes must never overwrite an approved creative silently.

## Ledger

- Planning: main implements dashboard/diagnostic/routing; identity and save-status assigned disjoint scopes for parallel work. User has asked for the visible changes now; no additional stage approval is requested.
- Existing workspace has extensive uncommitted user work. No blanket staging, revert, reset or implementation commit.
- Browser: authenticated dashboard→diagnostic→dashboard and content→identity preserved origin. Isolated demo: filled essentials, selected KPI/channel, saved, reloaded, checked green progress/XP, then content→context→content without restarting onboarding. Actual account answers were not edited for QA.
- Responsive QA: 390 px, light/dark themes, mobile menu, keyboard focus and no horizontal overflow; desktop checked with actual Movitta data.
- Review corrections: preserve user-corrected suggestions after URL replacement; keep old diagnostic drafts from overriding canonical answers; expose first report generation as an explicit action; project edited/confirmed references into channels; preserve earned XP without retaining approval of edited pieces.
- Runtime limitations: remote workspace save remains unavailable. Compact status discloses that closing the tab may lose its draft. Brand story migration unavailable. No OAuth, AI generation, uploads, remote migrations, push or deployment performed.
- Deferred refinements: per-field URL focus; automatic kit defaulting for a new piece. Current section/chapter return and explicit kit application remain functional.
- Final verification: 380/380 tests passed, typecheck and changed-scope ESLint passed, `NITRO_PRESET=vercel npm run build` passed. Logs: `/tmp/nukkia-command-center-final-tests.log`, `/tmp/nukkia-command-center-build-final.log`.
- Browser uncovered duplicate sibling React keys in the identity route; distinct `kit:` and `piece:` keys fixed duplication. Regression RED/GREEN and repeated panel→identity→panel navigation confirmed one form. Actual panel left open at `http://localhost:8081/painel`; temporary synthetic QA tab closed.
