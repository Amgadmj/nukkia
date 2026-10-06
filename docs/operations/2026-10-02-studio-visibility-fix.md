# Nukkia: studio visibility fix

The operator could not see the new studio at
`/demo?passo=6&aba=cerebro&editar=contexto&retorno=conteudo`. That route correctly
opened the existing context form, while the studio was hidden behind a Content
tab whose default was the older piece editor. The landing page and shared
visual surfaces also remained unchanged in the initial prototype.

The product name remains **Nukkia**, with its existing official symbol. The
health studio is a feature, not a product rename.

- Landing, sign-in and workspace colors now use the documented Nukkia visual
  system. Copy describes the actual fictional text-preview capability.
- Main navigation exposes Estúdio de saúde, and Content opens that studio by
  default. Existing piece/approach/calendar tabs remain available.
- The demo selects its tab through `vista` in the URL, preserving explicit
  legacy views across fresh rendering and context return.
- The context form has an Abrir estúdio de saúde shortcut. It preserves saved
  answers and blocks navigation during an unfinished reference-link edit.
- The local application dashboard uses the name Nukkia and opens the studio
  demo directly.

Open http://127.0.0.1:8082/demo?passo=6&aba=conteudo&vista=saude.
The updated landing is http://127.0.0.1:8082/.

Verification: **464 tests passed**, build and typecheck passed, changed-file
ESLint and whitespace checks passed. Independent review had no remaining
material findings. Full repository lint retains the previously documented
99 existing errors in unchanged authentication files.

At **2026-10-02 05:09:31 UTC**, the existing preview served the updated landing
with title “Nukkia — Conteúdo para sua clínica” and the new main heading, with
no “Nukkia Health” product rename. The split demo component served URL-selected
studio navigation, and the dashboard served the new direct launch link.
Browser automation providers were unavailable: actual desktop/narrow visual
appearance, focus and playback remain unverified.

Reviewed base/HEAD: `5f1a1dab06e003b47614d0597bd8279db2b391c3`.
Final 18-file review packet SHA-256:
`fcf8adc556271f13bf45dc9783b663f66777b6f8ff53e9393dae118e5ed5fbe3`
(sorted relative path + NUL + bytes + NUL). Production provider, policy,
consent and release authority remain outside this prototype.
