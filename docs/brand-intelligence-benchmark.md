# Teste controlado — 16/10/2026

Site autorizado: https://laboratoriosaopaulobh.com.br/

O problema observado na prévia era `missing-api-key`: a cópia temporária servida
no localhost não tinha configuração do provedor. A síntese controlada com a
configuração do workspace retornou uma frase institucional como nome. A API
agora descarta o nome do modelo e preserva o candidato determinístico. O dono
revisa os três campos antes de liberar as próximas etapas.

## Medições comparáveis do pipeline

Uma página, mesmo gateway de HTTPS/robots, CSS, logo e Markdown; três amostras
alternadas, sem chamada de IA nesta medição. Node 24.21.0, Scrapling 0.4.15,
Python 3.14.7. O parser efetivamente utilizado é registrado por fonte.

| Parser | Amostras (ms) | Mediana (ms) | Texto útil | Logo | Cores/fontes |
|---|---|---|---|---|---|
| Cheerio | 870, 3124, 625 | 870 | 5093 caracteres | Sim | 8/4 |
| Scrapling | 3794, 1612, 896 | 1612 | 5094 caracteres | Sim | 8/4 |

Neste site estático, Scrapling não melhorou a cobertura textual e teve mediana
maior. A amostra pequena mistura variação de rede, cache e custo de subprocesso;
não sustenta conclusão geral sobre outros sites. O modo opcional permite novos
pilotos sem trocar o parser padrão ou contratar serviços. Renderização JS por
navegador ainda não faz parte deste adaptador offline.

O primeiro teste exploratório de Fetcher direto (1,9s/7710 caracteres) não usava
a mesma limpeza e controles do gateway. Não deve ser interpretado como vantagem
de desempenho de produção sobre os 3,6s/5079 caracteres medidos inicialmente.

## Evidências de integração

No navegador, o perfil mostrou nome, área e hipótese de público juntos depois do
processamento. O documento contém URLs, data de coleta e texto público. CSS
forneceu candidatos #DD5934 e #8B3211, família Geist e URL de logo. Logos raster
são baixados pelo gateway e têm paleta analisada localmente com Pillow.

O dono ainda precisa confirmar o perfil. A revisão automática bloqueou o clique
do agente nessa confirmação; não foi contornada. Cartões e identidade possuem
verificações de renderização e fluxo, mas sua passagem no navegador após essa
confirmação permanece pendente. Não houve publicação ou ativação de infraestrutura.
