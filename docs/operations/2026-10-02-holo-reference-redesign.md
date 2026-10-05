# Nukkia: Holo reference redesign

The operator requested the Holo screenshot style and flow with Nukkia's own theme.
This supersedes the earlier visibility-only change. Name remains **Nukkia**.

Open the existing local server:

- Panel: `http://127.0.0.1:8082/demo?passo=6&aba=painel`
- Studio: `http://127.0.0.1:8082/demo?passo=6&aba=conteudo&vista=saude`
- Previously reported context URL: `http://127.0.0.1:8082/demo?passo=6&aba=cerebro&editar=contexto&retorno=conteudo`

## Reference and implementation

Inspected all 18 PNGs in `/Users/nicolacaprirolo/Downloads/Screenshots`.
The home and editor references include `180732`, `180823`, `180851`, `180910`,
`181015`, and `181134` in the `Captura de tela 2026-10-01` filename series.

- Narrow grouped sidebar and rounded main canvas, with restrained Nukkia washes.
- Home setup shortcuts, video/image creation cards, and actual saved drafts.
- Video sequence: format → instructions → three illustrative options → editor.
- Central text-card preview, selectable scene rail, one scene's editing fields.
- Existing image editor: central image, real page thumbnails, fields below.
- Context: Marca → Objetivo → Referências, with pending-reference guards.
- Both themes retain the official logo. No Holo mascot or assets copied.

The saved workspace schema and domain constraints remain unchanged. Undo/redo,
revision checking, draft recovery, scene operations, timing and text-fit checks
remain in use. Context fields remeasure on step changes and keyboard focus moves
to the active panel heading. CSS selectors are scoped to the Nukkia root so the
redesign wins over older styles regardless of Vite CSS chunk load order. Collapsed
desktop navigation and mobile layouts have explicit overrides. Dark action text
uses Night on Blue, preserving the documented contrast requirement.

## Evidence and limits

- Full onboarding suite: **468 passed, 0 failed**.
- Typecheck, production build, scoped ESLint, and whitespace check passed.
- Independent review found no remaining material issues; focused suites:28/28.
- Loopback 8082 returned HTTP200 for panel and the reported context URL.
  Transformed studio, home, context, and stylesheet modules contain the new UI.
- Browser inspection was attempted with fresh IAB and Chrome tabs; both providers
  were unavailable and the browser inventory was empty. Actual visual appearance,
  focus behavior, and narrow-screen rendering have **not** been browser-verified.
- Existing repository-wide lint failures outside these changes were not repaired.

Health options remain fictional, predefined text examples. The owned-avatar
provider, medical policy, professional review, audio, paid render, and approved
delivery are not activated by this redesign. The existing generic image editor
does not certify medical compliance. Demo persistence is the existing session
storage; authenticated persistence uses the existing account/company workspace.

Reviewed source packet uses sorted relative paths, NUL, file bytes, NUL:
`71c2d4e0f08f5349d82ebcd92c672d6a1193045f0cd8c03133e9955cfbb8888a`.
Files: studio.css; components health-studio, workspace-shell, marketing-views,
workspace-context-editor, first-post-workspace, demo-workspace; routes demo and
authenticated/painel; tests health-studio-ui, workspace-context-editor,
workspace-refinement-ui, workspace-shell-ui; docs/nukkia-visual-system.md.

No commit, push, deployment, provider request, or database migration was performed.
