# Nukkia screenshot led UI proposal

Draft for Nicola's review, 2 October 2026. Finish the app's user-facing design before handing the database work to Amgad. Use the supplied Holo screenshots for layout and interaction patterns, while keeping **Nukkia**, its official logo, Sora/Manrope and its own purple/blue/cyan palette. The design must help a clinic owner provide brand context, create/edit useful material, find saved work and understand what still requires review.

This is a whole-app design proposal, decomposed into reviewable UI slices. It is not a claim that these views have been implemented. No handoff, database activation or external publishing is part of this proposal. The [current app map](../../2026-10-02-app-map.md) and [held database handoff](../../2026-10-02-backend-handoff-amgad.md) preserve the implementation facts.

## Design direction

Use the already approved workspace direction: narrow grouped navigation, spacious rounded content canvas, soft Nukkia color wash only around creation/setup, clear visual choices and a large central preview. Each view has one job and one primary next action. Keep secondary details in contextual tabs/drawers. The owner should be able to go back without losing edits and resume a saved draft directly in its editor.

Three possible approaches were considered:

| Approach | Benefit | Tradeoff |
| --- | --- | --- |
| **Extend the existing Nukkia workspace** — recommended | Keeps current routes and recovery logic; adds the missing library/services/inspiration views; makes the screenshot patterns consistent throughout | Requires deliberate visual cleanup of older route content, not merely changing the sidebar. |
| Reproduce every visible Holo destination | Broad apparent feature parity | The screenshots do not show the interiors or prove how Chat, Inbox, Analytics or credits work; creates speculative product/backend commitments. |
| Finish only the existing editors | Smallest immediate change | Leaves navigation, reusable assets, service context and account experience incomplete. |

The recommendation is the first approach. The prior redesign remains the starting point, not evidence that every screen has already had a full design pass. Brazil and medicine are the selected first Health market. Production eligibility, rights and professional review remain explicit prerequisites, never decorative compliance badges.

## Screenshot reference inventory

All 18 PNGs in `/Users/nicolacaprirolo/Downloads/Screenshots` were inspected. Names below use the time suffix in `Captura de tela 2026-10-01 <time>.png`.

| Reference | What the screenshot actually shows | Nukkia adaptation |
| --- | --- | --- |
| `170009`, `170026` | Sparse welcome, one next action | Short welcome; useful setup explanation and Nukkia logo rather than a copied mascot. |
| `180426` | Website input and alternative for no website | Optional public website; clear permission and manual-entry path. |
| `180507` | Language choices and back/progress controls | Portuguese for Brazil as the first scope; explain chosen language. Do not imply every displayed language is supported. |
| `180532` | Business name and industry, focused step | Company/clinic identity with saved editable answers. |
| `180617` | Editable colors, logo, mission and guidelines | Identity confirmation view; separate found suggestions from owner-confirmed settings. |
| `180644` | Product list beside editable product images/title/description | **Services and offers** list/detail view for clinics; authorized imagery and validity/conditions fields. |
| `180732`, `180755` | Grouped sidebar, setup shortcuts, creation cards and saved-content thumbnails | Painel with useful setup actions, formats and actual saved drafts. No invented streak, credits or content counts. |
| `180823` | Image creation-mode choices | Format/method chooser for supported image/carousel flows; unavailable methods have an honest label. |
| `180851` | One instruction field, advanced settings, aspect ratio and amount | Brief view with objective/service, reference, ratio and explicit constraints; advanced options tucked away. |
| `180910` | Video-method chooser | Health scene workflow and generic promotional MP4 clearly distinguished; owned-twin mode requires setup. |
| `180930` | Upload/source chooser with a small reusable-library strip | Reusable-material drawer with provenance and selection. Selecting an asset does not confer rights clearance. |
| `180952` | Actor/scene, script, duration and ratio inputs | Own professional/twin readiness rather than a fabricated patient testimonial or unknown actor. |
| `181015` | Large central image, right thumbnail rail and editing controls | Piece preview with page/scene rail and focused edit controls; approve/export separate from editing. |
| `181134`, `181141`, `181155` | Scene/source cards, instructions, ratio and duration; different framing | Scene-based briefing with optional authorized material; responsive layout using the same underlying data. |

Calendar, Inbox and Analytics appear as navigation labels, but no supplied screenshot shows their detailed views. Their proposed Nukkia layouts below are design recommendations, not observed Holo implementations. Holo and Holi Labs are distinct references.

## Navigation and view placement

Keep the seven existing primary destinations. Make the subviews understandable instead of adding a long sidebar for every function.

| Existing destination | Proposed internal views | New surface versus improvement |
| --- | --- | --- |
| **Painel** | Setup shortcuts, creation entry, recent drafts, pending work | Improve existing home; recent drafts already exist. |
| **Trilha** | First-delivery checklist and links to incomplete work | Improve hierarchy/copy; keep saved progress. |
| **Conteúdo** | Criar, Biblioteca, Planejamento mensal, Revisão | Creation/calendar exist; unified library and professional review are new. Review is a Health phase, not an immediate operational feature. |
| **Cérebro** | Overview/facts, Serviços e ofertas, Referências, Hipóteses e lacunas; diagnostic report remains accessible | Facts/sources/hypotheses/editors exist; structured reusable service list is new. Preserve source distinctions within the clearer grouping. |
| **Identidade** | Identity settings, visual inspirations, brand story, brand-book preview | Identity/story exist; visual inspiration collection and reusable board are new. |
| **Canais** | Public links, real connection status, setup/recovery actions | Improve present view; operational connector actions require future backend work. |
| **Resultados** | Observed data, date/source/freshness, unavailable and collection-error states | Improve present view; no simulated ROI or fabricated live data. |
| **Conta** in footer | Profile, professional readiness, security/recovery, data/privacy; team/plan only when implemented | Current export/delete exists; editable settings and readiness are new. |

“Biblioteca” means the owner's saved materials/versions. “Inspirações” means references the owner wants to use as direction; those entries are not automatically cleared assets. “Revisão” means decisions on a particular package/version, not a social-message inbox. A freeform priority-offer answer already exists, but it is not a structured services catalog.

## Screen proposals and success definitions

### Entry and onboarding

Show the same logo, field style and action hierarchy across login, signup, confirmation and recovery. Keep registration details and consent explicit. Put errors next to the relevant field and keep entered values on retry. Show a working path for invalid/expired email links rather than sending the person back to a blank form.

Onboarding uses focused steps: clinic identity → website/manual source → confirm context and identity → objective/first format. Existing essential offer/audience/differential answers remain editable; do not silently discard them during simplification. Extra medical/professional setup can be completed when enabling Health production, with a visible readiness checklist. Back/resume preserves drafts; progress reflects the steps actually saved.

Success: a new person can explain what to provide, skip a website, correct extracted suggestions, go back and resume. Profile/reviewer fields have explicit missing/unverified states. Screenshot inspiration: `170009`, `170026`, `180426`, `180507`, `180532`, `180617`.

### Painel and Trilha

Painel begins with “O que você quer criar?” and Image/Carousel/Video choices with truthful availability. Next to them, a concise setup list links to Cérebro, identity and services. Below, show the owner's actual recent drafts with thumbnail, title, format, last edit and status. Empty home explains how to start; recovered draft provides a direct “Continuar edição” action. Keep pending work tied to actual saved state.

Trilha becomes a short delivery checklist, with completed steps checked and unfinished ones linking to the exact relevant screen. Avoid duplicate metrics and a large decorative XP panel; any retained XP must come from existing saved progress. Health readiness is separate from the first generic-piece journey.

Success: the main creation action is visible on desktop/mobile; each existing draft opens the correct version/editor; empty and recovery states are clear; no invented notifications. Reference: `180732`, `180755`.

### Cérebro and services

Use a short overview with confirmed brand/service/audience/objective facts and editable source annotations. Keep discovered material and hypotheses visibly distinct. Clicking a fact opens a focused editor with a return path to where the owner started. The report remains a secondary deeper analysis, including stale-report explanation.

Add Services and offers as a list/detail view: title, summary, audience, administrative call to action, validity/conditions, source and authorized material. Include draft/confirmed/archived states and a way to choose which service a creative brief uses. This is marketing context, not a clinical record system. New catalog values must not silently overwrite the existing priority-offer answer; later backend work defines the deliberate mapping.

Success: owner can create/edit/archive and select a service without losing other context; unconfirmed conditions remain visible; every proposed “fact” has an identifiable source. References: `180532`, `180644` and the home setup shortcuts.

### Identity and inspirations

Identity is a preview-first workbench: colors/type/logo preview beside the editable settings, then manual story and brand-book sections. Label unsaved draft versus saved/applied identity. “Aplicar à peça” is explicit and shows that relevant previous approval becomes outdated. Make missing/expired logo assets recoverable.

Add Inspirations as a visual board of uploaded references or public links, each with source, owner note, purpose and permission/clearance status. A selected reference can be attached to a brief. An empty board offers manual upload/link; unsupported ingestion stays unavailable. Preserve current pending-reference confirmation guards. Do not duplicate uploaded content or silently send it to a provider.

Success: identify what identity is currently applied; references stay attributable; replacing/deleting a reference does not erase the user's written brief; both themes show the same official logo. Reference: `180617`; source-selection pattern `180930`. The board interior is a Nukkia proposal, since the screenshots do not show Holo's Inspo page.

### Creation chooser and brief

Use format cards first, then one focused brief panel. The generic Image/Carousel flow and Health Video prototype have distinct availability labels. Email and advanced clone/translate/lipsync modes are not advertised as working. A Health template catalog is selectable, but selecting a catalog item is not a qualified production workflow.

The brief shows service/goal, editable idea/script, chosen material, aspect ratio and duration where relevant. Advanced restrictions and notes stay expandable. For generic creative preparation, the main action says “Preparar opções”; for the current Health prototype, it says “Ver exemplos de roteiro”. Any eventual paid render shows readiness and cost/budget decision before execution.

Success: format → brief → options → editor works forwards/backwards with edits preserved; unavailable production actions explain what is missing; provider calls require server authorization. References: `180823`, `180851`, `180910`, `180930`, `180952`, `181134`, `181141`, `181155`.

### Options and editor

Compare three options with thumbnail/text summary, purpose and an obvious “Editar esta opção” action. No claim that illustrative predefined examples were generated by a provider. Returning from the editor preserves human text. Replacing options requires an explicit discard decision if it would lose edits.

The editor has a large central preview, a page/scene thumbnail rail, one selected page/scene's fields and a compact contextual toolbar. Use undo/redo only where real history exists. For scenes, expose duration and reordering with accessible controls; keep total timing, text fit and unavailable audio/render status visible. Generic approval/export remain separate. Health professional review uses a separate pending/reviewed package, not the generic approval checkbox.

Success: thumbnail selection changes the correct edit target; text is readable and fits; relevant edits invalidate old approval; keyboard/narrow-screen editing preserves the draft; export names the actual produced format. Reference: `181015` and the scene-based screenshots.

### Unified content library

Show grid/list entries with thumbnail, title, format, last edit and version/status. Filter by Image/Carousel/Video and Draft/Review/Approved where those states genuinely exist. Provide resume, inspect version, duplicate and archive affordances; don't activate destructive removal or approval without a real backing contract. Never mix a generic approved creative with a professional-approved Health release in one ambiguous badge.

The current home has a draft preview and the monthly planner has saved content items, but there is no unified multi-item library/version-management screen. The proposed view consolidates access to those representations; it must not claim that all data is already a shared asset model.

Success: locate and resume a saved piece, inspect the intended version and understand its approval/export status; blank/loading/error states are useful; no fabricated library contents appear in the real app. Reference: home gallery `180755` and editor/library selection `181015`, `180930`.

### Planner and professional review

Improve the existing monthly planner with a readable dated overview and selected-item detail. Show intended date, channel, format, actual draft/review status and the next action. On narrow screens, use an agenda list rather than shrinking seven unreadable columns. Planning is distinct from publishing.

The Health review proposal has an inbox/list and exact-package detail: playable complete output, captions/alt/audio, source/claim/rights summary, professional identity and intended destination. Decision actions are “Solicitar ajustes”, “Rejeitar” and “Aprovar esta versão”; none becomes operational until server authority and immutable version handling exist. Changed/revoked packages leave review or delivery blocked; no reviewer capacity remains pending.

Success: a scheduled draft never looks published; review due dates and production eligibility are visible; full output is inspectable; source or content changes invalidate earlier decisions. Holo calendar/review interiors were not supplied; these are Nukkia recommendations driven by the blueprint.

### Channels, results and account

Canais uses distinct rows for a supplied public link and an authenticated integration. Show which data is available and when it was last received. Connect/reconnect/disconnect actions appear only when supported; link editing always remains accessible.

Resultados shows measured values with source/date/freshness, plus empty or failed-collection states. Separate a created/exported piece, a provider-confirmed publication and attributed business results. Unavailable values stay unavailable.

Conta receives the same canvas/tab/field system. Put basic profile, professional/readiness settings and security before the privacy export/delete area. Keep destructive deletion in a separate confirmation step. Explain incomplete export/purge outcomes; do not imply a DB cascade removes external provider copies. Team/company switching and billing are later tabs only when their product and backend scope is activated.

Success: ordinary owner can find account/recovery controls; unavailable integrations are honest; dangerous actions are explicit; full linked data and retention outcomes are accurate. Screenshots show destination labels only; these interiors are Nukkia design recommendations.

### Landing, privacy, terms and admin

Keep the landing aligned with current capabilities, using clearly labeled examples. Login and legal pages use the same official brand and type hierarchy. Privacy/terms reflect what the activated application actually processes. Admin remains a clearly separate internal read-only overview; it is not reused as a medical reviewer role or given access to owner-only drafts by a UI change.

Success: no unsupported automatic publishing, medical certification or measured ROI claims; readable legal content on mobile; role denial/recovery does not look like a blank broken screen.

## Shared states and visual checks

Every proposed view must show its first-use empty state, loading, saved/unsaved draft, validation error, retryable failure and completed state where applicable. Draft screens additionally need recovered local draft, cloud unavailable, concurrent revision conflict and expired session. Reviewer/provider screens need pending, changed version, revoked, failed and cancelled states; present them as design states until backed by real APIs.

Check light/dark and desktop at 1360 px, laptop at 1024 px, narrow at 390 px and minimum at 320 px. Use reflow rather than hiding essential actions. Keep visible keyboard focus, labeled controls, readable color contrast and status text beyond color. Creation options/cards remain touchable; a selected thumbnail has a visible and accessible state. Official logo stays legible in both themes. Do not use stock Holo mascot assets or decorative numbered headings.

## Implementation slices after UI review

| Order | Slice | Design finish condition |
| --- | --- | --- |
| First | Shared canvas/navigation, Painel, Cérebro/services and identity/inspirations | One coherent design; context edits retain return paths; new-view boundaries and empty states agreed. |
| Next | Creation chooser, brief, options, generic/Health editors and library | Complete reviewable journey; drafts survive navigation; supported versus proposed outputs unmistakable. |
| Then | Existing planner, channel/results views and account/recovery | Same component language throughout; date/status/error behavior specified; no old route content visually isolated from the shell. |
| Before Health production | Professional/twin readiness, review, jobs and controlled-delivery surfaces | Exact version, current authority, provider cost, failures and revocation are visible and mapped to a reviewed backend domain. |
| Handoff | Freeze approved UI scope, screen/state inventory and contracts; send to Amgad | Every affected screen has a reviewed layout and state list; implementation/prototype/pending distinctions remain; no unreviewed UI is disguised as finished. |

Nicola requested the handoff wait until this UI proposal is finished. Review this direction and the screen examples before implementing the new views. New product behavior follows a reviewed implementation plan; database wiring is handed over after the UI scope is settled.
