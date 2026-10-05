# Nukkia workspace from the supplied Holo references

The operator authorized an in-place redesign and supplied 18 screenshots in
`/Users/nicolacaprirolo/Downloads/Screenshots`. Keep the product name Nukkia,
official symbol, Sora/Manrope, and purple/blue/cyan identity. Reuse Holo's narrow
grouped sidebar, spacious rounded canvas, visual creation cards, focused steps,
and central preview with scene thumbnails. Do not copy its mascot or assets.

## Implementation

1. `workspace-shell.tsx`, `workspace.css`: group the existing seven destinations,
   slim the sidebar, soften the canvas, controls, typography, and both themes.
   Preserve mobile dialogs, keyboard access, saved progress, and account actions.
2. `marketing-views.tsx`, demo and authenticated panel: put setup shortcuts and
   real creation routes first; show actual saved work, and retain measured results.
   Image opens the existing image editor; video opens the text-only Health studio.
3. `health-studio.tsx`: format → settings → three illustrative options → scene
   editor. Show one scene's fields and a selectable thumbnail rail beside a large
   preview. Reuse all revision, undo, timing, fit, and persistence constraints.
   Recover saved options directly into editing. Back preserves the draft.
4. `workspace-context-editor.tsx`: focused Marca → Objetivo → Referências panels,
   preserving existing values and reference confirmation. Guard pending link edits
   when changing panels. Use the same canvas style on existing onboarding screens.

## Verification and stop condition

First add failing behavior tests for progressive creation, selected-scene editing,
reload recovery, back preservation, and reference-panel navigation guards. Run the
full onboarding suite, typecheck, production build, and scoped lint. Review the
final diff independently. Attempt fresh isolated browser inspection, desktop and
narrow, both themes. Report if browser access remains unavailable.

Stop when these existing paths have the new coherent layout and working sequence.
No new provider, avatar, medical approval, scheduling, analytics, public domain,
or paid render integration is part of this visual iteration.
