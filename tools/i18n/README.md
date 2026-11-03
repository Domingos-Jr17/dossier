# Tradução da interface (pt-PT)

Gera `src/lib/i18n/pt-PT.ts`, o dicionário que o `InterfaceTranslator` usa (ver "Interface language" no `DEVELOPMENT.md`).

- `pt00.tsv` … `pt07.tsv`: `id<TAB>português`. Os ids vêm de `todo.json` (os textos ingleses extraídos dos ecrãs); `{}` marca as partes que variam e `-` deixa o texto por traduzir.
- `extra.tsv` … `extra4.tsv`: `inglês<TAB>português`, para textos feitos no código e acrescentados depois. **É aqui que se acrescentam traduções novas.**
- `countries.tsv`: nomes de países (gerado por `countries.cjs`).
- Datas, listas de nomes e contagens, que são padrões feitos à mão: `src/lib/i18n/pt-PT-patterns.ts`.

Gerar o dicionário:

```sh
python3 tools/i18n/build.py src/lib/i18n/pt-PT.ts
```

Ver os textos em inglês que o código tem e o dicionário ainda não sabe: `node tools/i18n/extract.cjs saida.json`, e comparar com as chaves de `pt-PT.ts`.

Também se pode acrescentar a tradução à mão em `pt-PT.ts`, mas o próximo `build.py` apaga-a: ponha-a num `extra*.tsv`.
