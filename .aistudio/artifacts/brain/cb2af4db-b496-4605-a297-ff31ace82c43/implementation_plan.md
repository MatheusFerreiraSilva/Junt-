# Implementação do Prompt # 10 — Plantões, saldos e disponibilidade

## 1. Fonte Única da Verdade para Saldos de Plantões
- **Contrato Unificado em Centavos Inteiros (`ShiftIncomeAllocation`)**:
  - Implementada a função `getShiftBalance(shift, ledgers)` em `src/utils/shiftsEngine.ts`, expondo `expectedAmount`, `receivedAmount`, `pendingAmount`, `overallocatedAmount`, `isFullyPaid`, `isPartiallyPaid` e `isOverallocated`.
  - `calculateShiftMetrics` agora consome as alocações da tabela `shiftIncomeAllocations`, unificando a leitura de valores recebidos, pendentes e em atraso sem depender de flag booleana de status.
  - `calendarEngine.ts` e `thermometerEngine.ts` agora utilizam a mesma fonte unificada de saldo, exibindo o status `'parcial'` e o saldo residual exato nos recebíveis médicos.
  - Preservação estrita de `netAmount: 0` (`netAmount !== undefined ? netAmount : grossAmount`), sem fallback espúrio para `grossAmount`.

## 2. Conciliação Multi-plantão e Pagamento Parcial
- Um único depósito de provento pode quitar múltiplos plantões (ex: R$ 2.000 quitando dois plantões de R$ 1.000).
- Um plantão pode ser quitado em partes através de múltiplos depósitos parciais/adiantamentos.
- `applyShiftAllocation` e `undoShiftAllocations` em `src/utils/shiftReconciliation.ts` mantêm a rastreabilidade em centavos inteiros (`amountCents`) e atualizam os campos `reconciledAmount`, `pendingAmount` e `overallocatedAmount`.
- A edição de valores esperados em `FinanceContext.tsx` recalcula o balanço em tempo real e expõe sobrealocações via notificação informativa, impedindo pendências ocultas.

## 3. Planejamento de Agenda, Horários e Detecção de Sobreposição
- Adicionados os campos opcionais de escala à interface `MedicalShift` em `src/types/finance.ts`:
  - `startTime?: string` (HH:mm)
  - `endTime?: string` (HH:mm)
  - `commuteMinutes?: number` (deslocamento)
  - `timePrecision?: 'exact' | 'date_only'`
- Implementadas as funções `getShiftTimeWindow` e `checkShiftOverlap` em `src/utils/shiftsEngine.ts`:
  - Suporte completo a plantões que viram a noite (ex.: 22:00 às 07:00 do dia seguinte com adição de 24h na janela de término).
  - Detecção de conflito de agenda no modal `MedicalShiftModal` com alerta em tempo real e consideração opcional de tempo de deslocamento.
  - Plantões cancelados (`executionStatus === 'cancelled'`) ou substituídos (`executionStatus === 'replaced'`) são ignorados no cômputo de sobreposição e nunca contam como trabalho realizado nem receita a receber.

## 4. Estágios de Carreira e Prescrição de Pacing
- `calculateShiftRecommendations` agora recebe contexto de carreira (`PacingContext`):
  - Estudantes em `graduacao` ou `internato` recebem **0 plantões extras sugeridos** por definição do produto.
  - Residentes (`residencia`) possuem tolerância zero de plantões extras por padrão na simulação, permitindo liberação apenas se explicitamente configurado.
  - Filtros individuais por parceiro não herdam 100% dos custos fixos do casal: a partilha de despesas fixas é calculada proporcionalmente à renda do parceiro.

## 5. Invariantes e Proteção contra Resgates
- Resgates de caixinhas ou investimentos (`classification: 'resgate_principal'`, `'principal_redemption'` ou com descrição `resgate`) não são considerados renda de plantão.
- `findMatchingBankIncomesForShift` e `applyShiftAllocation` rejeitam explicitamente resgates e transferências internas, garantindo que resgates não conciliem plantões médicos.
- Desfazer o vínculo (`undoShiftReconciliation`) reabre o saldo pendente do plantão sem apagar o depósito bancário nem o plantão realizado.

## 6. Verificação e Suíte de Testes
- Adicionados 11 testes unitários dedicados em `src/utils/__tests__/shiftsEnginePrompt10.test.ts`.
- 100% dos 280 testes automatizados da aplicação passaram (40 arquivos de teste).
- Typecheck (`compile_applet`) e ESLint (`lint_applet`) executados com zero erros.
