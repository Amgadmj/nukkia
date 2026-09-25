# Primeira peça com contexto de marca

## Entrega desta iteração

Demo local: referência da marca → confirmar contexto → escolher oferta e ação → painel com arte editável e legenda. Pesquisa começa em segundo plano, sem bloquear o preenchimento. A peça usa somente o briefing confirmado; sugestões de fontes nunca se tornam fatos silenciosamente.

Critérios: mostrar fontes e falhas reais, preservar edições durante pedidos assíncronos, validar informações/visual/CTA antes de aprovar, exportar PNG 1080×1350 + legenda num ZIP. Alterar contexto, texto ou visual invalida a aprovação. As respostas anteriores da demo continuam recuperáveis.

## Coleta e Scrapling

Scrapling foi avaliado em https://github.com/D4Vinci/Scrapling. Continua candidato a worker Python isolado para páginas com JavaScript; **não foi integrado**. A coleta atual reutiliza o backend Node/Cheerio com DNS validado e fixado na conexão, robots.txt, limites de bytes, redirecionamentos, tempo e concorrência. Lê até oito páginas prioritárias (orçamento de nove segundos), usando links internos e sitemap, depois amplia até dezesseis no total (dezoito segundos adicionais). São limites, não promessa de encontrar essa quantidade. Não contorna login, CAPTCHA ou bloqueios nem lê históricos de redes sociais.

Introduzir Scrapling quando os pilotos mostrarem falhas relevantes em páginas dinâmicas. O worker deverá manter as mesmas regras de saída de rede, escopo, limites e proveniência. Não usar as funções de bypass como substituto de acesso autorizado.

## Referências agrupadas — 24/09/2026

O onboarding exibe um item por site (normalizando `www`) ou perfil social, com páginas internas recolhidas. O conteúdo original, as URLs e as datas continuam disponíveis no Cérebro da marca e nas referências da peça. Material colado permanece separado.

O coletor identifica perfis sociais em links das páginas e outros sites declarados pela empresa em `rel=me` ou `sameAs` de metadados de organização. Deduplica parâmetros de rastreamento e limita a descoberta a 12 referências. Não segue esses links nem considera perfis encontrados como fontes lidas, contas conectadas ou métricas disponíveis. Sites de fornecedores não são tratados como sites da marca apenas por aparecerem num link.

Teste local na Clínica São Paulo: três páginas do mesmo site agrupadas em um item; Instagram e Facebook encontrados separadamente. LinkedIn não encontrado nas páginas consultadas. Nenhum material enviado a IA, nenhum deploy.

## Limite de lançamento (produção)

A coleta desta demo fica restrita ao servidor de desenvolvimento, requisições locais de mesma origem e limites de uso/concorrência. A síntese com Anthropic é opcional e requer autorização específica na interface. Para liberar em produção, conectar à conta/empresa autenticada e à quota persistente existente, com uma fila durável e armazenamento por empresa. Não publicar um coletor/gerador anônimo. Esta iteração não executa migrações nem deploy.

Não prometer exclusividade absoluta, conversão, vendas ou conformidade automática. A entrega atual é uma composição local editável que usa o briefing confirmado, com identidade visual controlada e revisão humana. O modelo de design limita os textos para evitar cortes.

## Síntese e decisões implementadas — 24/09/2026

Após autorização explícita do operador, foram integradas coleta progressiva e síntese real via Anthropic. O cliente recebe NDJSON com progresso observado, sem contagens simuladas. Nome, segmento e público podem preencher rascunhos vazios; dados editados ou confirmados não são substituídos. Ofertas, diferenciais e FAQ são clicáveis e editáveis, com fonte, coleta, classificação e confiança qualitativa (não probabilidade).

Fluxo: confirmar site e opção de IA → coletar evidências → minimizar conteúdo localmente → sintetizar → validar citações → revisar contexto → escolher oferta e confirmar condições → preparar peça. Material colado manualmente não é enviado ao provedor. Não há envio de credenciais, URLs identificadoras, contatos ou respostas pessoais no payload planejado. A filtragem é conservadora, mas **não é garantia de anonimização**: avaliação de privacidade e política de retenção/contrato continuam bloqueios de produção, registrados em Riscos.

Referências são agrupadas por site/perfil, com ícones, handles, adição e remoção. Confirmá-las é obrigatório antes da peça; novos perfis invalidam a confirmação anterior. Fontes removidas não alimentam novas sugestões. Revogar autorização, trocar a referência ou desmontar a tela cancela a requisição; isso não desfaz conteúdo já transmitido. A pesquisa complementar depende da aba aberta: **não existe fila durável nesta entrega**.

`ANTHROPIC_RESEARCH_MODEL` usa por padrão `claude-haiku-4-5-20251001`, separadamente de `ANTHROPIC_TEXT_MODEL`. Timeout de vinte segundos, sem retries automáticos; chamada total limitada a sessenta e cinco segundos. Haiku foi verificado na conta e em uma síntese real após Sonnet atingir o timeout. A [documentação da Anthropic](https://platform.claude.com/docs/en/test-and-evaluate/strengthen-guardrails/reduce-latency) recomenda modelos rápidos e saídas menores para latência. A meta de 8–12 segundos não é SLA validado.

Campanhas datadas não são apresentadas como vigentes. As três categorias só aparecem quando há evidência; nunca completar uma cota inventando promoções. Citações sustentam a origem, não a verdade independente. A revisão de condições, direitos dos ativos e regras profissionais continua humana. A composição da primeira peça segue o mecanismo existente; não foi adicionado um selo de conformidade nem um avaliador médico automático.

## Piloto e aceitação

Medir conclusão do contexto, tempo até a primeira peça aprovada e proporção de peças exportadas, além de uma rubrica humana de qualidade. Não otimizar apenas conclusão de formulário. Avaliar sites com HTML e JavaScript antes de decidir pelo worker Scrapling. O agrupamento foi testado com o site real da Clínica São Paulo; isso não valida desempenho de marketing ou leitura de redes sociais.

## Revisão de consentimento e referências — 24/09/2026

Desenho aprovado: duas opções separadas, “Este é o site da minha marca. Autorizo a análise.” e “Analisar meu site com IA e personalizar minhas sugestões.” A segunda é opcional, desmarcada em contas novas. “Como usamos seus dados” mantém acessíveis, antes da escolha, o provedor Anthropic, a finalidade, o possível processamento fora do Brasil, a limitação dos filtros e a alternativa sem envio à IA. Limites de páginas e de leitura de redes ficam nesse detalhe; o aviso sobre dados pessoais também aparece junto ao campo de material colado.

Os termos permanecem no cadastro real: não são incorporados à autorização opcional de IA. Esta melhoria de interface não certifica conformidade. Política de privacidade, registro de autorizações, retenção, contratos e mecanismo de transferência internacional ainda precisam de validação para produção. Referências: [LGPD, arts. 6º, 8º e 9º](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm) e [ANPD — transferência internacional](https://www.gov.br/anpd/pt-br/assuntos/assuntos-internacionais/transferencia-internacional-de-dados).

Cada referência agora permite editar a URL ou o @perfil, salvar e cancelar. Alterações salvas exigem nova conferência; o botão “Confirmar minha marca” e o envio por Enter não avançam com referências pendentes ou edição aberta. Alterar o site principal descarta a pesquisa antiga e retorna à autorização; editar uma rede não atribui o conteúdo do perfil anterior ao novo. Fontes continuam disponíveis em “Por que sugerimos isso?”, recolhido por padrão — transparência da evidência, não exposição dos prompts ou da lógica interna. Público sugerido pela IA continua sendo hipótese revisável, não um fato validado.
