# Meu painel: diagnóstico, prioridades e execução

Data: 25/09/2026. Direção aprovada na conversa; especificação escrita aguardando revisão. Este documento descreve a próxima entrega, não funcionalidades já implementadas.

## Resultado esperado e escopo

Ao abrir **Meu painel**, o usuário entende o objetivo da marca, o que falta configurar e qual ação executar. Consegue concluir o diagnóstico, personalizar a marca e retomar conteúdo sem repetir o onboarding. Resultados aparecem somente quando existem dados utilizáveis.

Reorganizar o workspace existente, compartilhado entre demo e conta. A prioridade é corrigir seus fluxos e estados. OAuth real será um próximo subprojeto: conexões entram como prioridade na experiência, mas não serão simuladas como funcionando.

Uma alteração somente visual manteria a fragmentação dos dados. Construir agora toda a automação social ampliaria o escopo antes de resolver a base. A opção escolhida é reaproveitar os componentes existentes com navegação, diagnóstico e identidade coerentes.

## Evidências da inspeção

- `src/routes/demo.tsx` usa `onEditBrief={() => setStep(0)}`. O painel autenticado envia para `/boas-vindas?rever=true&etapa=0`. Completar contexto reabre o onboarding.
- `src/lib/onboarding.ts` contém 27 perguntas em cinco capítulos. O campo `restrictions` da versão original permanece no schema, mas não no formulário. O diagnóstico está acessível no Cérebro, porém pouco visível nos caminhos principais.
- `src/routes/_authenticated/marca.tsx` renderiza identidade da peça e kit da conta em blocos diferentes, com título duplicado. Na conta inspecionada, um logo salvo no kit não aparecia na peça.
- Canais lê referências e registros existentes, mas não contém um fluxo OAuth funcional. Um registro em `social_accounts` não comprova autorização válida.
- `WorkspaceSaveStatus` mostra indisponibilidade de sincronização nas páginas autenticadas. A falha é observável; sua causa exata ainda precisa ser diagnosticada. Uma migração local não prova aplicação no servidor.

## Meu painel

Usar **Meu painel** como título principal grande, com a marca como contexto discreto. Remover “Uma boa direção. Uma próxima ação.” e chamadas genéricas semelhantes, sem substituí-las por outro slogan.

| Área | Conteúdo e ação |
| --- | --- |
| Seu objetivo | Resultado comercial confirmado e indicador escolhido; Editar. Sem objetivo: Definir meu objetivo. |
| Prioridades | Até três ações concretas, uma principal. Cada uma abre a seção e o campo necessários. |
| Resultados | Até três indicadores pertinentes, com fonte, período e atualização. Sem dados: configuração compacta, sem zeros ou gráficos fictícios. |
| Em andamento | Diagnóstico incompleto, peça em edição ou análise existente. Retomar preserva estado; ocultar quando vazio. |

Na conta nova, priorizar diagnóstico essencial, preparação do canal principal e identidade. Na conta configurada, revisões e tarefas existentes. Se a conexão está bloqueada por dependência externa, informar e oferecer a próxima ação executável. A priorização inicial usa regras determinísticas sobre o estado salvo, não uma nova análise por IA nem conclusões de desempenho sem evidência.

No celular, manter a mesma hierarquia em uma coluna. Sem carrosséis obrigatórios, cards redundantes ou títulos duplicados. Preservar logo oficial, tema claro/escuro e acessibilidade.

## Diagnóstico acessível dentro do app

Entrada visível em Meu painel, Minha trilha e Cérebro da marca. Onboarding é introdução; diagnóstico é uma atividade contínua do workspace.

O resumo essencial reúne quatro decisões:

- Resultado desejado: reutilizar `goals`.
- Oferta e público prioritários: reutilizar `offers` e `audience`.
- Principal obstáculo: reutilizar `challenge`.
- Indicador desejado: preferência de acompanhamento. Selecionar não cria dados ou conexão.

Nome, segmento e detalhe concreto continuam editáveis. Aproveitar respostas existentes sem perguntar novamente. Restaurar `restrictions` como pergunta opcional sobre limites de comunicação; não solicitar dados de pacientes.

Preservar os cinco capítulos para aprofundamento. Distinguir **essencial concluído** de **diagnóstico aprofundado**; questões opcionais não bloqueiam toda a produção de conteúdo. Mostrar conclusão por capítulo e continuar no primeiro campo pendente. O resumo é editável e separa fatos confirmados de hipóteses.

## Navegação e retorno

| Origem | Destino | Ao concluir |
| --- | --- | --- |
| Painel: definir objetivo/completar contexto | Editor interno, focado na decisão pendente | Painel, com prioridades recalculadas |
| Conteúdo: completar contexto | Mesmo editor, com retorno Conteúdo | Retomar a peça existente |
| Trilha: diagnóstico | Capítulo ou decisão pendente | Trilha atualizada |
| Painel/trilha: adicionar logo | Identidade, seção do logo | Área de origem |
| Painel/trilha: configurar canal | Canais, plataforma selecionada | Estado verdadeiro, nunca sucesso simulado |

Seção, campo e retorno devem sobreviver por URL. Retornos pertencem a uma lista interna permitida, sem redirecionamentos arbitrários. Back, reload e links diretos não apagam respostas. Recomeçar onboarding exige ação explícita distinta.

## Respostas e salvamento

Reutilizar `MarketingProvider`, contrato de workspace e controle de revisão; não criar outro armazenamento concorrente para as mesmas respostas.

- Na conta, dados antigos do diagnóstico inicializam somente campos ausentes. Não sobrescrever respostas mais recentes ou rascunhos.
- Editor e consumidores compartilham respostas normalizadas. A geração existente de diagnóstico recebe os valores atuais. Relatórios anteriores permanecem disponíveis e identificados como anteriores quando o contexto muda.
- Demo permanece separado da conta. Preservar isolamento por usuário/empresa e compatibilidade com dados legados. Não executar reset geral ou descarte de campos necessários à compatibilidade.
- Campos novos recebem defaults compatíveis. Uma falha ao salvar ou gerar não marca o relatório como atualizado.

Investigar a resposta segura de `/api/marketing-workspace`, autenticação, schema e autorização. Corrigir causas locais demonstráveis, sem registrar chaves, tokens ou dados sensíveis. Se houver dependência de migração remota, reportar o bloqueio e a ação necessária; não aplicar por inferência.

Trocar o banner global por um indicador compacto: **Salvo na conta**, **Salvando**, **Somente nesta aba** ou **Revisar conflito**. Detalhes permitem recuperação e nova tentativa. Falha também no armazenamento local exige aviso visível sobre perda ao fechar a aba. Conflitos mantêm resolução explícita, sem sobrescrita silenciosa. Reduzir ruído não significa esconder risco.

## Uma identidade, peças com versões

Uma página Identidade organiza logo, cores, tipografia, tom e materiais. Kit da conta é a base reutilizável; ajustes da peça pertencem ao editor de conteúdo, não a um segundo kit idêntico.

O kit é padrão para novas peças. Peças existentes mantêm snapshots e ajustes intencionais. Aplicar identidade atualizada exige ação explícita e invalida a aprovação da versão alterada, sem destruir histórico. Divergências aparecem como “Da marca” e “Ajuste desta peça”, sem substituição automática.

Mostrar os materiais já salvos na primeira abertura. Demo usa sua própria identidade. Reutilizar validação de arquivos e preparação de assets; identificar formatos não suportados pelo renderizador. Não importar automaticamente fotos de terceiros nem presumir licença de uso porque estão públicas.

## Minha trilha

Fases nomeadas, sem numeração decorativa:

- Objetivo e diagnóstico.
- Canais e presença digital.
- Identidade da marca.
- Conteúdo e execução.
- Resultados e aprendizado.

A sensação de jornada vem de continuidade visual, checks, conclusão verde legível e próxima ação clara, sem copiar dados de pacientes do Cortex. Fases podem avançar em paralelo; OAuth não bloqueia todo o produto.

Conclusões vêm de trabalho salvo, nunca só visitas ou cliques. Confirmar marca, concluir essenciais, confirmar identidade, aprovar peça e exportar são marcos diferentes. Escolher estilo não prova que exista uma peça pronta.

Preservar XP conquistado sem duplicá-lo em edição/reload. Mudanças que exigem revisão geram “Revisar”, sem apagar a conquista histórica. Novas tarefas de preparação não recebem pontuação arbitrária nesta entrega. Progresso de configuração não é nota de qualidade da marca.

## Canais e indicadores: verdade antes de aparência

Separar **link identificado**, **link confirmado pela marca**, **conta autorizada** e **dados disponíveis**. Dados antigos podem existir com autorização vencida; informar atualização e necessidade de reconexão quando verificável. Status legado sem verificação continua não verificado.

Nesta entrega, revisar links e escolher o canal principal são ações funcionais. Onde não existe conector, informar **Conexão ainda não disponível**, sem autorização fictícia. Para clínicas, Instagram ou Google Business podem ser hipóteses úteis, não regra universal. Não deduzir qualidade da presença contando URLs nem assumir que publicar mais resolve o problema.

Reutilizar snapshots existentes apenas com fonte e período identificáveis. Ausência não é zero; dados antigos mostram a data real. Não somar períodos incompatíveis. Clique no WhatsApp não é conversa nem agendamento. Agendamentos e receita exigem fonte própria que os comprove. Não apresentar dados da demonstração como resultados reais.

Próximo subprojeto: um conector real da autorização à coleta, atualização, revogação e recuperação de falhas. Requer credenciais, permissões e eventual aprovação da plataforma. Começar por leitura; publicação social é autorização e implementação separada.

## Critérios de aceitação

- Completar contexto no demo e na conta abre edição interna e retorna à origem, preservando respostas, pesquisa e peça.
- Respostas legadas reaparecem e alimentam os mesmos consumidores; restrições voltam a ser preenchíveis.
- Painel usa a hierarquia proposta sem prometer peça pronta ou métricas inexistentes.
- Identidade exibe kit existente; aplicar mudanças numa peça é explícito e revoga sua aprovação sem apagar histórico.
- Trilha reflete conclusões reais, preserva XP e dá destaque a diagnóstico, canais e identidade.
- Links não viram conexões por inferência. Estados sem dados, antigos e indisponíveis são distinguíveis.
- Salvamento é compacto, mas conflitos e risco de perda continuam claros e recuperáveis.
- Testes cobrem demo/conta, dados antigos, navegação/retorno, validação, revisão de peça, falha/conflito de salvamento, reload e isolamento entre empresas.
- Executar testes pertinentes, typecheck, lint no escopo e build. Fazer walkthrough dos fluxos corrigidos em desktop e 390 px, ambos os temas e teclado. Reportar dependências externas separadamente; testes locais não provam sincronização remota.

## Limites desta execução

Sem push, deploy, migração remota, criação de credenciais, novas chamadas a modelos externos, publicação social ou coleta de pacientes. Não redesenhar novamente a landing page neste recorte nem atualizar documentos externos implicitamente.

Conector e ciclo de métricas/recomendações são próximos subprojetos. Corrigir o workspace não significa entregar essas integrações.

## Referências que orientam a decisão

As referências apoiam a direção, não garantem conversão para Nukkia. [Buffer Insights](https://buffer.com/insights) relaciona análise e ações. O [caso Kuhns publicado pelo Buffer](https://buffer.com/resources/kuhns-inc-case-study/) descreve uso de temas e desempenho para orientar estratégia. [Mailchimp Analytics](https://mailchimp.com/help/about-email-analytics/) explicita dependências de rastreamento e integração. A [configuração do Google Business Profile](https://developers.google.com/my-business/content/basic-setup) e seu [OAuth](https://developers.google.com/my-business/content/implement-oauth) mostram por que uma URL não substitui autorização.

Aplicação à Nukkia: tornar dependências acionáveis e usar diagnóstico para escolher o que medir antes de recomendar produção indiscriminada de conteúdo.

## Próxima etapa

Revisar esta especificação e então preparar o plano técnico com arquivos, testes e ordem de execução. Código de produto ainda não foi alterado nesta etapa.
