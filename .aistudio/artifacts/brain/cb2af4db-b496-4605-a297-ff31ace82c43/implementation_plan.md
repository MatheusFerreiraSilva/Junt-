# Área Dedicada de Sobras & Excessos Semanais no Dashboard

Reorganização inteligente e otimizada da nova mecânica de acompanhamento semanal, unificando o Pacing de Comida & Conveniência, as sugestões da IA e o radar de recalibragem de excessos em uma aba dedicada no menu do Dashboard do Junto.

---

### User Review & Critical Decisions

> [!IMPORTANT]
> **Decisões confirmadas com o casal:**
> - **Posicionamento**: Criação de uma aba dedicada no seletor de abas do Dashboard (`Sobras & Excessos`), aliviando a poluição visual do topo e da aba de ações gerais.
> - **Escopo Unificado**: A nova aba reúne (1) Pacing Semanal de Comida & Abastecimento, (2) Sugestões Contextuais da IA de 1 toque e (3) Radar Empático de Excessos e Recalibragem.
> - **Tratamento de Excessos Semanais**: Abordagem acolhedora e empática para semanas com plantões pesados, oferecendo ações rápidas de recalibragem de ritmo diário e compensação sem julgamento financeiro frio.

---

### 1. Overview & Core Concept

- **O que faz**: Cria um centro de inteligência financeira semanal no Dashboard do Junto (`🌿 Sobras & Excessos`), isolando a análise de ritmo semanal em um espaço focado e harmonioso.
- **Público-alvo**: O casal (Dra. Bia & Dr. Lucas), que precisa verificar rapidamente a saúde da semana atual, gerenciar o saldo de comida/delivery e decidir o destino de sobras orçamentárias sem sobrecarga de informação.
- **Valor Principal**: Elimina a fragmentação visual, permitindo que a aba principal continue limpa para lançamentos rápidos e rituais, enquanto a nova aba oferece profundidade analítica, acolhimento e celebração das vitórias semanais.

---

### 2. User Experience & Visual Design

```
┌────────────────────────────────────────────────────────────────────────┐
│                        DASHBOARD - SELETOR DE ABAS                     │
├──────────────────┬─────────────────┬─────────────────┬─────────────────┤
│ ✨ Ações Rápidas │ 🌿 Sobras & Ex. │ ⚖️ Divisão 50/50│ 📅 Cofrinhos/Par│
└──────────────────┴────────┬────────┴─────────────────┴─────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 🌿 HUB SEMANAL: SOBRAS, RITMO & INTELIGÊNCIA DA IA                     │
│                                                                        │
│ 1. HERO DO RITMO SEMANAL                                               │
│    • Semana 3 de 4 (Dias 15 a 21) · Ritmo Seguro: R$ 85,00/dia         │
│    • Saldo Líquido Operacional em Aberto                               │
│                                                                        │
│ 2. SUGESTÕES CONTEXTUAIS DA IA (3 OPÇÕES RÁPIDAS DE 1 TOQUE)           │
│    • Proposta de Recompensa / Sobras Identificadas                     │
│      [ ✨ Gostei, vamos usar! ] [ 🎯 Mandar p/ Cofrinho ] [ 🛡️ Guardar]│
│                                                                        │
│ 3. RADAR EMPÁTICO DE RECALIBRAGEM (QUANDO HOUVER EXCESSO)              │
│    • Leitura de cansaço nos plantões sem culpa                         │
│    • Botão de recalibragem inteligente do ritmo diário restante        │
│                                                                        │
│ 4. INTELIGÊNCIA DE ABASTECIMENTO & PACING (COMIDA & CONVENIÊNCIA)      │
│    • Detalhamento dos 3 Pilares (Estrutural, Rotina, Conveniência)     │
│    • Blocos das 4 semanas com status em tempo real                     │
└────────────────────────────────────────────────────────────────────────┘
```

#### Fluxo do Usuário:
1. **Entrada Natural**: Na tela inicial, abaixo das 3 Perguntas Essenciais, o casal encontra a barra de navegação de contexto. Um indicador discreto na aba `🌿 Sobras & Excessos` sinaliza quando houver sobras ativas para direcionamento.
2. **Visão da Semana**: Ao tocar na aba, o casal visualiza imediatamente o saldo seguro dos próximos dias, sem misturar com formulários de entrada de dados.
3. **Decisão em 1 Toque**: As sugestões da IA aparecem organizadas em cards acolhedores com as 3 opções diretas ("Gostei, vamos usar!", "Mandar para o Cofrinho", "Manter guardado na conta").
4. **Recalibragem Serena**: Se uma semana tiver excesso de delivery devido a plantões, o radar acolhe o cansaço e oferece recalibrar a média diária dos dias restantes em 1 clique.

---

### 3. Key Product Decisions & Trade-Offs

- **Aba Dedicada vs. Card no Topo**:
  - *Decisão*: Criar a aba `surplus` no menu de seções do Dashboard.
  - *Por que*: O topo do dashboard já possui o Termômetro do Mês e a Faixa de Vida, que são o "raio-x" instantâneo. Inserir múltiplos cards de sobras no topo alongava desnecessariamente a rolagem vertical.
- **Componente Unificado `WeeklySurplusHub`**:
  - *Decisão*: Criar uma área modular que engloba as sugestões da IA, o Pacing de Comida e o Radar de Excessos de forma integrada.
  - *Por que*: Evita renderização duplicada ou cards órfãos espalhados pelo código.
- **Tratamento de Excessos com Recalibragem**:
  - *Decisão*: Em vez de mero aviso vermelho de estouro, oferecer cálculo de novo ritmo seguro diário para o restante do mês.
  - *Por que*: Reduz ansiedade e mantém a cumplicidade do relacionamento.

---

### 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────────────────────┐
│                        FinanceContext                                  │
│  - foodPacingMetrics (semanas, saldo operacional, pilares)             │
│  - aiPredictiveInsights (sugestões com 3 ações)                        │
│  - applyAISuggestionAction / dismissAISuggestion                       │
│  - recalculateSafeDailyPacing                                          │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   src/screens/HomeScreen.tsx                           │
│  - activeDashboardTab: 'actions' | 'surplus' | 'split' | 'future' ...  │
│  - renderiza WeeklySurplusHub quando activeDashboardTab === 'surplus'  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│           src/components/WeeklySurplusHub.tsx (NOVO)                   │
│  ├── Header com Status da Semana e Ritmo Seguro Diário                 │
│  ├── Radar Empático de Excessos e Recalibragem de Ritmo               │
│  ├── AIPredictiveInsightsCard (Sugestões de 1 toque da IA)             │
│  └── FoodPacingWeeklyCard (Pacing Semanal dos 3 Pilares de Comida)     │
└────────────────────────────────────────────────────────────────────────┘
```

#### Passos de Implementação:
1. **Criar componente `WeeklySurplusHub.tsx`**:
   - Reúne métricas da semana em andamento, ritmo diário, card de excessos com recalibragem suave, `AIPredictiveInsightsCard` e `FoodPacingWeeklyCard`.
2. **Atualizar `DashboardTab` em `HomeScreen.tsx`**:
   - Adicionar `'surplus'` ao tipo `DashboardTab` (`actions | surplus | split | future | fusion`).
   - Atualizar a barra de abas com label `🌿 Sobras & Excessos` e contador de insights pendentes.
   - Mover a visualização densa de `AIPredictiveInsightsCard` e `FoodPacingWeeklyCard` para dentro da aba `surplus`.
   - Adicionar banner sutil ou badge na aba indicando quando há sobras semanais para direcionar.
3. **Garantir Integração com Ações**:
   - Manter as ações de 1 toque funcionando perfeitamente (recompensas, cofrinhos, amortecedor de caixa).
   - Manter compatibilidade com tela de detalhes de categoria (`CategoryDetailsScreen.tsx`).
4. **Verificação & Testes**:
   - Executar `lint_applet` e `compile_applet`.
   - Executar `vitest` em `src/utils/__tests__` garantindo 100% de sucesso.
