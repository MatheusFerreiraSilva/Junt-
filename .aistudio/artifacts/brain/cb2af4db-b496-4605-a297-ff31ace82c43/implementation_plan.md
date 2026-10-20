# Atualização de Regras Financeiras: Transporte, Teto de 20%, Reserva Inteligente & Adiantamento de Parcelas

Implementação da nova especificação de regras do Juntô: adição da 6ª categoria oficial (**Transporte & Mobilidade** a 10%), ajuste do **Teto de Parcelamento no Cartão para 20%** com desoneração de financiamentos estruturais (imobiliário e veicular), **Gestão da Reserva de Emergência** com piso blindado de 3 meses e liberação voluntária de excesso (meta de 10 meses), e **Recurso Customizado de Adiantamento de Parcelas** com múltiplas fontes de débito (reserva excedente, cofrinhos específicos, sobras de categorias ou misto).

## Decisões Confirmadas & Respostas do Usuário

> [!IMPORTANT]
> - **Transporte & Mobilidade (10%)**: Inclusão como categoria oficial com 10% da renda combinada, recalibrando proporcionalmente Moradia e Lazer nas 4 faixas de renda (`incomeTiersEngine.ts`).
> - **Reserva de Emergência**: Meta de acúmulo de **10 meses** de despesas fixas, com **piso intocável de segurança de 3 meses** blindado contra compras. O saldo acumulado acima do piso pode ser transferido voluntariamente para Caixinhas/Objetivos ou compras à vista.
> - **Adiantamento Customizado de Parcelas**: Recurso inteligente na aba de parcelas com seleção de fontes customizadas (debita da reserva excedente, de um cofrinho escolhido, do saldo livre de lazer/sobra do mês ou composição mista), recalculando instantaneamente o teto de 20%.

- **Decisão Confirmada 1**: Categoria oficial `transporte` adicionada a `CategoryKey` com escopo completo (combustível, IPVA, licenciamento, seguro auto, manutenção preventiva/corretiva, Uber/99, pedágios e estacionamentos).
- **Decisão Confirmada 2**: Teto de compras parceladas no cartão de crédito ajustado para **20% da renda líquida combinada**. Financiamentos habitacionais e veiculares são classificados como compromissos estruturais (PF) das categorias Moradia e Transporte e **não** consomem o teto do cartão.
- **Decisão Confirmada 3**: Piso sagrado de 3 meses na Reserva com calculadora de excesso liberado e transferência facilitada para caixinhas.
- **Decisão Confirmada 4**: Modal interativo de adiantamento de parcelas com cálculo em tempo real e débitos customizados.

## 1. Visão Geral & Proposta de Valor

- **O que faz**:
  1. Dá visibilidade autônoma a todos os gastos de locomoção e manutenção veicular do casal através da categoria **Transporte & Mobilidade**, sem misturar com Moradia ou Lazer.
  2. Ajusta a régua de endividamento no cartão para um teto realista de **20%**, diferenciando o que é compra de consumo de parcelamento longo do que é financiamento de patrimônio.
  3. Protege a integridade psicológica do casal com um piso intocável de 3 meses na Reserva, ao mesmo tempo em que destrava o excesso para acelerar sonhos e objetivos.
  4. Permite ao casal "matar" parcelas futuras usando sobras inteligentes do mês, liberando a margem de cartão no mesmo instante.
- **Público-Alvo**: O casal que deseja clareza orçamentária cirúrgica, mobilidade sem surpresas no IPVA/seguro e alavancagem inteligente para quitar compras parceladas mais rápido.

## 2. Experiência do Usuário & Design Visual

- **1. Categoria Transporte & Mobilidade (`🚗`)**:
  - Nova categoria nos gráficos de rosca, raio-x das áreas da vida, extrato e modais de lançamento.
  - Paleta: Azul Petróleo / Ciano Profundo (`#0284C7`), com badge própria e ícones de combustível, carro e aplicativo de transporte.
  - Regras de categorização automática atualizadas para mapear postos de gasolina, Uber, 99, Sem Parar, IPVA e oficinas para `transporte`.
- **2. Financiamentos vs. Parcelas de Consumo (Teto de 20%)**:
  - Na tela de parcelamento (`InstallmentsScreen.tsx`), cada item exibe sua natureza:
    - 💳 *Parcela de Consumo*: Consome a margem de 20% do cartão.
    - 🏛️ *Financiamento Estrutural*: Vinculado a Moradia ou Transporte como custo fixo base.
  - Termômetro de comprometimento atualizado para a régua de 20%, com indicador de margem livre (`"Margem livre no cartão: R$ X"`).
- **3. Reserva de Emergência com Piso de 3 Meses & Liberação de Excesso**:
  - Na tela de Investimentos & Metas (`GoalsScreen.tsx`):
    - Barra de proteção dividida em dois segmentos: **Piso Blindado (3 meses)** + **Excesso Alavancável (até 10 meses)**.
    - Botão *"Realocar Excesso da Reserva"*: abre gaveta para transferir valores excedentes para qualquer Cofrinho (ex: Casamento, Viagem, Reforma) sem tocar no piso mínimo de sobrevivência.
- **4. Modal Interativo de Adiantamento de Parcelas (`AdvanceInstallmentModal`)**:
  - Botão *"⚡ Adiantar Parcelas"* em cada card de parcelamento e no topo da aba.
  - Interface em 3 etapas:
    - *Etapa 1*: Selecionar quantidade de parcelas a adiantar (ex: 2x de R$ 450 = R$ 900).
    - *Etapa 2*: Escolher a fonte de débito customizada com sliders ou inputs:
      - 🛡️ Excesso da Reserva (disponível: R$ ...)
      - 🎯 Cofrinho X (ex: Viagem - disponível: R$ ...)
      - 🎮 Saldo Livre de Lazer / Sobra do Mês
      - 💡 Composição Mista (ex: R$ 500 do Lazer + R$ 400 do Cofrinho)
    - *Etapa 3*: Confirmação com animação comemorativa e liberação imediata do teto de 20%.

## 3. Decisões de Produto & Arquitetura de Componentes

- **Decisão 1**: Inclusão retrocompatível de `transporte` em `CategoryKey`.
  - *Abordagem*: Adicionar `'transporte'` à união `CategoryKey` em `src/types/finance.ts` e registrar em `CATEGORIES_BASE`. Todas as telas e gráficos lerão automaticamente a 6ª categoria sem quebrar lançamentos antigos.
  - *Distribuição padrão nas faixas*: Decolagem (Moradia 30%, Transporte 10%, Comida 18%, Lazer 10%, Proteção 12%, Profissional 10%, Investimentos 10%).
- **Decisão 2**: Campo `type` em `InstallmentPurchase`.
  - *Abordagem*: `type?: 'card_consumption' | 'financing'` (default: `'card_consumption'`). Apenas `'card_consumption'` entra no cálculo do `installmentCommitmentPercentage`.
- **Decisão 3**: Adiantamento como operação financeira atômica.
  - *Abordagem*: Ao adiantar parcelas, o sistema atualiza `paidInstallmentsCount`, recalcula a fatura do próximo mês e deduz com exatidão dos saldos escolhidos (reserva ou cofrinho), registrando um log de histórico transparente.

## 4. Arquitetura Técnica & Diagrama de Fluxo

```
┌────────────────────────────────────────────────────────────────────────┐
│                          FinanceContext State                          │
│  - CategoryKey: moradia | comida | lazer | protecao |                  │
│                 profissional | transporte (NOVO)                       │
│  - InstallmentPurchase.type: 'card_consumption' | 'financing'          │
│  - emergencyReserveMonthsTarget: 10 meses                             │
│  - emergencyReserveFloorMonths: 3 meses                                │
│  - installmentLimitPercentage: 20%                                     │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
         ┌──────────────────────────┴──────────────────────────┐
         ▼                                                     ▼
┌─────────────────────────────────┐   ┌──────────────────────────────────┐
│ Gestão de Parcelas              │   │ Gestão de Reserva & Metas        │
│ - Teto de 20% (Apenas Consumo)  │   │ - Piso Intocável (3 meses fixos) │
│ - Financiamentos em Moradia /   │   │ - Excesso Liberável (até 10 m)   │
│   Transporte                    │   │ - Ação: reallocateReserveExcess  │
│ - Modal: Adiantar Parcelas      │   │                                  │
│   (Fontes customizadas)         │   │                                  │
└─────────────────────────────────┘   └──────────────────────────────────┘
```

- **Plano de Execução**:
  1. **Atualizar `src/types/finance.ts`**:
     - Adicionar `'transporte'` a `CategoryKey`.
     - Adicionar `type?: 'card_consumption' | 'financing'` em `InstallmentPurchase`.
     - Adicionar tipos de adiantamento e realocação de reserva.
  2. **Atualizar `src/utils/incomeTiersEngine.ts`**:
     - Recalibrar porcentagens das 4 faixas de vida incorporando Transporte a 10%.
  3. **Atualizar `src/context/FinanceContext.tsx`**:
     - Adicionar `transporte` em `CATEGORIES_BASE`.
     - Ajustar cálculo do teto de parcelas para 20% filtrando apenas `card_consumption`.
     - Implementar lógica de piso de 3 meses e realocação de excesso da reserva.
     - Implementar ação `advanceInstallmentPayment`.
  4. **Criar `AdvanceInstallmentModal.tsx`**:
     - Modal com seleção de parcelas e fontes customizadas (reserva, cofrinho, sobra, misto).
  5. **Atualizar `InstallmentsScreen.tsx` e `GoalsScreen.tsx`**:
     - Integrar o botão e fluxo de adiantamento na tela de parcelamentos.
     - Integrar a visualização de piso intocável e botão de realocação na tela de metas.
  6. **Atualizar telas com filtros e gráficos (`HomeScreen.tsx`, `TrendsScreen.tsx`, etc.)**:
     - Garantir que Transporte & Mobilidade apareça com sua paleta nos gráficos de rosca e extratos.
  7. **Compilação e Verificação**:
     - `compile_applet` e `lint_applet` para garantir zero regressões.
