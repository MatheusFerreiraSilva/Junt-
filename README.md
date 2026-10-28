# JUNTÔ

### A vida de vocês, os planos de vocês, o dinheiro organizado.

O **Juntô** é um aplicativo de finanças para um casal de futuros médicos: acompanha o orçamento da casa, os gastos de cada pessoa, os objetivos compartilhados e as mudanças financeiras entre faculdade, residência e vida profissional.

A proposta é simples: registrar o que aconteceu, entender o mês e planejar o próximo passo juntos. O uso principal é **manual, com importação de extratos CSV e revisão dos lançamentos**.

[![CI](https://github.com/MatheusFerreiraSilva/Junt-/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/MatheusFerreiraSilva/Junt-/actions/workflows/ci.yml)
![React](https://img.shields.io/badge/React-19-149eca)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6)
![Firebase](https://img.shields.io/badge/Firebase-Auth%20%2B%20Firestore-dd8e00)

[Começar](#executar-localmente) · [Importar extratos](#importação-de-extratos) · [Configuração](#configuração) · [Verificações](#testes-e-qualidade) · [Limitações](#estado-atual-e-limitações)

---

## O que o Juntô organiza

| Área | Recursos |
| --- | --- |
| **O mês** | Orçamento por categoria, receitas, despesas e acompanhamento dos valores disponíveis no orçamento. |
| **Cada pessoa e o casal** | Visões individuais e conjunta, responsáveis pelos lançamentos e divisão de despesas. |
| **Compras parceladas** | Compras, acompanhamento de parcelas e antecipação; cálculos distribuem os centavos para preservar o total. |
| **Planos a dois** | Metas, cofrinhos, lista de desejos, contas fixas e simulações. |
| **Formação médica** | Modo Faculdade e etapa individual: graduação, internato, preparação para residência, residência ou atuação. |
| **Plantões** | Cadastro, execução, previsão de pagamento, recebimento parcial, alocação de depósitos e reversão da conciliação. |
| **Extratos** | Importação CSV com prévia, titularidade, identificação de repetidos e revisão antes de virar receita ou despesa. |
| **Assistente opcional** | Chat com Gemini e sugestão de orçamento no onboarding, com validação dos percentuais e indicação de fallback. |
| **Uso no celular** | Interface responsiva, PWA e lembretes locais opcionais. |

**Saldo bancário, orçamento disponível e recebimento previsto são conceitos diferentes.** Importar um extrato não deve transformar o saldo de uma conta em uma nova receita; um plantão agendado não representa dinheiro recebido.

## Uma rotina simples

1. Configure o perfil e a etapa de formação de cada pessoa.
2. Crie o vínculo do casal e compartilhe o convite com seu par.
3. Registre receitas e gastos ou importe um extrato.
4. Confira categorias, parcelas, transferências e recebimentos.
5. Acompanhe o mês e ajuste os objetivos de vocês.

O orçamento não exige renda de plantões. Estudantes podem usar o aplicativo com bolsa, ajuda familiar ou outras receitas informadas, sem presumir atividade médica remunerada.

## Importação de extratos

A tela de importação **não exige conexão ao banco nem assinatura de Open Finance**. O arquivo é lido no navegador; os lançamentos confirmados participam da persistência do aplicativo.

### Formato aceito

CSV com cabeçalhos reconhecíveis de **data, descrição e valor**. Exemplo com separador ponto e vírgula:

```csv
data;descricao;valor
28/10/2026;Mercado;-125,40
28/10/2026;Bolsa;900,00
29/10/2026;Transferência entre contas;-200,00
```

- Datas: `DD/MM/AAAA` ou `AAAA-MM-DD`.
- Valores negativos: saídas; positivos: entradas.
- Separadores: vírgula ou ponto e vírgula; campos entre aspas são aceitos.
- Cabeçalhos também reconhecem variantes como `date`, `description`, `amount`, `histórico` e `título`.
- Limites: **5 MB por arquivo e 5.000 lançamentos**.
- OFX, PDF e layouts bancários arbitrários **ainda não são suportados**.

### Como importar

1. Exporte o CSV pelo banco e confira se as colunas correspondem ao formato aceito.
2. Informe uma identificação estável, como **Conta conjunta — Banco X**.
3. Selecione o titular: pessoa 1, pessoa 2 ou conta conjunta.
4. Escolha o arquivo e revise a prévia.
5. Adicione os novos lançamentos à fila de revisão.
6. Confirme cada receita ou gasto; marque transferências entre contas para não inflar receitas e despesas.

### Como são reconhecidos os repetidos

A identificação considera **conta, data, descrição e valor**, além da ocorrência de linhas idênticas no arquivo. Importar novamente o mesmo extrato com a mesma identificação de conta mantém os identificadores.

Isso não substitui um identificador bancário único. Alterar o nome da conta ou a descrição pode fazer um registro parecer novo; períodos sobrepostos com transações idênticas exigem conferência. Lançamentos digitados manualmente também precisam ser comparados com o extrato antes da confirmação.

### Lembrete diário

A importação oferece um lembrete opcional para conferir o extrato. Ele é verificado enquanto o aplicativo está aberto, e notificações do navegador dependem de permissão. **Não há agendamento remoto garantido com o app fechado.** Exportar o arquivo continua sendo uma ação feita por vocês no banco.

## Executar localmente

### Pré-requisitos

- **Node.js 24 LTS**, recomendado para reproduzir o ambiente local de validação. A CI usa Node.js 22.
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

Abra **http://localhost:3000**. O servidor Express fornece as APIs e integra o Vite durante o desenvolvimento.

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

### Google AI Studio

Use a branch **`main`** como fonte da versão atual. Configure os segredos no ambiente do servidor e mantenha o projeto Firebase coerente com a configuração web.

A execução precisa comportar o **servidor Node/Express**, não apenas arquivos estáticos. Importar o repositório não configura automaticamente Firebase Admin, métodos de login, domínios autorizados ou regras do Firestore. Valide login, criação/entrada do casal e persistência antes de usar dados reais.

## Arquitetura

```text
Interface React / PWA
├── Lançamentos manuais e leitura CSV no navegador
├── Firebase Auth → identidade de cada pessoa
├── Firestore → dados compartilhados do casal
└── Express /api
    ├── Firebase Admin → verificação de identidade e vínculos
    ├── Convites e cotas compartilhadas
    ├── Gemini → assistente opcional
    └── Pluggy → código legado opcional, fora do fluxo manual
```

| Camada | Tecnologias |
| --- | --- |
| Interface | React 19, TypeScript, Tailwind CSS, Lucide e Motion |
| Servidor | Express, Firebase Admin e SDK Gemini |
| Dados | Firebase Auth, Firestore e cache local com identificação de usuário/casal |
| Build | Vite, esbuild e plugin PWA |
| Qualidade | ESLint, Vitest, Testing Library e GitHub Actions |

```text
src/
├── components/        Componentes e formulários
├── screens/           Telas do aplicativo
├── context/           Estado e ações financeiras
├── lib/               Firebase, API autenticada e sincronização de entidades
├── hooks/             Comportamentos de interface
├── types/             Contratos do domínio
└── utils/             Importação, centavos, plantões e motores financeiros
server/                Autorização, convites, orçamento e integração legada
scripts/               Smoke test e migração local de segurança
tests/                 Testes das regras do Firestore
docs/                  Segurança, migração e registro de validação
```

## Segurança e persistência

- APIs protegidas exigem Firebase ID token; endpoints de saúde são públicos.
- Convites têm expiração, uso único e consumo transacional.
- Cache identifica usuário e casal, e a troca de sessão encerra listeners e invalida operações pendentes.
- Entidades financeiras usam documentos independentes e verificação transacional de conflitos.
- Arrays legados são preservados na migração incremental; tombstones evitam recriar registros excluídos.
- O assistente não possui autoridade para modificar dados financeiros por meio de uma resposta.

Há limites importantes: configurações e totais agregados ainda têm operações no documento principal. A migração completa para um ledger transacional permanece pendente para garantir invariantes entre documentos em todos os cenários concorrentes.

Antes de migrar dados existentes, faça backup e leia [migração e rollback](docs/IMPLEMENTATION.md). O script `scripts/migrate-security.mjs` trabalha apenas em exports locais, com dry-run por padrão; não resolve automaticamente identidades legadas nem altera produção.

## Testes e qualidade

```bash
npm ci
npm run lint
npm run typecheck
npm test
npm run build:all
node scripts/smoke-production.mjs
```

Para ambientes com poucos recursos, execute `npm test -- --maxWorkers=2`.

Os testes de regras são separados da suíte de aplicação. Com Java 21 disponível:

```bash
npx firebase emulators:exec --only firestore --project demo-junto-rules "npx vitest run --config vitest.rules.config.ts"
```

Use o projeto fictício `demo-junto-rules`. O arquivo `firebase.json` define o emulador local na porta 8085; não aponte testes de autorização para dados reais.

**Estado verificado em 28/10/2026:** as melhorias foram incorporadas à `main` no commit [`b1eb5c3`](https://github.com/MatheusFerreiraSilva/Junt-/commit/b1eb5c33bd440e790de3d1dfcb620faf5e59af46). A [CI desse commit passou](https://github.com/MatheusFerreiraSilva/Junt-/actions/runs/40628639666), incluindo lint, TypeScript, suíte de aplicação, builds e smoke do servidor. A validação local registrou 80 testes em 18 arquivos. Os testes de regras do Firestore não fazem parte desse resultado da CI; sua execução ainda precisa ser confirmada.

## Scripts úteis

| Comando | Finalidade |
| --- | --- |
| `npm run dev` | Express + Vite em desenvolvimento |
| `npm run build:all` | Gera cliente em `dist/` e servidor em `server.js` |
| `npm run start:prod` | Executa o servidor compilado |
| `npm run preview` | Prévia estática do frontend; não substitui o Express para APIs |
| `npm run test:watch` | Testes durante desenvolvimento |
| `npm run test:coverage` | Relatório de cobertura |
| `npm run format:check` | Verifica formatação |
| `npm run clean` | Remove arquivos gerados de build e cobertura |

### Executar o build de produção

```bash
npm run build:all
npm run start:prod
```

Configure `NODE_ENV=production` no host e mantenha as variáveis e permissões necessárias para o Firebase Admin. Os endpoints `/health` e `/api/health` indicam que o processo está vivo; não certificam que todas as integrações estão configuradas.

## Estado atual e limitações

| Disponível | Ainda precisa evoluir |
| --- | --- |
| Lançamentos manuais e importação CSV com revisão | OFX, PDF, mapeamento de colunas e validação com layouts reais de cada banco |
| Identificação determinística de repetidos no CSV | Conferência de períodos sobrepostos e correspondência com lançamentos manuais |
| Lembrete diário com app aberto | Agendamento e entrega remota de notificações |
| Perfis médicos individuais e conciliação de plantões | Calendário completo de formação, conflitos de agenda e planejamento profissional ampliado |
| Persistência de entidades e detecção de conflitos | Ledger transacional completo para operações entre agregados |
| Cache da interface PWA | Validação de instalação/atualização em dispositivos reais e fluxo offline completo |

O backend ainda contém endpoints Pluggy da evolução anterior. Eles não são necessários para a rotina manual e sua existência não comprova uma conexão bancária em produção.

## Documentação complementar

- [Segurança](docs/SECURITY.md)
- [Autenticação, convites e backend](docs/BACKEND_SECURITY.md) — inclui detalhes da integração bancária legada.
- [Migração, rollback e limitações de arquitetura](docs/IMPLEMENTATION.md)
- [Registro de validação local](docs/VALIDATION.md) — registro histórico; consulte também a CI mais recente.

## Contribuindo

Faça alterações pequenas e verificáveis. Preserve dados antigos, adicione testes quando houver risco financeiro ou de autorização e descreva as mudanças de schema. Use fixtures e emuladores para testes; nunca inclua extratos reais, dados de pacientes, tokens ou credenciais em commits e issues.

## Licença

O repositório ainda não possui um arquivo `LICENSE` definindo os termos de distribuição. A escolha da licença cabe ao autor.
