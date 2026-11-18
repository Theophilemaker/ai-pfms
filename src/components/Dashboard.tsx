import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeftRight,
  ArrowRight,
  BarChart3,
  Bell,
  Check,
  Cpu,
  CreditCard,
  Database,
  Download,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  Globe,
  Info,
  Landmark,
  Layers,
  LayoutDashboard,
  LogOut,
  Menu,
  Monitor,
  Moon,
  PiggyBank,
  Plus,
  Receipt,
  Search,
  Settings,
  Smartphone,
  Sparkles,
  Sun,
  Target,
  Trash2,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
  WifiOff,
  X,
  Zap,
} from 'lucide-react';
import { translations, type Locale, type ThemeMode } from '../i18n/translations';
import { AIInsights, generateMockLLMFinancialAnalysis } from './AIInsights';
import { BudgetGoals, type SavingsGoal } from './BudgetGoals';
import { BudgetHistory } from './BudgetHistory';
import {
  BudgetThresholdControl,
  BudgetThresholdNotifier,
} from './BudgetThresholdNotifier';
import { DashboardCharts } from './DashboardCharts';
import { ExportModal } from './ExportModal';
import {
  BillsSection,
  evaluateFinancialAlerts,
  NotificationBellDropdown,
  NotificationCenter,
  type FinancialAlert,
  type ScheduledBill,
} from './NotificationCenter';
import {
  OnboardingWizard,
  type BudgetAllocation,
  type LinkedAccountConfig,
  type OnboardingResult,
} from './OnboardingWizard';
import { RecentActivity, type AccountUpdateEvent } from './RecentActivity';
import { TransactionHistory } from './TransactionHistory';
import {
  exportFinancialData,
  type ExportDataset,
  type ExportFormat,
} from '../utils/exportFinancialData';
import {
  buildNonSensitiveSummary,
  clearOfflineTransactionSummary,
  loadOfflineTransactionSummary,
  saveOfflineTransactionSummary,
  type NonSensitiveTransactionSummary,
} from '../utils/offlineSummaryCache';
import {
  TransactionInput,
  type RecordedTransaction,
  type TransactionType,
} from './TransactionInput';

export interface AuthenticatedUser {
  name: string;
  email: string;
  isNewUser?: boolean;
}

type DashboardSection =
  | 'overview'
  | 'accounts'
  | 'transactions'
  | 'income'
  | 'expenses'
  | 'transfers'
  | 'budgets'
  | 'savings'
  | 'debts'
  | 'bills'
  | 'reports'
  | 'insights'
  | 'family'
  | 'documents'
  | 'notifications'
  | 'settings';

interface DashboardProps {
  user: AuthenticatedUser;
  locale: Locale;
  onToggleLocale: () => void;
  theme: ThemeMode;
  onCycleTheme: () => void;
  isInstalled: boolean;
  isOnline?: boolean;
  onInstallClick: () => void;
  onLogout: () => void;
}

export function Dashboard({
  user,
  locale,
  onToggleLocale,
  theme,
  onCycleTheme,
  isInstalled,
  isOnline = true,
  onInstallClick,
  onLogout,
}: DashboardProps) {
  const t = translations[locale];
  const d = t.dashboard;

  const [activeSection, setActiveSection] = useState<DashboardSection>('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [period, setPeriod] = useState<'month' | 'days30' | 'ytd'>('month');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchDropdownOpen, setSearchDropdownOpen] = useState(false);
  const [transactionSearchFilter, setTransactionSearchFilter] = useState('');
  const searchContainerRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<RecordedTransaction[]>([]);
  const [transactionModalOpen, setTransactionModalOpen] = useState(false);
  const [transactionInitialType, setTransactionInitialType] =
    useState<TransactionType>('expense');
  const [onboardingOpen, setOnboardingOpen] = useState<boolean>(() => Boolean(user.isNewUser));
  const [onboardingCompleted, setOnboardingCompleted] = useState(false);
  const [primaryCurrency, setPrimaryCurrency] = useState<'RWF' | 'USD'>('RWF');
  const [monthlyIncomeTarget, setMonthlyIncomeTarget] = useState<number>(0);
  const [configuredAccounts, setConfiguredAccounts] = useState<LinkedAccountConfig[] | null>(null);
  const [budgetAllocations, setBudgetAllocations] = useState<BudgetAllocation[]>([]);
  const [accountUpdates, setAccountUpdates] = useState<AccountUpdateEvent[]>([]);
  const [savingsGoals, setSavingsGoals] = useState<SavingsGoal[]>([]);
  const [scheduledBills, setScheduledBills] = useState<ScheduledBill[]>([]);
  const [readAlertIds, setReadAlertIds] = useState<Set<string>>(() => new Set());
  const [dismissedAlertIds, setDismissedAlertIds] = useState<Set<string>>(() => new Set());
  const [budgetThresholdPct, setBudgetThresholdPct] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = Number(window.localStorage.getItem('ai_pfms_budget_alert_pct'));
      if (Number.isFinite(saved) && saved >= 10 && saved <= 100) return Math.round(saved);
    }
    return 80;
  });
  const [liveToastAlert, setLiveToastAlert] = useState<FinancialAlert | null>(null);
  const seenAlertIdsRef = useRef<Set<string>>(new Set());
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportDataset, setExportDataset] = useState<ExportDataset>('financial_report');
  const [cachedOfflineSummary, setCachedOfflineSummary] =
    useState<NonSensitiveTransactionSummary | null>(null);

  useEffect(() => {
    window.localStorage.setItem('ai_pfms_budget_alert_pct', String(budgetThresholdPct));
  }, [budgetThresholdPct]);

  useEffect(() => {
    let cancelled = false;
    loadOfflineTransactionSummary().then((summary) => {
      if (!cancelled && summary) {
        setCachedOfflineSummary(summary);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const ThemeIcon = theme === 'dark' ? Moon : theme === 'light' ? Sun : Monitor;

  const handleAddBill = (bill: ScheduledBill) => {
    setScheduledBills((prev) => [bill, ...prev]);
  };

  const handleToggleBillPaid = (billId: string) => {
    setScheduledBills((prev) =>
      prev.map((bill) => (bill.id === billId ? { ...bill, paid: !bill.paid } : bill))
    );
  };

  const handleDeleteBill = (billId: string) => {
    setScheduledBills((prev) => prev.filter((bill) => bill.id !== billId));
  };

  const handleMarkAlertRead = (id: string) => {
    setReadAlertIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  const handleDismissAlert = (id: string) => {
    setDismissedAlertIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  const openExportModal = (dataset: ExportDataset = 'financial_report') => {
    setExportDataset(dataset);
    setExportModalOpen(true);
  };

  const handleQuickExport = (dataset: ExportDataset, format: ExportFormat) => {
    const filename = exportFinancialData({
      dataset,
      format,
      userName: user.name,
      userEmail: user.email,
      primaryCurrency,
      monthlyIncomeTarget,
      accounts: activeAccounts,
      transactions,
      budgets: budgetAllocations,
      savingsGoals,
    });
    setActionNotice(`${d.exportFeature.downloadedNotice} ${filename}`);
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
        setSearchDropdownOpen(true);
      }
      if (e.key === 'Escape' && searchDropdownOpen) {
        setSearchDropdownOpen(false);
        searchInputRef.current?.blur();
      }
    };
    const onMouseDown = (e: MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(e.target as Node)
      ) {
        setSearchDropdownOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onMouseDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onMouseDown);
    };
  }, [searchDropdownOpen]);

  const openTransactionModal = (initialType: TransactionType = 'expense') => {
    setTransactionInitialType(initialType);
    setTransactionModalOpen(true);
  };

  const handleSaveTransaction = (txn: RecordedTransaction) => {
    setTransactions((prev) => {
      if (prev.some((existing) => existing.idempotencyKey === txn.idempotencyKey)) {
        return prev;
      }
      return [txn, ...prev];
    });
    setActionNotice(d.transactionRecorded);
  };

  const handleAddGoal = (goal: SavingsGoal) => {
    setSavingsGoals((prev) => [goal, ...prev]);
  };

  const handleContributeGoal = (goalId: string, amount: number) => {
    setSavingsGoals((prev) =>
      prev.map((goal) =>
        goal.id === goalId
          ? {
              ...goal,
              currentAmount: Math.round((goal.currentAmount + amount) * 100) / 100,
            }
          : goal
      )
    );
  };

  const handleDeleteGoal = (goalId: string) => {
    setSavingsGoals((prev) => prev.filter((goal) => goal.id !== goalId));
  };

  const handleOnboardingComplete = (result: OnboardingResult) => {
    const now = new Date();
    const newEvents: AccountUpdateEvent[] = [];

    result.accounts
      .filter((acc) => acc.enabled)
      .forEach((acc, idx) => {
        const ts = new Date(now.getTime() + idx * 1000).toISOString();
        newEvents.push({
          id: `acc-${acc.id}-${now.getTime()}-${idx}`,
          timestamp: ts,
          kind: acc.openingBalance > 0 ? 'balance_initialized' : 'account_linked',
          title: acc.name,
          detail: acc.providerLabel
            ? `${acc.providerLabel} · ${acc.type} (${acc.currency})`
            : `${acc.type} (${acc.currency})`,
          accountName: acc.name,
          amount: acc.openingBalance > 0 ? acc.openingBalance : undefined,
          currency: acc.openingBalance > 0 ? acc.currency : undefined,
        });
      });

    if (result.budgets.length > 0) {
      const totalAllocated = result.budgets.reduce((sum, b) => sum + b.monthlyLimit, 0);
      newEvents.push({
        id: `budget-${now.getTime()}`,
        timestamp: new Date(now.getTime() + 10000).toISOString(),
        kind: 'budget_configured',
        title: d.budgetsView.title,
        detail: `${result.budgets.length} ${d.recentActivity.filterAccounts === 'Account Updates' ? 'categories' : 'ibyiciro'}`,
        amount: totalAllocated,
        currency: result.primaryCurrency,
      });
    }

    setPrimaryCurrency(result.primaryCurrency);
    setMonthlyIncomeTarget(result.monthlyIncomeTarget);
    setConfiguredAccounts(result.accounts);
    setBudgetAllocations(result.budgets);
    setAccountUpdates((prev) => [...newEvents.reverse(), ...prev]);
    setOnboardingCompleted(true);
    setOnboardingOpen(false);
    setActionNotice(d.onboardingWizard.completedNotice);
  };

  const activeAccounts: LinkedAccountConfig[] = configuredAccounts
    ? configuredAccounts.filter((acc) => acc.enabled)
    : d.accountTypes.map((acc) => ({
        id: acc.id,
        name: acc.name,
        type: acc.type,
        currency: acc.currency,
        status: acc.status,
        providerLabel: '',
        openingBalance: 0,
        enabled: true,
      }));

  const rwfOpeningBalance = activeAccounts
    .filter((acc) => acc.currency === 'RWF')
    .reduce((sum, acc) => sum + acc.openingBalance, 0);

  const rwfIncome = transactions
    .filter((tx) => tx.currency === 'RWF' && tx.type === 'income')
    .reduce((sum, tx) => sum + tx.amount, 0);
  const rwfExpenses = transactions
    .filter((tx) => tx.currency === 'RWF' && tx.type === 'expense')
    .reduce((sum, tx) => sum + tx.amount, 0);
  const rwfNetBalance = rwfOpeningBalance + rwfIncome - rwfExpenses;

  useEffect(() => {
    if (transactions.length === 0) return;
    const summary = buildNonSensitiveSummary({
      transactions,
      primaryCurrency,
      openingBalance: rwfOpeningBalance,
    });
    setCachedOfflineSummary(summary);
    void saveOfflineTransactionSummary(summary);
  }, [transactions, primaryCurrency, rwfOpeningBalance]);

  const handleClearOfflineCache = () => {
    void clearOfflineTransactionSummary();
    setCachedOfflineSummary(null);
    setActionNotice(d.offlineCache.clearedNotice);
  };

  const handleSecureLogout = () => {
    void clearOfflineTransactionSummary();
    setCachedOfflineSummary(null);
    onLogout();
  };

  const isShowingOfflineFallback =
    !isOnline && transactions.length === 0 && cachedOfflineSummary !== null;
  const displayCurrency = isShowingOfflineFallback
    ? cachedOfflineSummary.primaryCurrency
    : 'RWF';
  const displayNetBalance = isShowingOfflineFallback
    ? cachedOfflineSummary.netBalance
    : rwfNetBalance;
  const displayIncome = isShowingOfflineFallback
    ? cachedOfflineSummary.totalIncome
    : rwfIncome;
  const displayExpenses = isShowingOfflineFallback
    ? cachedOfflineSummary.totalExpenses
    : rwfExpenses;

  const formatAmount = (amount: number, currency: string) =>
    currency === 'USD'
      ? `${new Intl.NumberFormat('en-US', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(amount)} USD`
      : `${new Intl.NumberFormat('en-US').format(amount)} RWF`;

  const accountBalances = transactions.reduce<Record<string, number>>((acc, tx) => {
    const delta = tx.type === 'income' ? tx.amount : -tx.amount;
    acc[tx.accountId] = (acc[tx.accountId] ?? 0) + delta;
    return acc;
  }, {});

  const expensesByCategory = transactions
    .filter((tx) => tx.type === 'expense')
    .reduce<Record<string, number>>((acc, tx) => {
      acc[tx.category] = (acc[tx.category] ?? 0) + tx.amount;
      return acc;
    }, {});

  const activeAlerts = useMemo(
    () =>
      evaluateFinancialAlerts({
        bills: scheduledBills,
        budgets: budgetAllocations,
        transactions,
        primaryCurrency,
        monthlyIncomeTarget,
        budgetThresholdPct,
        locale,
        formatAmount,
      }).filter((alert) => !dismissedAlertIds.has(alert.id)),
    [
      scheduledBills,
      budgetAllocations,
      transactions,
      primaryCurrency,
      monthlyIncomeTarget,
      budgetThresholdPct,
      locale,
      dismissedAlertIds,
    ]
  );

  const unreadAlertsCount = activeAlerts.filter((a) => !readAlertIds.has(a.id)).length;
  const hasOverBudget = budgetAllocations.some(
    (b) => (expensesByCategory[b.category] ?? 0) > b.monthlyLimit
  );
  const unpaidBillsCount = scheduledBills.filter((bill) => !bill.paid).length;

  const handleMarkAllAlertsRead = () => {
    setReadAlertIds((prev) => {
      const next = new Set(prev);
      activeAlerts.forEach((a) => next.add(a.id));
      return next;
    });
  };

  useEffect(() => {
    const newAlerts = activeAlerts.filter((a) => !seenAlertIdsRef.current.has(a.id));
    if (newAlerts.length > 0) {
      activeAlerts.forEach((a) => seenAlertIdsRef.current.add(a.id));
      const nonBudgetAlert = newAlerts.find((a) => a.kind !== 'budget_threshold');
      if (nonBudgetAlert) {
        setLiveToastAlert(nonBudgetAlert);
      }
    }
  }, [activeAlerts]);

  useEffect(() => {
    if (!liveToastAlert) return;
    const timer = window.setTimeout(() => setLiveToastAlert(null), 6500);
    return () => window.clearTimeout(timer);
  }, [liveToastAlert]);

  const navItems: { id: DashboardSection; label: string; icon: typeof LayoutDashboard }[] = [
    { id: 'overview', label: d.nav.overview, icon: LayoutDashboard },
    { id: 'accounts', label: d.nav.accounts, icon: Landmark },
    { id: 'transactions', label: d.nav.transactions, icon: Layers },
    { id: 'income', label: d.nav.income, icon: TrendingUp },
    { id: 'expenses', label: d.nav.expenses, icon: TrendingDown },
    { id: 'transfers', label: d.nav.transfers, icon: ArrowLeftRight },
    { id: 'budgets', label: d.nav.budgets, icon: Target },
    { id: 'savings', label: d.nav.savings, icon: PiggyBank },
    { id: 'debts', label: d.nav.debts, icon: CreditCard },
    { id: 'bills', label: d.nav.bills, icon: Receipt },
    { id: 'reports', label: d.nav.reports, icon: BarChart3 },
    { id: 'insights', label: d.nav.insights, icon: Cpu },
    { id: 'family', label: d.nav.family, icon: Users },
    { id: 'documents', label: d.nav.documents, icon: FolderOpen },
    { id: 'notifications', label: d.nav.notifications, icon: Bell },
    { id: 'settings', label: d.nav.settings, icon: Settings },
  ];

  const accountIconMap: Record<string, typeof Wallet> = {
    cash: Wallet,
    bank: Landmark,
    momo: Smartphone,
    savings: PiggyBank,
    fx: Globe,
  };

  const trimmedSearch = searchQuery.trim();
  const normalizedSearch = trimmedSearch.toLowerCase();

  const globalMatchingAccounts = useMemo(() => {
    if (!normalizedSearch) return [];
    return activeAccounts.filter(
      (acc) =>
        acc.name.toLowerCase().includes(normalizedSearch) ||
        acc.type.toLowerCase().includes(normalizedSearch) ||
        acc.currency.toLowerCase().includes(normalizedSearch) ||
        acc.providerLabel.toLowerCase().includes(normalizedSearch) ||
        acc.status.toLowerCase().includes(normalizedSearch)
    );
  }, [activeAccounts, normalizedSearch]);

  const globalMatchingTransactions = useMemo(() => {
    if (!normalizedSearch) return [];
    return transactions.filter(
      (tx) =>
        tx.description.toLowerCase().includes(normalizedSearch) ||
        tx.category.toLowerCase().includes(normalizedSearch) ||
        tx.accountName.toLowerCase().includes(normalizedSearch) ||
        tx.referenceNo.toLowerCase().includes(normalizedSearch) ||
        tx.date.includes(normalizedSearch) ||
        String(tx.amount).includes(normalizedSearch) ||
        Boolean(tx.tags?.some((tag) => tag.toLowerCase().includes(normalizedSearch)))
    );
  }, [transactions, normalizedSearch]);

  const filteredAccounts =
    !normalizedSearch ||
    (globalMatchingAccounts.length === 0 && globalMatchingTransactions.length > 0 && activeSection === 'overview')
      ? activeAccounts
      : globalMatchingAccounts;

  const handleSelectSection = (id: DashboardSection) => {
    setActiveSection(id);
    setSidebarOpen(false);
    setActionNotice(null);
    setSearchDropdownOpen(false);
    if (id !== 'transactions' && id !== 'income' && id !== 'expenses') {
      setTransactionSearchFilter('');
    }
  };

  const activeNavLabel = navItems.find((item) => item.id === activeSection)?.label ?? d.nav.overview;

  return (
    <div className="flex min-h-screen bg-[#F8FAFC] text-[#0F172A] dark:bg-[#0F1724] dark:text-[#F8FAFC]">
      {/* Mobile Sidebar Backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-xs lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Authenticated Sidebar */}
      <aside
        aria-label="Application Sidebar"
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-slate-200 bg-white transition-transform duration-200 lg:static lg:w-72 lg:translate-x-0 dark:border-[#263449] dark:bg-[#0B1220] ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-20 items-center justify-between border-b border-slate-200 px-5 dark:border-[#263449]">
          <div className="flex items-center gap-3">
            <img
              src="/assets/icons/icon.svg"
              alt="AI-PFMS"
              className="h-9 w-9 rounded-xl"
              width={36}
              height={36}
            />
            <span className="font-display text-lg font-bold tracking-tight text-slate-900 dark:text-white">
              {t.brandName}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            aria-label={t.nav.closeMenu}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 lg:hidden dark:text-slate-400 dark:hover:bg-[#162235]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1.5 overflow-y-auto px-3.5 py-5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelectSection(item.id)}
                className={`flex w-full items-center justify-between gap-2 rounded-xl px-3.5 py-2.5 text-left text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-[#7C3AED] text-white'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-[#162235] dark:hover:text-white'
                }`}
              >
                <span className="flex min-w-0 items-center gap-3">
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </span>
                {item.id === 'notifications' && unreadAlertsCount > 0 && (
                  <span
                    className={`font-mono-num shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                      isActive
                        ? 'bg-white text-[#7C3AED]'
                        : 'bg-rose-600 text-white'
                    }`}
                  >
                    {unreadAlertsCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="border-t border-slate-200 p-3 dark:border-[#263449]">
          <button
            type="button"
            onClick={handleSecureLogout}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-rose-600 transition-colors hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/30"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            <span>{d.logout}</span>
          </button>
        </div>
      </aside>

      {/* Main Workspace Area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Expanded Sticky Navigation Bar & Quick Action Bar */}
        <div className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-md dark:border-[#263449] dark:bg-[#0B1220]/95">
          <header className="flex h-20 items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              aria-label={t.nav.openMenu}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 lg:hidden dark:border-[#263449] dark:text-slate-200 dark:hover:bg-[#162235]"
            >
              <Menu className="h-5 w-5" />
            </button>

            <div ref={searchContainerRef} className="relative w-full max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                ref={searchInputRef}
                type="search"
                value={searchQuery}
                onFocus={() => {
                  if (trimmedSearch.length > 0) setSearchDropdownOpen(true);
                }}
                onChange={(e) => {
                  const next = e.target.value;
                  setSearchQuery(next);
                  setSearchDropdownOpen(next.trim().length > 0);
                }}
                placeholder={d.searchPlaceholder}
                aria-label={d.globalSearch.ariaLabel}
                aria-expanded={searchDropdownOpen && trimmedSearch.length > 0}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-16 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#7C3AED] focus:bg-white focus:outline-none dark:border-[#263449] dark:bg-[#162235] dark:text-slate-100 dark:focus:bg-[#0B1220]"
              />
              {trimmedSearch ? (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setSearchDropdownOpen(false);
                    setTransactionSearchFilter('');
                    searchInputRef.current?.focus();
                  }}
                  aria-label={d.globalSearch.clear}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 dark:hover:bg-[#263449] dark:hover:text-slate-200"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : (
                <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-400 sm:inline-block dark:border-[#263449] dark:bg-[#0B1220]">
                  {d.globalSearch.shortcutHint}
                </kbd>
              )}

              {/* Global Search Results Dropdown */}
              {searchDropdownOpen && trimmedSearch.length > 0 && (
                <div
                  role="region"
                  aria-label={d.globalSearch.ariaLabel}
                  className="absolute left-0 top-full z-40 mt-2 max-h-[72vh] w-full min-w-[290px] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl sm:w-[440px] dark:border-[#263449] dark:bg-[#0B1220]"
                >
                  <div className="mb-2 flex items-center justify-between border-b border-slate-100 px-2 pb-2 text-[11px] font-semibold text-slate-500 dark:border-[#263449] dark:text-slate-400">
                    <span>
                      <span className="font-mono-num text-[#7C3AED]">
                        {globalMatchingAccounts.length + globalMatchingTransactions.length}
                      </span>{' '}
                      {d.globalSearch.resultsCount}
                    </span>
                    <button
                      type="button"
                      onClick={() => setSearchDropdownOpen(false)}
                      className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                    >
                      Esc
                    </button>
                  </div>

                  {globalMatchingAccounts.length === 0 && globalMatchingTransactions.length === 0 ? (
                    <div className="px-3 py-6 text-center">
                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                        {d.globalSearch.noResultsTitle}
                      </p>
                      <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                        {d.globalSearch.noResultsHint}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {globalMatchingAccounts.length > 0 && (
                        <div>
                          <div className="flex items-center justify-between px-2 py-1">
                            <span className="text-[11px] font-bold tracking-wider text-slate-500 uppercase dark:text-slate-400">
                              {d.globalSearch.accountsGroup} ({globalMatchingAccounts.length})
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setActiveSection('accounts');
                                setSearchDropdownOpen(false);
                              }}
                              className="text-[11px] font-semibold text-[#7C3AED] hover:underline"
                            >
                              {d.globalSearch.viewInAccounts}
                            </button>
                          </div>
                          <ul className="space-y-1">
                            {globalMatchingAccounts.slice(0, 5).map((acc) => {
                              const Icon = accountIconMap[acc.id] ?? Wallet;
                              const liveBalance =
                                acc.openingBalance + (accountBalances[acc.id] ?? 0);
                              return (
                                <li key={acc.id}>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveSection('accounts');
                                      setSearchDropdownOpen(false);
                                    }}
                                    className="flex w-full items-center justify-between gap-3 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-slate-50 dark:hover:bg-[#162235]"
                                  >
                                    <div className="flex min-w-0 items-center gap-2.5">
                                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-[#7C3AED] dark:bg-violet-950/60">
                                        <Icon className="h-4 w-4" />
                                      </div>
                                      <div className="min-w-0">
                                        <p className="truncate text-xs font-semibold text-slate-900 dark:text-white">
                                          {acc.name}
                                        </p>
                                        <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                                          {acc.providerLabel ? `${acc.providerLabel} · ` : ''}
                                          {acc.type}
                                        </p>
                                      </div>
                                    </div>
                                    <span className="font-mono-num shrink-0 text-xs font-bold text-slate-900 dark:text-white">
                                      {formatAmount(liveBalance, acc.currency)}
                                    </span>
                                  </button>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      )}

                      {globalMatchingTransactions.length > 0 && (
                        <div>
                          <div className="flex items-center justify-between px-2 py-1">
                            <span className="text-[11px] font-bold tracking-wider text-slate-500 uppercase dark:text-slate-400">
                              {d.globalSearch.transactionsGroup} ({globalMatchingTransactions.length})
                            </span>
                          </div>
                          <ul className="space-y-1">
                            {globalMatchingTransactions.slice(0, 6).map((tx) => (
                              <li key={tx.id}>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setTransactionSearchFilter(tx.referenceNo);
                                    setActiveSection('transactions');
                                    setSearchDropdownOpen(false);
                                  }}
                                  className="flex w-full items-center justify-between gap-3 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-slate-50 dark:hover:bg-[#162235]"
                                >
                                  <div className="flex min-w-0 items-center gap-2.5">
                                    <div
                                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                                        tx.type === 'income'
                                          ? 'bg-emerald-100 text-[#16A34A] dark:bg-emerald-950/50'
                                          : 'bg-rose-100 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400'
                                      }`}
                                    >
                                      {tx.type === 'income' ? (
                                        <TrendingUp className="h-4 w-4" />
                                      ) : (
                                        <TrendingDown className="h-4 w-4" />
                                      )}
                                    </div>
                                    <div className="min-w-0">
                                      <p className="truncate text-xs font-semibold text-slate-900 dark:text-white">
                                        {tx.description}
                                      </p>
                                      <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                                        {tx.category} · {tx.accountName} · {tx.date}
                                      </p>
                                    </div>
                                  </div>
                                  <span
                                    className={`font-mono-num shrink-0 text-xs font-bold ${
                                      tx.type === 'income'
                                        ? 'text-[#16A34A]'
                                        : 'text-rose-600 dark:text-rose-400'
                                    }`}
                                  >
                                    {tx.type === 'income' ? '+' : '-'}
                                    {formatAmount(tx.amount, tx.currency)}
                                  </span>
                                </button>
                              </li>
                            ))}
                          </ul>
                          <button
                            type="button"
                            onClick={() => {
                              setTransactionSearchFilter(trimmedSearch);
                              setActiveSection('transactions');
                              setSearchDropdownOpen(false);
                            }}
                            className="mt-1.5 flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 py-2 text-xs font-semibold text-[#7C3AED] transition-colors hover:bg-violet-50 dark:border-[#263449] dark:bg-[#162235] dark:hover:bg-violet-950/30"
                          >
                            <span>{d.globalSearch.viewAllTransactions}</span>
                            <ArrowRight className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <NotificationBellDropdown
              alerts={activeAlerts}
              readIds={readAlertIds}
              locale={locale}
              onMarkRead={handleMarkAlertRead}
              onMarkAllRead={handleMarkAllAlertsRead}
              onNavigateSection={(sec) => handleSelectSection(sec)}
            />

            <button
              type="button"
              onClick={onToggleLocale}
              aria-label={t.language.label}
              className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-[#263449] dark:text-slate-200 dark:hover:bg-[#162235]"
            >
              <Globe className="h-3.5 w-3.5 text-[#7C3AED]" />
              <span>{locale.toUpperCase()}</span>
            </button>

            <button
              type="button"
              onClick={onCycleTheme}
              aria-label={`${t.theme.label}: ${t.theme[theme]}`}
              title={`${t.theme.label}: ${t.theme[theme]}`}
              data-theme-mode={theme}
              className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-[#7C3AED] dark:border-[#263449] dark:text-slate-200 dark:hover:bg-[#162235]"
            >
              <ThemeIcon className="h-3.5 w-3.5 text-[#7C3AED]" />
              <span className="hidden sm:inline">{t.theme[theme]}</span>
            </button>

            {!isInstalled ? (
              <button
                type="button"
                onClick={onInstallClick}
                className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-[#6D28D9] transition-colors hover:bg-violet-100 dark:border-violet-500/30 dark:bg-violet-950/40 dark:text-violet-300 dark:hover:bg-violet-900/50"
              >
                <Download className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{t.nav.installApp}</span>
              </button>
            ) : (
              <span className="hidden shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 sm:inline-flex dark:border-emerald-500/30 dark:bg-emerald-950/40 dark:text-emerald-300">
                <Check className="h-3.5 w-3.5" />
                <span>{t.nav.installed}</span>
              </span>
            )}

            <div className="hidden items-center gap-2 border-l border-slate-200 pl-2.5 sm:flex dark:border-[#263449]">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#7C3AED] text-xs font-bold text-white">
                {user.name.slice(0, 1).toUpperCase()}
              </div>
              <div className="max-w-[130px]">
                <p className="truncate text-xs font-semibold text-slate-900 dark:text-white">
                  {user.name}
                </p>
                <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                  {user.email}
                </p>
              </div>
            </div>
          </div>
        </header>

        {/* Quick Action Bar */}
        <nav
          aria-label={d.quickActions.barLabel}
          className="flex items-center gap-2 overflow-x-auto border-t border-slate-100 bg-slate-50/85 px-4 py-2.5 sm:px-6 dark:border-[#263449]/70 dark:bg-[#0F1724]/80"
        >
          <span className="hidden shrink-0 items-center gap-1.5 pr-2 text-[11px] font-bold tracking-wider text-slate-500 uppercase md:inline-flex dark:text-slate-400">
            <Zap className="h-3.5 w-3.5 text-[#7C3AED]" />
            <span>{d.quickActions.badge}</span>
          </span>

          <button
            type="button"
            onClick={() => openTransactionModal('expense')}
            className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg bg-[#7C3AED] px-3 py-1.5 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-[#6D28D9] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7C3AED]"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>{d.quickActions.addTransaction}</span>
          </button>

          <button
            type="button"
            onClick={() => handleSelectSection('reports')}
            className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
              activeSection === 'reports'
                ? 'border-[#7C3AED] bg-violet-50 text-[#6D28D9] dark:border-violet-500/50 dark:bg-violet-950/50 dark:text-violet-300'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-[#263449] dark:bg-[#0B1220] dark:text-slate-200 dark:hover:bg-[#162235]'
            }`}
          >
            <BarChart3 className="h-3.5 w-3.5 text-[#7C3AED]" />
            <span>{d.quickActions.viewReports}</span>
          </button>

          <button
            type="button"
            onClick={() => handleSelectSection('budgets')}
            className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
              activeSection === 'budgets'
                ? 'border-[#7C3AED] bg-violet-50 text-[#6D28D9] dark:border-violet-500/50 dark:bg-violet-950/50 dark:text-violet-300'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-[#263449] dark:bg-[#0B1220] dark:text-slate-200 dark:hover:bg-[#162235]'
            }`}
          >
            <Target className="h-3.5 w-3.5 text-[#7C3AED]" />
            <span>{d.quickActions.budgetStatus}</span>
            <span
              className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                budgetAllocations.length === 0
                  ? 'bg-slate-100 text-slate-600 dark:bg-[#162235] dark:text-slate-300'
                  : hasOverBudget
                    ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                    : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
              }`}
            >
              {budgetAllocations.length === 0
                ? d.quickActions.budgetUnset
                : hasOverBudget
                  ? d.quickActions.budgetAlert
                  : d.quickActions.budgetOnTrack}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleSelectSection('insights')}
            className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
              activeSection === 'insights'
                ? 'border-[#7C3AED] bg-violet-50 text-[#6D28D9] dark:border-violet-500/50 dark:bg-violet-950/50 dark:text-violet-300'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-[#263449] dark:bg-[#0B1220] dark:text-slate-200 dark:hover:bg-[#162235]'
            }`}
          >
            <Cpu className="h-3.5 w-3.5 text-[#7C3AED]" />
            <span>{d.quickActions.aiInsights}</span>
          </button>

          <button
            type="button"
            onClick={() => handleSelectSection('bills')}
            className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
              activeSection === 'bills'
                ? 'border-[#7C3AED] bg-violet-50 text-[#6D28D9] dark:border-violet-500/50 dark:bg-violet-950/50 dark:text-violet-300'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-[#263449] dark:bg-[#0B1220] dark:text-slate-200 dark:hover:bg-[#162235]'
            }`}
          >
            <Receipt className="h-3.5 w-3.5 text-[#7C3AED]" />
            <span>{d.quickActions.billsDue}</span>
            {unpaidBillsCount > 0 && (
              <span className="font-mono-num rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                {unpaidBillsCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => handleQuickExport('financial_report', 'csv')}
            className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100 dark:border-[#263449] dark:bg-[#0B1220] dark:text-slate-200 dark:hover:bg-[#162235]"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-[#16A34A]" />
            <span>{d.quickActions.exportCsv}</span>
          </button>
        </nav>
        </div>

        {/* Main Content Viewport */}
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {/* Offline Mode — Cached Non-Sensitive Summary Banner */}
          {!isOnline && (
            <section
              role="status"
              aria-live="polite"
              className="mb-6 rounded-2xl border border-amber-300 bg-amber-50/90 p-4 text-amber-950 dark:border-amber-500/40 dark:bg-amber-950/30 dark:text-amber-100"
            >
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300">
                    <WifiOff className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold">{d.offlineCache.bannerTitle}</h2>
                    <p className="mt-0.5 text-xs text-amber-900/85 dark:text-amber-200/85">
                      {d.offlineCache.bannerDesc}
                    </p>
                  </div>
                </div>
                {cachedOfflineSummary && (
                  <button
                    type="button"
                    onClick={handleClearOfflineCache}
                    className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900 transition-colors hover:bg-amber-100 dark:border-amber-500/40 dark:bg-[#0B1220] dark:text-amber-200 dark:hover:bg-amber-900/40"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>{d.offlineCache.clearCacheBtn}</span>
                  </button>
                )}
              </div>

              {cachedOfflineSummary ? (
                <div className="mt-4 space-y-3 border-t border-amber-200/80 pt-3 dark:border-amber-500/25">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div className="rounded-xl bg-white/80 px-3 py-2 dark:bg-[#0B1220]/70">
                      <p className="text-[11px] font-medium text-amber-800/80 dark:text-amber-300/80">
                        {d.kpis.totalBalance}
                      </p>
                      <p className="font-mono-num mt-0.5 text-sm font-bold">
                        {formatAmount(
                          cachedOfflineSummary.netBalance,
                          cachedOfflineSummary.primaryCurrency
                        )}
                      </p>
                    </div>
                    <div className="rounded-xl bg-white/80 px-3 py-2 dark:bg-[#0B1220]/70">
                      <p className="text-[11px] font-medium text-amber-800/80 dark:text-amber-300/80">
                        {d.kpis.totalIncome}
                      </p>
                      <p className="font-mono-num mt-0.5 text-sm font-bold text-emerald-700 dark:text-emerald-400">
                        {formatAmount(
                          cachedOfflineSummary.totalIncome,
                          cachedOfflineSummary.primaryCurrency
                        )}
                      </p>
                    </div>
                    <div className="rounded-xl bg-white/80 px-3 py-2 dark:bg-[#0B1220]/70">
                      <p className="text-[11px] font-medium text-amber-800/80 dark:text-amber-300/80">
                        {d.kpis.totalExpenses}
                      </p>
                      <p className="font-mono-num mt-0.5 text-sm font-bold text-rose-700 dark:text-rose-400">
                        {formatAmount(
                          cachedOfflineSummary.totalExpenses,
                          cachedOfflineSummary.primaryCurrency
                        )}
                      </p>
                    </div>
                    <div className="rounded-xl bg-white/80 px-3 py-2 dark:bg-[#0B1220]/70">
                      <p className="text-[11px] font-medium text-amber-800/80 dark:text-amber-300/80">
                        {d.offlineCache.lastSyncedLabel}
                      </p>
                      <p className="font-mono-num mt-0.5 text-xs font-semibold">
                        {cachedOfflineSummary.transactionCount} {d.offlineCache.entriesLabel}
                      </p>
                      <p className="mt-0.5 truncate text-[10px] opacity-75">
                        {new Date(cachedOfflineSummary.updatedAt).toLocaleString(
                          locale === 'rw' ? 'rw-RW' : 'en-US'
                        )}
                      </p>
                    </div>
                  </div>

                  {cachedOfflineSummary.categoryTotals.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-semibold text-amber-900 dark:text-amber-200">
                        {d.offlineCache.topCategoriesLabel}:
                      </span>
                      {cachedOfflineSummary.categoryTotals.slice(0, 4).map((cat) => (
                        <span
                          key={cat.category}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-white/85 px-2.5 py-1 text-[11px] font-medium dark:border-amber-500/30 dark:bg-[#0B1220]/80"
                        >
                          <span>{cat.category}</span>
                          <span className="font-mono-num font-bold">
                            {formatAmount(cat.amount, cachedOfflineSummary.primaryCurrency)}
                          </span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <p className="mt-3 border-t border-amber-200/80 pt-2.5 text-xs font-medium text-amber-900/80 dark:border-amber-500/25 dark:text-amber-200/80">
                  {d.offlineCache.settingsEmptyStatus}
                </p>
              )}
            </section>
          )}

          {/* Placeholder / Onboarding Status Notice */}
          {!onboardingCompleted ? (
            <div className="mb-6 flex flex-col justify-between gap-3 rounded-xl border border-violet-200 bg-violet-50/80 px-4 py-3 text-xs text-violet-950 sm:flex-row sm:items-center dark:border-violet-500/30 dark:bg-violet-950/30 dark:text-violet-200">
              <div className="flex items-start gap-2.5">
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[#7C3AED]" />
                <span>{d.onboardingWizard.resumeBanner}</span>
              </div>
              <button
                type="button"
                onClick={() => setOnboardingOpen(true)}
                className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-lg bg-[#7C3AED] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#6D28D9] sm:self-auto"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>{d.onboardingWizard.resumeButton}</span>
              </button>
            </div>
          ) : (
            <div className="mb-6 flex items-start gap-3 rounded-xl border border-violet-200 bg-violet-50/80 px-4 py-3 text-xs text-violet-950 dark:border-violet-500/30 dark:bg-violet-950/30 dark:text-violet-200">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#7C3AED]" />
              <span>{d.placeholderBanner}</span>
            </div>
          )}

          {(activeSection === 'overview' || activeSection === 'accounts') && (
            <>
              {/* Header Row */}
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                  <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                    {d.welcome} {user.name}
                  </h1>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{d.subtitle}</p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <select
                    aria-label={d.periodLabel}
                    value={period}
                    onChange={(e) => setPeriod(e.target.value as 'month' | 'days30' | 'ytd')}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 focus:border-[#7C3AED] focus:outline-none dark:border-[#263449] dark:bg-[#0B1220] dark:text-slate-200"
                  >
                    <option value="month">{d.periods.month}</option>
                    <option value="days30">{d.periods.days30}</option>
                    <option value="ytd">{d.periods.ytd}</option>
                  </select>

                  <button
                    type="button"
                    onClick={() => openTransactionModal('expense')}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#7C3AED] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#6D28D9] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7C3AED]"
                  >
                    <Plus className="h-4 w-4" />
                    <span>{d.recordTransaction}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => openExportModal('financial_report')}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-[#263449] dark:bg-[#0B1220] dark:text-slate-200 dark:hover:bg-[#162235]"
                  >
                    <Download className="h-4 w-4 text-[#7C3AED]" />
                    <span>{d.exportFeature.buttonLabel}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActionNotice(d.accountActionNotice)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-[#263449] dark:bg-[#0B1220] dark:text-slate-200 dark:hover:bg-[#162235]"
                  >
                    <Plus className="h-4 w-4 text-[#7C3AED]" />
                    <span>{d.addAccount}</span>
                  </button>
                </div>
              </div>

              {actionNotice && (
                <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs font-medium text-amber-900 dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-200">
                  <span>{actionNotice}</span>
                  <button
                    type="button"
                    onClick={() => setActionNotice(null)}
                    aria-label={t.installModal.close}
                    className="rounded p-1 hover:bg-amber-100 dark:hover:bg-amber-900/40"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}

              {/* Summary KPIs */}
              <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  {
                    label: d.kpis.totalBalance,
                    value: formatAmount(displayNetBalance, displayCurrency),
                    accent: 'border-violet-300 dark:border-violet-500/40',
                  },
                  {
                    label: d.kpis.totalIncome,
                    value: formatAmount(displayIncome, displayCurrency),
                    accent: 'border-emerald-300 dark:border-emerald-500/40',
                  },
                  {
                    label: d.kpis.totalExpenses,
                    value: formatAmount(displayExpenses, displayCurrency),
                    accent: 'border-rose-300 dark:border-rose-500/40',
                  },
                  {
                    label: d.kpis.savingsProgress,
                    value: (() => {
                      const primaryGoals = savingsGoals.filter(
                        (g) => g.currency === primaryCurrency
                      );
                      const goalTarget = primaryGoals.reduce((s, g) => s + g.targetAmount, 0);
                      const goalSaved = primaryGoals.reduce((s, g) => s + g.currentAmount, 0);
                      if (goalTarget > 0) {
                        return `${Math.min(100, Math.round((goalSaved / goalTarget) * 100))}%`;
                      }
                      return displayIncome > 0
                        ? `${Math.max(0, Math.round(((displayIncome - displayExpenses) / displayIncome) * 100))}%`
                        : '0%';
                    })(),
                    accent: 'border-blue-300 dark:border-blue-500/40',
                  },
                ].map((kpi) => (
                  <div
                    key={kpi.label}
                    className={`rounded-2xl border ${kpi.accent} bg-white p-5 dark:bg-[#0B1220]`}
                  >
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      {kpi.label}
                    </p>
                    <p className="font-mono-num mt-2 text-2xl font-bold text-slate-900 dark:text-white">
                      {kpi.value}
                    </p>
                  </div>
                ))}
              </div>

              {/* Recharts Visualizations: Account Balances & Historical Spending Trends */}
              <DashboardCharts
                locale={locale}
                theme={theme}
                period={period}
                recordedTransactions={transactions}
                accounts={activeAccounts}
              />

              {/* Financial Accounts Placeholder Overview */}
              <section className="mt-8">
                <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
                  <div>
                    <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                      {d.accountsHeading}
                    </h2>
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      {d.accountsSubheading}
                    </p>
                  </div>
                </div>

                {filteredAccounts.length === 0 ? (
                  <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 dark:border-[#263449] dark:bg-[#0B1220] dark:text-slate-400">
                    {d.emptyFilter}
                  </div>
                ) : (
                  <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {filteredAccounts.map((acc) => {
                      const Icon = accountIconMap[acc.id] ?? Wallet;
                      return (
                        <div
                          key={acc.id}
                          className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 transition-colors hover:border-violet-300 dark:border-[#263449] dark:bg-[#0B1220] dark:hover:border-violet-500/40"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-[#7C3AED] dark:bg-violet-950/60">
                                <Icon className="h-5 w-5" />
                              </div>
                              <div>
                                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                                  {acc.name}
                                </h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                  {acc.providerLabel ? `${acc.providerLabel} · ` : ''}
                                  {acc.type} · {acc.currency}
                                </p>
                              </div>
                            </div>
                            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                              {acc.status}
                            </span>
                          </div>

                          <div className="mt-5 flex items-baseline justify-between border-t border-slate-100 pt-3.5 dark:border-[#263449]">
                            <span className="font-mono-num text-lg font-bold text-slate-900 dark:text-white">
                              {formatAmount(
                                acc.openingBalance + (accountBalances[acc.id] ?? 0),
                                acc.currency
                              )}
                            </span>
                            <button
                              type="button"
                              onClick={() => openTransactionModal('expense')}
                              className="text-xs font-semibold text-[#7C3AED] hover:underline"
                            >
                              {d.recordTransaction}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              {/* Recent Activity, Filterable Transaction History & Secondary Overview Panels */}
              {activeSection === 'overview' && (
                <>
                  <div className="mt-8">
                    <RecentActivity
                      transactions={transactions}
                      accountUpdates={accountUpdates}
                      locale={locale}
                      formatAmount={formatAmount}
                      onViewAllTransactions={() => handleSelectSection('transactions')}
                      onViewAccounts={() => handleSelectSection('accounts')}
                      onRecordTransaction={() => openTransactionModal('expense')}
                      onLaunchSetup={() => setOnboardingOpen(true)}
                    />
                  </div>

                  <div className="mt-6">
                    <BudgetGoals
                      goals={savingsGoals}
                      accounts={activeAccounts}
                      primaryCurrency={primaryCurrency}
                      locale={locale}
                      formatAmount={formatAmount}
                      onAddGoal={handleAddGoal}
                      onContributeGoal={handleContributeGoal}
                      onDeleteGoal={handleDeleteGoal}
                      compact
                      onViewAllGoals={() => handleSelectSection('savings')}
                    />
                  </div>

                  <div className="mt-6">
                    <TransactionHistory
                      transactions={transactions}
                      locale={locale}
                      formatAmount={formatAmount}
                      onRecordClick={openTransactionModal}
                      onExportClick={() => openExportModal('transaction_history')}
                    />
                  </div>

                  <section className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
                    {/* Budget Progress Card */}
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-[#263449] dark:bg-[#0B1220]">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <Target className="h-4 w-4 text-[#7C3AED]" />
                          <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white">
                            {d.panels.budgetsTitle}
                          </h3>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleSelectSection('budgets')}
                          className="text-[11px] font-semibold text-[#7C3AED] hover:underline"
                        >
                          {d.nav.budgets}
                        </button>
                      </div>

                      {budgetAllocations.length === 0 ? (
                        <div className="mt-3 space-y-2.5">
                          <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                            {d.panels.budgetsEmpty}
                          </p>
                          <button
                            type="button"
                            onClick={() => setOnboardingOpen(true)}
                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#7C3AED] hover:underline"
                          >
                            <Sparkles className="h-3.5 w-3.5" />
                            <span>{d.onboardingWizard.resumeButton}</span>
                          </button>
                        </div>
                      ) : (
                        <div className="mt-3.5 space-y-3">
                          {budgetAllocations.slice(0, 3).map((b) => {
                            const spent = expensesByCategory[b.category] ?? 0;
                            const pct =
                              b.monthlyLimit > 0
                                ? Math.min(100, Math.round((spent / b.monthlyLimit) * 100))
                                : 0;
                            const isOver = spent > b.monthlyLimit;
                            return (
                              <div key={b.category}>
                                <div className="flex items-center justify-between text-xs">
                                  <span className="font-medium text-slate-700 dark:text-slate-200">
                                    {b.category}
                                  </span>
                                  <span className="font-mono-num text-[11px] text-slate-500 dark:text-slate-400">
                                    {formatAmount(spent, primaryCurrency)} /{' '}
                                    {formatAmount(b.monthlyLimit, primaryCurrency)}
                                  </span>
                                </div>
                                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-[#162235]">
                                  <div
                                    className={`h-full rounded-full transition-all ${
                                      isOver ? 'bg-rose-500' : 'bg-[#7C3AED]'
                                    }`}
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Upcoming Bills Card */}
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-[#263449] dark:bg-[#0B1220]">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <FileText className="h-4 w-4 text-[#7C3AED]" />
                          <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white">
                            {d.panels.billsTitle}
                          </h3>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleSelectSection('bills')}
                          className="text-[11px] font-semibold text-[#7C3AED] hover:underline"
                        >
                          {d.billsManager.manageBills}
                        </button>
                      </div>

                      {scheduledBills.filter((b) => !b.paid).length === 0 ? (
                        <div className="mt-3 space-y-2.5">
                          <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                            {d.panels.billsEmpty}
                          </p>
                          <button
                            type="button"
                            onClick={() => handleSelectSection('bills')}
                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#7C3AED] hover:underline"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            <span>{d.billsManager.addBill}</span>
                          </button>
                        </div>
                      ) : (
                        <ul className="mt-3.5 space-y-2.5">
                          {scheduledBills
                            .filter((b) => !b.paid)
                            .slice(0, 3)
                            .map((bill) => (
                              <li
                                key={bill.id}
                                className="flex items-center justify-between gap-2 text-xs"
                              >
                                <div className="min-w-0">
                                  <p className="truncate font-semibold text-slate-800 dark:text-slate-100">
                                    {bill.title}
                                  </p>
                                  <p className="font-mono-num text-[11px] text-slate-500 dark:text-slate-400">
                                    {bill.dueDate}
                                  </p>
                                </div>
                                <span className="font-mono-num shrink-0 font-bold text-slate-900 dark:text-white">
                                  {formatAmount(bill.amount, bill.currency)}
                                </span>
                              </li>
                            ))}
                        </ul>
                      )}
                    </div>

                    {/* Analytical Summary Card */}
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-[#263449] dark:bg-[#0B1220]">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <Cpu className="h-4 w-4 text-[#7C3AED]" />
                          <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white">
                            {d.panels.aiTitle}
                          </h3>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleSelectSection('insights')}
                          className="text-[11px] font-semibold text-[#7C3AED] hover:underline"
                        >
                          {d.aiInsights.openInsights}
                        </button>
                      </div>
                      {transactions.length === 0 ? (
                        <p className="mt-3 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                          {d.panels.aiEmpty}
                        </p>
                      ) : (
                        (() => {
                          const quickReport = generateMockLLMFinancialAnalysis({
                            transactions,
                            accounts: activeAccounts,
                            budgets: budgetAllocations,
                            savingsGoals,
                            primaryCurrency,
                            monthlyIncomeTarget,
                            locale,
                            focusMode: 'summary',
                            formatAmount,
                          });
                          return (
                            <div className="mt-3 space-y-2">
                              <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                                {quickReport.headline}
                              </p>
                              <p className="line-clamp-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                                {quickReport.narrativeParagraphs[0]}
                              </p>
                              {quickReport.topCategory && (
                                <p className="text-[11px] font-medium text-[#7C3AED]">
                                  {d.aiInsights.overviewTopCat} {quickReport.topCategory.category} ({quickReport.topCategory.sharePct}%)
                                </p>
                              )}
                            </div>
                          );
                        })()
                      )}
                    </div>
                  </section>
                </>
              )}
            </>
          )}

          {activeSection === 'settings' && (
            <section className="space-y-6">
              <div>
                <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
                  {d.nav.settings}
                </h1>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  {d.preferencesDesc}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-[#263449] dark:bg-[#0B1220]">
                <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                  {d.preferencesTitle}
                </h2>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={onToggleLocale}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-[#263449] dark:text-slate-200 dark:hover:bg-[#162235]"
                  >
                    <Globe className="h-4 w-4 text-[#7C3AED]" />
                    <span>{t.language[locale]}</span>
                  </button>

                  <button
                    type="button"
                    onClick={onCycleTheme}
                    aria-label={`${t.theme.label}: ${t.theme[theme]}`}
                    title={`${t.theme.label}: ${t.theme[theme]}`}
                    data-theme-mode={theme}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-[#7C3AED] dark:border-[#263449] dark:text-slate-200 dark:hover:bg-[#162235]"
                  >
                    <ThemeIcon className="h-4 w-4 text-[#7C3AED]" />
                    <span>{t.theme[theme]}</span>
                  </button>

                  {!isInstalled && (
                    <button
                      type="button"
                      onClick={onInstallClick}
                      className="inline-flex items-center gap-2 rounded-xl bg-[#7C3AED] px-4 py-2 text-xs font-semibold text-white hover:bg-[#6D28D9]"
                    >
                      <Download className="h-4 w-4" />
                      <span>{t.nav.installApp}</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setOnboardingOpen(true)}
                    className="inline-flex items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-4 py-2 text-xs font-semibold text-[#6D28D9] hover:bg-violet-100 dark:border-violet-500/30 dark:bg-violet-950/40 dark:text-violet-300"
                  >
                    <Sparkles className="h-4 w-4" />
                    <span>{d.budgetsView.configureWizard}</span>
                  </button>
                </div>
              </div>

              {/* Offline Summary Cache (IndexedDB) Control Card */}
              <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-[#263449] dark:bg-[#0B1220]">
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-[#7C3AED] dark:bg-violet-950/60">
                      <Database className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                        {d.offlineCache.settingsTitle}
                      </h2>
                      <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                        {d.offlineCache.settingsDesc}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleClearOfflineCache}
                    disabled={!cachedOfflineSummary}
                    className="inline-flex shrink-0 items-center gap-2 self-start rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-semibold text-rose-700 transition-colors hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-rose-500/30 dark:bg-rose-950/30 dark:text-rose-300 dark:hover:bg-rose-950/50"
                  >
                    <Trash2 className="h-4 w-4" />
                    <span>{d.offlineCache.clearCacheBtn}</span>
                  </button>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs dark:border-[#263449] dark:bg-[#162235]">
                  <div className="flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-100">
                    <span
                      className={`h-2.5 w-2.5 rounded-full ${
                        cachedOfflineSummary ? 'bg-[#16A34A]' : 'bg-slate-400'
                      }`}
                    />
                    <span>
                      {cachedOfflineSummary
                        ? d.offlineCache.settingsActiveStatus
                        : d.offlineCache.settingsEmptyStatus}
                    </span>
                  </div>
                  {cachedOfflineSummary && (
                    <div className="font-mono-num text-[11px] text-slate-600 dark:text-slate-300">
                      {cachedOfflineSummary.transactionCount} {d.offlineCache.entriesLabel} ·{' '}
                      {d.offlineCache.lastSyncedLabel}{' '}
                      {new Date(cachedOfflineSummary.updatedAt).toLocaleString(
                        locale === 'rw' ? 'rw-RW' : 'en-US'
                      )}
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}

          {activeSection === 'budgets' && (
            <section className="space-y-6">
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                  <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
                    {d.budgetsView.title}
                  </h1>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                    {d.budgetsView.subtitle}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={() => openExportModal('budget_summary')}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-[#263449] dark:bg-[#0B1220] dark:text-slate-200 dark:hover:bg-[#162235]"
                  >
                    <Download className="h-4 w-4 text-[#7C3AED]" />
                    <span>{d.exportFeature.buttonLabel}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setOnboardingOpen(true)}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#7C3AED] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#6D28D9]"
                  >
                    <Sparkles className="h-4 w-4" />
                    <span>{d.budgetsView.configureWizard}</span>
                  </button>
                </div>
              </div>

              <BudgetThresholdControl
                thresholdPct={budgetThresholdPct}
                monitoredCount={budgetAllocations.length}
                locale={locale}
                onChange={setBudgetThresholdPct}
              />

              {budgetAllocations.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center dark:border-[#263449] dark:bg-[#0B1220]">
                  <p className="mx-auto max-w-md text-sm text-slate-600 dark:text-slate-300">
                    {d.budgetsView.emptyBudgets}
                  </p>
                  <button
                    type="button"
                    onClick={() => setOnboardingOpen(true)}
                    className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#7C3AED] px-4 py-2 text-xs font-semibold text-white hover:bg-[#6D28D9]"
                  >
                    <Sparkles className="h-4 w-4" />
                    <span>{d.onboardingWizard.resumeButton}</span>
                  </button>
                </div>
              ) : (
                <>
                  {(() => {
                    const totalBudgeted = budgetAllocations.reduce(
                      (sum, b) => sum + b.monthlyLimit,
                      0
                    );
                    const totalBudgetSpent = budgetAllocations.reduce(
                      (sum, b) => sum + (expensesByCategory[b.category] ?? 0),
                      0
                    );
                    const remainingBudget = totalBudgeted - totalBudgetSpent;
                    return (
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-[#263449] dark:bg-[#0B1220]">
                          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                            {d.budgetsView.monthlyIncomeLabel}
                          </p>
                          <p className="font-mono-num mt-2 text-xl font-bold text-slate-900 dark:text-white">
                            {formatAmount(monthlyIncomeTarget, primaryCurrency)}
                          </p>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-[#263449] dark:bg-[#0B1220]">
                          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                            {d.budgetsView.totalAllocatedLabel}
                          </p>
                          <p className="font-mono-num mt-2 text-xl font-bold text-[#7C3AED]">
                            {formatAmount(totalBudgeted, primaryCurrency)}
                          </p>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-[#263449] dark:bg-[#0B1220]">
                          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                            {d.budgetsView.totalSpentLabel}
                          </p>
                          <p className="font-mono-num mt-2 text-xl font-bold text-slate-900 dark:text-white">
                            {formatAmount(totalBudgetSpent, primaryCurrency)}
                          </p>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-[#263449] dark:bg-[#0B1220]">
                          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                            {d.budgetsView.remainingLabel}
                          </p>
                          <p
                            className={`font-mono-num mt-2 text-xl font-bold ${
                              remainingBudget >= 0
                                ? 'text-[#16A34A]'
                                : 'text-rose-600 dark:text-rose-400'
                            }`}
                          >
                            {formatAmount(remainingBudget, primaryCurrency)}
                          </p>
                        </div>
                      </div>
                    );
                  })()}

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {budgetAllocations.map((b) => {
                      const spent = expensesByCategory[b.category] ?? 0;
                      const pct =
                        b.monthlyLimit > 0
                          ? Math.min(100, Math.round((spent / b.monthlyLimit) * 100))
                          : 0;
                      const isOver = spent > b.monthlyLimit;
                      return (
                        <div
                          key={b.category}
                          className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-[#263449] dark:bg-[#0B1220]"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white">
                              {b.category}
                            </h3>
                            <span
                              className={`text-xs font-semibold ${
                                isOver
                                  ? 'text-rose-600 dark:text-rose-400'
                                  : 'text-[#16A34A]'
                              }`}
                            >
                              {isOver ? d.budgetsView.overBudget : d.budgetsView.onTrack}
                            </span>
                          </div>
                          <p className="font-mono-num mt-2 text-xs text-slate-600 dark:text-slate-300">
                            {formatAmount(spent, primaryCurrency)} {d.budgetsView.ofLimit}{' '}
                            {formatAmount(b.monthlyLimit, primaryCurrency)} ({pct}%)
                          </p>
                          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-[#162235]">
                            <div
                              className={`h-full rounded-full transition-all ${
                                isOver ? 'bg-rose-500' : 'bg-[#7C3AED]'
                              }`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              <BudgetHistory
                budgets={budgetAllocations}
                transactions={transactions}
                thresholdPct={budgetThresholdPct}
                primaryCurrency={primaryCurrency}
                locale={locale}
                formatAmount={formatAmount}
              />
            </section>
          )}

          {(activeSection === 'transactions' ||
            activeSection === 'income' ||
            activeSection === 'expenses') && (
            <TransactionHistory
              key={activeSection}
              transactions={transactions}
              locale={locale}
              formatAmount={formatAmount}
              onRecordClick={openTransactionModal}
              onExportClick={() => openExportModal('transaction_history')}
              initialSearchQuery={
                activeSection === 'transactions' ? transactionSearchFilter : ''
              }
              defaultTypeFilter={
                activeSection === 'income'
                  ? 'income'
                  : activeSection === 'expenses'
                    ? 'expense'
                    : 'all'
              }
            />
          )}

          {activeSection === 'savings' && (
            <BudgetGoals
              goals={savingsGoals}
              accounts={activeAccounts}
              primaryCurrency={primaryCurrency}
              locale={locale}
              formatAmount={formatAmount}
              onAddGoal={handleAddGoal}
              onContributeGoal={handleContributeGoal}
              onDeleteGoal={handleDeleteGoal}
            />
          )}

          {activeSection === 'reports' && (
            <section className="space-y-6">
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                  <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
                    {d.exportFeature.reportsTitle}
                  </h1>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                    {d.exportFeature.reportsSubtitle}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={() => handleQuickExport('financial_report', 'csv')}
                    title={d.exportFeature.exportDataCsvHint}
                    className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-800 transition-colors hover:bg-emerald-100 dark:border-emerald-500/30 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-900/50"
                  >
                    <FileSpreadsheet className="h-4 w-4 text-[#16A34A]" />
                    <span>{d.exportFeature.exportDataBtn}</span>
                    <span className="rounded bg-white/80 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-[#0B1220]/70 dark:text-emerald-300">
                      CSV
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => openExportModal('financial_report')}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#7C3AED] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#6D28D9]"
                  >
                    <Download className="h-4 w-4" />
                    <span>{d.exportFeature.customExportBtn}</span>
                  </button>
                </div>
              </div>

              {actionNotice && (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-medium text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-950/40 dark:text-emerald-200">
                  <span>{actionNotice}</span>
                  <button
                    type="button"
                    onClick={() => setActionNotice(null)}
                    aria-label={t.installModal.close}
                    className="rounded p-1 hover:bg-emerald-100 dark:hover:bg-emerald-900/40"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                {(
                  [
                    {
                      id: 'financial_report',
                      icon: BarChart3,
                      countLine: `${activeAccounts.length} ${d.exportFeature.accountsCount} · ${transactions.length} ${d.exportFeature.transactionsCount}`,
                    },
                    {
                      id: 'transaction_history',
                      icon: Layers,
                      countLine: `${transactions.length} ${d.exportFeature.transactionsCount}`,
                    },
                    {
                      id: 'budget_summary',
                      icon: Target,
                      countLine: `${budgetAllocations.length} ${d.exportFeature.budgetsCount} · ${savingsGoals.length} ${d.exportFeature.goalsCount}`,
                    },
                  ] as const
                ).map((rep) => {
                  const Icon = rep.icon;
                  const copy = d.exportFeature.datasets[rep.id];
                  return (
                    <div
                      key={rep.id}
                      className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 dark:border-[#263449] dark:bg-[#0B1220]"
                    >
                      <div>
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 text-[#7C3AED] dark:bg-violet-950/60">
                          <Icon className="h-5 w-5" />
                        </div>
                        <h2 className="font-display mt-4 text-base font-bold text-slate-900 dark:text-white">
                          {copy.title}
                        </h2>
                        <p className="mt-1.5 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                          {copy.desc}
                        </p>
                        <p className="font-mono-num mt-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                          {rep.countLine}
                        </p>
                      </div>

                      <div className="mt-5 grid grid-cols-2 gap-2.5 border-t border-slate-100 pt-4 dark:border-[#263449]">
                        <button
                          type="button"
                          onClick={() => handleQuickExport(rep.id, 'csv')}
                          className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-100 dark:border-[#263449] dark:bg-[#162235] dark:text-slate-100 dark:hover:bg-[#1E2D45]"
                        >
                          <Download className="h-3.5 w-3.5 text-[#7C3AED]" />
                          <span>CSV</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleQuickExport(rep.id, 'pdf')}
                          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#7C3AED] px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#6D28D9]"
                        >
                          <FileText className="h-3.5 w-3.5" />
                          <span>PDF</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {activeSection === 'bills' && (
            <BillsSection
              bills={scheduledBills}
              primaryCurrency={primaryCurrency}
              locale={locale}
              formatAmount={formatAmount}
              onAddBill={handleAddBill}
              onTogglePaid={handleToggleBillPaid}
              onDeleteBill={handleDeleteBill}
            />
          )}

          {activeSection === 'notifications' && (
            <div className="space-y-6">
              <BudgetThresholdControl
                thresholdPct={budgetThresholdPct}
                monitoredCount={budgetAllocations.length}
                locale={locale}
                onChange={setBudgetThresholdPct}
              />
              <NotificationCenter
                alerts={activeAlerts}
                readIds={readAlertIds}
                locale={locale}
                onMarkRead={handleMarkAlertRead}
                onMarkAllRead={handleMarkAllAlertsRead}
                onDismiss={handleDismissAlert}
                onNavigateSection={(sec) => handleSelectSection(sec)}
              />
            </div>
          )}

          {activeSection === 'insights' && (
            <AIInsights
              transactions={transactions}
              accounts={activeAccounts}
              budgets={budgetAllocations}
              savingsGoals={savingsGoals}
              primaryCurrency={primaryCurrency}
              monthlyIncomeTarget={monthlyIncomeTarget}
              locale={locale}
              formatAmount={formatAmount}
              onRecordClick={() => openTransactionModal('expense')}
              onNavigateSection={(sec) => handleSelectSection(sec)}
            />
          )}

          {activeSection !== 'overview' &&
            activeSection !== 'accounts' &&
            activeSection !== 'transactions' &&
            activeSection !== 'income' &&
            activeSection !== 'expenses' &&
            activeSection !== 'budgets' &&
            activeSection !== 'savings' &&
            activeSection !== 'bills' &&
            activeSection !== 'notifications' &&
            activeSection !== 'reports' &&
            activeSection !== 'insights' &&
            activeSection !== 'settings' && (
              <section className="rounded-2xl border border-slate-200 bg-white p-8 text-center dark:border-[#263449] dark:bg-[#0B1220]">
                <h1 className="font-display text-xl font-bold text-slate-900 dark:text-white">
                  {activeNavLabel}
                </h1>
                <p className="mx-auto mt-2 max-w-md text-sm text-slate-600 dark:text-slate-300">
                  {d.modulePlaceholder}
                </p>
                <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => handleSelectSection('overview')}
                    className="inline-flex items-center rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-[#263449] dark:text-slate-200 dark:hover:bg-[#162235]"
                  >
                    {d.returnOverview}
                  </button>
                </div>
              </section>
            )}
        </main>
      </div>

      {/* Onboarding Wizard for Newly Registered Users */}
      <OnboardingWizard
        open={onboardingOpen}
        userName={user.name}
        locale={locale}
        initialCurrency={primaryCurrency}
        initialMonthlyIncome={monthlyIncomeTarget}
        initialAccounts={configuredAccounts ?? undefined}
        initialBudgets={budgetAllocations.length > 0 ? budgetAllocations : undefined}
        onComplete={handleOnboardingComplete}
        onSkip={() => setOnboardingOpen(false)}
      />

      {/* Export Financial Data Modal */}
      <ExportModal
        open={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        initialDataset={exportDataset}
        locale={locale}
        userName={user.name}
        userEmail={user.email}
        primaryCurrency={primaryCurrency}
        monthlyIncomeTarget={monthlyIncomeTarget}
        accounts={activeAccounts}
        transactions={transactions}
        budgets={budgetAllocations}
        savingsGoals={savingsGoals}
        onExported={(filename) =>
          setActionNotice(`${d.exportFeature.downloadedNotice} ${filename}`)
        }
      />

      {/* Transaction Input Modal */}
      <TransactionInput
        open={transactionModalOpen}
        onClose={() => setTransactionModalOpen(false)}
        onSave={handleSaveTransaction}
        locale={locale}
        initialType={transactionInitialType}
        accounts={activeAccounts}
      />

      {/* Real-Time Financial Alert Toast */}
      {liveToastAlert && (
        <div
          role="alert"
          className="fixed bottom-4 right-4 z-50 flex max-w-sm items-start gap-3 rounded-2xl border border-amber-300 bg-white p-4 shadow-2xl dark:border-amber-500/40 dark:bg-[#0B1220]"
        >
          <div
            className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
              liveToastAlert.severity === 'critical'
                ? 'bg-rose-100 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400'
                : 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300'
            }`}
          >
            <AlertTriangle className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-display text-xs font-bold text-slate-900 dark:text-white">
              {liveToastAlert.title}
            </p>
            <p className="mt-0.5 text-[11px] leading-snug text-slate-600 dark:text-slate-300">
              {liveToastAlert.message}
            </p>
            <button
              type="button"
              onClick={() => {
                handleMarkAlertRead(liveToastAlert.id);
                handleSelectSection(liveToastAlert.targetSection);
                setLiveToastAlert(null);
              }}
              className="mt-1.5 text-[11px] font-semibold text-[#7C3AED] hover:underline"
            >
              {d.notificationsCenter.actionInspect}
            </button>
          </div>
          <button
            type="button"
            onClick={() => setLiveToastAlert(null)}
            aria-label={d.notificationsCenter.dismiss}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-[#162235] dark:hover:text-slate-200"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
      {/* Dedicated Budget Category Threshold Monitor & Toast Alerts */}
      <BudgetThresholdNotifier
        transactions={transactions}
        budgets={budgetAllocations}
        thresholdPct={budgetThresholdPct}
        primaryCurrency={primaryCurrency}
        locale={locale}
        formatAmount={formatAmount}
        hasOtherToast={Boolean(liveToastAlert)}
        onInspectBudgets={() => handleSelectSection('budgets')}
      />
    </div>
  );
}
