# JUNTÔ — Finanças Inteligentes de Casal

Aplicativo PWA de finanças para casais, com foco em clareza, acolhimento e decisões conjuntas. O JUNTÔ organiza a vida financeira em três blocos — **Proteção**, **Objetivos** e **Liberdade** — e usa IA para transformar números em conversas úteis.

## ✨ Principais recursos

- **Painel do casal** com visão conjunta e individual (parceiro 1 / parceiro 2).
- **Sistema de 3 blocos**: reserva de emergência, metas e liberdade financeira.
- **Orçamento por categorias** com tetos, pisos e redistribuição inteligente.
- **Parcelamentos** com acompanhamento de comprometimento da renda.
- **Open Finance** via Pluggy (sandbox simulado quando não há credenciais).
- **Assistente financeiro com Gemini** (chat e onboarding inteligente).
- **PWA instalável** com funcionamento offline e notificações push.
- **Modo Faculdade** para a transição entre formação e vida profissional.
- **Tema claro/escuro** e múltiplos acentos de cor.

## 🧱 Stack

| Camada | Tecnologia |
| --- | --- |
| UI | React 19 + TypeScript |
| Build | Vite 8 + Tailwind CSS 4 |
| Backend | Express + Gemini API (`@google/genai`) |
| Dados | Firebase Auth + Firestore |
| PWA | `vite-plugin-pwa` (Workbox) |
| Testes | Vitest + Testing Library |
| Qualidade | ESLint 9 + Prettier |

## 🚀 Rodando localmente

```bash
# 1. Instale as dependências
npm install

# 2. Configure as variáveis de ambiente
cp .env.example .env
# Edite .env com sua GEMINI_API_KEY (e APP_URL se necessário)

# 3. Suba o servidor de desenvolvimento (Express + Vite middleware)
npm run dev
```

O app fica disponível em `http://localhost:3000`.

> O gerenciador de pacotes de referência é o **npm** (`package-lock.json`). Se você usa Bun, rode `bun install` para gerar seu próprio lockfile.

> O Firebase já está configurado em `firebase-applet-config.json`. Para usar outro projeto, substitua esse arquivo pelas credenciais do seu app Firebase.

## 📜 Scripts

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento com HMR |
| `npm run build` | Build de produção do cliente em `dist/` |
| `npm run build:server` | Compila `server.ts` em `server.js` |
| `npm run build:all` | Build do cliente + servidor |
| `npm start` | Inicia o servidor em modo desenvolvimento (`tsx`) |
| `npm run start:prod` | Inicia o servidor compilado (`node server.js`) |
| `npm run typecheck` | Verificação de tipos com TypeScript |
| `npm run lint` | ESLint em todos os arquivos `.ts`/`.tsx` |
| `npm run lint:fix` | ESLint com correções automáticas |
| `npm run format` | Prettier em todo o projeto |
| `npm run test` | Executa a suíte de testes uma vez |
| `npm run test:watch` | Testes em modo watch |
| `npm run test:coverage` | Testes com relatório de cobertura |
| `npm run clean` | Remove `dist/`, `server.js` e `coverage/` |

## 🗂️ Estrutura

```
src/
  components/     Componentes reutilizáveis (navegação, modais, gráficos)
  context/        FinanceContext (estado global + regras de negócio)
  hooks/          Hooks utilitários (ex.: instalação PWA)
  lib/            Inicialização do Firebase
  screens/        Telas principais (Home, calendário, metas, ajustes…)
  services/       Serviços de notificação
  test/           Setup do Vitest
  types/          Tipagens de domínio
  utils/          Motores de cálculo, categorização, formatação e reconciliação
server.ts         API Express: Gemini, Pluggy e health checks
public/           Assets estáticos, manifest e handler de push
```

## 🧪 Testes

A suíte cobre os motores mais críticos:

- `src/utils/formatters.ts` — moeda, meses e durações.
- `src/utils/categorizationEngine.ts` — categorização e detecção de assinaturas.
- `src/utils/incomeTiersEngine.ts` — faixas de renda, progresso e regra 50/50.

```bash
npm run test
npm run test:coverage
```

## 📲 PWA e notificações

- O service worker é gerado pelo Workbox (`vite-plugin-pwa`) em `dist/sw.js`.
- Os handlers de **Web Push** ficam em `public/push-handler.js` e são importados pelo Workbox via `importScripts`.
- A registration é feita uma única vez em `src/main.tsx` com `registerSW` (o `injectRegister` do plugin está desativado para evitar registro duplicado).
- Em desenvolvimento o service worker fica desativado por padrão; para testar PWA faça um build e rode `npm run preview` ou `npm run start:prod`.

## 🤖 Gemini AI Studio

Este projeto foi pensado para rodar no AI Studio:

- `metadata.json` declara a capability `MAJOR_CAPABILITY_SERVER_SIDE_GEMINI_API`.
- `GEMINI_API_KEY` é injetada pelo AI Studio em runtime (não comite seu `.env`).
- `APP_URL` também é injetada pelo AI Studio.
- O servidor Express expõe `/api/gemini/chat` e `/api/gemini/onboarding-interpret`.
- O build do cliente continua sendo `npm run build`; o AI Studio pode usar `npm run dev` ou `npm start`.

## 🔐 Segurança

- Nunca comite `.env` nem chaves privadas.
- As regras atuais do Firestore (`firestore.rules`) permitem que qualquer usuário autenticado leia/escreva documentos de casais. Para produção, restrinja por `request.auth.uid` e membros do casal (veja `docs/SECURITY.md`).
- O app usa a API key pública do Firebase no cliente — isso é esperado; a proteção real vem das regras do Firestore e dos domínios autorizados no console do Firebase.

## 🗺️ Próximos passos recomendados

1. Dividir o `FinanceContext` em contextos de domínio (auth, finanças, investimentos, UI).
2. Adicionar testes de integração para fluxos de transação e onboarding.
3. Endurecer as regras do Firestore com `partnerUids`.
4. Integrar monitoramento de erros (Sentry/GlitchTip) e Web Vitals.
5. Avaliar i18n (pt-BR → es-AR/en-US).

Veja mais detalhes em [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), [`docs/UPGRADE.md`](docs/UPGRADE.md) e [`docs/SECURITY.md`](docs/SECURITY.md).

## 📄 Licença

MIT.
