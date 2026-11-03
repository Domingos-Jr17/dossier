# Casos reais (sites reais, IA real, perfil fictício)

Scripts de Playwright que conduzem uma instância de produção do Dossier, com a IA e os sites a sério, a partir do CV fictício de "Marta Sitoe" (`cv-marta-sitoe.html`). Serviram para o relatório do ramo `mz`. **Gastam chamadas à IA** (DeepSeek) e fazem pedidos aos sites de vagas.

Preparação:

```sh
yarn build && cp -r public .next/standalone/ && cp -r .next/static .next/standalone/.next/
# uma base de dados própria, e a chave da IA no ambiente:
export DOSSIER_AI_KEY=...   # nunca no repositório
sh tools/real-cases/start-real.sh     # porta 3200, base dossier_real
```

O `start-real.sh` usa a palavra-passe de teste `e2e-password` e um segredo de teste: é só para uso local. Em cada script, `rc.cjs` abre o navegador autenticado (`CHROMIUM_PATH` indica um Chromium, se o do Playwright não estiver instalado). As capturas, o estado da sessão e os resultados ficam nesta pasta e não vão para o git (`.gitignore`).

- `stage1`…`stage6`: os passos (perfil, procurar vagas, candidatura, Kukwira, links, agente, várias fontes, interface em português). `ONLY=1,2 node stage6.cjs` corre só alguns.
- `lang.cjs`, `leftovers.cjs`: páginas em português, e os textos que ainda ficam em inglês.
- `make-pdf.cjs`: gera o PDF do CV fictício.
