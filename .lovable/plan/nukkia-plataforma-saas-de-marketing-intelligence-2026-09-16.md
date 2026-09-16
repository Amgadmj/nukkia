# Nukkia — Plataforma SaaS de Marketing Intelligence

Plataforma web completa em português, com tema claro e escuro, usando a paleta e a tipografia do site nukkia.com: Roxo Profundo #2A0845, Azul Elétrico #3B82F6, Ciano Neon #06B6D4, Branco Neutro #F8FAFC, fontes Sora (títulos) e Manrope (texto). Logomarca oficial da Nukkia aplicada no topo e como ícone do navegador.

## Jornada do cliente

1. **Entrada e conta** — página inicial curta que recebe quem vem do funil e leva ao cadastro. Cadastro coleta nome, e-mail, telefone, empresa, CNPJ, segmento e número de funcionários. Login por e-mail/senha e Google.
2. **Diagnóstico guiado** — passo a passo com: site (opcional), perfis de Instagram e LinkedIn, público-alvo, mercado, concorrentes, produtos/serviços, objetivos e restrições éticas do segmento (importante para clínicas).
3. **Identidade da marca** — upload da logomarca, leitura automática das cores dominantes e geração de três propostas de identidade (paleta, tipografia, tom de voz). O cliente escolhe uma e pode ajustar. Vira o "Cérebro da Empresa" que alimenta todo o conteúdo.
4. **Relatório de presença digital** — análise do diagnóstico com notas por área (identidade, constância, conteúdo, conversão), pontos fortes, lacunas e recomendações priorizadas.
5. **Trilha gamificada** — missões geradas a partir do relatório, com níveis, conquistas e XP acumulado. Cada etapa concluída libera a próxima e soma pontos.
6. **Planejamento de conteúdo** — calendário mensal com frequência sugerida por rede, pauta por pilar editorial e formatos (arte única, carrossel, reels, stories, artigo). Textos e roteiros gerados por IA, com fluxo de aprovação do cliente.
7. **Produção das peças** — geração das artes e capas de carrossel por IA, respeitando a identidade escolhida. Cliente aprova, regenera ou substitui.
8. **Agendamento nas redes** — conexão real das contas e publicação/agendamento automático no Instagram e no LinkedIn.
9. **Painel de resultados** — alcance, engajamento, visitas ao perfil, cliques no site, salvamentos, comentários, curtidas e mensagens, com evolução no tempo e comparação por publicação.

Área administrativa da Nukkia para acompanhar clientes, diagnósticos e uso.

## O que preciso de você

- **LinkedIn**: conecto pela integração pronta da Lovable; você autoriza a página da Nukkia/cliente em uma tela dentro do chat.
- **Instagram**: publicar exige um aplicativo próprio no Meta for Developers, com conta Instagram Profissional ligada a uma Página do Facebook e as permissões `instagram_content_publish` e `instagram_manage_insights` aprovadas pela Meta (a revisão costuma levar de dias a semanas). Vou construir toda a conexão e o agendamento; precisarei que você crie o app na Meta e me passe as credenciais quando estiverem prontas.
- Enquanto a aprovação da Meta não sai, a parte do Instagram fica pronta mas sem publicar de verdade. O LinkedIn já funciona de ponta a ponta.
- As métricas do painel vêm direto das redes conectadas; antes da conexão, o painel mostra um estado vazio explicando o que falta.

## Detalhes técnicos

- TanStack Start + Tailwind v4; tokens de cor em `src/styles.css` com variantes clara/escura e alternador persistido.
- Lovable Cloud para banco, autenticação e armazenamento (logos e peças geradas). Tabelas: `profiles`, `companies`, `diagnostics`, `brand_kits`, `missions`/`user_progress`, `content_plans`, `content_items`, `assets`, `social_accounts`, `scheduled_posts`, `metrics_snapshots`, `user_roles`. RLS por empresa em todas, com grants explícitos.
- Textos, roteiros e relatórios via Lovable AI (`openai/gpt-6-astra`, Responses API com streaming); artes via `openai/gpt-image-2.5-sunburst`.
- Publicação: conector LinkedIn pela gateway da Lovable; Instagram via Graph API com credenciais próprias guardadas em secrets. Agendamento por rota pública `/api/public/cron/publish` disparada por agendador, com verificação de assinatura.
- Coleta de métricas por job periódico gravando snapshots diários para o painel.

## Ordem de construção

1. Base visual, tema claro/escuro, landing de entrada e autenticação.
2. Cadastro da empresa, diagnóstico e relatório com IA.
3. Identidade da marca (upload da logo, três propostas, escolha).
4. Trilha gamificada com XP e conquistas.
5. Calendário, geração de textos e aprovação.
6. Geração de artes e biblioteca de peças.
7. Conexão LinkedIn + Instagram, agendamento e publicação.
8. Painel de métricas e área administrativa.
