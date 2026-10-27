# Unificação e Integração Total: Hub do Casal x Investimentos & Extrato

Unificação completa e bidirecional dos dados de investimentos, reserva de emergência, desejos da wishlist e contas fixas do casal no aplicativo JUNTÔ. As abas **Investimentos** e **Hub do Casal** passarão a compartilhar uma fonte de dados única e sincronizada, garantindo que qualquer alteração em uma refletirá instantaneamente na outra.

---

## Decisões Confirmadas do Usuário

> [!IMPORTANT]
> As escolhas a seguir foram confirmadas diretamente pelo usuário na fase de alinhamento:

- **Unificação Total de Caixinhas & Metas**: As mesmas Caixinhas (`piggyBanks` e `coupleGoals`) serão utilizadas simultaneamente na aba *Investimentos* e no *Hub do Casal*. Aportes e retiradas feitos em qualquer uma das telas atualizam o saldo consolidado e mantêm a divisão de contribuição do casal (Ele x Ela).
- **Integração dos Alertas de Contas Fixas com o Extrato**: Ao marcar uma conta fixa como paga no Hub do Casal, o sistema registrará automaticamente uma nova despesa no **Extrato de Transações**, vinculada à categoria correspondente e ao pagador designado.
- **Intenções Estratégicas de Gasto na Wishlist e Caixinhas**: Botão direto na Lista de Desejos (Wishlist) e nos Cofrinhos para vincular ou converter um desejo diretamente em uma **Intenção Estratégica de Gasto** (Alocação Proativa de Reserva/Caixinha).

---

## 1. Visão Geral e Conceito Central

### O que esta mudança entrega
- **Fonte Única da Verdade (`Single Source of Truth`)**: Eliminação de redundâncias. A aba *Investimentos* e a aba *Hub do Casal* operam sobre os mesmos objetos de estado no `FinanceContext`.
- **Conexão Real com a Reserva de Emergência**: O painel de Reserva do Hub do Casal consumirá diretamente os valores reais do Bloco 1 (`protectionCurrentAmount` e `protectionTotalInvested`) e os alvos de meses definidos no perfil do casal.
- **Fluxo Automático de Pagamento de Contas**: Marcar um boleto/fatura como pago atualiza o checklist e lança a saída no orçamento mensal instantaneamente.
- **Wishlist -> Meta -> Intenção Estratégica**: Ciclo de vida completo do desejo do casal:
  `Desejo na Wishlist` ➔ `Transformar em Meta/Caixinha` ➔ `Aportar` ➔ `Vincular Intenção Estratégica de Gasto` ao atingir a meta.

---

## 2. Experiência do Usuário & Design Visual

### Fluxos Principais

1. **Gestão Única de Caixinhas (Investimentos ⇄ Hub do Casal)**
   - O usuário acessa a aba *Investimentos* ou o *Hub do Casal*.
   - Ao criar uma nova Caixinha ou Meta, ela aparece em ambas as abas.
   - No *Hub do Casal*, a Caixinha ganha visualização detalhada da participação individual (**Ele x Ela**), enquanto na aba *Investimentos* é exibida no contexto dos 3 Blocos de Segurança (Proteção, Objetivos, Liberdade).

2. **Checklist Inteligente de Contas Fixas & Lançamento no Extrato**
   - Na aba *Hub do Casal*, na seção *Alertas de Contas*, o usuário clica em **"Marcar Pago"**.
   - O app pergunta/confirma a data e o método de pagamento e cria automaticamente uma transação na lista de `expenses`.
   - Se desmarcado, o registro correspondente no extrato pode ser estornado ou atualizado.

3. **Ciclo de Vida do Desejo (Wishlist)**
   - Na Wishlist, botão **"Vincular Intenção Estratégica"** abre o modal de alocação de reserva pré-preenchido com o item desejado.
   - Botão **"Transformar em Meta do Casal"** cria a Caixinha correspondente e atualiza o status para `convertido_meta`.

---

## 3. Decisões de Arquitetura & Modelo de Dados

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       FinanceContext (Global State)                         │
│                                                                             │
│ ┌─────────────────────────┐ ┌───────────────────────┐ ┌───────────────────┐ │
│ │ piggyBanks &           │ │ protectionCurrentAmt │ │ expenses          │ │
│ │ coupleGoals (Unified)   │ │ (Reserva do Bloco 1)  │ │ (Extrato do Mês)  │ │
│ └────────────┬────────────┘ └───────────┬───────────┘ └─────────┬─────────┘ │
└──────────────┼──────────────────────────┼───────────────────────┼───────────┘
               │                          │                       │
               ▼                          ▼                       ▼
┌──────────────────────────────┐ ┌───────────────────────────────────────────┐
│ GoalsScreen (Investimentos)  │ │         CoupleHubScreen (Hub)             │
│                              │ │                                           │
│  - Visão por 3 Blocos        │ │  - Divisão de Aportes Ele x Ela           │
│  - Caixinhas Unificadas      │ │  - Reserva Real de Emergência             │
│  - Guia de Aportes Mensais   │ │  - Wishlist ➔ Meta ➔ Intenção Estratégica │
│                              │ │  - Alertas de Vencimento ➔ Extrato Auto  │
└──────────────────────────────┘ └───────────────────────────────────────────┘
```

### Mapeamento das Entidades Unificadas

1. **`SavingsPiggyBank` & `CoupleGoal`**:
   - Mapeamento bidirecional no helper do context ou fusão de tipos de modo que todas as caixinhas criadas em *Investimentos* sejam refletidas como metas no *Hub do Casal* com divisão padrão de 50/50 quando a divisão não for especificada.

2. **Reserva de Emergência Bloco 1 (`protectionCurrentAmount`)**:
   - Conectada diretamente ao indicador do Hub do Casal. Operações de depósito/resgate no Bloco 1 sincronizam em tempo real no dashboard do casal.

3. **Contas Fixas ➔ Extrato de Despesas**:
   - Ação de pagamento adiciona item na lista de `expenses` com `assignedTo`, `category` e `paidBy`.

---

## 4. Plano de Execução em Etapas

1. **Ajustes de Tipos & Mapeadores no Contexto (`src/types/finance.ts` & `src/context/FinanceContext.tsx`)**:
   - Adicionar helpers para criar/sincronizar caixinhas entre `piggyBanks` e `coupleGoals`.
   - Adicionar handler no context `markFixedBillPaid(billId, paymentDetails)` que atualiza o status do alerta e insere no extrato `expenses`.

2. **Atualização da tela `GoalsScreen.tsx` (Investimentos)**:
   - Exibir indicadores de divisão do casal nas Caixinhas e atalho para o *Hub do Casal*.

3. **Atualização da tela `CoupleHubScreen.tsx` (Hub do Casal)**:
   - Conectar os cofrinhos do Hub diretamente à lista unificada `piggyBanks` do context.
   - Conectar a Reserva de Emergência do Hub aos valores reais de `protectionCurrentAmount`.
   - Adicionar botão **"Vincular Intenção Estratégica"** na Wishlist.
   - Conectar a ação de pagamento de contas para criar a transação automática no Extrato.

4. **Verificação & Compilação**:
   - Executar `compile_applet` e `lint_applet` para garantir compilação limpa sem erros.
