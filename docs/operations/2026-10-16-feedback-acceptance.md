# Feedback acceptance definitions

These definitions qualify observable behavior, not deployment or legal compliance. A local test is not evidence of hosted delivery, social ingestion, storage isolation in a live account or a screenshot review.

| Area | Success definition | Verification / boundary |
| --- | --- | --- |
| Dashboard | First primary CTA opens the Brain diagnostic editor. Drafts, objectives, priorities, results and in-progress panels are absent; existing saved content remains intact. | Shared component regressions; browser review pending reconnection. |
| Navigation / XP | Brain follows Panel/Trail in navigation; top-right shows XP derived from recorded milestones. Scanned candidates do not become owner-approved facts. | Workspace shell / journey tests. No fabricated review, scheduling or XP. |
| Diagnostic | Brand/Goal/References are visible clickable steps; incomplete required setup or a pending link prevents completion/exit; a single Gerar Análise CTA leads to a review/report then identity. Optional story does not block. | Context-editor tests; local report explicitly identifies itself as a confirmed-data summary, not a new AI analysis. Hosted report remains provider-gated. |
| Brain | Site references replace Encontrado; early hypothesis tab is hidden without deleting records; age/location/interests/needs/objections are available. Chapter navigation validates required answers and exposes next action. | Existing source attribution, draft preservation and chapter tests. |
| Trail | Identity precedes channels; visible chronological checklist covers context, identity, channels, monthly plan, review, approval, intended calendar date and export. Completion uses saved facts, including account-plan status when available. | Journey tests. Multiple independent channels or optional history are not falsely completed. |
| Identity | Existing/observed colors seed a reference palette plus two variants with small channel changes. Variants are labelled proposals, not site extraction or an AI result. Optional story candidates remain editable. | Palette / identity tests. Social links are not evidence that social posts were read. |
| Brandbook | HTML/PDF preview includes actual saved palette/type, original-logo application examples, business-card layout and labelled slogan proposals. Escaping and no fabricated contacts/claims remain intact. | Brandbook tests. Print/PDF final visual review pending browser connection. |
| Content | First-touch entry is the piece briefing with a monthly-plan CTA before production; readiness/review has no active tab; secondary controls are collapsed. | Navigation / content tests. No claim of automatic publication. |
| Materials | Explicit optional PNG/JPEG/WebP/MP4 upload requires declared permission, validates type/size and uses a company-scoped private path. Account switch/unmount discards preview state. | 13 focused validation/path tests; live authenticated storage test remains unverified. |
| Calendar | Dragging a real planned item changes only its intended date via the existing save callback. Version, channel, time and timezone survive; invalid/external drops and failed saves do not report success. Keyboard/date forms remain. | Calendar domain/UI tests; live drag screenshot pending browser connection. |
| Email | Confirmation/resend/recovery reach approved test inboxes, provider delivery logs and successful callback are recorded. | NOT achieved by frontend tests. Requires verified sender/DNS, SMTP credentials and live delivery tests; see transactional-email-readiness.md. |
| Future feed preview | Remains future work, as requested. | Not presented as implemented. |
| Intent cards | Explain services / strengthen brand labels, centered copy, persistent multi-selection, visible selection-order priorities. No focus selector, topic summary or redundant offer list. | Onboarding regressions; browser visual QA pending. |
| Optional detail / channel | Important-detail copy replaces true-detail wording. Preferred contact channel is editable and persisted separately; previous factual question answers are not overwritten or invented. | Onboarding and persistence regressions. |
| Public contacts | Address/email/phone candidates from validated pages survive into Markdown with URL/time. Formatting duplicates consolidate sources; differing values remain listed and require purpose/owner review. | Contact extraction/reconciliation + collector regressions and live clinics. No automatic canonical number selection. |
| LGPD map | Each actual data store is mapped to purpose, access/recipient, retention/deletion behavior and gaps. Legal basis, controller/operator roles, provider transfer safeguards and consent evidence are explicit unresolved decisions where not established. | Source-based map; not a compliance certification. |

## Review notes

Numbering applies to real selected priorities and chronological tasks, not decorative section numbers. Existing drafts, published git history and live provider settings are preserved.

Chrome reconnected after an interruption. Browser checks on a synthetic clinic verified desktop/narrow intent cards, keyboard focus, ordered selection/channel recovery after reload, light/dark presentation, the diagnosis-first dashboard, incomplete diagnostic sidebar blocking, confirmed-data summary → identity and explicit identity save with actual XP updates. This supersedes the generic browser-pending notes for those specific flows only. Authenticated storage, actual calendar drag, final Brandbook print and provider delivery are still unqualified.

The deterministic palette-refresh action retains the saved/observed reference plus two nearby variants without calling or charging AI. The optional AI fallback is offered only when no reference options exist. Social extraction is not implemented by registering a profile URL.

Public contacts are bounded candidates, not a guarantee of exhaustive discovery: pages may lack supported contact markup, use short WhatsApp redirects, or exceed crawl limits. Markdown is persisted as research.evidenceMarkdown and can be downloaded as perfil-clinica-evidencias.md; no arbitrary server filesystem write is required. Different numbers remain reviewable, not automatically overwritten.

## Latest live collection + intelligence run

Local HTTP endpoint, optional local Scrapling worker/rendering enabled and configured AI synthesis authorized. All three returned phase=complete and synthesis=ready; name, area, audience and offer candidates were present, frontend application left owner confirmation required, and every structured contact value/source survived into Markdown. These are observed single-run timings, not a latency guarantee.

| Clinic | Total time | Sources | Structured contacts |
| --- | ---: | ---: | --- |
| draquisyvascular.com.br | 17.212 s | 1, rendered JS | 1 email; no phone/address candidate identified |
| www.clinicasaopaulo.com.br/especialidades/ | 55.037 s | 15 | 26 phone observations / 4 address observations across sources; differing phone values flagged for review |
| laboratoriosaopaulobh.com.br | 12.407 s | 1 | 1 phone; no email/address candidate identified |

Observation counts are not counts of unique phone numbers or physical units. Missing structured categories do not prove the clinic has no such contact. Collection is bounded and does not promise every page/field. The laboratory run also recovered a logo, observed logo/CSS colors and Geist font sources; the other runs did not identify a logo, so no claim of universal logo recovery is made.

## Final local gate

- Branch: codex/nukkia-onboarding; base HEAD: 528444af17310cf69f62b73ef0c587982e3d0a7f. Candidate includes uncommitted tracked and new files; existing recovery stash retained.
- npm run check with Node 24.21.0: exit 0, 814 tests passed, 0 failed; typecheck and production build passed; lint 0 errors / 11 warnings. git diff --check passed.
- Regression fixes include aggregate specialty limits with preserved pending text; no implicit offer confirmation on intent click; priorities retained when a piece brief exists; Angiologia-only profile handling; required-stage/chapter advance and panel/trail exit guards.
- Browser confirmed incomplete diagnostic and edited identity cannot return to panel/trail, followed by successful explicit completion. Account, correction and sign-out paths are intentionally not locked; closing the browser is not blocked.
- No commit, push, exact-commit GitHub CI qualification, deployment, real customer profile confirmation or SMTP activation performed. A local gate does not establish those outcomes.

## Onboarding follow-up: field layout and retained reading

- Research document hidden throughout onboarding only; retained Markdown remains exportable from later source review.
- Name/area suggestions render beneath their own field. Selected area chips and the editable entry share one bordered control; focus is shown on that control, not a second input box.
- Back → Continue reuses completed or in-progress research without calling research again. URL replacement/removal still invalidates evidence; the explicit Analyze again action remains available.
- Red/green regressions reproduced the misplaced suggestions/document and unconditional recollection. Full npm run check on Node 24.21.0: exit 0, 817 tests passed, typecheck/build passed, lint 11 warnings / 0 errors; diff whitespace check passed.
- Browser: existing Natalia Beauty tab retained 16 source pages and human fields on Back/Continue and same-tab reload; desktop and 390px layout checked, with the responsive override restored. No clinic profile was confirmed on the owner's behalf and no source/field was removed during this check.
- Remaining live-product qualifications are unchanged: authenticated uploads/storage isolation, actual calendar drag, final Brandbook print and SMTP delivery. URL replacement/removal and multi-area editing have automated regressions; the operator can additionally exercise them in a disposable draft.
