# Ultra Upgrade — o que mudou

Este documento registra o conjunto de melhorias aplicadas ao JUNTÔ.

## 1. PWA e notificações

- **Corrigido o conflito de service workers.** Antes existiam dois registros: o `public/sw.js` manual e o `sw.js` gerado pelo Workbox. Em produção, o arquivo gerado sobrescrevia o manual e os handlers de push eram perdidos.
- O `public/sw.js` foi removido.
- Os handlers de push foram movidos para `public/push-handler.js` e são importados pelo Workbox via `importScripts`.
- `vite.config.ts` agora usa `injectRegister: false`, `clientsClaim`, `skipWaiting`, `navigateFallback` e `cleanupOutdatedCaches`.
- `src/main.tsx` registra o SW uma única vez com `registerSW({ immediate: true })`.

## 2. Performance e carregamento

- **Code splitting por rota**: todas as telas, exceto `HomeScreen`, são carregadas com `React.lazy` + `Suspense`.
- **Code splitting por modal**: os modais só são montados quando abertos; o chunk correspondente é baixado sob demanda.
- Removido o `process.env.NODE_ENV` do código do browser (substituído pelo registro via `virtual:pwa-register`).
- `build.target: 'es2020'` e `chunkSizeWarningLimit` ajustado.
- A checagem de conexão do Firestore agora roda apenas em desenvolvimento.

## 3. Resiliência

- Adicionado `ErrorBoundary` global (`src/components/ErrorBoundary.tsx`) com fallback amigável e botão de recarregar.
- `App` é envolvido pelo boundary em `src/main.tsx`.

## 4. Qualidade e testes

- **Vitest** configurado em `vitest.config.ts` com ambiente `jsdom` e cobertura V8.
- **Testing Library** e `jest-dom` configurados em `src/test/setup.ts`.
- 17 testes unitários cobrindo:
  - formatação de moeda, meses e durações;
  - categorização e detecção de assinaturas;
  - faixas de renda, progresso, líquido PJ e regra 50/50.
- Scripts: `test`, `test:watch`, `test:coverage`.

## 5. DX (experiência de desenvolvimento)

- **ESLint 9** com flat config (`eslint.config.mjs`), React Hooks e Prettier.
- **Prettier** com `.prettierrc.json` e `.prettierignore`.
- **EditorConfig** para consistência entre editores.
- `package.json` reorganizado:
  - scripts `typecheck`, `build:server`, `build:all`, `start:prod`, `format`, `clean`;
  - dependências de tipagem movidas para `devDependencies`;
  - `esbuild` alinhado com o Vite 8 (`^0.28.0`);
  - TypeScript alinhado com o ecossistema ESLint (`^5.9.0`).
- `clean` agora é cross-platform (Node em vez de `rm -rf`).
- Lockfile padronizado em npm (`package-lock.json`); o `bun.lock` antigo foi removido para evitar resolução divergente. Quem usa Bun pode rodar `bun install` para regenerar.

## 6. Documentação

- `README.md` com visão geral, stack, setup, scripts, estrutura, PWA, AI Studio e segurança.
- `docs/ARCHITECTURE.md` com diagrama e fluxo de dados.
- `docs/SECURITY.md` com as regras aplicadas e limitações conhecidas.
- `docs/UPGRADE.md` (este arquivo).

## 7. Pequenos ajustes

- `type="button"` e `aria-label` no botão flutuante do chat.
- Tema do manifest padronizado em `#F43F5E`.
- `.gitignore` atualizado (`.npm-cache`, `.vite`, `server.js`, `coverage`).

## 8. Firestore hardening

- Novos casais gravam `partner1Uid`; ao entrar com convite, o app grava `partner2Uid`.
- Casais antigos são migrados automaticamente no primeiro carregamento do membro correspondente.
- `firestore.rules` agora exige vínculo (`users/{uid}.coupleId` ou campos `partner1Uid`/`partner2Uid`) para ler/escrever o casal e suas subcoleções.
- A busca por convite foi movida para `coupleInvites/{code}` (apenas `coupleId`), com `get` por código e **sem `list`** — não é possível enumerar casais.
- Ao gerar um novo código, o convite antigo é apagado.
- Detalhes, migração e limitação conhecida (força bruta de código) em `docs/SECURITY.md`.

## O que ainda vale a pena fazer

1. **Dividir o `FinanceContext`** em contextos de domínio. É a maior dívida técnica restante.
2. **Testes de integração** para os fluxos de despesa, onboarding, convite e sincronização.
3. **Monitoramento** (Sentry/GlitchTip + Web Vitals).
4. **i18n** e acessibilidade (auditoria com axe).
5. **Storybook** para os componentes de UI.
6. **Cloud Function** para resolução de convite (elimina a limitação de força bruta).
