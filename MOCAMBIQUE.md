# Dossier para Moçambique

Este fork (ramo `mz`) adapta o [Dossier](https://github.com/AienTech/dossier) à procura de emprego em Moçambique. Tudo o resto funciona como no projeto original: ver o [README](README.md) e o [DEVELOPMENT.md](DEVELOPMENT.md).

## O que o fork acrescenta

| Área | O quê |
|---|---|
| Fontes de vagas | **emprego.co.mz**, **Kukwira** e **CONTACT** (contact.co.mz), sem chave. E **Várias fontes**, que pesquisa várias ao mesmo tempo (por omissão as três moçambicanas; pode juntar o JSearch, o Adzuna e o FreeHire). |
| Língua | Interface em **português europeu** (botão "Português" na barra lateral) e documentos em português europeu (Definições → Documentos → Português (europeu)). |
| IA | `DOSSIER_AI_PROVIDER=deepseek` liga a DeepSeek diretamente. |
| Correspondência | Requisitos de formação comparados com os cursos do perfil; anos de experiência contados só nas funções da área pedida. |
| Carta | Escolha entre falar das lacunas com honestidade ou deixá-las de fora. O guarda de factos assinala planos inventados ("estou a concluir…") e credenciais e números escritos em português. |
| Candidatura | Quando a vaga se candidata num site (emprego.co.mz, formulários), o separador Email mostra "Candidatar-se em …" com os passos e os anexos. |
| Menu | Startups pode ser escondido (Definições → Pesquisa de emprego → Mostrar Startups no menu). |
| Agente | Pontua as vagas com o texto completo, não só com o excerto. |

## Configuração mínima

No `.env` (ver `.env.example`):

```sh
DOSSIER_AI_PROVIDER=deepseek
DOSSIER_AI_MODEL=deepseek-flash      # o id que https://api.deepseek.com/models devolve
DOSSIER_AI_KEY=…                     # a sua chave da DeepSeek
DOSSIER_JOBS_SOURCE=multi            # emprego.co.mz, Kukwira e CONTACT de uma vez
DOSSIER_INTERFACE_LANGUAGE=pt-PT
```

Tudo isto também se escolhe nas Definições, que se sobrepõem ao `.env`.

## Candidaturas por formulário (Kukwira, CONTACT)

Quando a vaga se candidata num formulário do próprio site, o separador Email mostra "Candidatar-se em …" com um seletor de três modos (a escolha fica guardada):

| Modo | O que faz | Onde |
|---|---|---|
| **Assistente** | Mostra cada valor do formulário, preenchido a partir do perfil, com um botão Copiar. | Kukwira e Workable (CONTACT) |
| **Favorito** | Um favorito para a barra do navegador. Na página do formulário, escreve os valores nos campos e diz o que deixou por preencher. Os dados ficam dentro do favorito: nada vai para o Dossier nem para outro sítio. | Kukwira e Workable (CONTACT); no Workable preenche o que reconhece, porque os formulários mudam de vaga para vaga |
| **Enviar daqui** | Rever o que vai, aceitar a política de privacidade do Kukwira e enviar. O Dossier envia o formulário como a página do Kukwira o faz, com o currículo adaptado como CV e a carta como mensagem, e marca a candidatura como enviada. | Só Kukwira |

O formulário do Kukwira pede dados que o perfil não tem (género, estado civil, local de nascimento, código postal, nacionalidade): preenche-os uma vez em "Dados que os formulários pedem"; ficam no seu servidor. Os cargos e os cursos são listas do próprio Kukwira: o Dossier escolhe o mais próximo e mostra-lhe a escolha antes de enviar; se não encontrar, pede-lhe que o escreva.

O envio automático não existe para o Workable (CONTACT): o formulário dele verifica que é uma pessoa a preenchê-lo. Nos dois modos que preenchem, o ficheiro do currículo, a política de privacidade e o botão Enviar ficam sempre consigo.

## JSearch (LinkedIn, Indeed e outros, através do Google for Jobs)

O JSearch aceita Moçambique (`country=mz`), mas o número de vagas depende do que o Google for Jobs tem indexado para o país.

1. Crie uma conta em [OpenWeb Ninja](https://www.openwebninja.com/) (ou na RapidAPI) e copie a chave do JSearch. O plano gratuito dá 200 pesquisas por mês.
2. Defina `DOSSIER_JSEARCH_KEY=…`, ou cole a chave em Definições → Pesquisa de emprego → JSearch.
3. Para o juntar às fontes moçambicanas: `DOSSIER_JOBS_SOURCES=emprego-mz,kukwira,contact-mz,jsearch`, ou marque-o em Várias fontes.
4. Para medir o que o JSearch encontra em Maputo (gasta uma pesquisa):

   ```sh
   JOBS_LIVE=jsearch-mz JSEARCH_TEST_KEY=… yarn vitest run src/lib/job-search/mozambique.live.test.ts
   ```

## Gmail e Google Calendar

Precisam de um cliente OAuth Google seu; os passos também aparecem em Definições → Google.

1. Na [Google Cloud Console](https://console.cloud.google.com/), crie um projeto e ative a **Gmail API** e a **Google Calendar API**.
2. Configure o **ecrã de consentimento OAuth** como Externo, acrescente o seu email como utilizador de teste e publique-o (Em produção). Se não estiver publicado, o Google corta o acesso ao fim de 7 dias.
3. Crie um **ID de cliente OAuth** do tipo Aplicação Web, com o URI de redirecionamento `https://<o seu domínio>/api/google/callback`. Em casa, sem domínio, `http://localhost:3000/api/google/callback` também serve. Se o Dossier estiver atrás de um proxy, defina `DOSSIER_PUBLIC_URL` com o endereço público.
4. Cole o ID e o segredo em Definições → Google, ou use `DOSSIER_GOOGLE_CLIENT_ID` e `DOSSIER_GOOGLE_CLIENT_SECRET`.

Nada é enviado sem a sua confirmação.

## Verificar os sites reais

O emprego.co.mz, o Kukwira e o CONTACT não têm API: o Dossier lê as páginas deles. Se um site mudar, a pesquisa deixa de encontrar vagas. Para verificar:

```sh
JOBS_LIVE=mozambique yarn vitest run src/lib/job-search/mozambique.live.test.ts
```

Atrás de um proxy, acrescente `NODE_USE_ENV_PROXY=1`.

## Contribuições para o projeto original

Estas melhorias não são específicas de Moçambique. Cada uma está num ramo próprio, a partir do `main`, e passa a tipagem, o lint e os testes:

| Ramo | O quê |
|---|---|
| `upstream/agent-whole-text` | O agente pontua as vagas com o texto completo (afeta o Adzuna, que só dá o início da vaga). |
| `upstream/pt-pt-documents` | Português europeu como língua dos documentos. |
| `upstream/score-reasons-language` | As razões da pontuação na língua dos documentos. |
| `upstream/letter-gaps` | Opção para a carta deixar as lacunas de fora; guarda de factos para planos inventados e números por extenso. |
| `upstream/apply-on-site` | "Candidatar-se em …" quando a vaga se candidata num site. |

Para os propor, abra um pull request de cada ramo para `AienTech/dossier:main`. Manter o fork perto do original torna mais fácil trazer as novidades de lá:

```sh
git fetch upstream && git checkout mz && git merge upstream/main
```
