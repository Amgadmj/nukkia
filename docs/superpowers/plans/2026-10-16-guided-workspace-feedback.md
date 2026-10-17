# Guided workspace feedback implementation plan

**Goal:** Replace the overloaded first-touch workspace with a guided Brain → identity → channels → monthly plan → review → approval → intended calendar sequence.

**Architecture:** Reuse the existing shared demo/authenticated workspace components and persisted state. Keep human confirmation, account isolation, source attribution, approval invalidation and real XP derivation. No new dependencies, hosted deployment or provider activation.

**Scope source:** Operator feedback of 2026-10-16, with explicit instruction to implement work that does not require their accounts or credentials. Work proceeds inline, with independent calendar and identity/Brandbook workers.

## Acceptance slices

- [x] Dashboard: first visible action is Concluir diagnóstico da marca; no drafts, objectives, priorities, results or in-progress panels. Brain navigation immediately follows panel/trail; header displays actual earned XP.
- [x] Brain editor: contrasted fields/tabs, bounded required-stage navigation, one Gerar análise action, report → identity continuation, target-audience enrichment, optional history, explained objections, visible chapter completion. Hide early hypotheses without deleting stored hypotheses.
- [x] Journey/content: identity before channels, chronological checklist with observed completion only; monthly-plan-first entry, briefing preview, pause readiness-screen entry.
- [x] Identity/Brandbook (worker): evidence-anchored palette + two close variants, optional contextual story, clearer completion, no Inspirations/piece-only controls, code-native branded application examples. Automated HTML assertions qualify content, not final print layout.
- [x] Calendar (worker): drag saved plans between dates through existing persistence callback, preserved version/channel/timezone, honest errors, compact layout. Automated domain/UI tests; actual browser drag remains unqualified.
- [x] Existing upload capabilities: expose user-owned photos/video/art references where existing secure storage supports them. Do not fabricate video upload/storage if absent. Implementation and validation tests complete; live authenticated storage remains unqualified.
- [x] Verification: focused red/green regressions; full npm run check on Node 24.21.0 passed 814 tests, typecheck, lint (11 warnings / 0 errors) and production build. Browser synthetic flow, saved state, desktop/mobile and themes checked; unverified hosted/provider behavior recorded explicitly below.

## External/future boundaries

SMTP delivery requires provider credentials, verified sender/domain and DNS ownership; prepare repository-owned guidance only, never sign up or alter live authentication settings. Instagram feed preview is future scope as requested. Social links are not proof of social content extraction. No fake completion, XP, published scheduling or generated medical facts.

## Additional accepted edits

Implemented with regression tests: centered multi-select intent cards, selection-order priorities, Explicar serviços / Fortalecer Marca labels, no first-focus selector or duplicate selected-topic summary, important-detail copy, separate persisted preferred contact channel, aggregate specialty limit without draft loss, ordered intents preserved through piece preparation, public contact reconciliation in exportable Markdown, and source-based LGPD inventory. Intent selection does not confirm an offer.

## Browser evidence

Chrome reconnected after the initial interruption. Synthetic clinic checks covered desktop/narrow intent cards, keyboard focus, reload recovery, light/dark presentation, diagnosis-first dashboard, blocked sidebar exit with incomplete diagnostic, completed diagnostic summary → identity, explicit identity confirmation and real XP updates. New browser tabs use separate session recovery; no real clinic ownership was confirmed. Hosted storage, final Brandbook print, actual calendar drag and SMTP remain separate acceptance boundaries.
