# Onboarding: direção antes da produção

Plano aprovado em 25/09/2026. Não publicar nem enviar para a equipe.

## Contrato
- Encerrar com “Sua marca, com direção.”, uma recomendação com oferta/público/formato e três referências: Essencial, Acolhedor, Dinâmico.
- CTA “Ir para meu painel”. Persistir a preferência, sem produzir uma peça ou substituir rascunhos.
- Painel: “Personalizar meu primeiro post” → identidade. Logo opcional; foto obrigatória apenas para a direção fotográfica.
- Trilha: contexto concluído → identidade visual → primeira entrega. Pontos de aprovação/download só após os eventos reais.
- Editor: produzir somente após personalização e ação explícita; estilo escolhido aplicado ao visual.
- Preservar dados/rascunhos anteriores e os fluxos autenticados. Sem novos serviços, migrações, publicação ou envio externo.

## Execução
- Inspeção: componentes compartilhados, JSON de workspace, editor e exportador existentes reutilizados.
- Testes de regressão: conclusão sem peça; reentrada preserva edições; persistência; foto condicional; estilo no exportador e na aprovação.
- Implementado: direção e confirmação de identidade no JSON existente; referências ilustrativas; conclusão sem composição; painel/trilha; personalização com logo encontrado ou upload; criação explícita no editor; estilos aplicados à exportação.
- Verificado no navegador: escolher Acolhedor → painel sem peça, 20 XP → foto obrigatória bloqueia avanço → Essencial permite seguir sem foto → editor ainda sem peça → trilha com identidade concluída e primeira entrega pendente → recarregar preserva a escolha.
- 295 testes passaram; tipagem, lint dos arquivos alterados e build local passaram. Build mantém aviso da ferramenta sobre `inlineDynamicImports`/`codeSplitting`.
- Limite: referências não são artes prontas. A composição existente continua sendo um rascunho a editar, não uma promessa de criação premium. Nenhuma publicação, envio ou chamada de geração externa foi feita nesta alteração.

Decisão: referências usam composições tipográficas ilustrativas, não imagens inventadas da clínica. Não são apresentadas como conteúdo já produzido.

## Revisão independente
- Corrigido: identidade autenticada aguarda recuperação/resolução de conflito; upload que termina após sair da tela não altera outro workspace. Testes reproduziram a falha e passaram após a correção.
- Corrigido: abordagem pendente persiste ao buscar uma foto, sem criar conteúdo. Teste de ida/volta reproduziu a perda e passou após a correção.
- A personalização também exige foto quando o formato escolhido precisa dela, mesmo no estilo Essencial; há uma alternativa explícita de formato sem foto.
- Corrigido: carrossel Acolhedor permite repor uma foto removida e informa sua necessidade. Teste reproduziu o bloqueio e passou após a correção.
- Menor, adiado: o rótulo “Após a personalização” no painel pode ganhar uma variante “Pronto para começar” depois da confirmação. O botão já leva ao destino correto conforme o estado.
- Limite de verificação: demo exercitado no navegador; recuperação do fluxo autenticado coberta por testes, sem criar conta real ou testar banco de produção.
