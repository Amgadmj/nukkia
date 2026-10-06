# Healthcare follow-up: browser observations and limits

Candidate: `baabfc16dce1e53aa164bbf9870a4cca12e18f21746e781281fbf68d87cfe6c5`. Branch `codex/nukkia-onboarding`, base `5f1a1dab06e003b47614d0597bd8279db2b391c3`. Nine-file delta from candidate `73f0d2fc…`; existing changes/assets preserved. Listener 8082 reused. No cloud writes, deployments, migrations or providers activated.

## Implemented and repaired

- Standalone healthcare palette board: Atlantic (deep blue/teal/cyan) and Eucalyptus (deep green/ivory/clay), official symbol, Sora/Manrope, swatches, product examples and independent light/dark previews. App palette remains pending selection.
- Healthcare identity/brief examples replace generic workshop copy and decorative padded artwork numbers. Card-relative typography fixes clipping observed at tablet width; titles and footers fit at 1024 and 320.
- Initially implicit first Health scene selection now follows its stable scene ID on reorder. Regression failed before fix, passed after; undo/redo retain the selected scene.
- Results → “Continuar minha peça” explicitly opens `vista=peca` instead of retaining `vista=saude`. Callback regression failed before fix, passed after; live button confirmed correct editor.
- Planning helper text remains accurate after a date is already selected.

## Actual local walkthrough

Synthetic fixture only: **Clínica Horizonte — QA sintético**. Preserved older Ateliê Aurora QA and existing service drafts.

1. Optional website skipped; manual name/segment/audience/offer entered; onboarding recommendation → dashboard.
2. Carousel home shortcut → focused brief; empty idea blocked; entered idea/goal, identity round-trip preserved brief. Three illustrative options → draft.
3. Edited page 1 heading and page 2 heading independently, inspected page 3; saved v1, edited page 1 and saved v2. Library v1 inspection retained v1 heading and edited page 2.
4. Duplicated selected v1 into an independent one-version item; original archived, revealed with filter, restored. Planning retained original **version 1**, **20/10/2026**, **Instagram**, despite latest v2. Reload recovered same plan and brand. Original item `c64a804b-574a-4040-989c-88e6b5502386`.
5. Connector date `fill()` changed DOM value without committing React state. Native keyboard ArrowUp/ArrowDown committed date correctly and enabled channel; classified as connector limitation, not an app defect.
6. Health → Roteiro em cenas → idea → 15 seconds/1:1 → three examples → Mostre um passo a passo. Edited title; reordered; undo/redo; duplicate produced correct duration warning and disabled playback. Merge preserved 15 seconds, split restored three scenes. Add introduced new scene; delete removed that added scene. Playback button changed to Pause; reset worked. Saved Health v1; reload retained title, scene order, script and duration.
7. Health desktop dark/light; 390 light and 320 dark; library/planning 320 dark. DOM width checks showed no page overflow. Mobile menu Escape returned focus to Abrir menu. Keyboard Enter opened Library and expanded trail Content step with two explanatory bullets/actions.
8. Identity 1024 dark exposed clipped example copy; fixed and checked strong/footer bounds at 1024 and 320. Canais and Resultados displayed truthful empty/unconnected states. Results continuation defect fixed and verified against actual selected Minha peça tab. Synthetic review checkbox → approval enabled download.

**Qualification boundary:** app screenshots in `../2026-10-05-complete-journey-evidence/` were captured during these incremental edits, before the final frozen aggregate. They document observed states/defects; they are not silently rebound as exhaustive final-candidate proof. Final palette screenshots were captured after the manifest freeze and are bound to this exact candidate. Automated tests bind the full final candidate. No claim that every screen/button/theme/device combination is qualified.

## Connector blockers

- Ateliê Aurora QA tab `689695983` remains on “Usar este serviço no briefing da peça?”. Both scoped accept and native key commands timed out. After operator asked us to close it, automatic approval review rejected whole-app Chrome selection because unrelated private tabs could be exposed. No bypass attempted. Service apply/replacement-cancel path remains unqualified for this candidate.
- Synthetic image upload cannot complete until the extension permits local file access. No patient/customer assets were used. Upload UI/retry/cancel remains unqualified in browser; domain/UI regressions pass.
- Download event check timed out, then QA tab `689695995` reported debugger detached. Scoped get/claim could not recover it. Approval was observed; file delivery was not verified. Do not count an attempted download as a successful export.
- Fresh localhost mood-board tab works. Preserved QA tabs were marked for continuation; no deliberate tab reload, close, reset or draft deletion to work around failure.

## Palette proof

`http://127.0.0.1:8082/nukkia-moodboard.html`. Both theme buttons work independently; 320px DOM/client widths equal 320. Atlantic anchor works. Desktop light and 320 dark final screenshots in `docs/design/2026-10-05-palette-evidence/`. Action white-text contrast: Atlantic 6.20:1, Eucalyptus 6.43:1; this is not a blanket contrast audit of every decorative swatch.

## Verification and remaining qualification

Node 24.21.0: **580 passed, 0 failed/skipped**; typecheck/build exit 0; lint scoped to this pass 0 errors/warnings. Full repo lint remains **99 errors, 9 warnings**, unrelated existing integration/legacy backlog. Red regression failures above were intentional and resolved. Connector failures are separate from automated test results.

Remaining: blocked service application, upload and export delivery; library resume/replacement confirmations; complete screen × button × width/theme coverage, including authenticated Conta. Cross-device persistence, stale/concurrent saves, expired-session/offline recovery, A↔B read/write denials, owned storage/export remain unqualified. Existing permission for disposable Movitta and Amgad Sali spaces persists; still establish actual non-production project and signed-in identities before remote mutation. Full checklist and success definitions remain in the execution ledger. No real records or production/provider activation.
