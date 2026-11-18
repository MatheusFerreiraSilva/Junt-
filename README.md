<div align="center">
  <img src="public/favicon.svg" alt="" width="88" height="88" />
  <h1>Juntô</h1>
  <p><strong>Finanças a dois, do gasto de hoje aos planos de amanhã.</strong></p>
  <p>Organizem as contas da casa, acompanhem o mês e planejem metas compartilhadas.<br />Registrem os lançamentos à mão ou revisem um extrato CSV.</p>
  <p>
    <a href="https://github.com/MatheusFerreiraSilva/Junt-/actions/workflows/ci.yml"><img src="https://github.com/MatheusFerreiraSilva/Junt-/actions/workflows/ci.yml/badge.svg?branch=main" alt="Status da integração contínua" /></a>
    <img src="https://img.shields.io/badge/React-19-27755C?style=flat-square" alt="React 19" />
    <img src="https://img.shields.io/badge/TypeScript-5-27755C?style=flat-square" alt="TypeScript 5" />
    <img src="https://img.shields.io/badge/Firebase-Auth%20%2B%20Firestore-A94F33?style=flat-square" alt="Firebase Auth e Firestore" />
  </p>
  <p><a href="#o-que-vocês-podem-fazer">Recursos</a> · <a href="#importar-um-extrato">Extratos</a> · <a href="#executar-localmente">Instalação</a> · <a href="#google-ai-studio">Google AI Studio</a> · <a href="#testes-e-qualidade">Testes</a></p>
</div>

---

## O que vocês podem fazer

| Área | Como funciona |
| --- | --- |
| **Painel e Termômetro do Mês** | Acompanhem os gastos e o ritmo do orçamento. Alternem entre as visões individual e do casal. |
| **Gastos, Calendário e Parcelas** | Registrem lançamentos, acompanhem vencimentos de contas fixas e consultem o impacto das compras parceladas nos próximos meses. |
| **Orçamento do mês** | Planejem tetos de gastos fixos e variáveis e a alocação para investimentos. Usem pisos e travas por categoria para preservar prioridades ao simular um remanejamento. |
| **Hub do Casal e Investimentos** | Planejem sonhos e objetivos compartilhados no Hub. Acompanhem cofrinhos, reserva de emergência e liberdade financeira nas áreas correspondentes. |
| **Plantões e formação médica** | Acompanhem a etapa de formação de cada pessoa, os plantões realizados e os pagamentos previstos ou recebidos, inclusive parciais. |
| **Perfil e sincronização** | Vinculem as contas por convite. Personalizem os avatares e sincronizem os ajustes compartilhados do casal pelo Firebase. |
| **Assistente opcional** | Usem o Gemini no chat e nas sugestões de orçamento do cadastro quando ele estiver configurado. |

> O orçamento mostra quanto foi planejado e utilizado no mês. O extrato mostra as movimentações registradas. Depósitos previstos entram como recebimentos quando forem confirmados.

### Uma rotina para começar

1. Configurem os perfis e vinculem as contas pelo convite.
2. Registrem a renda, os gastos e as contas fixas. Se preferirem, importem um extrato CSV.
3. Confiram lançamentos e vencimentos no painel e no calendário.
4. Ajustem o orçamento do mês e acompanhem os objetivos do casal.

## Importar um extrato

Exportem o CSV no banco, mantenham uma identificação estável para a conta e selecionem o titular no Juntô. Conferiram a prévia? Enviem os lançamentos à fila de revisão e confirmem as receitas e despesas. Marquem as transferências entre contas para evitar que inflem os totais.

```csv
data;descricao;valor
28/10/2026;Mercado;-125,40
28/10/2026;Bolsa;900,00
29/10/2026;Transferência entre contas;-200,00
```

<details>
<summary>Formatos, duplicidades e lembretes</summary>

- O CSV aceita data, descrição e valor, incluindo cabeçalhos como `date`, `description` e `amount`. Use data `DD/MM/AAAA` ou `AAAA-MM-DD`, vírgula ou ponto e vírgula como separador e aspas quando necessário.
- Cada arquivo pode ter até 5 MB e 5.000 lançamentos. OFX e PDF estão fora dos formatos aceitos.
- A identificação de duplicidades considera conta, data, descrição, valor e ocorrência de linhas idênticas. Confiram manualmente períodos sobrepostos e lançamentos já digitados.
- O lembrete diário é verificado com o aplicativo aberto. A notificação do navegador depende de permissão, e a exportação continua sendo feita no banco.

</details>

## Executar localmente

### Pré-requisitos

- **Node.js 22**, versão usada no GitHub Actions.
- npm e Git.
- Projeto Firebase para autenticação e compartilhamento.
- Java 21 para executar os testes do Firestore Emulator.
- Chave Gemini somente se quiser habilitar IA.

```bash
git clone https://github.com/MatheusFerreiraSilva/Junt-.git
cd Junt-
npm ci
```

Copie `.env.example` para `.env`:

```powershell
# Windows / PowerShell
Copy-Item .env.example .env
```

```bash
# Linux / macOS
cp .env.example .env
```

Configure o Firebase conforme a seção abaixo e inicie:

```bash
npm run dev
```

Abra `http://localhost:3000`. O servidor Express fornece as APIs e integra o Vite durante o desenvolvimento.

## Configuração

### Firebase: navegador e servidor

O projeto usa duas configurações com funções diferentes:

| Local | Finalidade |
| --- | --- |
| `firebase-applet-config.json` | Configuração pública do app web: Firebase Auth e Firestore no navegador. |
| Ambiente do servidor | Credenciais administrativas usadas para verificar tokens, criar vínculos e consumir convites em transações. |

Configure o projeto de testes, habilite os métodos de autenticação que pretende usar e ajuste os domínios autorizados. O cliente suporta `firestoreDatabaseId`; o backend administrativo usa o banco padrão. **Mantenha ambos no mesmo banco padrão nesta versão** para evitar vínculos e dados em bancos diferentes.

Para o backend, use Application Default Credentials e defina o projeto. Em desenvolvimento, `GOOGLE_APPLICATION_CREDENTIALS` pode apontar para um arquivo de conta de serviço **fora do repositório**. Em nuvem, prefira a identidade do serviço com as permissões necessárias.

A associação ao casal é concedida pelo servidor. Alterar o perfil no navegador não concede acesso. As regras em `firestore.rules` precisam ser revisadas, testadas e implantadas separadamente; atualizar a `main` não publica essas regras no Firebase.

### Variáveis de ambiente

| Variável | Uso |
| --- | --- |
| `FIREBASE_PROJECT_ID` | Projeto do Firebase Admin; também pode ser obtido de `GOOGLE_CLOUD_PROJECT`. |
| `GOOGLE_APPLICATION_CREDENTIALS` | Caminho local de credencial administrativa, quando não houver identidade de serviço. |
| `GEMINI_API_KEY` | Chave Gemini, somente no servidor. |
| `GEMINI_MODEL` | Identificador de modelo disponível para a conta; o servidor verifica sua disponibilidade. |
| `PORT` | Porta HTTP; padrão `3000`. |
| `NODE_ENV` | Use `production` na execução de produção. |
| `APP_URL` | URL pública registrada na configuração de exemplo; não substitui domínios autorizados do Firebase. |
| `PLUGGY_CLIENT_ID`, `PLUGGY_CLIENT_SECRET` | Integração legada opcional no backend; dispensáveis para uso manual e CSV. |

**Nunca coloque segredos em variáveis `VITE_*`, no frontend ou no Git.**

Sem Gemini configurado, o chat informa indisponibilidade. O onboarding pode oferecer uma heurística identificada como tal, sem afirmar que houve análise por IA.

## Google AI Studio

Use a branch **`main`** como fonte da versão atual. Configure os segredos no ambiente do servidor e mantenha o projeto Firebase coerente com a configuração web.

A execução precisa comportar o **servidor Node/Express**, não apenas arquivos estáticos. Importar o repositório não configura automaticamente Firebase Admin, métodos de login, domínios autorizados ou regras do Firestore. Valide login, criação/entrada do casal e persistência antes de usar dados reais.

## Arquitetura

| Camada | Responsabilidade |
| --- | --- |
| **React · TypeScript · Vite** | Interface responsiva e PWA, revisão de extratos no navegador e visualizações financeiras. |
| **Firebase Auth · Firestore** | Identidade das contas, persistência de entidades financeiras, preferências e avatares, com regras de acesso. |
| **Express · Firebase Admin** | APIs autenticadas, convites e operações administrativas do vínculo do casal. |
| **Gemini** | Assistente opcional, chamado pelo servidor quando configurado. |

O fluxo principal funciona com lançamentos manuais e CSV. O backend mantém a integração legada com Pluggy como opção separada.

## Testes e qualidade

A [CI no GitHub](https://github.com/MatheusFerreiraSilva/Junt-/actions/workflows/ci.yml) executa a instalação limpa, as verificações estáticas, os testes da aplicação, as regras Firestore em emulador, o build e o smoke de produção.

```bash
npm run lint
npm run typecheck
npm test
npm run build:all
node scripts/smoke-production.mjs
```

Com Java 21, execute os testes de regras em um projeto fictício:

```bash
npx firebase emulators:exec --only firestore --project demo-junto-rules "npx vitest run --config vitest.rules.config.ts"
```

Para rodar a versão compilada, use `npm run start:prod` depois do build. `npm run preview` serve apenas a prévia estática do frontend. O endpoint `/api/health` verifica se o servidor está respondendo.

<details>
<summary>Documentação técnica e contribuições</summary>

- [Segurança](docs/SECURITY.md)
- [Autenticação, convites e backend](docs/BACKEND_SECURITY.md)
- [Arquitetura, migração e rollback](docs/IMPLEMENTATION.md)
- [Histórico de validação local](docs/VALIDATION.md)

Ao contribuir, use dados fictícios, preserve a compatibilidade com dados existentes e cubra alterações financeiras ou de autorização com testes. Mantenha credenciais e extratos reais fora do repositório.

</details>
