# Coletor local opcional

O gateway Node mantém as conexões HTTPS, DNS fixado, robots e limites. O worker
Python recebe somente recursos já validados pelo gateway no stdin. Não usa
proxies nem stealth e não faz coleta de rede própria.

```sh
python3 -m venv /private/tmp/nukkia-scrapling
/private/tmp/nukkia-scrapling/bin/pip install -r scripts/scrapling/requirements.txt
SCRAPLING_PYTHON=/private/tmp/nukkia-scrapling/bin/python SCRAPLING_RENDER=1 npm run dev
```

Sem SCRAPLING_PYTHON o parser Cheerio permanece ativo. Timeout/erro do worker
também usa Cheerio. O processo usa até 3 segundos e recebe no máximo 1 MB.
Com `SCRAPLING_RENDER=1`, páginas com pouco texto e scripts passam por um
Chrome local via Scrapling. Ele recebe até quatro scripts do mesmo site, já
validados pelo Node, e fica offline: requisições fora desse mapa são abortadas.
O renderizador tem limite de oito segundos e exige Chrome instalado.
Não é um serviço Python de produção; sem o worker, páginas dependentes de JS
podem fornecer apenas metadados. A leitura hospedada continua exigindo sessão.

Teste opt-in de ponta a ponta contra o servidor local (Node 24):

```sh
node --env-file=.env --experimental-strip-types scripts/scrapling/verify-clinics.ts --http
# Adicione --ai para testar também o provedor configurado, com custo de API.
```

O teste verifica Dra. Quisy (incluindo URL com parâmetros de anúncio), Clínica
São Paulo e Laboratório São Paulo: fontes reais, parser, nome, áreas, público,
assuntos, Markdown e preenchimento do perfil sem confirmar pelo dono. Registra
tempos e evidências de identidade encontradas; ausência de logo não é sucesso
de extração de logo. Sem `--http`, chama o mesmo handler diretamente.
