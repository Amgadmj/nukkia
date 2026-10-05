# Atlantic integration and landing prototype — 5 October 2026

User selected Atlantic and requested integration across the app plus a Holo-inspired, differentiated landing prototype. Branch `codex/nukkia-onboarding`, base `5f1a1dab06e003b47614d0597bd8279db2b391c3`; exact candidate `da7b8600baef4fb49865d7a835d3d8c3cc59cb49d5386bec14367a190d5eb495`. Existing tracked/untracked changes, official assets and session drafts preserved. Existing listener 8082/PID 39183 reused; no deployment, provider activation, account mutation or migration.

## Design and implementation

- Global `--nukkia-*` semantic colors define light/dark backgrounds, cards, text, muted text, borders, focus, accents and buttons. Existing workspace, studio, onboarding, auth and landing aliases consume the same palette. Purple application literals removed; success/warning/error remain distinct.
- Atlantic light: paper #F5F9FA, ink #122B3A, teal #006C72, wash #DFF1ED. Dark: background #0B202B, panels #15333F, text #F5F9FA, action #56C8C8 with deep-blue text. Official symbol, Sora/Manrope and customer artwork palettes preserved. No draft data/schema transformation.
- Manual browser QA uncovered the legacy black `!important` onboarding field; removed it, extended existing semantic component styles to onboarding labels/cards, and added a regression. Auth had a forced dark class and a white primary action; it now inherits theme and uses Atlantic. Existing diagnostic action also uses shared primary tokens.
- New local route `/proposta`, independent of preserved homepage `/`. Message: “Sua clínica tem muito a dizer. Dê forma a isso.” Connected context → creation → library → planning, healthcare examples, editable workflow explanation, format gallery and FAQ. Tabs work by pointer, arrows, Home and End; mobile presents all four labels in a two-column grid.
- Holo reference inspected visually and through its current page on 5 October: https://tryholo.ai/ . Borrowed presentation principles: prominent hero, visible product story, staged benefits, examples and FAQ. Nukkia uses original CSS artwork/product collage, Atlantic, healthcare-specific Portuguese, official symbol and actual capability boundaries. No Holo artwork/mascot, copied testimonials, metrics or provider promises.
- Primary links open `/demo?passo=0` (router normalizes to include `vista=saude&aba=painel`); login/signup keep distinct auth modes. Prototype is noindex and local, not published. Existing home remains accessible and now uses Atlantic.

## Acceptance evidence

Synthetic fixture: **Clínica Atlantic — QA**, created in its own browser session. Earlier Ateliê Aurora and Clínica Horizonte sessions were not reset or deleted.

- Prototype primary CTA → manual onboarding → brand/audience/offer → recommendation → dashboard worked. Name/context retained after navigating to studio and reloading.
- Dark sidebar navigation traversed Minha trilha, Cérebro, Identidade, Canais, Resultados and Conteúdo. Each displayed its correct heading and resolved text/action tokens #F5F9FA/#56C8C8. Desktop workspace inspected in both themes.
- Onboarding light field measured white background and #122B3A text after the fix. Auth buttons measured #56C8C8/#0B202B dark and #006C72/#FFFFFF light.
- Landing four stages changed visible panel text via keyboard arrows/End. FAQ expanded and collapsed with click/Enter; all five disclosures exercised. Anchor navigation, demo CTA and login links observed. Signup href is `/auth?modo=cadastro`; no signup/login submission performed.
- Landing inspected at desktop 1360, mobile 390 and 320. Both themes captured; 320 and 390 DOM widths equal viewport widths. Mobile tabs reflow to two rows. Workspace studio at 390 showed no document overflow; Escape closed menu and restored focus. Viewport reset invoked after checks; synthetic workspace handoff tab may retain its 390px tab-specific override because browser-level reset affected the active landing tab only.
- `final-*` screenshots captured after source freeze and bind this exact candidate. Other captures are intermediate visual observations retained for traceability. Screenshot samples are not exhaustive screen × interaction coverage or authenticated persistence evidence.

## Automated checks

Node 24.21.0: **585 pass, 0 fail, 0 skipped**. Typecheck/build exit 0. Scoped ESLint 0 errors/warnings and formatting check pass. `git diff --check` clean. Theme regression includes reading/action contrast ≥4.5:1, forbidden previous brand literals, onboarding background precedence and auth theme inheritance. Intentional red logs retained; all resolved. Full lint separately reports 99 errors and 9 warnings in the existing unrelated backlog.

## Preserved boundaries

Authenticated two-device/workspace isolation qualification remains separate and unverified. This change does not alter persistence code or imply previous blocked upload/confirmation/export checks passed. No real healthcare/customer data, cloud fixture changes, production migration or publishing/Health provider activation.
