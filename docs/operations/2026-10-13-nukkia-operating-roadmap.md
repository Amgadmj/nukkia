# Nukkia operating roadmap

Prepared 13 October 2026. Operational source: [04 Nukkia Product Backlog Roadmap and CTO Execution](https://docs.google.com/spreadsheets/d/1OFKaIVzQtd-Mk2tXYOxLnsUdM4aJAguJUxj8wfy7MxU/edit). The September tracker remains historical; its B IDs map to the newer N IDs. Existing scope and acceptance conditions remain intact.

## Delivery sequence and success

| Gate | Deliverable | Accountable lead | Definition of success |
| --- | --- | --- | --- |
| G0 — start here | Access inventory, accepted capacity, reproducible release and CI | Amgad: technical access/CI; Nicola: capacity, IP and commercial decisions | N01/N02/N37/N38 have named accepted owners, evidence links and recorded limitations. Latest feature-branch CI is verified separately from current master/release readiness. |
| G1 — first production milestone | Complete authenticated onboarding → research/context → brief → editor → saved versions → calendar/export | Amgad: backend, isolation and recovery; Nicola: product acceptance; Victor: proposed QA owner | Synthetic account A recovers in two independent sessions; B is denied A's rows/assets; stale/offline writes preserve edits; actual exported files match approved versions; restore and rollback are exercised. Every N03–N10/N35/N36 criterion has candidate-bound proof. |
| G2 — pilot and repeat value | Authorized clinic pilot, measurement, pricing and second delivery | Nicola: pilot, product and economics; Amgad: instrumentation and concurrency; Victor: proposed test execution | Each admitted attempt is counted, the manual baseline and assistance are comparable, second delivery is observed and accepted-output costs are measured. No invented traction or margin. |
| G3 — controlled Health | Policy/reviewer authority, identity, grants, supplier and exact-package release | Amgad: technical controls; Nicola: policy/reviewer coordination; Victor: proposed qualification execution | Named qualified medical/privacy review, current rights and provider approval exist; costs/jobs/revocation are tested; actual output is inspected. This roadmap does not authorize production migrations, paid providers or publishing. |
| G4 — commercial repeatability | Billing/entitlements, observed retention and support-adjusted economics | Nicola: commercial acceptance; Amgad: implementation; Victor: proposed regression QA | Real cohort definitions, payment reconciliation and accepted-output cost evidence support the commercial offer. Health requires its own G3 approval. |
| G5 — expansion | Publishing, channel metrics and dynamic-site coverage only where demanded | Nicola: scope/access decisions; Amgad: adapters; Victor: proposed QA | Official API permission, demand and independent qualification precede promises. |

Dates are relative to accepted T0 and available capacity. The workbook's windows are proposals, not committed deadlines. Nicola owns priority changes; Amgad owns technical dependency estimates. Victor's assignments require his acceptance.

## Daily workflow

1. Before starting, choose an existing N ID. Record exactly one accountable owner: Nicola, Amgad or Victor. List collaborators separately. If the work has no matching item, add a new item with an acceptance criterion and dependency before beginning.
2. Move Intake → Ready only when scope, owner, permission boundary and observable acceptance check are complete. Use In progress → In review → Qualified → Done. Blocked requires a named blocker and next action. A passing test alone never means production-qualified.
3. Keep work in the existing repository/branch discipline. Attach the actual commit, PR, CI run, screenshot or test report. Record environment, source revision and the check's limitations.
4. At the daily reminder, append a dated update to Daily Updates: owner, N ID, work completed, evidence, remaining check, blocker, next action and next owner. Link/upload work to the backlog's evidence field; do not put passwords, tokens or patient/customer records in the sheet.
5. Amgad reports implementation and technical blockers; Nicola reviews outcome and scope; Victor supplies QA evidence when assigned. Review does not transfer ownership silently.
6. Nicola and Amgad review Ready/In review/Blocked weekly, accept or return work against its definition of success, and record changes in Decisions. Limit initial work in progress to one primary item per person; pair on dependencies when needed.

## Initial queue

- Amgad: N01, then N02/N03, then N04/N05. N02 includes current master/release-target qualification; feature commit `00eecf07d64c6d2658bf7ead27883011e9110f16` already passed 640 tests, types, lint and Node-server build on GitHub.
- Nicola: N38 and N37, then N06 acceptance and N11 pilot preparation. Confirm pilot data permissions and qualified medical reviewer availability before Health work.
- Victor: proposed N10 QA preparation; coordinate N04/N05/N06 evidence with Amgad. Do not imply Victor has accepted availability or access.

## Reminder delivery

Requested: weekday email prompting Nicola and Amgad to upload/link daily work to the product backlog and identify the owner. Recipients are Nicola (`nicola@holilabs.xyz`) and Amgad (`salihamgad69@gmail.com`); schedule is weekdays around 18:00 America/Sao_Paulo. The tested bound Apps Script is in `/Users/nicolacaprirolo/.hermes/Modular Skills/08-daily-email-reminder.md`. Google authorization/activation is pending; no reminder is described as active until its trigger and delivery are verified. A reminder asks for updates; it does not infer completion or move backlog status automatically.

## Current evidence and gaps

[Onboarding evidence](2026-10-13-onboarding-evidence/verification.md) proves local website entry/collection, Instagram references, Brand System, reload, keyboard and sampled narrow/theme behavior. Authenticated logout, independent cloud recovery, isolation and hosted-provider qualification remain separate G1 checks. This roadmap does not retroactively qualify all 18 reference screens.

## Operationalization receipt

The approved 40-item owner mapping is populated in Backlog G6:G45. Native owner choices are Nicola/Amgad/Victor. Columns Q:V hold owner acceptance, reviewer, evidence, update, blocker and workflow. Daily Updates has date/owner/ID/evidence/next-action inputs; Operating Workflow explains the states and review loop. Readback matched all 40 owners and preserved all prior non-owner values in A:P. Owners remain Proposed until individually accepted. Source-derived toolkit and personalized Amgad brief are saved in Hermes/Modular Skills.
