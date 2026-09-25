# Nukkia — implementação da direção de produto

Direção aprovada em 24/09/2026: conhecer a marca, identificar lacunas, recomendar uma próxima ação, criar uma peça editável e aprender com entregas reais.

## Experiência

- Boas-vindas: símbolo central com movimento ascendente, referência opcional, confirmação da marca e público, objetivo/oferta/detalhe/CTA, recomendação e três abordagens. Diagnóstico aprofundado continua dentro do produto.
- Meu painel: uma próxima ação, justificativa, prévia da entrega, progresso e principal lacuna.
- Minha trilha: Fundação, Posicionamento, Primeira entrega, Consistência, Aprendizado. XP da peça reconhece contexto confirmado, aprovação e início de exportação; não soma cliques repetidos nem promete vendas.
- Cérebro: confirmado, encontrado com fonte/data, hipóteses não confirmadas, lacunas acionáveis. Diagnóstico anterior e capítulos permanecem acessíveis.
- Conteúdo: mesma peça do onboarding, três abordagens, editor de todas as páginas, aprovação por versão e ZIP. Planejamento mensal existente fica disponível como outra aba.
- Identidade: ativos e BrandBook existentes, organizados por propósito.
- Canais/Resultados: distinguir referências públicas de integrações; mostrar somente dados realmente disponíveis.

## Implementação e compatibilidade

Reutilizar BrandOnboarding, ContentRecommendation, FirstPostWorkspace e contratos existentes; compartilhar taxonomia e componentes de painel/trilha/cérebro entre demo e conta real. Preservar relatórios, missões, paletas e calendário anteriores.

Estado da primeira entrega separado por usuário/empresa; API de salvamento usa sessão e RLS, valida conteúdo e compara revisão para evitar sobrescrever outra sessão. Migração aditiva não será aplicada automaticamente. Se indisponível, recuperar rascunho nesta aba e apresentar estado de salvamento verdadeiro. Não usar dados da demonstração para preencher outra conta.

Dados de site continuam no coletor local existente e requerem ação explícita. Nenhuma geração externa, publicação social, migração remota, push ou deploy faz parte desta execução. Chave OpenAI permanece no servidor; validação de listagem não prova geração ou saldo.

## Ordem e verificação

1. Contrato de workspace, recuperação, isolamento e salvamento com revisão.
2. Componentes compartilhados: recomendação no painel, cérebro, trilha e estúdio.
3. Rotas reais e onboarding curto; demo usa as mesmas seções centrais.
4. Identidade, Canais, Resultados e navegação responsiva.
5. Testes de proveniência, estados/XP, aprovação revogada e persistência; typecheck, lint e build; walkthrough local sem enviar material à IA.

Aceitação: navegar entre todas as áreas sem perder rascunho; contexto alterado exige revisão; evidência ausente aparece como pendência; exportação inclui visual e legenda; indisponibilidade de armazenamento não se apresenta como sucesso. Métrica principal: início do onboarding até primeiro início de download aprovado, quando ambos os eventos foram observados. Não equivale a confirmação de publicação.

## Entrega e verificação local — 24/09/2026

- Sete áreas integradas na conta e no demo. Calendário mensal, relatório salvo, missões anteriores, kit de identidade e BrandBook preservados. O demo não oferece um calendário inexistente.
- Identidade salva pode ser aplicada explicitamente à peça, com nova aprovação exigida. Alterações em links do Cérebro aparecem em Canais; links públicos não são tratados como autorização OAuth.
- Restauração por usuário/empresa, fila de salvamento serial, comparação de revisões, recuperação de falhas e conflitos, proteção contra respostas após logout e handoff do cadastro têm testes comportamentais. Testes usam componentes reais com um driver determinístico de hooks; não substituem a validação futura contra a migração instalada.
- Suite `npm run test:onboarding`: 155 testes passaram. `npm run typecheck`: passou. Build local `NITRO_PRESET=vercel npm run build`: passou. `git diff --check`: passou.
- ESLint no escopo alterado: zero erros, dois avisos de Fast Refresh no provider. Lint global continua com 99 erros anteriores em cinco arquivos de `src/integrations/supabase` (formatação e um `prefer-const`), não alterados nesta entrega.
- Walkthrough com Estúdio Aurora fictício: cadastro simulado → quatro momentos → recomendação → painel → revisão de três páginas → aprovação → download ZIP. O ZIP foi inspecionado: três PNGs 1080×1350, legenda e referências. XP observado: 20 → 60 → 90; edição posterior revoga aprovação/exportação. Recarregamento preservou a sessão. Tempo do teste automatizado não é benchmark de ativação de usuários.
- Desktop e viewport 390×844 verificados: navegação mobile abre/fecha e não há transbordamento horizontal. Console do demo sem erros no walkthrough.
- Conta real inspecionada sem editar seus dados: Identidade/BrandBook, calendário e Resultados existentes disponíveis. Estado local de sincronização explicitamente informado.

## Ativação pendente, sem execução nesta entrega

1. Revisar/aplicar `supabase/migrations/20260924170000_marketing_workspaces.sql` e validar RLS, escrita e recuperação em outro navegador com uma conta de teste. Até lá, a peça da conta fica no rascunho desta aba, não sincronizada entre dispositivos.
2. A tela de história da marca também informa que a migração de histórias está indisponível no ambiente atual; sua ativação é separada.
3. Geração por modelos externos, publicação automática e métricas de redes não foram ativadas. A primeira peça usa composição determinística editável; o coletor público existente é limitado ao desenvolvimento local.
4. Nenhum conteúdo enviado a modelos externos, nenhuma migração remota aplicada, nenhum push ou deploy nesta entrega.
