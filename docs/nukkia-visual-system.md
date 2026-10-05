# Sistema visual Nukkia

## Vocabulário do produto

Use **Cérebro** como nome da área e **cópia digital da marca** para explicar o
que ela reúne: serviços, público, objetivos, identidade e referências.
Não use “DNA” como nome ou descrição de uma funcionalidade da Nukkia.

Este sistema parte do logo oficial da Nukkia. A referência da Holi Labs foi usada somente como
estrutura de documentação; suas cores e sua linguagem visual não foram copiadas.

Em 2 de outubro de 2026, o operador forneceu 18 capturas do Holo como referência de interface.
O workspace adota menu estreito com grupos, painel de atalhos, criação em etapas e prévia
central com miniaturas. Nome, símbolo, fontes e paleta continuam sendo da Nukkia. Holo e
Holi Labs são referências distintas; nenhum mascote ou ativo de outra marca foi incorporado.

## Princípio

Atlantic foi escolhida pelo operador em 5 de outubro de 2026 e substitui a paleta roxa anterior.
Azul profundo organiza texto e superfícies; teal identifica ações no tema claro; ciano marca
ações no tema escuro e pequenos detalhes. A cor nunca substitui texto, estado ou hierarquia.

## Paleta Atlantic

| Papel | Cor | Uso |
| --- | --- | --- |
| Tinta | `#122B3A` | Texto principal claro e identidade |
| Ação | `#006C72` | Botões e foco em tema claro, texto branco (6,20:1) |
| Ciano | `#56C8C8` | Ação escura com texto `#0B202B`, pequenos acentos |
| Apoio | `#DFF1ED` | Seleção e superfícies de apoio claras |
| Papel | `#FFFFFF` | Fundo claro branco, conforme preferência do operador |
| Texto noturno | `#F5F9FA` | Texto principal no tema escuro |
| Noite | `#0B202B` | Fundo escuro |
| Painel | `#15333F` | Cartões escuros |

Os tokens `--nukkia-*` em `src/styles.css` governam os papéis semânticos de ambos os temas.
Workspace, onboarding, autenticação e landing usam esses tokens. Os nomes legados
`--brand-blue` e `--landing-blue` permanecem aliases de compatibilidade para teal.
Cores de sucesso, atenção e erro continuam distintas, com texto e ícone. Peças dos clientes
mantêm a identidade confirmada: a troca da interface não reescreve cores, materiais ou versões salvas.

## Tipografia

- **Sora**: títulos, números de destaque e nomes de seções.
- **Manrope**: corpo, controles, legendas e dados.
- Títulos usam peso entre 550 e 650, com espaçamento levemente negativo.
- Corpo usa entre 13 e 16 px, com altura de linha generosa.

## Aplicação

- Use teal para uma única ação dominante por contexto no tema claro; ciano no escuro.
- Use os tokens de seleção, progresso e foco da Atlantic.
- Use ciano apenas como acento; blocos grandes em ciano reduzem a sobriedade.
- No workspace de criação, use apenas o banho suave de teal/ciano/tinta no topo do canvas
  solicitado nas referências do Holo. Dados e estados continuam em superfícies neutras.
- Prefira bordas, espaço e tipografia a sombras fortes.
- O logo oficial deve manter proporção e geometria; não redesenhar o símbolo.

## Acessibilidade

- Texto normal deve manter contraste mínimo de 4,5:1.
- Estados de sucesso, erro e seleção precisam de texto ou ícone, não apenas cor.
- Todo controle interativo mantém foco visível Atlantic.
- Tema claro e escuro usam os mesmos papéis semânticos, não uma simples inversão de cores.

## 5 October 2026 — screenshot audit refinement

The [current 18-reference map](2026-10-02-app-map.md#current-screenshot-to-screen-implementation-audit--5-october-2026) and [candidate-bound visual evidence](operations/2026-10-05-screenshot-screen-audit.md) cover the latest local refinement. Home formats are Image/Carousel/Video; saved gallery previews come from saved snapshots. Identity uses a preview/settings workbench, reflowing to one column on narrow screens. Options have clearly illustrative previews. Reusable source cards show exact saved version and provenance before confirmed replacement; library filters describe real format and approval state. Official assets, Sora/Manrope and theme tokens remain authoritative. Authenticated account canvas is implemented but not browser-qualified.

## 5 October 2026 — section title and trail refinement

The top bar names the active sidebar section; the customer brand stays in the profile. Home and trail do not repeat that heading inside the canvas. Minha trilha uses circular stage controls on a curved alternating path; one selected stage reveals two explanatory bullets and existing task actions below it. Completion checks and counts use saved state; no decorative awards or artificial locks. The demo sidebar has no restart control. See [implementation and sampled evidence](operations/2026-10-05-trail-update.md).

## 5 October 2026 — complete-journey candidate

The [current implementation matrix](2026-10-02-app-map.md#current-accepted-journey-candidate--implementation-versus-qualification) now includes focused brief, reusable local material chooser, service imagery, desktop preview beside editor fields, detailed historical inspection and compact monthly agenda with channel. Health scene references remain a text-frame prototype, not generated media. Welcome respects both themes and states PT-BR scope. Layout rules are implemented; the new candidate still requires actual desktop/narrow, both-theme and keyboard qualification. Older screenshots do not certify it.


## Healthcare follow-up and palette board — 5 October 2026

Current candidate `baabfc16dce1e53aa164bbf9870a4cca12e18f21746e781281fbf68d87cfe6c5` supersedes implementation identity above without rebinding historical screenshots. See `docs/operations/2026-10-05-healthcare-followup-evidence/browser-checks.md` and its source manifest. Healthcare example copy/card sizing, scene-selection reorder and Results → piece navigation repaired. Two new regressions fail before fixes and pass after; final 580 tests/typecheck/build pass, this-pass lint clean; full lint remains 99 errors/9 warnings.

Palette proposals are at `/nukkia-moodboard.html`: Atlantic (deep blue/teal/cyan) and Eucalyptus (deep green/ivory/clay), both without purple, preserving official symbol/Sora/Manrope. User's newer preference supersedes the earlier purple direction for these proposals. Historical proposal state; Atlantic was subsequently selected and applied (see the palette section above).

Synthetic manual browser journey now covers onboarding/brief/options, edits/v1/v2/inspection/duplicate/archive/restore/exact-version planning/reload, Health scene operations/save/reload and sampled keyboard/responsive themes. All 18 existing map rows now distinguish observed and still unqualified states. Whole-app Chrome selection was rejected by automatic review; native confirm remains stuck, upload permission unavailable, download/QA reattachment timed out. No claim of all buttons or authenticated persistence qualified; previously authorized disposable-account checks still need identified non-production sessions. No provider activation or remote data mutation.

## Landing Atlantic — protótipo local

`/proposta` apresenta “Sua clínica tem muito a dizer. Dê forma a isso.” A proposta organiza
contexto → criação → biblioteca → planejamento em uma demonstração interativa, exemplos de
formatos, benefícios para clínicas e perguntas frequentes. A estrutura comercial foi estudada
em https://tryholo.ai/ em 5 de outubro; composição, símbolo, materiais e texto são próprios.
Sem métricas, depoimentos, parceiros ou capacidades de publicação inventados. A home existente
permanece disponível em `/`, já com Atlantic, para comparação.
