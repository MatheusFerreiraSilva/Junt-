# Upgrade Inteligente & Funcional: Hub de Sobras, Excessos & Vasos Comunicantes

Transformação do módulo "Sobras & Excessos" em uma central viva e interativa para o casal, equipada com Simulador de Divisão Percentual Personalizada, projeção de antecipação de metas, transferência visual por Vasos Comunicantes, amortização de furos via Plantões Extras e recalibragem suave do ritmo diário.

---

### User Review & Critical Decisions

> [!IMPORTANT]
> As decisões abaixo foram confirmadas através das respostas do casal e estruturam toda a experiência deste upgrade:

- **Divisão das Sobras sob Medida**: Sliders percentuais interativos onde o casal decide livremente a proporção exata destinada para cada pote (Caixinhas/Metas, Aceleração da Reserva de Emergência, Recompensa Livre do Casal ou Amortização Futura).
- **Tríade de Resolução de Excessos**: Disponibilização integrada de três mecanismos imediatos quando uma categoria estoura:
  1. *Vasos Comunicantes*: transferir saldo de categorias que gastaram menos com 1 toque.
  2. *Amortização por Plantão Extra*: vincular ganhos de plantões médicos recentes ou futuros para absorver o furo.
  3. *Recalibragem Suave*: recalcular a média diária segura para os dias restantes do mês sem gerar estresse.
- **Simulador Visual de Impacto**: Cálculo dinâmico em tempo real exibindo quantas semanas ou meses o casal antecipa a realização de seus sonhos ao direcionar as sobras para as caixinhas.

---

### 1. Overview & Core Concept

- **O que faz**: Oferece ao casal médico um sistema proativo para lidar com a volatilidade da rotina. Em semanas com sobras orçamentárias, transforma o saldo positivo em aceleração tangível de metas com distribuição percentual escolhida a dedo. Em semanas sobrecarregadas com estouro de gastos, oferece três saídas funcionais, empáticas e sem culpa.
- **Público-alvo**: O casal médico, integrando a rotina de plantões e a vida financeira compartilhada.
- **Valor Principal**: Elimina a sensação de frustração ou cálculo manual. Dá visibilidade imediata ao impacto positivo de economizar e simplifica o reequilíbrio orçamentário.

---

### 2. User Experience & Visual Design

#### Fluxos Principais
1. **Visão Geral do Hub de Sobras & Ritmo**:
   - Hero com o balanço consolidado de sobras ativas vs. furos do mês, dias restantes e ritmo seguro diário.
   - Indicador de estado de equilíbrio: "Ciclo com Sobra Ativa", "Ajuste Necessário" ou "Orçamento Equilibrado".

2. **Simulador de Destinação Percentual de Sobras**:
   - Sliders táteis e sintonizados (somando 100%):
     - **Caixinha Prioritária / Wishlist** (ex: Viagem, Reforma, Casamento).
     - **Reserva de Emergência** (aceleração do colchão de segurança).
     - **Livre para Desfrute do Casal** (jantar especial, lazer sem culpa).
     - **Fundo de Transição / Próximo Mês**.
   - **Métrica de Antecipação de Sonhos**: cartão visual que projeta: *"Com este aporte de R$ X, vocês antecipam a meta [Viagem] em 24 dias!"*.
   - Botão de execução: *"Consolidar Distribuição & Celebrar"*, acionando animação de confetti e histórico de auditoria.

3. **Painel Inteligente de Resolução de Excessos (Quando houver categoria estourada)**:
   - **Aba/Modal de Vasos Comunicantes**: Lista visual das categorias com folga (ex: Transporte com +R$ 220 de sobra) e botão direto de "Transferir para Categoria Estourada (ex: Mercado)". Mostra a animação fluida do nivelamento.
   - **Compensação com Plantão Extra**: Lista os plantões médicos pendentes ou recém-realizados do casal para vincular como fonte de cobertura do furo com 1 clique.
   - **Recalibrador Suave**: Exibe o impacto na média diária de gastos para os dias que faltam no mês, permitindo absorver o excesso diluído no tempo.

4. **Histórico de Realocações & Transparência**:
   - Registro datado de todas as transferências entre categorias e aportes derivados de sobras para manter total clareza.

#### Estilo Visual & Diretrizes Frontend-Design
- **Aparência**: Estilo contemporâneo e sofisticado, combinando ardósia neutra escura/clara (`bg-slate-900` / `bg-white`) com toques de verde esmeralda para sobras e âmbar caloroso para recalibragens.
- **Tipografia**: Numerais em `tabular-nums` alinhados com precisão cirúrgica e fontes legíveis.
- **Zero-Pill Discipline**: Metadados textuais limpos com separadores tipográficos (`·`), sem cápsulas estáticas ou bordas excessivas.

---

### 3. Key Product Decisions & Trade-Offs

- **Decisão 1: Controle Percentual Dinâmico com Bloqueio de 100%**:
  - *Abordagem*: Sliders interativos com ajuste proporcional inteligente para garantir que a soma dos destinos sempre seja 100% do valor da sobra selecionada.
  - *Por que*: Atende com precisão ao desejo do usuário ("eu escolho quantos porcento vão para cada lugar") com total controle e facilidade táctil.
- **Decisão 2: Tríade de Soluções de Excesso no mesmo componente**:
  - *Abordagem*: Integrar Vasos Comunicantes, Abatimento por Plantão e Recalibragem de Ritmo em abas intuitivas no mesmo painel de resolução.
  - *Por que*: Em semanas médicas atípicas, o casal tem flexibilidade para escolher a melhor saída em segundos.

---

### 4. Technical Architecture & Component Structure

```
┌────────────────────────────────────────────────────────────────────────┐
│                          WeeklySurplusHub                              │
│                                                                        │
│  ┌───────────────────────┐  ┌───────────────────────────────────────┐  │
│  │   Hero & Status       │  │   Visual Metrics                      │  │
│  │   · Sobras Ativas     │  │   · Dias Restantes                    │  │
│  │   · Furos Detectados  │  │   · Ritmo Seguro Diário               │  │
│  └───────────────────────┘  └───────────────────────────────────────┘  │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ [SEÇÃO SOBRAS] Simulador de Alocação Percentual                  │  │
│  │  - Sliders interativos: Metas / Reserva / Lazer / Próximo Mês    │  │
│  │  - Projeção viva: "Antecipa meta em X dias"                      │  │
│  │  - Ação: "Efetivar Distribuição de Sobras"                       │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ [SEÇÃO EXCESSOS] Painel de Resolução Inteligente                 │  │
│  │  ├─ Vasos Comunicantes: Transferência entre categorias           │  │
│  │  ├─ Plantão Médico Extra: Cobertura direta do déficit            │  │
│  │  └─ Recalibragem Suave: Rebalanceamento da média diária          │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ Histórico de Realocações & Pacing Semanal de Comida              │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

#### Mapeamento de Estado e Funções:
- Atualização em `FinanceContext.tsx`:
  - `reallocateCategoryBudget(fromCategory, toCategory, amount)`: transfere saldo entre categorias para a mecânica de vasos comunicantes.
  - `coverExpenseDeficitWithShift(shiftId, categoryKey, amount)`: vincula plantão médico para amortizar estouro de categoria.
  - `distributeSurplusPercentages(allocations: { targetType: string; targetId?: string; percentage: number; amount: number }[])`: distribui as sobras selecionadas para caixinhas, reserva ou saldo livre.
- Refatoração dos componentes:
  - `src/components/WeeklySurplusHub.tsx`: tela principal com o novo simulador percentual e painel de vasos comunicantes.
  - `src/components/CommunicatingVesselsModal.tsx` / subcomponente dedicado para visualização fluida de transferência.
  - `src/components/SurplusAllocationModal.tsx`: atualização para sincronizar com os novos controles percentuais.
