# Perfil e identidade da clínica

Escopo aprovado em 16/10/2026: coleta pública com Scrapling, evidência em Markdown,
perfil editável confirmado pelo dono, intenções em cartões e identidade visual com origem.

## Fluxo

1. O gateway Node valida HTTPS, DNS, redirects, robots, bytes e orçamento. Scrapling
   processa o HTML recebido pelo gateway em um subprocesso Python local opcional.
   Pillow analisa localmente as cores de logos raster. O worker não recebe URLs para buscar: mantém as restrições de rede existentes. Sem Python
   configurado, Cheerio mantém o fluxo disponível.
2. Nome é candidato determinístico de Organization/site_name/título. Serviços e
   público recebem evidências e hipóteses identificadas. Markdown contém URLs,
   datas, título, texto e identidade observada; material colado não é enviado à IA.
3. Claude seleciona propostas com evidências. Nome não pode ser substituído por
   uma frase produzida pelo modelo. Os três campos ficam disponíveis ao terminar
   o processamento; falha permite preenchimento manual explícito.
4. Dono confirma nome, áreas e público. A confirmação guarda fingerprint dos três
   valores e da referência; alterações invalidam o avanço. Respostas humanas não
   são sobrescritas por pesquisa tardia. Próximas etapas usam somente esse perfil.

## Comunicação e identidade

Intenções: apresentar um serviço, explicar um exame, fortalecer confiança,
convidar para agendar. Cartões de rádio sem imagens decorativas; em seguida
aparecem serviços/propostas reais das evidências.

Identidade observa logo, cores CSS e famílias tipográficas, com URL de origem.
Cores de CSS são candidatas, não um manual oficial. Usuário edita e confirma.
Ausência de identidade mantém proposta identificada. Não baixa fontes externas.

## Verificação e limites

Testar título vs slogan, preservação de edição, confirmação vinculada aos valores,
campos durante processamento, propostas, Markdown e CSS. Rodar npm run check.
Benchmark inicial é amostra única: Node 3,6s/5079 caracteres, Scrapling normal
1,9s/7710 caracteres; não estabelece vantagem geral nem compara texto igualmente limpo.
Claude 21,2s total retornou nome incorreto. Localhost temporário estava sem chave.
Sem deploy, fila durável ou nova infraestrutura nesta entrega.
