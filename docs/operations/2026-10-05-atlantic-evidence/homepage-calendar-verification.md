# Atlantic homepage and calendar qualification — 5 October 2026

Candidate `c50965d20fde50c3b7a52575b1567a073554296eb6a4e218c3ce63409be02b1c`. Exact source and test hashes: [manifest](homepage-calendar-source.json). Historical evidence manifests remain unchanged.

## Implemented
- Approved `/proposta` design is now `/`; `/proposta` redirects to `/`. Previous homepage preserved in `docs/design/2026-10-05-homepage-before-atlantic.tsx.txt`.
- White light-theme surfaces with Atlantic teal, cyan and blue accents in navigation, creation cards and calendar. Customer artwork remains driven by customer identity.
- Month grid with scheduled-content bubbles; daily agenda, previous/next/today and keyboard arrows; explicit exact-version planning, time, IANA timezone and channel; date-only plans remain compatible.
- Six generic approaches are a phase between Briefing and Editor, with existing approach URLs retained. Health scene templates remain their own workflow.

## Actual browser evidence
Synthetic local Clínica Atlantic QA only, existing port 8082. No production service or record changed.
- Homepage redirect and content observed at `/`; desktop and 390px screenshots. 390px document scroll width equals viewport.
- Created a synthetic Health script, saved it, duplicated the saved item, planned two items on October 15 at 10:45 Instagram and 14:30 WhatsApp. Time/channel/version appeared in day agenda and month bubbles and survived reload.
- Day previous/next; keyboard arrows October 15→16→15; empty-day state observed.
- Desktop populated calendar in both themes. Separate empty local workspace at 390px in both themes; day controls fit, month grid scroll is contained, document width 390px. Populated mobile state was not browser-qualified in this pass.
- Brief → six approach controls observed, all three new choices were selected. Identity readiness correctly prevented unconfirmed output in this fixture; this pass does not claim a new generic editor qualification.
- Screenshots: `homepage-installed.jpg`, `homepage-installed-390.jpg`, `calendar-month-bubbles.jpg`, `calendar-day-dark.jpg`, `calendar-month-390-empty.jpg`, `calendar-day-390-empty.jpg`, `calendar-day-390-light-empty.jpg`, `six-approaches-phase.jpg`.

## Automated verification
- Full suite: **601 passed, 0 failures**. Typecheck and production build: pass.
- Scoped lint on the 12 changed implementation modules: clean. Existing full-repository lint backlog remains separately recorded as 99 errors / 9 warnings; not rerun or resolved here.
- Regressions cover time-input persistence, adjacent-month bubble selection, cancellation, exact saved snapshots, local date math, invalid clocks/zones, archive exclusion, duplicate independence and six approach schema compatibility.
- Intermediate test failure: two new UI tests initially omitted required fixture `answers`; corrected fixture, final suite passes.

## Limits
Planning is a saved intention, not an activated sending service. Live authenticated persistence, independent-device recovery, stale-session/offline behavior and denied cross-workspace requests remain unqualified. No production migrations or providers activated. This milestone does not upgrade all 18 reference screens to fully qualified; use the prior audit alongside this incremental record.
