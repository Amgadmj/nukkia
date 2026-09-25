# Nukkia first-user walkthrough

Open `/demo`. This is an interactive, isolated product prototype, accessible without login. It simulates signup with a fictional profile, then runs five onboarding screens, a result, a first dashboard, content review/export and optional diagnostic chapters. It does not create Supabase accounts, modify existing companies, generate AI output, publish content or change production signup. Answers and edited/approved text are kept in this tab's session storage. Restart clears only this demo state. Existing v1 answers are retained without inventing approvals.

## Recommended first session

Four required prompts and one optional prompt. This is a design hypothesis to validate with users, not an evidence-based universal question limit. Prefer clear value from each answer over a completion-time promise.

| Screen      | Prompt                               | Immediate use                                                                |
| ----------- | ------------------------------------ | ---------------------------------------------------------------------------- |
| 1           | What is your business and sector?    | Personalize the workspace; two short fields in one topic.                    |
| 2           | What do you want to achieve first?   | Set the first action; four clear choices.                                    |
| 3           | What would you like to sell more of? | Give the first content idea a concrete subject.                              |
| 4           | Who do you want to reach?            | Adapt the draft; explicitly accept uncertainty.                              |
| 5, optional | What makes your business different?  | Give the draft a concrete owner-provided differentiator; accept uncertainty. |

The account screen uses a fictional identity to demonstrate the transition. Real signup still uses the existing authentication flow, including verification when required. Removing phone collection or changing consent requires a separate product decision; this prototype does not imply those changes are live.

## Progressive diagnostic

The existing diagnostic contains 27 prompts. Three are required in this short demo (`goals`, `offers`, `audience`); `differentials` is optional. Business name and sector are not diagnostic prompts. That leaves 23–24 diagnostic prompts for later. No questions have been deleted. An unknown audience is explicitly accepted; a skipped differentiator is not replaced by a made-up advantage. Marketing blockers remain in the deferred diagnostic.

| Later mission                   | Questions retained from the diagnostic                               |
| ------------------------------- | -------------------------------------------------------------------- |
| Put the brand on the map        | City, state, site, Instagram, LinkedIn, Google Business.             |
| Find the differentiator         | Existing offer, problem solved, price, competition, differentiation. |
| Understand the audience         | Existing audience, gender, age, location, income, interests.         |
| Turn interest into conversation | Physical/online sales, hours, objections, praise, preferred channel. |
| Tell the brand story            | Existing goal/blocker, purpose, founder story.                       |

The optional suggested chapter is differentiation: one answer about the problem solved can be more valuable than demographic detail. Existing answers are prefilled and the chapter begins at its first unanswered prompt. A user may leave at any time. Brand assets, network connections, corporate identifiers and employee count are deferred until their corresponding feature needs them, outside this demo's scope.

## First page and engagement design

Land on **Meu painel**, with the primary action **Revisar minha primeira publicação**, three content directions, an editable first text and an editable brand context. Suggestions are deterministic text templates, not AI generation or external research. Selecting another idea asks before replacing manually selected/edited text. Missing information is never substituted by invented brand facts.

The user edits, approves and downloads a UTF-8 `.txt` for manual publication. Export is unavailable before approval and is counted only after the browser download is requested successfully. Download initiation does not prove a file was saved or posted. Editing text or changing brand context invalidates approval/export for the current version, while preserving the user's draft. Changes to diagnostic answers never silently overwrite human edits. Reapproval is explicit. This is not automated learning or a shared production memory system.

Visual treatment: flat black, official Nukkia symbol rendered monochrome, centered entry, one upward/shrinking movement, compact segmented progress, one topic per screen. Respect reduced motion. Keep Back, visible optional skip, keyboard focus and refresh recovery. No artificial generation delay.

The dashboard prioritizes three observable demo milestones: starting context (+20 XP), approved text (+40), export requested (+30). Points are derived, not accumulated by repeated clicks. The optional diagnostic retains all 27 questions inside the brain and an expandable Trilha section, without chapter XP. Publication and learning from a week of results are visibly unavailable, not fake completed milestones. The three-milestone progress bar describes this demo, not marketing readiness, brand quality or revenue. There are no streak penalties or deadlines.

## Research basis and validation

- [GOV.UK question pages](https://design-system.service.gov.uk/patterns/question-pages/): ask only what is needed, explain why, start with one question per page, support uncertainty and Back, reuse answers.
- [Nielsen Norman Group: progressive disclosure](https://www.nngroup.com/articles/progressive-disclosure/): reveal secondary detail as users need it.

Before replacing real onboarding, test this prototype with new users. Observe: abandonment by screen, time to first usable approved piece, edit burden, whether users recognize their business, voluntary diagnostic exploration, manual publication and weekly return. These are a measurement plan, not telemetry implemented by this prototype. Evaluate the five-screen hypothesis against useful output, not form completion alone.

Production integration still needs the short-profile persistence contract and the real first-dashboard path. The existing full diagnostic requires `problems` and `challenge`, so the demo deliberately does not send an incomplete profile to that endpoint. The new route leaves live authentication and reporting intact.
