# Auditoria de Experiência do Cliente — JUNTÔ

Data: 2026-10-20
Escopo: navegação, fluidez de tela, acessibilidade básica, feedback de erro, robustez das APIs que alimentam a experiência (assistente e Open Finance).

Este documento registra o que foi **encontrado**, o que foi **corrigido nesta entrega** e o que **permanece como recomendação**.

---

## 1. Atritos encontrados

| # | Atrito | Evidência | Impacto na experiência |
| --- | --- | --- | --- |
| 1 | Troca de tela mantinha o scroll anterior e não devolvia foco ao conteúdo | `src/App.tsx` (`handleNavigate`) | No mobile a pessoa "caía" no meio da tela nova e precisava rolar de volta ao topo |
| 2 | O título do documento nunca mudava entre telas | `src/App.tsx` | Dificulta orientação no PWA, no histórico e em leitores de tela (sempre "JUNTÔ") |
| 3 | Erro ao apagar dados usava `alert()` nativo | `src/screens/SettingsScreen.tsx` | Bloqueia a interface, visual destoante no PWA, sem ação de fechar acessível |
| 4 | Barra de navegação inferior podia ficar sob a *home indicator* do iPhone | `src/components/Navigation.tsx` | Botões parcialmente encobertos em aparelhos com notch |
| 5 | Nenhum suporte a `prefers-reduced-motion` | `src/index.css` | Pessoas sensíveis a movimento recebiam todas as animações |
| 6 | Barra de rolagem aparecendo/sumindo mudava a largura do conteúdo | `src/index.css` | Pequenos "pulos" de layout ao navegar entre telas com alturas diferentes |
| 7 | Sem atalho "pular para o conteúdo" | `src/App.tsx` | Navegação por teclado precisava atravessar todo o menu em cada tela |
| 8 | APIs do assistente sem limite de uso, sem limite de payload e com log de erro cru | `server.ts` | Risco de custo/abuso na Gemini API, DoS por payload grande e vazamento de detalhes internos |

---

## 2. Correções aplicadas

### Navegação e fluidez (`src/App.tsx`)
- `useEffect` por tela que:
  - atualiza `document.title` para `"<Tela> · JUNTÔ — Finanças Inteligentes de Casal"`;
  - rola para o topo de forma **instantânea** (a rolagem suave em troca de tela parecia travamento);
  - move o foco para `<main id="conteudo-principal" tabIndex={-1}>`, sem roubar o scroll.
- Atalho de teclado visível no foco: **"Ir para o conteúdo principal"**.

### Feedback de erro (`src/screens/SettingsScreen.tsx`)
- `alert()` substituído por aviso inline com `role="alert"`, ícone, botão de fechar e `aria-label`.
- Mensagem amigável em vez de `e.message` cru quando a operação falha.

### Mobile / PWA (`src/components/Navigation.tsx`, `src/index.css`)
- Barra inferior agora respeita `env(safe-area-inset-bottom)`.
- `scrollbar-gutter: stable` evita o salto de largura.
- `overscroll-behavior-y: contain` evita o efeito elástico que arrasta o app inteiro.
- `-webkit-tap-highlight-color: transparent` remove o flash cinza ao tocar.
- Bloco `@media (prefers-reduced-motion: reduce)` desliga animações e transições.
- Foco visível padronizado (`:focus-visible`) e utilitário `.pwa-safe-bottom`.

### Robustez das APIs (`server.ts`)
- **Rate limiting** em memória (sem dependência nova):
  - `/api/gemini/chat` → 20 req/min por IP;
  - `/api/gemini/onboarding-interpret` → 10 req/min;
  - `/api/pluggy/auth` → 10 req/min;
  - `/api/pluggy/accounts` → 20 req/min;
  - `/api/bank-sync/fetch` → 30 req/min;
  - resposta `429` com `Retry-After` e headers `X-RateLimit-*`.
- **Limite de payload**: `express.json({ limit: '256kb' })` com resposta `413` amigável.
- **Sanitização de contexto do Gemini**: `sanitizeText` remove caracteres de controle, crases e chaves, normaliza espaços e corta em 280 caracteres — reduz superfície de *prompt injection* via nome, cidade ou categoria.
- **Validação de mensagens**: 1 a 40 mensagens, texto de 1 a 4000 caracteres, papéis normalizados.
- **Sem PII em log**: erros registram apenas `err.message`; o corpo da requisição (renda, gastos, nomes) nunca é logado.
- **Falha explícita em produção**: sem `GEMINI_API_KEY`, os endpoints do assistente respondem `503` em vez de devolver um mock que parecia resposta real. Em desenvolvimento o mock continua, para o preview do AI Studio.
- **Open Finance honesto**: em produção, falha do Pluggy retorna `502` em vez de contas fictícias; o modo simulado fica restrito ao ambiente de desenvolvimento e vem marcado com `simulated: true`.
- **Headers extras**: `X-Frame-Options: DENY`, `Cross-Origin-Opener-Policy`, `Permissions-Policy` e HSTS em produção; `x-powered-by` desativado; `trust proxy` para IP real atrás do proxy do AI Studio.

---

## 3. O que permanece recomendado (não feito nesta entrega)

1. **Dividir o `FinanceContext`** (~136 KB em um único arquivo). É a maior dívida estrutural: qualquer mudança de estado re-renderiza muitos consumidores. Sugestão: `AuthContext`, `TransactionsContext`, `BudgetsContext`, `GoalsContext`, mantendo `useFinance()` como fachada para não quebrar as telas.
2. **Testes de integração de fluxo**: onboarding → primeira despesa → meta. Hoje a suíte cobre motores de cálculo (17 testes), não jornadas.
3. **Monitoramento de erros** (Sentry/GlitchTip) e Web Vitals para medir fluidez em produção.
4. **Virtualização de listas longas** em `TransactionHistoryScreen` se o histórico passar de algumas centenas de itens.
5. **Revisão de contraste** nos temas escuros com o `axe-core` no CI.

---

## 4. Como validar

```bash
npm ci
npm run typecheck   # ok
npm run lint        # ok
npm run test        # 17 testes passando
npm run build       # build + PWA ok
```

Smoke test das APIs (servidor de produção local):

| Cenário | Esperado | Obtido |
| --- | --- | --- |
| `GET /health` | 200 | 200 |
| 11ª chamada a `/api/gemini/onboarding-interpret` no mesmo minuto | 429 | 429 |
| `/api/gemini/chat` sem `GEMINI_API_KEY` (produção) | 503 | 503 |
| `/api/gemini/chat` com `messages: []` | 400 | 400 |
| Payload de 300 KB | 413 | 413 |
