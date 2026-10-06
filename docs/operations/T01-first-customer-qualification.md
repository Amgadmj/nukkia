# T01 — qualificação do primeiro cliente

Observação local: 2026-10-02, 20:15:35 UTC. Coordenador executou os testes de
navegador; esta etapa não foi executada por um trabalhador OpenHands. Escopo:
marca fictícia, demonstração anônima em `http://127.0.0.1:8082`, perfil novo e
descartável do Chrome. Nenhum código da aplicação foi alterado.

## Resultado local

| Passo | Ação e esperado | Observado |
| --- | --- | --- |
| Preparar marca | Criar conta de demonstração; escolher preenchimento manual; informar nome, área, público, oferta e detalhe fictícios | Onboarding concluído; nenhuma pesquisa de provedor autorizada |
| Confirmar identidade | Escolher abordagem Explicar; finalizar identidade e salvar | Identidade confirmada; rascunho de três páginas preparado |
| Editar e recuperar | Mudar o título para “Peça fictícia T01” e recarregar | Título preservado em armazenamento de sessão da demonstração |
| Exigir revisão | Tentar exportar antes da aprovação | Botão de download desabilitado |
| Aprovar versão | Marcar conferência e aprovar a peça | Versão aprovada; download disponível |
| Exportar | Baixar arte e legenda; inspecionar o ZIP efetivamente recebido | ZIP íntegro de 179.077 bytes; três PNGs de 1080 × 1350, legenda e referências |
| Invalidar aprovação | Editar a legenda depois de aprovar | Download novamente desabilitado |
| Layout | Inspecionar 1360 × 1000 e 390 × 844 | Sem transbordamento horizontal; zero exceções JavaScript |
| Health | Abrir Estúdio de saúde e inspecionar produção | Produção com gêmeo digital indisponível; botão Gerar desabilitado |

O ZIP sintético tem SHA-256
`bb14434ce22847c62a2dd75ae814c034c898006794ea348f133689499d118573`.
O perfil temporário foi encerrado e removido. A captura e os JSONs/ZIP de
evidência ficam no estado privado do command center, em
`state/nukkia-workflow/T01-local`. Não são dados de cliente nem material clínico.
O navegador permitiu apenas GETs ao servidor local e bloqueou quatro outras
requisições; não enviou POSTs ou pedidos a provedores externos neste teste.

Uma primeira tentativa do roteiro parou depois de salvar a identidade porque
a interface retorna ao conteúdo padrão Health. O teste foi corrigido para
selecionar “Três abordagens” antes de preparar a peça genérica. Isso foi um
erro do roteiro; não estabeleceu defeito na aplicação. O registro foi preservado.

## Supabase identificado; qualificação autenticada pendente

O operador indicou Supabase e a conta de Amgad. A documentação local identifica
`Amgadmj's Project`, referência `ihppmpnlpsvxqsqenjfl`. Os URLs de navegador e
servidor configurados concordam com esse projeto. As chaves não foram copiadas
para trabalhadores, Pixel ou este relatório.

O checker existente executou três GETs com `limit=0`, usando somente a chave
pública. `marketing_workspaces`, `brand_stories` e `onboarding_drafts` retornaram
401 / `42501`, confirmando exposição das tabelas com acesso anônimo restrito.
Isso não comprova persistência autenticada, isolamento por empresa ou buckets
privados. O comando foi:

```sh
NITRO_PRESET=node-server npm run check:demo -- --remote
```

O preset foi selecionado apenas para essa checagem; nenhum deploy ocorreu.
Sem esse preset explícito, o checker recusou a checagem remota por configuração.
O `project_id` em `supabase/config.toml` identifica o ambiente local da CLI;
não é evidência suficiente para escolher um projeto cloud. Conforme a
[documentação Supabase](https://supabase.com/docs/guides/local-development/cli/config),
ele distingue projetos locais no mesmo host. Não foi modificado por suposição.

## Próxima execução autenticada

Pré-condições: escolher staging ou dois usuários QA dedicados no projeto
identificado; usar empresas e arquivos sintéticos; manter segredos no ambiente
de teste, fora do pacote OpenHands. Não testar com a sessão pessoal de Amgad.

1. Entrar como QA A e criar empresa A; repetir com QA B e empresa B.
2. Como A, editar Cérebro, salvar e recarregar em perfil novo. Comparar a versão
   e os valores enviados/recuperados; distinguir cache local de persistência real.
3. Como B, tentar ler e alterar a empresa A pelas APIs da aplicação e pelo banco
   com credenciais normais. Esperado: nenhuma leitura ou alteração autorizada.
4. Abrir duas sessões de A; salvar a primeira e depois a revisão antiga da segunda.
   Esperado: conflito 409, preservação do rascunho e recuperação manual verificável.
5. Confirmar troca de empresa, logout/login e recuperação por proprietário,
   sem mistura de rascunhos entre A e B.
6. Repetir preparação, edição, aprovação, ZIP e invalidação da peça genérica
   em sessão autenticada. Verificar os arquivos, não apenas a mensagem de sucesso.
7. Verificar o acesso privado aos assets sintéticos e a expiração/revalidação
   dos links assinados. Não chamar provedores pagos ou produção Health nesta etapa.

Cada caso deve registrar precondição, ação, esperado, observado, versão,
evidência e bloqueio. Um defeito reproduzido recebe uma correção separada no
arquivo responsável, com checks e revisão independente. Até esses testes
passarem, não declarar o primeiro fluxo de cliente qualificado em produção.
