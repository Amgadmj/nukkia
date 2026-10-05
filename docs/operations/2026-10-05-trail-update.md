# Section titles and interactive trail — 5 October 2026

Implemented the operator's supplied trail reference as a connected, alternating path in Nukkia's own visual system. Five circular stage controls replace the expanded task-card stack. All start collapsed; selecting a dot reveals two explanatory bullets and the existing task destinations below that dot. Selecting the same dot closes it. Completion and XP continue to derive from saved data; selection never writes progress or clears a draft. No artificial locks, stars or achievements were added.

The shared top bar now follows the selected sidebar section, with the brand remaining in the profile. Removed the repeated home brand/title block and the repeated trail title inside the canvas. Removed the demo sidebar's `Recomeçar demonstração` action, including its catalog-clearing handler. Existing onboarding reset functionality outside that sidebar is unchanged. No saved data, assets or prior work was removed.

Branch `codex/nukkia-onboarding`, base `5f1a1dab06e003b47614d0597bd8279db2b391c3`; exact current source candidate **`46f8df957a5621ca4b803195672f5bd1730f23105033ae4f850c6874e62c12e4`**. [Source identity and six-file delta](2026-10-05-trail-evidence/source-manifest.json), [evidence hashes](2026-10-05-trail-evidence/evidence-manifest.json). The preceding candidate was checked byte-for-byte before editing. No new server: existing localhost 8082 remains in use. Earlier journey/audit evidence retains its original source identity.

## Success and observations

- Sidebar navigation `Minha trilha` → `Meu painel` → `Minha trilha` visibly changes the top heading; home has one section heading, with no duplicated brand/title block. Automated test checks all seven section labels and retained profile name.
- Native click opens a dot's explanations; Enter closes/reopens it; Tab reaches its first action. Regression checks reveal the selected region, exactly two bullets, preserved data, no navigation on selection, and correct navigation from the action.
- Empty demo shows zero progress honestly. Existing completed-identity regression still detects exactly one complete phase and 3/5 first-delivery milestones. Browser completed-state qualification is carried by earlier journey evidence; this pass's visual fixture was the separate empty demo tab, not a replacement of the preserved saved-content fixture.
- [1360/light connected trail](2026-10-05-trail-evidence/trail-1360-light.png) and [320/dark expanded identity step](2026-10-05-trail-evidence/trail-expanded-320-dark.png) were captured and visually inspected; physical widths 2720 and 640 at DPR2. Desktop expanded dark was also visually inspected through native screenshot. The 320/light expanded state was not separately captured or certified. Preview remained open on the trail, DevTools closed.
- A first visual capture exposed an undefined connector color token; repaired to the existing accent token and recaptured. The `before-connector-fix` image is failure evidence, not final qualification. Earlier scroll-position screenshot artifacts were replaced with captures from the top.

## Verification

**553 tests pass**, zero failures/skips; typecheck/build pass; ESLint of this six-file delta's TypeScript files passes with zero warnings/errors; `git diff --check` passes. Logs are in the evidence directory. Three red acceptance checks preceded implementation (section title, home duplication, interactive trail). One full-suite test initially failed because collapsed panels no longer rendered the existing calendar action; keeping content inside properly hidden regions restored that accessibility/markup contract and the full suite passed.

The previously documented repository lint backlog of 99 errors/9 warnings is unchanged and was not rerun as part of this focused update. No authenticated persistence, provider, deployment or production operation occurred. No comprehensive accessibility certification is claimed beyond the recorded keyboard and viewport samples.
