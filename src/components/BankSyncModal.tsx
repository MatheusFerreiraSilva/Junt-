import React, { useState, useEffect } from 'react';
import {
  X,
  RefreshCw,
  CheckCircle2,
  Building,
  CreditCard,
  ShieldCheck,
  Plus,
  Sparkles,
  ArrowRight,
  Shield,
  Eye,
  EyeOff,
  CheckSquare,
  Stethoscope,
  Briefcase,
  User,
} from 'lucide-react';
import { useFinance, CATEGORIES_BASE, ACCENT_THEMES } from '../context/FinanceContext';
import { formatCurrency } from '../utils/formatters';

interface BankSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface BankBrand {
  id: string;
  name: string;
  logo: string;
  colorHex: string;
  bgClass: string;
  borderClass: string;
  textClass: string;
  defaultCpf: string;
  defaultCnpj?: string;
}

const BANK_BRANDS: BankBrand[] = [
  { id: 'nubank', name: 'Nubank (PF / PJ)', logo: '🟣', colorHex: '#8A05BE', bgClass: 'bg-purple-500/10 dark:bg-purple-950/30', borderClass: 'border-purple-300 dark:border-purple-800/80', textClass: 'text-purple-700 dark:text-purple-300', defaultCpf: '123.456.789-00', defaultCnpj: '12.345.678/0001-90' },
  { id: 'itau', name: 'Itaú Personalité / Empresas', logo: '🟠', colorHex: '#EC7000', bgClass: 'bg-amber-500/10 dark:bg-amber-950/30', borderClass: 'border-amber-300 dark:border-amber-800/80', textClass: 'text-amber-700 dark:text-amber-300', defaultCpf: '987.654.321-99', defaultCnpj: '23.456.789/0001-01' },
  { id: 'btg', name: 'BTG Pactual (PF / PJ)', logo: '🔵', colorHex: '#002C5B', bgClass: 'bg-blue-500/10 dark:bg-blue-950/30', borderClass: 'border-blue-300 dark:border-blue-800/80', textClass: 'text-blue-700 dark:text-blue-300', defaultCpf: '123.456.789-00', defaultCnpj: '34.567.890/0001-12' },
  { id: 'unicred', name: 'Unicred / Coop. Médica', logo: '🩺', colorHex: '#059669', bgClass: 'bg-emerald-500/10 dark:bg-emerald-950/30', borderClass: 'border-emerald-300 dark:border-emerald-800/80', textClass: 'text-emerald-700 dark:text-emerald-300', defaultCpf: '123.456.789-00', defaultCnpj: '45.678.901/0001-23' },
  { id: 'bradesco', name: 'Bradesco Prime / Saúde', logo: '🔴', colorHex: '#CC092F', bgClass: 'bg-rose-500/10 dark:bg-rose-950/30', borderClass: 'border-rose-300 dark:border-rose-800/80', textClass: 'text-rose-700 dark:text-rose-300', defaultCpf: '987.654.321-99', defaultCnpj: '56.789.012/0001-34' },
  { id: 'santander', name: 'Santander Select / PJ', logo: '🟥', colorHex: '#EC0000', bgClass: 'bg-red-500/10 dark:bg-red-950/30', borderClass: 'border-red-300 dark:border-red-800/80', textClass: 'text-red-700 dark:text-red-300', defaultCpf: '123.456.789-00', defaultCnpj: '67.890.123/0001-45' },
  { id: 'inter', name: 'Banco Inter / PJ Médico', logo: '🍊', colorHex: '#FF7A00', bgClass: 'bg-orange-500/10 dark:bg-orange-950/30', borderClass: 'border-orange-300 dark:border-orange-800/80', textClass: 'text-orange-700 dark:text-orange-300', defaultCpf: '987.654.321-99', defaultCnpj: '78.901.234/0001-56' },
  { id: 'xp', name: 'XP Investimentos', logo: '🖤', colorHex: '#000000', bgClass: 'bg-slate-500/10 dark:bg-slate-900/30', borderClass: 'border-slate-300 dark:border-slate-800', textClass: 'text-slate-700 dark:text-slate-300', defaultCpf: '123.456.789-00' },
];

export const BankSyncModal: React.FC<BankSyncModalProps> = ({ isOpen, onClose }) => {
  const {
    state,
    isSyncingBanks,
    triggerBankSync,
    addNotification,
    pluggyAccounts,
    addPluggyAccount,
    triggerCelebration,
    simulateNewDepositConfirmation,
  } = useFinance();

  const [syncStatusMsg, setSyncStatusMsg] = useState<string | null>(null);
  const [isAddingBank, setIsAddingBank] = useState(false);
  
  // Widget Flow Steps
  const [pluggyStep, setPluggyStep] = useState<1 | 2 | 3 | 4>(1);
  const [selectedBank, setSelectedBank] = useState<BankBrand | null>(null);
  
  // Persona PF vs PJ Médica (CRM)
  const [accountPersona, setAccountPersona] = useState<'pf' | 'pj'>('pf');
  const [pluggyCpf, setPluggyCpf] = useState('');
  const [pluggyCnpj, setPluggyCnpj] = useState('');
  const [pluggyCrm, setPluggyCrm] = useState('123456/SP');
  const [pluggyCompanyName, setPluggyCompanyName] = useState('Serviços Médicos LTDA');
  const [pluggyPassword, setPluggyPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [pluggyAgencia, setPluggyAgencia] = useState('');
  const [pluggyAccountNum, setPluggyAccountNum] = useState('');
  const [consentCheck, setConsentCheck] = useState(true);
  const [syncStatus, setSyncStatus] = useState('');
  const [syncProgress, setSyncProgress] = useState(0);

  // Discovered Accounts State
  const [discoveredAccounts, setDiscoveredAccounts] = useState<{
    id: string;
    name: string;
    type: 'corrente' | 'cartao' | 'investimento';
    balance: number;
    owner: 'partner1' | 'partner2' | 'both';
    accountType: 'individual' | 'conjunta';
    persona: 'pf' | 'pj';
    crm?: string;
  }[]>([]);

  const handleSyncNow = async () => {
    setSyncStatusMsg('Conectando via Open Finance seguro (Meu Pluggy)...');
    await triggerBankSync();
    setSyncStatusMsg(`Sincronização Meu Pluggy concluída! Todas as contas PF e PJ foram consolidadas.`);
    setTimeout(() => setSyncStatusMsg(null), 3500);
  };

  const handleSelectBank = (bank: BankBrand) => {
    setSelectedBank(bank);
    setPluggyCpf(bank.defaultCpf);
    setPluggyCnpj(bank.defaultCnpj || '12.345.678/0001-90');
    setPluggyAgencia('3412');
    setPluggyAccountNum('98234-1');
    setPluggyStep(2);
  };

  const handleAuthorizePluggy = () => {
    const hasIdentifier = accountPersona === 'pf' ? pluggyCpf.trim() : pluggyCnpj.trim();
    if (!hasIdentifier || !pluggyPassword.trim()) return;
    setPluggyStep(3);
    setSyncProgress(0);
  };

  // Simulated syncing progress
  useEffect(() => {
    if (pluggyStep !== 3) return;

    const statuses = [
      'Estabelecendo conexão segura com Meu Pluggy Open Finance...',
      'Processando consentimento regulatório do Banco Central...',
      accountPersona === 'pj' ? 'Mapeando CNPJ e extratos de honorários médicos...' : 'Mapeando saldos, cartões e faturas PF...',
      'Concluído!',
    ];

    const interval = setInterval(() => {
      setSyncProgress(prev => {
        const next = prev + 25;
        if (next >= 100) {
          clearInterval(interval);
          const bName = selectedBank?.name.split('(')[0].trim() || 'Banco';
          const holds = pluggyCpf === '123.456.789-00' ? 'partner1' : 'partner2';
          
          if (accountPersona === 'pj') {
            setDiscoveredAccounts([
              {
                id: `disc-sync-pj-1`,
                name: `${bName} PJ Médica (${pluggyCompanyName})`,
                type: 'corrente',
                balance: 18450,
                owner: holds as 'partner1' | 'partner2',
                accountType: 'individual',
                persona: 'pj',
                crm: pluggyCrm,
              }
            ]);
          } else {
            setDiscoveredAccounts([
              {
                id: `disc-sync-pf-1`,
                name: `${bName} Conta Corrente`,
                type: 'corrente',
                balance: selectedBank?.id === 'itau' ? 9500 : 4200,
                owner: holds as 'partner1' | 'partner2',
                accountType: 'individual',
                persona: 'pf',
              }
            ]);
          }
          setPluggyStep(4);
          return 100;
        }
        const index = Math.min(statuses.length - 1, Math.floor((next / 100) * statuses.length));
        setSyncStatus(statuses[index]);
        return next;
      });
    }, 380);

    return () => clearInterval(interval);
  }, [pluggyStep, selectedBank, pluggyCpf, accountPersona, pluggyCompanyName, pluggyCrm]);

  const handleConfirmDiscoveredAccounts = () => {
    discoveredAccounts.forEach(disc => {
      addPluggyAccount({
        itemId: `item-sync-${Date.now()}`,
        accountId: `acc-${Math.floor(Math.random() * 9000) + 1000}`,
        name: disc.name,
        bankName: selectedBank?.name.split('(')[0].trim() || 'Banco',
        accountType: disc.type,
        type: disc.accountType,
        owner: disc.owner,
        taxNumber: disc.persona === 'pj' ? pluggyCnpj : pluggyCpf,
        balance: disc.balance,
        lastSynced: 'Agora mesmo',
        consentExpiresAt: '2027-10-01',
        status: 'connected',
        appOwner: disc.owner === 'partner2' ? 'partner2' : 'partner1',
      });
    });

    addNotification({
      title: 'Nova Conta Conectada 🏦',
      message: `${selectedBank?.name} (${accountPersona === 'pj' ? 'PJ Médica CRM' : 'PF'}) conectado com sucesso via Meu Pluggy. Transações sincronizadas automaticamente.`,
      type: 'info',
    });

    setIsAddingBank(false);
    setPluggyStep(1);
    setSelectedBank(null);
    setPluggyPassword('');
    triggerCelebration();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
      {/* Click outside backdrop */}
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative z-10 w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92vh] text-slate-800 dark:text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 pt-4 sm:pt-5 pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-9 h-9 rounded-2xl bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 flex items-center justify-center text-base font-bold shrink-0 shadow-2xs">
              🏦
            </span>
            <div className="min-w-0">
              <h3 className="font-extrabold text-slate-900 dark:text-white text-sm sm:text-base truncate">
                {isAddingBank ? 'Conectar via Open Finance' : 'Conexão Bancária Meu Pluggy'}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                {isAddingBank ? `Passo ${pluggyStep} de 4 · Integração PF / PJ / CRM` : 'Sincronização automática para médicos e casais'}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              if (isAddingBank) {
                setIsAddingBank(false);
                setPluggyStep(1);
                setSelectedBank(null);
              } else {
                onClose();
              }
            }}
            className="w-10 h-10 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors shrink-0 cursor-pointer"
            aria-label="Fechar"
          >
            <X className="w-5 h-5 stroke-[2.5]" />
          </button>
        </div>

        {/* Sync panel or simulated addition flow */}
        {!isAddingBank ? (
          <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-5">
            {/* Security Banner */}
            <div className="p-3.5 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/60 flex items-start gap-3 text-xs text-emerald-900 dark:text-emerald-300">
              <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">Open Finance Banco Central · Criptografia Ponta a Ponta</span>
                Leitura de extratos PF e PJ Médica regulamentada pelo Banco Central. O aplicativo possui acesso somente leitura e não movimenta recursos financeiros.
              </div>
            </div>

            {/* Connected Accounts List */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Contas Conectadas ({pluggyAccounts.length})
                </span>
                <button
                  type="button"
                  onClick={() => setIsAddingBank(true)}
                  className="text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Conectar Conta (PF / PJ)
                </button>
              </div>

              <div className="space-y-2.5 max-h-[30vh] overflow-y-auto pr-1">
                {pluggyAccounts.length === 0 ? (
                  <div className="p-4 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-center text-xs text-slate-500">
                    Nenhuma conta conectada ainda. Clique em "Conectar Conta" para sincronizar via Open Finance.
                  </div>
                ) : (
                  pluggyAccounts.map(acc => (
                    <div
                      key={acc.id}
                      className="p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="text-xl shrink-0">
                          {acc.name.includes('PJ') ? '🏢' : '🟣'}
                        </span>
                        <div className="min-w-0">
                          <div className="font-bold text-slate-900 dark:text-white truncate flex items-center gap-1.5">
                            <span>{acc.name}</span>
                            {acc.name.includes('PJ') && (
                              <span className="px-1.5 py-0.2 rounded-md bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 text-[9px] font-black">
                                PJ Médica
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                            {acc.bankName} · {acc.taxNumber} · {acc.owner === 'both' ? 'Casal' : acc.owner === 'partner1' ? state.profile.partner1Name : state.profile.partner2Name}
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="font-extrabold text-slate-900 dark:text-white block">
                          R$ {formatCurrency(acc.balance)}
                        </span>
                        <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-bold block">
                          {acc.lastSynced}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Sync status alert */}
            {syncStatusMsg && (
              <div className="p-3 rounded-2xl bg-emerald-100 dark:bg-emerald-950/50 text-emerald-900 dark:text-emerald-300 text-xs font-bold flex items-center gap-2 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                {syncStatusMsg}
              </div>
            )}

            {/* Sync Trigger Action */}
            <div className="pt-2 space-y-2.5">
              <button
                type="button"
                onClick={handleSyncNow}
                disabled={isSyncingBanks}
                className="w-full py-3.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs sm:text-sm shadow-md shadow-emerald-600/20 disabled:opacity-50 transition-all flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
              >
                <RefreshCw className={`w-4 h-4 ${isSyncingBanks ? 'animate-spin' : ''}`} />
                {isSyncingBanks ? 'Sincronizando extratos...' : 'Sincronizar Extratos Meu Pluggy Agora'}
              </button>

              {/* Simulation button to test active confirmation */}
              <button
                type="button"
                onClick={() => {
                  simulateNewDepositConfirmation(12500, 'Unimed Cooperativa Médica (Produção PJ)');
                  onClose();
                }}
                className="w-full py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>Simular Recebimento Hospitalar PJ (Testar Confirmação)</span>
              </button>
            </div>
          </div>
        ) : (
          /* IS ADDING BANK FLOW WIDGET */
          <div className="flex-1 overflow-y-auto">
            {/* Step 1: Select Bank */}
            {pluggyStep === 1 && (
              <div className="p-5 sm:p-6 space-y-4">
                <h4 className="font-extrabold text-xs text-slate-500 uppercase tracking-wider">
                  Selecione seu Banco ou Cooperativa:
                </h4>
                <div className="grid grid-cols-2 gap-2.5">
                  {BANK_BRANDS.map(bank => (
                    <button
                      key={bank.id}
                      onClick={() => handleSelectBank(bank)}
                      className={`p-3.5 rounded-2xl border text-left flex flex-col justify-between h-20 transition-all cursor-pointer hover:scale-[1.02] ${bank.bgClass} ${bank.borderClass}`}
                    >
                      <span className="text-xl">{bank.logo}</span>
                      <span className={`font-bold text-xs block truncate ${bank.textClass}`}>{bank.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 2: Persona (PF vs PJ Médica) and Credentials */}
            {pluggyStep === 2 && selectedBank && (
              <div className="p-5 sm:p-6 space-y-4 text-xs">
                <div className="flex items-center gap-3 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20">
                  <span className="text-2xl">{selectedBank.logo}</span>
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-white">{selectedBank.name}</h4>
                    <p className="text-[10px] text-slate-400">Autenticação regulada Open Finance via Meu Pluggy</p>
                  </div>
                </div>

                {/* Persona Switcher: PF vs PJ Médica (CRM) */}
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-1">
                    Tipo de Conexão:
                  </label>
                  <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setAccountPersona('pf')}
                      className={`py-1.5 px-3 rounded-lg font-extrabold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        accountPersona === 'pf'
                          ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                          : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                    >
                      <User className="w-3.5 h-3.5" />
                      <span>Pessoa Física (PF)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setAccountPersona('pj')}
                      className={`py-1.5 px-3 rounded-lg font-extrabold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        accountPersona === 'pj'
                          ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                          : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                    >
                      <Stethoscope className="w-3.5 h-3.5" />
                      <span>PJ Médica (CRM)</span>
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  {accountPersona === 'pj' ? (
                    <>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 block mb-0.5">CNPJ da Empresa Médica</label>
                          <input
                            type="text"
                            value={pluggyCnpj}
                            onChange={e => setPluggyCnpj(e.target.value)}
                            placeholder="12.345.678/0001-90"
                            className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono font-bold"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 block mb-0.5">CRM do Responsável</label>
                          <input
                            type="text"
                            value={pluggyCrm}
                            onChange={e => setPluggyCrm(e.target.value)}
                            placeholder="123456/SP"
                            className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono font-bold text-indigo-600 dark:text-indigo-400"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 block mb-0.5">Razão Social / Nome da Clínica</label>
                        <input
                          type="text"
                          value={pluggyCompanyName}
                          onChange={e => setPluggyCompanyName(e.target.value)}
                          placeholder="Serviços Médicos LTDA"
                          className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold"
                        />
                      </div>
                    </>
                  ) : (
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 block mb-0.5">CPF do Titular</label>
                      <input
                        type="text"
                        value={pluggyCpf}
                        onChange={e => setPluggyCpf(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold font-mono"
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 block mb-0.5">Agência</label>
                      <input
                        type="text"
                        value={pluggyAgencia}
                        onChange={e => setPluggyAgencia(e.target.value)}
                        placeholder="3412"
                        className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 block mb-0.5">Conta</label>
                      <input
                        type="text"
                        value={pluggyAccountNum}
                        onChange={e => setPluggyAccountNum(e.target.value)}
                        placeholder="98234-1"
                        className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-0.5">Senha de Acesso ao Internet Banking</label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={pluggyPassword}
                        onChange={e => setPluggyPassword(e.target.value)}
                        placeholder="Senha de acesso"
                        className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                      >
                        {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  <label className="flex items-start gap-2 text-[10px] text-slate-500 cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={consentCheck}
                      onChange={e => setConsentCheck(e.target.checked)}
                      className="rounded text-emerald-600 mt-0.5"
                    />
                    <span>Autorizo compartilhar extratos e saldos regulados pelo Banco Central para fins de planejamento financeiro do casal por 12 meses.</span>
                  </label>
                </div>

                <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <button
                    onClick={() => {
                      setPluggyStep(1);
                      setSelectedBank(null);
                    }}
                    className="px-3.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold"
                  >
                    Voltar
                  </button>
                  <button
                    onClick={handleAuthorizePluggy}
                    disabled={(!pluggyCpf.trim() && !pluggyCnpj.trim()) || !pluggyPassword.trim() || !consentCheck}
                    className="btn-primary-accent px-4 py-1.5 rounded-xl text-white font-extrabold shadow-sm disabled:opacity-50 transition-all cursor-pointer"
                  >
                    Autorizar Conexão
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Loading Sync Progress */}
            {pluggyStep === 3 && (
              <div className="p-8 text-center space-y-4">
                <RefreshCw className="w-12 h-12 text-emerald-600 dark:text-emerald-400 animate-spin mx-auto stroke-[2.5]" />
                <h4 className="font-extrabold text-xs text-slate-800 dark:text-white">{syncStatus}</h4>
                <div className="w-full max-w-xs mx-auto bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-emerald-500 h-full transition-all duration-300" style={{ width: `${syncProgress}%` }} />
                </div>
              </div>
            )}

            {/* Step 4: Discovered Account & Owner Setup */}
            {pluggyStep === 4 && (
              <div className="p-5 sm:p-6 space-y-4 text-xs">
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-2xl text-[11px] font-bold text-emerald-800 dark:text-emerald-300">
                  ✓ Sucesso! Identificamos a seguinte conta via Meu Pluggy:
                </div>

                {discoveredAccounts.map(disc => (
                  <div key={disc.id} className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 space-y-2">
                    <div className="flex justify-between font-bold text-slate-900 dark:text-white gap-3">
                      <span className="truncate min-w-0">
                        {disc.persona === 'pj' ? '🏢' : '🏦'} {disc.name}
                      </span>
                      <span className="shrink-0 text-emerald-600 dark:text-emerald-400 font-black">
                        R$ {formatCurrency(disc.balance)}
                      </span>
                    </div>

                    {disc.crm && (
                      <div className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold">
                        Vínculo Médico Ativo: CRM {disc.crm}
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2.5 pt-1 text-[11px]">
                      <div>
                        <label className="text-[10px] text-slate-400 block mb-0.5">Dono / Titular</label>
                        <select
                          value={disc.owner}
                          onChange={e => {
                            const val = e.target.value as any;
                            setDiscoveredAccounts(prev => prev.map(a => a.id === disc.id ? { ...a, owner: val, accountType: val === 'both' ? 'conjunta' : 'individual' } : a));
                          }}
                          className="w-full px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-[11px]"
                        >
                          <option value="partner1">Você ({state.profile.partner1Name})</option>
                          <option value="partner2">Ela/Ele ({state.profile.partner2Name})</option>
                          <option value="both">Nós dois (Conjunta)</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[10px] text-slate-400 block mb-0.5">Tipo de Conta</label>
                        <select
                          value={disc.accountType}
                          onChange={e => {
                            const val = e.target.value as any;
                            setDiscoveredAccounts(prev => prev.map(a => a.id === disc.id ? { ...a, accountType: val } : a));
                          }}
                          className="w-full px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-[11px]"
                        >
                          <option value="individual">Individual</option>
                          <option value="conjunta">Conjunta (Mapeamento)</option>
                        </select>
                      </div>
                    </div>
                  </div>
                ))}

                <button
                  onClick={handleConfirmDiscoveredAccounts}
                  className="btn-primary-accent w-full py-2.5 rounded-xl text-white font-extrabold text-xs shadow-md transition-all active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <CheckSquare className="w-4 h-4" />
                  <span>Concluir Conexão Open Finance</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
