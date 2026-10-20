# Arquitetura do JUNTÔ

## Visão geral

O JUNTÔ é uma SPA React servida por um Express mínimo. Em desenvolvimento, o Express usa o middleware do Vite; em produção, serve os arquivos estáticos de `dist/` e mantém as rotas de API.

```
┌──────────────────────────────────────────────────────────┐
│                        Browser / PWA                      │
│  React 19 + Tailwind + Context API + Workbox Service Worker│
└───────────────▲──────────────────────────────▲────────────┘
                │ HTTPS                        │ Web Push
┌───────────────┴──────────────┐   ┌───────────┴────────────┐
│      Express (server.ts)      │   │  Firebase Auth/Firestore│
│  /api/gemini/*  /api/pluggy/* │   │  (client SDK)           │
└───────────────▲──────────────┘   └────────────────────────┘
                │
      ┌─────────┴─────────┐
      │  Gemini API        │
      │  Pluggy API        │
      └───────────────────┘
```

## Camadas do front-end

### `src/screens/`
Telas de rota. Recebem props de navegação e modais, e leem o estado via `useFinance()`.

### `src/components/`
Componentes de UI reutilizáveis. Os modais ficam em `components/modals/`. A maioria retorna `null` quando `isOpen` é falso, mas o `App.tsx` agora só os monta quando estão abertos, reduzindo o bundle inicial.

### `src/context/FinanceContext.tsx`
Coração do domínio. Concentra:

- estado persistido em `localStorage` (`STORAGE_KEY`);
- sincronização em tempo real com Firestore;
- autenticação (e-mail, Google, anônimo);
- regras de orçamento, parcelamentos, cofrinhos e 3 blocos;
- motores de categorização, reconciliação e alertas.

> **Dívida técnica conhecida:** o contexto tem ~3.400 linhas e mistura auth, finanças, investimentos e UI. A próxima evolução recomendada é dividi-lo em `AuthContext`, `FinanceCoreContext`, `InvestmentsContext` e `UIContext`, mantendo um `FinanceProvider` de composição para compatibilidade.

### `src/utils/`
Funções puras e motores de cálculo. É a camada com maior cobertura de testes e a mais segura para refatorar.

### `src/lib/firebase.ts`
Inicializa o Firebase uma única vez e exporta `auth` e `db`. A checagem de conexão só roda em desenvolvimento (`import.meta.env.DEV`).

### `server.ts`
API Express:

- `GET /health` e `/api/health` — health check;
- `POST /api/pluggy/auth` e `/api/pluggy/accounts` — proxy Open Finance (com fallback simulado);
- `POST /api/bank-sync/fetch` — feed bancário simulado para demonstração;
- `POST /api/gemini/chat` — assistente financeiro;
- `POST /api/gemini/onboarding-interpret` — questionário de onboarding.

## PWA

- `vite-plugin-pwa` gera `dist/sw.js` com precache do Workbox.
- `public/push-handler.js` contém os listeners de `push` e `notificationclick` e é importado pelo SW gerado.
- `src/main.tsx` registra o SW com `registerSW({ immediate: true })`.
- `injectRegister: false` evita que o plugin injete um segundo registro.
- O manifest é gerado pelo plugin a partir de `vite.config.ts`; `public/manifest.webmanifest` permanece como fallback para desenvolvimento sem plugin.

## Fluxo de dados

1. `FinanceProvider` carrega o estado do `localStorage`.
2. Se houver usuário autenticado, abre um `onSnapshot` no documento `couples/{coupleId}`.
3. Alterações locais atualizam o estado e são persistidas no Firestore (quando online).
4. `isRemoteSync` evita loops de escrita entre abas/parceiros.
5. Componentes consomem `useFinance()` e derivam valores com `useMemo`.

## Decisões de build

- `target: 'es2020'` para equilíbrio entre compatibilidade e tamanho.
- Code splitting por rota e por modal.
- `chunkSizeWarningLimit: 900` para não poluir o build com avisos de chunks grandes; o objetivo é reduzir o chunk principal ao longo do tempo.
- `sourcemap: false` em produção para não expor código-fonte.

## Próximas etapas sugeridas

1. Extrair `AuthContext` e `UIContext` do `FinanceContext`.
2. Criar um `useFinanceSelector` ou adotar Zustand para reduzir re-renders.
3. Adicionar `ErrorBoundary` por rota (hoje há um global).
4. Cobrir fluxos de integração com Testing Library.
5. Instrumentar Web Vitals e erros.
