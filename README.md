<div align="center">

# JUNTÔ

**Finanças inteligentes para casais: simples, visual e acolhedor.**

PWA com orçamento conjunto e individual, parcelamentos, metas, reserva de emergência e um assistente financeiro com Gemini.

[![CI](https://github.com/MatheusFerreiraSilva/Junt-/actions/workflows/ci.yml/badge.svg)](https://github.com/MatheusFerreiraSilva/Junt-/actions/workflows/ci.yml)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind-4-06B6D4?logo=tailwindcss&logoColor=white)
![Firebase](https://img.shields.io/badge/Firebase-Auth%20%2B%20Firestore-FFCA28?logo=firebase&logoColor=black)
![License](https://img.shields.io/badge/license-MIT-green)

</div>

---

## Sumário

- [Visão geral](#visão-geral)
- [Funcionalidades](#funcionalidades)
- [Screenshots](#screenshots)
- [Stack](#stack)
- [Arquitetura](#arquitetura)
- [Começando](#começando)
- [Variáveis de ambiente](#variáveis-de-ambiente)
- [Scripts](#scripts)
- [Estrutura do projeto](#estrutura-do-projeto)
- [API do servidor](#api-do-servidor)
- [Firebase e segurança](#firebase-e-segurança)
- [Testes e qualidade](#testes-e-qualidade)
- [PWA e notificações](#pwa-e-notificações)
- [Deploy](#deploy)
- [Roadmap](#roadmap)
- [Contribuindo](#contribuindo)
- [Licença](#licença)

---

## Visão geral

O **JUNTÔ** organiza a vida financeira do casal em três blocos: **Proteção**, **Objetivos** e **Liberdade**. O app transforma números em conversas úteis: mostra quanto ainda dá para gastar no mês, onde o orçamento estourou e como reequilibrar sem culpa.

Cada parceiro tem sua visão individual, e os dois compartilham a visão conjunta em tempo real via Firestore, conectados por um código de convite.

## Funcionalidades

| Área | O que faz |
| --- | --- |
| **Painel do casal** | Visão conjunta e individual (parceiro 1 / parceiro 2), termômetro do mês e acerto de contas entre o casal |
| **Orçamento por categorias** | Moradia, comida, lazer, proteção, profissional e investimentos, com tetos, pisos e redistribuição de sobras |
| **Parcelamentos** | Controle de parcelas, antecipação e comprometimento da renda |
| **Metas e reserva** | Cofrinhos, reserva de emergência, guia de depósito mensal e alocação de sobra semanal |
| **Assistente com Gemini** | Chat financeiro em linguagem natural e onboarding que sugere percentuais e pisos a partir do perfil do casal |
| **Insights preditivos** | Ritmo de gastos com comida, alertas e resumo semanal (*Weekly Pulse*) |
| **Plantões médicos** | Cadastro de plantões e conciliação de pagamentos |
| **Modo Faculdade** | Visão adaptada para a transição entre formação e vida profissional |
| **Triagem de transações** | Categorização automática, detecção de duplicatas e de assinaturas |
| **PWA** | Instalável, funciona offline e envia notificações push |
| **Open Finance (demo)** | Fluxo de conexão bancária **simulado**, para demonstração. Veja [Roadmap](#roadmap) |

## Screenshots

> Adicione capturas em `docs/screenshots/` e referencie aqui.

<!--
| Home | Metas | Assistente |
| --- | --- | --- |
| ![Home](docs/screenshots/home.png) | ![Metas](docs/screenshots/goals.png) | ![Chat](docs/screenshots/chat.png) |
-->

## Stack

| Camada | Tecnologia |
| --- | --- |
| UI | React 19, TypeScript, Tailwind CSS 4, Motion, Lucide |
| Build | Vite 8 |
| Servidor | Express 4 (proxy de IA, headers de segurança, rate limit) |
| IA | Gemini via `@google/genai` |
| Dados | Firebase Auth + Firestore |
| PWA | `vite-plugin-pwa` (Workbox) + Web Push |
| Testes | Vitest + Testing Library |
| Qualidade | ESLint 9, Prettier, GitHub Actions |

## Arquitetura

```
┌────────────┐    HTTPS     ┌────────────────────┐
│  PWA React │ ───────────► │  Express (server)  │──► Gemini API
│  (Vite)    │              │  /api/gemini/*     │
└─────┬──────┘              └────────────────────┘
      │ SDK
      ▼
┌──────────────────────────────┐
│ Firebase Auth + Firestore    │  couples/{id}, users/{uid},
│ (regras em firestore.rules)  │  coupleInvites/{code}
└──────────────────────────────┘
```

- **Estado global** em `FinanceContext`, persistido em `localStorage` e sincronizado com o Firestore quando há login.
- **Regras de negócio** isoladas em `src/utils/*Engine.ts` (funções puras e testadas).
- **Code splitting** por tela e por modal com `React.lazy`.
- **Chave do Gemini nunca vai ao cliente**: o navegador fala só com o servidor Express.

## Começando

### Pré-requisitos

- Node.js 22+
- npm 10+
- Uma chave da [Gemini API](https://aistudio.google.com/apikey) (opcional em desenvolvimento)
- Um projeto Firebase com Auth e Firestore (opcional para testar só o modo local)

### Instalação

```bash
git clone https://github.com/MatheusFerreiraSilva/Junt-.git
cd Junt-

npm install
cp .env.example .env     # edite com sua GEMINI_API_KEY

npm run dev              # Express + Vite em http://localhost:3000
```

Sem `GEMINI_API_KEY`, em desenvolvimento o assistente responde com um texto simulado. Em produção, os endpoints de IA respondem `503`.

### Usando seu próprio Firebase

Substitua `firebase-applet-config.json` pelas credenciais do seu app web e publique as regras:

```bash
npx firebase-tools deploy --only firestore:rules
```

## Variáveis de ambiente

| Variável | Obrigatória | Descrição |
| --- | --- | --- |
| `GEMINI_API_KEY` | Em produção | Chave da Gemini API, usada apenas no servidor |
| `APP_URL` | Não | URL pública do app (links e callbacks) |
| `PORT` | Não | Porta do servidor (padrão `3000`) |
| `NODE_ENV` | Não | `production` desativa respostas simuladas |

> Nunca comite o `.env`. O `.gitignore` já o ignora, exceto o `.env.example`.

## Scripts

| Comando | Descrição |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento (Express + Vite middleware) |
| `npm run build` | Build do cliente em `dist/` |
| `npm run build:server` | Compila `server.ts` para `server.js` |
| `npm run build:all` | Cliente + servidor |
| `npm run start:prod` | Roda o servidor compilado |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` / `lint:fix` | ESLint |
| `npm run format` / `format:check` | Prettier |
| `npm run test` / `test:watch` / `test:coverage` | Vitest |
| `npm run clean` | Remove `dist/`, `server.js` e `coverage/` |

## Estrutura do projeto

```
.
├── server.ts                 API Express (IA, health, headers, rate limit)
├── firestore.rules           Regras de segurança do Firestore
├── public/                   Manifest, favicon e push-handler.js
├── docs/                     Arquitetura, segurança, upgrades e auditoria UX
└── src/
    ├── App.tsx               Roteamento por tela e carregamento lazy
    ├── context/              FinanceContext (estado global e regras)
    ├── screens/              Home, Metas, Parcelas, Calendário, Casal, Ajustes…
    ├── components/           Cards, gráficos, navegação e modais
    ├── hooks/                Hooks utilitários (ex.: instalação PWA)
    ├── services/             Notificações
    ├── lib/                  Inicialização do Firebase
    ├── types/                Tipos de domínio
    └── utils/                Motores de cálculo (categorização, renda,
                              plantões, conciliação, insights) + testes
```

## API do servidor

| Método | Rota | Rate limit | Descrição |
| --- | --- | --- | --- |
| `GET` | `/health`, `/api/health` | none | Health check |
| `POST` | `/api/gemini/chat` | 20/min | Chat do assistente financeiro |
| `POST` | `/api/gemini/onboarding-interpret` | 10/min | Sugere percentuais e pisos a partir do perfil |
| `POST` | `/api/pluggy/auth`, `/api/pluggy/accounts` | 10–20/min | Proxy Open Finance (modo demo fora de produção) |
| `POST` | `/api/bank-sync/fetch` | 30/min | Feed bancário **simulado** |

Proteções ativas: limite de payload (256 KB), sanitização do contexto enviado ao Gemini (anti prompt-injection), rate limit por IP em memória e headers de segurança (`X-Frame-Options`, `nosniff`, HSTS em produção, `Permissions-Policy`).

## Firebase e segurança

- **Coleções**: `users/{uid}`, `couples/{coupleId}` (+ subcoleções) e `coupleInvites/{code}`.
- A chave pública do Firebase no cliente é esperada. A proteção real vem das **regras do Firestore** e dos **domínios autorizados** no console.
- As regras só valem depois do deploy: `npx firebase-tools deploy --only firestore:rules`.
- Detalhes em [`docs/SECURITY.md`](docs/SECURITY.md).

## Testes e qualidade

```bash
npm run test
npm run test:coverage
```

A suíte cobre os motores de cálculo (formatadores, categorização, faixas de renda, plantões, triagem, ritmo de comida, insights e notificações push). A CI roda lint, typecheck, testes e build a cada push e pull request.

## PWA e notificações

- Service worker gerado pelo Workbox em `dist/sw.js`.
- Handlers de Web Push em `public/push-handler.js`, importados via `importScripts`.
- Registro único em `src/main.tsx` (`registerSW`).
- Em desenvolvimento o SW fica desativado; para testar o PWA, rode `npm run build && npm run preview`.

## Deploy

**Google AI Studio / Cloud Run**: o projeto declara `MAJOR_CAPABILITY_SERVER_SIDE_GEMINI_API` em `metadata.json`, e `GEMINI_API_KEY` e `APP_URL` são injetadas em runtime.

**Qualquer host Node**:

```bash
npm run build:all
NODE_ENV=production npm run start:prod
```

## Roadmap

- [ ] Integração real com Open Finance (Pluggy) ou remoção do fluxo simulado
- [ ] Autenticar as rotas `/api/gemini/*` com ID token do Firebase
- [ ] Dividir o `FinanceContext` em contextos de domínio
- [ ] Testes de integração (transações, convite, onboarding) e de regras do Firestore
- [ ] Personalização além do perfil de casais médicos
- [ ] Ícones PWA em PNG (192/512, maskable)
- [ ] Monitoramento de erros (Sentry) e Web Vitals
- [ ] i18n (pt-BR → en-US / es-AR)

## Contribuindo

1. Faça um fork e crie uma branch: `git checkout -b feat/minha-feature`
2. Garanta que `npm run lint && npm run typecheck && npm run test` passam
3. Abra um Pull Request descrevendo a mudança

## Licença

[MIT](LICENSE)

---

<div align="center">
Feito com carinho para quem constrói a vida a dois.
</div>
