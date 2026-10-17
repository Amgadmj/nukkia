# LGPD × dados efetivamente tratados pela Nukkia

Data do levantamento: 16/10/2026. Mapa técnico baseado no repositório; não é parecer jurídico, certificação de conformidade nem verificação das configurações de produção. A base legal e os contratos devem ser definidos pelo responsável com assessoria apropriada.

## Fontes normativas

- [LGPD, texto compilado](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709compilado.htm): conceitos e dados sensíveis (art. 5), princípios (art. 6), bases legais e transparência (arts. 7–9), sensíveis (art. 11), término/conservação (arts. 15–16), direitos (art. 18), transferências (arts. 33–36), registros e segurança (arts. 37, 46–49).
- [ANPD — agentes de tratamento](https://www.gov.br/anpd/pt-br/assuntos/noticias/nova-versao-do-guia-dos-agentes-de-tratamento): definir controlador, operador, suboperadores e responsabilidades por operação, não presumir um único papel para toda a plataforma.
- [ANPD — legítimo interesse](https://www.gov.br/anpd/pt-br/assuntos/noticias/anpd-lanca-guia-orientativo-sobre-legitimo-interesse): a hipótese depende de finalidade e avaliação dos direitos do titular; não é autorização genérica para coletar dados públicos.

## Inventário e controles observados

| Dado e finalidade | Onde / destinatário | Controle observado | Retenção, direitos e lacunas |
| --- | --- | --- | --- |
| Conta: nome, email, telefone, identificadores, credenciais de autenticação | Supabase Auth / profiles. SMTP transportará mensagens de autenticação quando configurado. | Sessão validada, políticas de acesso por usuário; cadastro transmite versão de consentimento. Migração prevê consent_version / consent_accepted_at. | Exclusão autenticada em /api/conta. Não testados o projeto hospedado, backups, logs do provedor ou entrega real. Confirmar base legal da conta e política de retenção. |
| Clínica e respostas: nome, atuação, oferta, público, objetivos, história opcional | companies, diagnósticos, marketing_workspaces; cópias de recuperação no navegador | Rascunhos preservados por dono/empresa, confirmação humana, controle de revisão. | Recuperação em sessionStorage e localStorage, removida no logout/limpeza explícita segundo marketing-provider. Sem TTL comprovado. Exclusão de conta não revoga arquivos já exportados ou cópias externas. |
| Pesquisa pública: URLs, texto, trechos, data, nome candidato, cores/fontes/logo | brand.research no workspace e Markdown exportável | HTTPS/DNS/redirects/robots/limites; proveniência e hipóteses editáveis separadas de confirmação. | Há minimização na preparação para IA, não anonimização garantida. Não há política comprovada de expiração de pesquisas antigas. Dados públicos de profissionais identificáveis ainda podem ser pessoais. |
| Contatos públicos: endereço comercial, email, telefone | Campos estruturados de research e Markdown; fontes/data por candidato | Candidatos públicos do contexto empresarial; formatação consolidada, divergências preservadas para revisão. Não enviados como campo estruturado ao modelo. | Não presume que um número público pertença apenas à empresa. Múltiplas unidades não são automaticamente erro. Confirmar finalidade, necessidade, base legal, prazo e canal de correção. |
| Texto para síntese, diagnóstico e história | Anthropic nas rotinas de texto, mediante ação/autorização prevista pelo fluxo | prepareEvidence filtra fontes; material colado e dados ambíguos permanecem locais no fluxo de pesquisa. Valores sugeridos não confirmam fatos. | Cadastro e autorização da leitura são registros diferentes. Booleanos siteAuthorized / aiAuthorized não demonstram sozinhos consentimento específico versionado com data. Revisar DPA, retenção do fornecedor, suboperadores e salvaguardas de transferência internacional. |
| Artes, imagens, roteiros e vídeos gerados | Serviços configurados nas rotas / content-engine: modelos de imagem/vídeo e armazenamento da conta | Credenciais no servidor, chamadas/quota separadas; não implica publicação em redes. | Inventariar provedores efetivamente ativos, regiões, subprocessadores e logs. Não prometer ausência de treinamento/retenção sem respaldo contratual. |
| Fotos, artes e MP4 enviados pelo usuário | Bucket privado content-media, prefixo UUID da empresa / uploads | RLS de empresa existente; declaração de direito de uso; tipo/tamanho; upload sem sobrescrever; prévia assinada com expiração. | Declaração de licença não é consentimento LGPD de pessoas retratadas. Aviso para não enviar pacientes/dados sensíveis. Storage hospedado/RLS e expiração real não verificados com conta nesta sessão. |
| Logo e material visual local | brand-assets, conteúdo privado e/ou imagem reduzida no rascunho local | Seleção explícita, sem envio automático de arquivo à IA apenas por visitar a identidade | URLs assinadas, cópias no navegador e downloads têm ciclos diferentes. Retenção de arquivos órfãos requer política. |
| Plano, versões, revisão e datas pretendidas | content_items, library / workspace | Versões e aprovação preservadas; mudar data não publica; alterações materiais invalidam aprovação | Explicitar prazos para versões e rascunhos. Não confundir aprovação editorial com autorização de uso de imagem ou validação profissional. |
| Pagamento, assinatura, CPF/CNPJ e eventos financeiros | Rotas de billing / provedor de pagamento / tabelas da conta | Operações autenticadas e registros de eventos | Definir obrigações de conservação e resposta a exclusão por categoria; não prometer apagar registros legalmente conservados sem análise. |
| Telemetria e logs | Logs de aplicação e integração de analytics presente no upstream | Pesquisa registra host, etapa, tempo e contagens, não o texto completo do site | Verificar analytics efetivamente ativo, cookies, identificação, destinatários e TTL de logs. Nenhuma auditoria do ambiente hospedado foi realizada. |

## Decisões e gaps antes de afirmar conformidade

1. Definir papéis e bases legais por finalidade. Uma autorização da clínica para analisar seu site não representa consentimento dos pacientes, funcionários ou profissionais citados.
2. Não coletar prontuários, depoimentos identificáveis ou informações individuais de saúde. Dados de saúde exigem análise específica do art. 11; não estender automaticamente legítimo interesse a esse tratamento.
3. Formalizar aviso claro, finalidades, destinatários, prazo, transferência e direitos. Conciliar a política atual com os provedores realmente usados e registrar versões quando houver alteração material.
4. Registrar evidência adequada de autorização por finalidade, sem inferir consentimento apenas por navegar ou gerar uma peça. Validar revogação e bloqueio de novos envios ao fornecedor.
5. Definir TTL e execução de expurgo para pesquisas, contatos, rascunhos, versões, uploads órfãos, logs e backups. Hoje não há prazo de eliminação comprovado para todos esses armazenamentos.
6. Testar acesso/correção/exportação/eliminação com duas contas isoladas e comprovante de conclusão. /api/conta purga os buckets da empresa antes de apagar o usuário e as linhas em cascata, mas backups/fornecedores/arquivos exportados não ficam automaticamente cobertos.
7. Validar o canal de privacidade anunciado, contrato de operadores/suboperadores e mecanismo de transferência internacional aplicável; preparar resposta a incidentes e responsabilidades.
8. Reconciliar contatos com contexto de unidade/departamento e confirmação do dono. Não substituir um telefone por outro só porque foi coletado depois.

## Critério de sucesso deste mapa

Cada categoria acima aponta dado real, local de persistência/destinatário, controle observado e lacuna explícita. Produção só pode ser qualificada após as decisões e testes correspondentes; testes unitários não comprovam LGPD, entrega de email ou configuração de provedor.
