/**
 * Matriz Canônica de Persistência Financeira e Confirmação de Nuvem
 * 
 * Separação rigorosa de responsabilidades:
 * 1. Finanças do Casal (compartilhadas entre os parceiros, sob /couples/{coupleId})
 * 2. Dados Pessoais / Conta (privados ao UID, sob /avatars/{uid}, /accountPreferences/{uid}, /users/{uid})
 * 3. Rascunhos e Simulações (estritamente locais até confirmação expressa)
 * 4. Cache Local (localStorage; fallback resiliente offline, JAMAIS confirmação de nuvem)
 */

export type PersistenceOwner = 'couple' | 'personal' | 'simulation_draft' | 'client_cache';
export type CompetencyScope = 'monthly' | 'continuous' | 'event' | 'setting';

export interface PersistenceMatrixEntry {
  field: string;
  owner: PersistenceOwner;
  competency: CompetencyScope;
  source: string;
  readPath: string;
  writePath: string;
  rule: string;
  test: string;
}

export const CLOUD_PERSISTENCE_MATRIX: readonly PersistenceMatrixEntry[] = [
  // --- Finanças Compartilhadas do Casal: Entidades Independentes ---
  {
    field: 'expenses',
    owner: 'couple',
    competency: 'monthly',
    source: 'Entrada manual, reconciliação ou importação bancária',
    readPath: 'couples/{coupleId}/entities/expenses:{id}',
    writePath: 'couples/{coupleId}/entities/expenses:{id}',
    rule: 'validEntity && validRecord (amount >= 0, paidBy válido, sem segredos)',
    test: 'src/lib/__tests__/entitySync.test.ts',
  },
  {
    field: 'incomes',
    owner: 'couple',
    competency: 'monthly',
    source: 'Entrada de salário/renda ou plantões médicos conciliados',
    readPath: 'couples/{coupleId}/entities/incomes:{id}',
    writePath: 'couples/{coupleId}/entities/incomes:{id}',
    rule: 'validEntity && validRecord (amount >= 0, recipient válido)',
    test: 'src/lib/__tests__/entitySync.test.ts',
  },
  {
    field: 'installments',
    owner: 'couple',
    competency: 'continuous',
    source: 'Compras parceladas ou financiamentos imobiliários/veiculares',
    readPath: 'couples/{coupleId}/entities/installments:{id}',
    writePath: 'couples/{coupleId}/entities/installments:{id}',
    rule: 'validEntity (totalAmount, installmentsCount, startMonth)',
    test: 'src/utils/__tests__/installmentMoney.test.ts',
  },
  {
    field: 'piggyBanks',
    owner: 'couple',
    competency: 'continuous',
    source: 'Cofrinhos, metas conjuntas e reserva de oportunidade',
    readPath: 'couples/{coupleId}/entities/piggyBanks:{id}',
    writePath: 'couples/{coupleId}/entities/piggyBanks:{id}',
    rule: 'validEntity com reconciliação aditiva transacional concorrente',
    test: 'src/lib/__tests__/entitySync.test.ts',
  },
  {
    field: 'coupleGoals',
    owner: 'couple',
    competency: 'continuous',
    source: 'Objetivos estruturais do casal com histórico aditivo',
    readPath: 'couples/{coupleId}/entities/coupleGoals:{id}',
    writePath: 'couples/{coupleId}/entities/coupleGoals:{id}',
    rule: 'validEntity com reconciliação aditiva de aportes e histórico',
    test: 'src/lib/__tests__/entitySync.test.ts',
  },
  {
    field: 'strategicIntents',
    owner: 'couple',
    competency: 'monthly',
    source: 'Triagem de gastos estratégicos planejados',
    readPath: 'couples/{coupleId}/entities/strategicIntents:{id}',
    writePath: 'couples/{coupleId}/entities/strategicIntents:{id}',
    rule: 'validEntity (targetSource, estimatedAmount)',
    test: 'src/lib/__tests__/entitySync.test.ts',
  },
  {
    field: 'medicalShifts',
    owner: 'couple',
    competency: 'monthly',
    source: 'Gestão de plantões médicos de ambos os parceiros',
    readPath: 'couples/{coupleId}/entities/medicalShifts:{id}',
    writePath: 'couples/{coupleId}/entities/medicalShifts:{id}',
    rule: 'validEntity (dateWorked, grossAmount, sector, contractType)',
    test: 'src/utils/__tests__/shiftsEngine.test.ts',
  },
  {
    field: 'shiftIncomeAllocations',
    owner: 'couple',
    competency: 'event',
    source: 'Reconciliação de crédito real de plantão em centavos inteiros',
    readPath: 'couples/{coupleId}/entities/shiftIncomeAllocations:{id}',
    writePath: 'couples/{coupleId}/entities/shiftIncomeAllocations:{id}',
    rule: 'validEntity com ledger contra sobre-alocação concorrente',
    test: 'src/utils/__tests__/shiftReconciliation.test.ts',
  },
  {
    field: 'monthlyBudgetPlans',
    owner: 'couple',
    competency: 'monthly',
    source: 'Contrato do plano orçamentário mensal aprovado pelo casal',
    readPath: 'couples/{coupleId}/entities/monthlyBudgetPlans:{competence}',
    writePath: 'couples/{coupleId}/entities/monthlyBudgetPlans:{competence}',
    rule: 'validEntity (id no formato YYYY-MM, plannedNetIncome >= 0, categoryPercentages)',
    test: 'src/lib/__tests__/entitySync.test.ts',
  },
  {
    field: 'financialOperations',
    owner: 'couple',
    competency: 'event',
    source: 'Comandos financeiros atômicos com centavos autoritativos, idempotência e estorno',
    readPath: 'couples/{coupleId}/entities/financialOperations:{operationId}',
    writePath: 'couples/{coupleId}/entities/financialOperations:{operationId}',
    rule: 'validEntity (amountCents int > 0, escopo validado, revisão e transação atômica)',
    test: 'src/utils/__tests__/monetaryIntegrity29A.test.ts',
  },

  // --- Finanças Compartilhadas do Casal: Cabeçalho Bounded ---
  {
    field: 'emergencyReserveMonthsTarget',
    owner: 'couple',
    competency: 'setting',
    source: 'Configurações do perfil do casal (meses de reserva: 3 a 12)',
    readPath: 'couples/{coupleId}',
    writePath: 'couples/{coupleId}',
    rule: 'validMetadata (is number && >= 1 && <= 120)',
    test: 'tests/firestore.rules.test.ts',
  },
  {
    field: 'expectedYieldAnnual',
    owner: 'couple',
    competency: 'setting',
    source: 'Configuração de rentabilidade real acima da inflação',
    readPath: 'couples/{coupleId}',
    writePath: 'couples/{coupleId}',
    rule: 'validMetadata (is number && >= 0 && <= 100)',
    test: 'tests/firestore.rules.test.ts',
  },
  {
    field: 'protectionYieldAccumulated',
    owner: 'couple',
    competency: 'continuous',
    source: 'Rendimento acumulado do bloco de proteção',
    readPath: 'couples/{coupleId}',
    writePath: 'couples/{coupleId}',
    rule: 'validMetadata (safeAmount >= 0)',
    test: 'tests/firestore.rules.test.ts',
  },
  {
    field: 'freedomYieldAccumulated',
    owner: 'couple',
    competency: 'continuous',
    source: 'Rendimento acumulado da carteira de liberdade financeira',
    readPath: 'couples/{coupleId}',
    writePath: 'couples/{coupleId}',
    rule: 'validMetadata (safeAmount >= 0)',
    test: 'tests/firestore.rules.test.ts',
  },
  {
    field: 'categoryLocks',
    owner: 'couple',
    competency: 'setting',
    source: 'Travas ativas de categoria do mês corrente',
    readPath: 'couples/{coupleId}',
    writePath: 'couples/{coupleId}',
    rule: 'validMetadata (data.categoryLocks is map)',
    test: 'tests/firestore.rules.test.ts',
  },

  // --- Dados Pessoais / Conta Individual ---
  {
    field: 'avatars',
    owner: 'personal',
    competency: 'setting',
    source: 'Editor de Avatar (salvo pelo próprio dono ou parceiro vinculado)',
    readPath: 'avatars/{uid}',
    writePath: 'avatars/{uid}',
    rule: 'validAvatar com revisão sequencial monotônica',
    test: 'src/avatars/avatarStore.test.ts',
  },
  {
    field: 'accountPreferences',
    owner: 'personal',
    competency: 'setting',
    source: 'Preferências visuais de tema/cores privadas da conta',
    readPath: 'accountPreferences/{uid}',
    writePath: 'accountPreferences/{uid}',
    rule: 'validPreferences exclusivo ao request.auth.uid',
    test: 'src/lib/accountPreferences.test.ts',
  },

  // --- Rascunhos / Simulações Locais ---
  {
    field: 'draftSimulations',
    owner: 'simulation_draft',
    competency: 'event',
    source: 'Calculadoras de liberdade / projeção em memória',
    readPath: 'Memória React / Estado transitório da tela',
    writePath: 'Não persiste em nuvem antes de confirmação expressa',
    rule: 'Isolamento estrito contra poluição de saldo real',
    test: 'src/lib/__tests__/cloudPersistenceMatrix.test.ts',
  },

  // --- Cache Local Resiliente ---
  {
    field: 'localStorageCache',
    owner: 'client_cache',
    competency: 'continuous',
    source: 'Snapshot offline do cliente sob STORAGE_KEY:{uid}',
    readPath: 'localStorage',
    writePath: 'localStorage',
    rule: 'Nunca reporta isCloudSynced = true a partir de leitura de cache',
    test: 'src/lib/__tests__/cloudPersistenceMatrix.test.ts',
  },
];
