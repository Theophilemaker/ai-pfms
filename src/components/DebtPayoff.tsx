import { useMemo, useState } from 'react';
import {
  ArrowRight,
  Calendar,
  CheckCircle2,
  CreditCard,
  Landmark,
  Plus,
  Trash2,
  TrendingDown,
  X,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { translations, type Locale } from '../i18n/translations';
import type { RecordedTransaction } from './TransactionInput';

export type DebtType = 'loan' | 'credit_card' | 'mortgage' | 'other';
export type PayoffStrategy = 'avalanche' | 'snowball';

export interface DebtAccount {
  id: string;
  name: string;
  debtType: DebtType;
  lender?: string;
  originalAmount: number;
  remainingBalance: number;
  aprPct: number;
  minimumMonthlyPayment: number;
  currency: 'RWF' | 'USD';
  createdAt: string;
}

export interface MonthlySurplusSummary {
  monthlyIncome: number;
  monthlyExpenses: number;
  surplus: number;
  source: 'ledger' | 'target' | 'none';
}

export interface DebtPayoffItemProjection {
  debtId: string;
  paidSoFar: number;
  repaymentPct: number;
  isPaidOff: boolean;
  monthsToPayoff: number | null;
  estimatedPayoffLabel: string;
  monthlyAllocatedPayment: number;
  status: 'paid_off' | 'scheduled' | 'insufficient_surplus' | 'beyond_horizon';
}

export interface DebtTrajectoryPoint {
  monthIndex: number;
  label: string;
  minimumOnly: number;
  withSurplus: number;
}

export interface DebtPayoffPlanResult {
  totalOriginal: number;
  totalRemaining: number;
  totalRepaid: number;
  overallRepaidPct: number;
  overallMonthsToPayoff: number | null;
  overallDebtFreeLabel: string;
  overallStatus: 'paid_off' | 'scheduled' | 'insufficient_surplus' | 'beyond_horizon' | 'empty';
  byDebtId: Record<string, DebtPayoffItemProjection>;
  trajectory: DebtTrajectoryPoint[];
}

function addMonthsLabel(monthsAhead: number, now: Date = new Date()): string {
  const dt = new Date(now.getFullYear(), now.getMonth() + monthsAhead, 1);
  return new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' }).format(dt);
}

function addMonthsShortLabel(monthsAhead: number, now: Date = new Date()): string {
  const dt = new Date(now.getFullYear(), now.getMonth() + monthsAhead, 1);
  return new Intl.DateTimeFormat('en-US', { month: 'short', year: '2-digit' }).format(dt);
}

function formatCompactMoney(value: number, currency: string): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${Math.round(value / 1_000)}k`;
  return currency === 'USD' ? `$${Math.round(value)}` : String(Math.round(value));
}

export function computeMonthlySurplus(params: {
  transactions: RecordedTransaction[];
  primaryCurrency: 'RWF' | 'USD';
  monthlyIncomeTarget: number;
}): MonthlySurplusSummary {
  const { transactions, primaryCurrency, monthlyIncomeTarget } = params;
  const currentMonthKey = new Date().toISOString().slice(0, 7);

  const monthTxns = transactions.filter(
    (tx) => tx.date.startsWith(currentMonthKey) && tx.currency === primaryCurrency
  );

  const ledgerIncome = monthTxns
    .filter((tx) => tx.type === 'income')
    .reduce((sum, tx) => sum + tx.amount, 0);
  const ledgerExpenses = monthTxns
    .filter((tx) => tx.type === 'expense')
    .reduce((sum, tx) => sum + tx.amount, 0);

  if (ledgerIncome > 0) {
    return {
      monthlyIncome: Math.round(ledgerIncome * 100) / 100,
      monthlyExpenses: Math.round(ledgerExpenses * 100) / 100,
      surplus: Math.max(0, Math.round((ledgerIncome - ledgerExpenses) * 100) / 100),
      source: 'ledger',
    };
  }

  if (monthlyIncomeTarget > 0) {
    return {
      monthlyIncome: Math.round(monthlyIncomeTarget * 100) / 100,
      monthlyExpenses: Math.round(ledgerExpenses * 100) / 100,
      surplus: Math.max(0, Math.round((monthlyIncomeTarget - ledgerExpenses) * 100) / 100),
      source: 'target',
    };
  }

  return {
    monthlyIncome: 0,
    monthlyExpenses: Math.round(ledgerExpenses * 100) / 100,
    surplus: 0,
    source: 'none',
  };
}

export function computeDebtPayoffPlan(params: {
  debts: DebtAccount[];
  monthlySurplus: number;
  extraMonthlyPayment?: number;
  strategy: PayoffStrategy;
  primaryCurrency: 'RWF' | 'USD';
  labels: {
    paidOff: string;
    insufficient: string;
    beyondHorizon: string;
  };
}): DebtPayoffPlanResult {
  const {
    debts,
    monthlySurplus,
    extraMonthlyPayment = 0,
    strategy,
    primaryCurrency,
    labels,
  } = params;

  if (debts.length === 0) {
    return {
      totalOriginal: 0,
      totalRemaining: 0,
      totalRepaid: 0,
      overallRepaidPct: 0,
      overallMonthsToPayoff: null,
      overallDebtFreeLabel: '—',
      overallStatus: 'empty',
      byDebtId: {},
      trajectory: [],
    };
  }

  const primaryDebts = debts.filter((d) => d.currency === primaryCurrency);
  const displayDebts = primaryDebts.length > 0 ? primaryDebts : debts;

  const totalOriginal = displayDebts.reduce((s, d) => s + Math.max(0, d.originalAmount), 0);
  const totalRemaining = displayDebts.reduce((s, d) => s + Math.max(0, d.remainingBalance), 0);
  const totalRepaid = Math.max(0, Math.round((totalOriginal - totalRemaining) * 100) / 100);
  const overallRepaidPct =
    totalOriginal > 0
      ? Math.min(100, Math.round((totalRepaid / totalOriginal) * 100))
      : totalRemaining === 0
        ? 100
        : 0;

  const byDebtId: Record<string, DebtPayoffItemProjection> = {};
  const maxMonths = 240;

  // Simulate both Accelerated (min payments + surplus + extra) and Minimum-Only across all debts
  const activeInitial = debts.filter((d) => d.remainingBalance > 0);
  debts.forEach((d) => {
    const paidSoFar = Math.max(0, Math.round((d.originalAmount - d.remainingBalance) * 100) / 100);
    const repaymentPct =
      d.originalAmount > 0
        ? Math.min(100, Math.round((paidSoFar / d.originalAmount) * 100))
        : d.remainingBalance <= 0
          ? 100
          : 0;

    if (d.remainingBalance <= 0) {
      byDebtId[d.id] = {
        debtId: d.id,
        paidSoFar,
        repaymentPct: 100,
        isPaidOff: true,
        monthsToPayoff: 0,
        estimatedPayoffLabel: labels.paidOff,
        monthlyAllocatedPayment: 0,
        status: 'paid_off',
      };
    } else {
      byDebtId[d.id] = {
        debtId: d.id,
        paidSoFar,
        repaymentPct,
        isPaidOff: false,
        monthsToPayoff: null,
        estimatedPayoffLabel: labels.beyondHorizon,
        monthlyAllocatedPayment: d.minimumMonthlyPayment,
        status: 'beyond_horizon',
      };
    }
  });

  if (activeInitial.length === 0) {
    return {
      totalOriginal,
      totalRemaining: 0,
      totalRepaid,
      overallRepaidPct: 100,
      overallMonthsToPayoff: 0,
      overallDebtFreeLabel: labels.paidOff,
      overallStatus: 'paid_off',
      byDebtId,
      trajectory: [
        { monthIndex: 0, label: addMonthsShortLabel(0), minimumOnly: 0, withSurplus: 0 },
      ],
    };
  }

  // Order debts by selected strategy (Avalanche: highest APR first; Snowball: smallest balance first)
  const sortForStrategy = (a: DebtAccount, b: DebtAccount) => {
    if (strategy === 'avalanche') {
      if (b.aprPct !== a.aprPct) return b.aprPct - a.aprPct;
      return a.remainingBalance - b.remainingBalance;
    }
    if (a.remainingBalance !== b.remainingBalance) return a.remainingBalance - b.remainingBalance;
    return b.aprPct - a.aprPct;
  };

  const orderedDebts = [...displayDebts].filter((d) => d.remainingBalance > 0).sort(sortForStrategy);
  const availableExtraPool = Math.max(0, monthlySurplus) + Math.max(0, extraMonthlyPayment);

  const accBalances = new Map<string, number>();
  const minBalances = new Map<string, number>();
  const payoffMonthMap = new Map<string, number>();
  const firstMonthAllocated = new Map<string, number>();

  orderedDebts.forEach((d) => {
    accBalances.set(d.id, d.remainingBalance);
    minBalances.set(d.id, d.remainingBalance);
  });

  // Also handle any non-primary-currency debts individually with their minimum payment
  debts
    .filter((d) => d.remainingBalance > 0 && !orderedDebts.some((od) => od.id === d.id))
    .forEach((d) => {
      const rate = Math.max(0, d.aprPct) / 100 / 12;
      let bal = d.remainingBalance;
      const pmt = d.minimumMonthlyPayment;
      if (pmt <= bal * rate) {
        byDebtId[d.id] = {
          ...byDebtId[d.id],
          status: 'insufficient_surplus',
          estimatedPayoffLabel: labels.insufficient,
        };
        return;
      }
      let m = 0;
      while (bal > 0.01 && m < maxMonths) {
        m += 1;
        bal = Math.max(0, bal * (1 + rate) - pmt);
      }
      if (bal <= 0.01) {
        byDebtId[d.id] = {
          ...byDebtId[d.id],
          monthsToPayoff: m,
          estimatedPayoffLabel: addMonthsLabel(m),
          monthlyAllocatedPayment: pmt,
          status: 'scheduled',
        };
      }
    });

  const trajectory: DebtTrajectoryPoint[] = [
    {
      monthIndex: 0,
      label: addMonthsShortLabel(0),
      minimumOnly: Math.round(totalRemaining * 100) / 100,
      withSurplus: Math.round(totalRemaining * 100) / 100,
    },
  ];

  let allAcceleratedPaidMonth: number | null = null;

  for (let month = 1; month <= maxMonths; month += 1) {
    // 1. Minimum-only simulation step
    orderedDebts.forEach((d) => {
      const bal = minBalances.get(d.id) ?? 0;
      if (bal <= 0) return;
      const monthlyRate = Math.max(0, d.aprPct) / 100 / 12;
      const withInterest = bal * (1 + monthlyRate);
      const nextBal = Math.max(0, withInterest - Math.max(0, d.minimumMonthlyPayment));
      minBalances.set(d.id, nextBal);
    });

    // 2. Surplus-accelerated simulation step
    let freedMinPayments = 0;
    orderedDebts.forEach((d) => {
      const bal = accBalances.get(d.id) ?? 0;
      if (bal <= 0) {
        freedMinPayments += Math.max(0, d.minimumMonthlyPayment);
      }
    });

    let remainingSurplus = availableExtraPool + freedMinPayments;

    // Apply minimum payments first
    orderedDebts.forEach((d) => {
      const bal = accBalances.get(d.id) ?? 0;
      if (bal <= 0) return;
      const monthlyRate = Math.max(0, d.aprPct) / 100 / 12;
      const withInterest = bal * (1 + monthlyRate);
      const minPay = Math.min(withInterest, Math.max(0, d.minimumMonthlyPayment));
      const nextBal = Math.max(0, withInterest - minPay);
      accBalances.set(d.id, nextBal);
      if (month === 1) {
        firstMonthAllocated.set(d.id, minPay);
      }
      if (nextBal <= 0.01 && !payoffMonthMap.has(d.id)) {
        accBalances.set(d.id, 0);
        payoffMonthMap.set(d.id, month);
      }
    });

    // Roll surplus onto target debt(s) in strategy priority order
    for (const d of orderedDebts) {
      if (remainingSurplus <= 0) break;
      const bal = accBalances.get(d.id) ?? 0;
      if (bal <= 0) continue;
      const extraApplied = Math.min(bal, remainingSurplus);
      const nextBal = Math.max(0, bal - extraApplied);
      accBalances.set(d.id, nextBal);
      remainingSurplus -= extraApplied;
      if (month === 1) {
        firstMonthAllocated.set(d.id, (firstMonthAllocated.get(d.id) ?? 0) + extraApplied);
      }
      if (nextBal <= 0.01 && !payoffMonthMap.has(d.id)) {
        accBalances.set(d.id, 0);
        payoffMonthMap.set(d.id, month);
      }
    }

    let sumAcc = 0;
    let sumMin = 0;
    orderedDebts.forEach((d) => {
      sumAcc += accBalances.get(d.id) ?? 0;
      sumMin += minBalances.get(d.id) ?? 0;
    });

    if (month <= 48 || month % 3 === 0 || sumAcc <= 0.01) {
      trajectory.push({
        monthIndex: month,
        label: addMonthsShortLabel(month),
        minimumOnly: Math.round(sumMin * 100) / 100,
        withSurplus: Math.round(sumAcc * 100) / 100,
      });
    }

    if (sumAcc <= 0.01) {
      allAcceleratedPaidMonth = month;
      break;
    }
  }

  // Finalize per-debt projections
  orderedDebts.forEach((d) => {
    const months = payoffMonthMap.get(d.id) ?? null;
    const allocated = Math.round((firstMonthAllocated.get(d.id) ?? d.minimumMonthlyPayment) * 100) / 100;
    const monthlyInterest = d.remainingBalance * (Math.max(0, d.aprPct) / 100 / 12);

    if (months !== null) {
      byDebtId[d.id] = {
        ...byDebtId[d.id],
        monthsToPayoff: months,
        estimatedPayoffLabel: addMonthsLabel(months),
        monthlyAllocatedPayment: allocated,
        status: 'scheduled',
      };
    } else if (allocated <= monthlyInterest || allocated <= 0) {
      byDebtId[d.id] = {
        ...byDebtId[d.id],
        monthsToPayoff: null,
        estimatedPayoffLabel: labels.insufficient,
        monthlyAllocatedPayment: allocated,
        status: 'insufficient_surplus',
      };
    } else {
      byDebtId[d.id] = {
        ...byDebtId[d.id],
        monthsToPayoff: null,
        estimatedPayoffLabel: labels.beyondHorizon,
        monthlyAllocatedPayment: allocated,
        status: 'beyond_horizon',
      };
    }
  });

  const anyInsufficient = orderedDebts.some(
    (d) => byDebtId[d.id]?.status === 'insufficient_surplus'
  );

  return {
    totalOriginal,
    totalRemaining,
    totalRepaid,
    overallRepaidPct,
    overallMonthsToPayoff: allAcceleratedPaidMonth,
    overallDebtFreeLabel:
      allAcceleratedPaidMonth !== null
        ? addMonthsLabel(allAcceleratedPaidMonth)
        : anyInsufficient
          ? labels.insufficient
          : labels.beyondHorizon,
    overallStatus:
      allAcceleratedPaidMonth !== null
        ? 'scheduled'
        : anyInsufficient
          ? 'insufficient_surplus'
          : 'beyond_horizon',
    byDebtId,
    trajectory,
  };
}

interface DebtPayoffProps {
  debts: DebtAccount[];
  transactions: RecordedTransaction[];
  primaryCurrency: 'RWF' | 'USD';
  monthlyIncomeTarget: number;
  locale: Locale;
  formatAmount: (amount: number, currency: string) => string;
  onAddDebt: (debt: DebtAccount) => void;
  onRecordPayment: (debtId: string, paymentAmount: number) => void;
  onDeleteDebt: (debtId: string) => void;
  compact?: boolean;
  onViewAllDebts?: () => void;
}

export function DebtPayoff({
  debts,
  transactions,
  primaryCurrency,
  monthlyIncomeTarget,
  locale,
  formatAmount,
  onAddDebt,
  onRecordPayment,
  onDeleteDebt,
  compact = false,
  onViewAllDebts,
}: DebtPayoffProps) {
  const dp = translations[locale].dashboard.debtPayoff;

  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState('');
  const [debtType, setDebtType] = useState<DebtType>('loan');
  const [lender, setLender] = useState('');
  const [currency, setCurrency] = useState<'RWF' | 'USD'>(primaryCurrency);
  const [originalAmountInput, setOriginalAmountInput] = useState('');
  const [remainingBalanceInput, setRemainingBalanceInput] = useState('');
  const [aprInput, setAprInput] = useState('14');
  const [minPaymentInput, setMinPaymentInput] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [strategy, setStrategy] = useState<PayoffStrategy>('avalanche');
  const [extraBoostInput, setExtraBoostInput] = useState('');
  const [paymentInputs, setPaymentInputs] = useState<Record<string, string>>({});

  const surplusInfo = useMemo(
    () =>
      computeMonthlySurplus({
        transactions,
        primaryCurrency,
        monthlyIncomeTarget,
      }),
    [transactions, primaryCurrency, monthlyIncomeTarget]
  );

  const extraMonthlyBoost = useMemo(() => {
    const val = Number(extraBoostInput);
    return Number.isFinite(val) && val > 0 ? val : 0;
  }, [extraBoostInput]);

  const plan = useMemo(
    () =>
      computeDebtPayoffPlan({
        debts,
        monthlySurplus: surplusInfo.surplus,
        extraMonthlyPayment: extraMonthlyBoost,
        strategy,
        primaryCurrency,
        labels: {
          paidOff: dp.paidOffBadge,
          insufficient: dp.insufficientSurplus,
          beyondHorizon: dp.beyondHorizon,
        },
      }),
    [
      debts,
      surplusInfo.surplus,
      extraMonthlyBoost,
      strategy,
      primaryCurrency,
      dp.paidOffBadge,
      dp.insufficientSurplus,
      dp.beyondHorizon,
    ]
  );

  const handleCreateDebt = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    const origVal = Number(originalAmountInput);
    const remVal =
      remainingBalanceInput.trim() !== '' ? Number(remainingBalanceInput) : origVal;
    const aprVal = aprInput.trim() !== '' ? Number(aprInput) : 0;
    const minPayVal = minPaymentInput.trim() !== '' ? Number(minPaymentInput) : 0;

    if (
      !cleanName ||
      !Number.isFinite(origVal) ||
      origVal <= 0 ||
      !Number.isFinite(remVal) ||
      remVal < 0 ||
      !Number.isFinite(aprVal) ||
      aprVal < 0 ||
      aprVal > 100 ||
      !Number.isFinite(minPayVal) ||
      minPayVal < 0
    ) {
      setFormError(dp.errorValidation);
      return;
    }

    onAddDebt({
      id: `debt-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
      name: cleanName.slice(0, 100),
      debtType,
      lender: lender.trim().slice(0, 80) || undefined,
      originalAmount: Math.round(origVal * 100) / 100,
      remainingBalance: Math.round(remVal * 100) / 100,
      aprPct: Math.round(aprVal * 100) / 100,
      minimumMonthlyPayment: Math.round(minPayVal * 100) / 100,
      currency,
      createdAt: new Date().toISOString(),
    });

    setName('');
    setDebtType('loan');
    setLender('');
    setOriginalAmountInput('');
    setRemainingBalanceInput('');
    setAprInput('14');
    setMinPaymentInput('');
    setFormError(null);
    setFormOpen(false);
  };

  const handlePaymentSubmit = (debtId: string) => {
    const raw = Number(paymentInputs[debtId]);
    if (!Number.isFinite(raw) || raw <= 0) return;
    onRecordPayment(debtId, Math.round(raw * 100) / 100);
    setPaymentInputs((prev) => ({ ...prev, [debtId]: '' }));
  };

  const visibleDebts = compact ? debts.slice(0, 3) : debts;

  return (
    <section
      aria-label={dp.title}
      className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 dark:border-[#263449] dark:bg-[#0B1220]"
    >
      {/* Header */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400">
            <CreditCard className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
              {dp.title}
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-300">{dp.subtitle}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          {compact && onViewAllDebts && (
            <button
              type="button"
              onClick={onViewAllDebts}
              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-[#263449] dark:bg-[#162235] dark:text-slate-200 dark:hover:bg-[#1E2D45]"
            >
              <span>{dp.viewAllBtn}</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setFormOpen((v) => !v);
              setFormError(null);
            }}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#7C3AED] px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#6D28D9]"
          >
            {formOpen ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
            <span>{formOpen ? dp.closeForm : dp.addBtn}</span>
          </button>
        </div>
      </div>

      {/* Add Debt Form */}
      {formOpen && (
        <form
          onSubmit={handleCreateDebt}
          className="mt-5 rounded-xl border border-violet-200 bg-violet-50/50 p-4 dark:border-violet-500/30 dark:bg-violet-950/20"
        >
          <div className="mb-3 flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              {dp.quickTemplates}
            </span>
            {dp.templates.map((tpl) => (
              <button
                key={tpl.name}
                type="button"
                onClick={() => {
                  setName(tpl.name);
                  setDebtType(tpl.debtType as DebtType);
                  setAprInput(String(tpl.aprPct));
                  setFormError(null);
                }}
                className="rounded-lg border border-violet-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-[#6D28D9] transition-colors hover:bg-violet-100 dark:border-violet-500/30 dark:bg-[#0B1220] dark:text-violet-300 dark:hover:bg-violet-950/50"
              >
                + {tpl.name}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-200">
                {dp.nameLabel}
              </label>
              <input
                type="text"
                maxLength={100}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={dp.namePlaceholder}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-[#7C3AED] focus:outline-none dark:border-[#263449] dark:bg-[#0B1220] dark:text-white"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-200">
                {dp.typeLabel}
              </label>
              <select
                value={debtType}
                onChange={(e) => setDebtType(e.target.value as DebtType)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-[#7C3AED] focus:outline-none dark:border-[#263449] dark:bg-[#0B1220] dark:text-white"
              >
                <option value="loan">{dp.typeOptions.loan}</option>
                <option value="credit_card">{dp.typeOptions.credit_card}</option>
                <option value="mortgage">{dp.typeOptions.mortgage}</option>
                <option value="other">{dp.typeOptions.other}</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-200">
                {dp.lenderLabel}
              </label>
              <input
                type="text"
                maxLength={80}
                value={lender}
                onChange={(e) => setLender(e.target.value)}
                placeholder={dp.lenderPlaceholder}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-[#7C3AED] focus:outline-none dark:border-[#263449] dark:bg-[#0B1220] dark:text-white"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-200">
                {dp.currencyLabel}
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value as 'RWF' | 'USD')}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-[#7C3AED] focus:outline-none dark:border-[#263449] dark:bg-[#0B1220] dark:text-white"
              >
                <option value="RWF">RWF</option>
                <option value="USD">USD</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-200">
                {dp.originalAmountLabel}
              </label>
              <input
                type="number"
                min="1"
                step="any"
                value={originalAmountInput}
                onChange={(e) => setOriginalAmountInput(e.target.value)}
                placeholder="2000000"
                className="font-mono-num w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-[#7C3AED] focus:outline-none dark:border-[#263449] dark:bg-[#0B1220] dark:text-white"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-200">
                {dp.remainingBalanceLabel}
              </label>
              <input
                type="number"
                min="0"
                step="any"
                value={remainingBalanceInput}
                onChange={(e) => setRemainingBalanceInput(e.target.value)}
                placeholder="1450000"
                className="font-mono-num w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-[#7C3AED] focus:outline-none dark:border-[#263449] dark:bg-[#0B1220] dark:text-white"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-200">
                {dp.aprLabel}
              </label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={aprInput}
                onChange={(e) => setAprInput(e.target.value)}
                placeholder="14.5"
                className="font-mono-num w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-[#7C3AED] focus:outline-none dark:border-[#263449] dark:bg-[#0B1220] dark:text-white"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-200">
                {dp.minPaymentLabel}
              </label>
              <input
                type="number"
                min="0"
                step="any"
                value={minPaymentInput}
                onChange={(e) => setMinPaymentInput(e.target.value)}
                placeholder="85000"
                className="font-mono-num w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-[#7C3AED] focus:outline-none dark:border-[#263449] dark:bg-[#0B1220] dark:text-white"
              />
            </div>
          </div>

          {formError && (
            <p className="mt-2 text-xs font-semibold text-rose-600 dark:text-rose-400">
              {formError}
            </p>
          )}

          <div className="mt-4 flex justify-end">
            <button
              type="submit"
              className="rounded-xl bg-[#7C3AED] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#6D28D9]"
            >
              {dp.createBtn}
            </button>
          </div>
        </form>
      )}

      {/* Content */}
      {debts.length === 0 ? (
        <div className="mt-5 rounded-xl border border-dashed border-slate-200 bg-slate-50/70 p-6 text-center dark:border-[#263449] dark:bg-[#162235]/40">
          <CreditCard className="mx-auto h-7 w-7 text-rose-500" />
          <p className="mt-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
            {dp.emptyTitle}
          </p>
          <p className="mx-auto mt-1 max-w-md text-xs text-slate-500 dark:text-slate-400">
            {dp.emptyDesc}
          </p>
        </div>
      ) : (
        <div className="mt-5 space-y-5">
          {/* Summary Metrics + Surplus & Strategy Controls */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 dark:border-[#263449] dark:bg-[#162235]/60">
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                {dp.totalRemainingLabel}
              </p>
              <p className="font-mono-num mt-1 text-lg font-bold text-slate-900 dark:text-white">
                {formatAmount(plan.totalRemaining, primaryCurrency)}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 dark:border-[#263449] dark:bg-[#162235]/60">
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                {dp.totalRepaidLabel}
              </p>
              <p className="font-mono-num mt-1 text-lg font-bold text-[#16A34A] dark:text-emerald-400">
                {formatAmount(plan.totalRepaid, primaryCurrency)} ({plan.overallRepaidPct}%)
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 dark:border-[#263449] dark:bg-[#162235]/60">
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                {dp.monthlySurplusLabel}
              </p>
              <p className="font-mono-num mt-1 text-lg font-bold text-[#7C3AED] dark:text-violet-300">
                {formatAmount(surplusInfo.surplus + extraMonthlyBoost, primaryCurrency)}
              </p>
              <p className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">
                {surplusInfo.source === 'ledger'
                  ? dp.surplusSourceLedger
                  : surplusInfo.source === 'target'
                    ? dp.surplusSourceTarget
                    : dp.surplusSourceNone}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 dark:border-[#263449] dark:bg-[#162235]/60">
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                {dp.debtFreeDateLabel}
              </p>
              <p
                className={`font-mono-num mt-1 text-lg font-bold ${
                  plan.overallStatus === 'paid_off' || plan.overallStatus === 'scheduled'
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : 'text-amber-700 dark:text-amber-300'
                }`}
              >
                {plan.overallDebtFreeLabel}
                {plan.overallMonthsToPayoff !== null && plan.overallMonthsToPayoff > 0
                  ? ` · ${plan.overallMonthsToPayoff} ${dp.monthsUnit}`
                  : ''}
              </p>
            </div>
          </div>

          {/* Strategy & Extra Boost Controls + Recharts Payoff Curve */}
          {plan.totalRemaining > 0 && (
            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-[#263449] dark:bg-[#162235]/30">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div className="flex flex-wrap items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-[#16A34A]" />
                  <h3 className="font-display text-xs font-bold text-slate-900 dark:text-white sm:text-sm">
                    {dp.chartTitle}
                  </h3>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    {dp.strategyLabel}
                  </span>
                  <div
                    role="group"
                    aria-label={dp.strategyLabel}
                    className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 dark:border-[#263449] dark:bg-[#0B1220]"
                  >
                    <button
                      type="button"
                      onClick={() => setStrategy('avalanche')}
                      className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                        strategy === 'avalanche'
                          ? 'bg-[#7C3AED] text-white'
                          : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
                      }`}
                    >
                      {dp.strategyAvalanche}
                    </button>
                    <button
                      type="button"
                      onClick={() => setStrategy('snowball')}
                      className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                        strategy === 'snowball'
                          ? 'bg-[#7C3AED] text-white'
                          : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
                      }`}
                    >
                      {dp.strategySnowball}
                    </button>
                  </div>

                  <label className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 dark:border-[#263449] dark:bg-[#0B1220] dark:text-slate-200">
                    <span>+{dp.extraBoostLabel}:</span>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={extraBoostInput}
                      onChange={(e) => setExtraBoostInput(e.target.value)}
                      placeholder="0"
                      className="font-mono-num w-20 bg-transparent text-right text-xs font-bold text-[#7C3AED] focus:outline-none dark:text-violet-300"
                    />
                  </label>
                </div>
              </div>

              {plan.trajectory.length > 1 && (
                <div className="mt-3 h-52 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={plan.trajectory}
                      margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="debtSurplusGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#16A34A" stopOpacity={0.28} />
                          <stop offset="95%" stopColor="#16A34A" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#94A3B8" strokeOpacity={0.2} vertical={false} />
                      <XAxis
                        dataKey="label"
                        tick={{ fill: '#64748B', fontSize: 11 }}
                        tickLine={false}
                      />
                      <YAxis
                        tickFormatter={(val) => formatCompactMoney(Number(val), primaryCurrency)}
                        tick={{ fill: '#64748B', fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                        width={48}
                      />
                      <Tooltip
                        formatter={(value, name) => [
                          formatAmount(Number(value ?? 0), primaryCurrency),
                          name === 'withSurplus' ? dp.chartWithSurplus : dp.chartMinOnly,
                        ]}
                        contentStyle={{
                          borderRadius: '0.75rem',
                          fontSize: '12px',
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="minimumOnly"
                        name="minimumOnly"
                        stroke="#94A3B8"
                        strokeDasharray="4 4"
                        strokeWidth={2}
                        fill="none"
                      />
                      <Area
                        type="monotone"
                        dataKey="withSurplus"
                        name="withSurplus"
                        stroke="#16A34A"
                        strokeWidth={2.5}
                        fillOpacity={1}
                        fill="url(#debtSurplusGrad)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}

          {/* Individual Loan & Credit Card Progress Cards */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {visibleDebts.map((debt) => {
              const proj = plan.byDebtId[debt.id];
              const paidSoFar = proj?.paidSoFar ?? Math.max(0, debt.originalAmount - debt.remainingBalance);
              const pct = proj?.repaymentPct ?? 0;
              const isPaidOff = proj?.isPaidOff ?? debt.remainingBalance <= 0;
              const TypeIcon = debt.debtType === 'credit_card' ? CreditCard : Landmark;

              return (
                <div
                  key={debt.id}
                  className={`flex flex-col justify-between rounded-2xl border p-4 transition-colors ${
                    isPaidOff
                      ? 'border-emerald-200 bg-emerald-50/30 dark:border-emerald-500/30 dark:bg-emerald-950/15'
                      : 'border-slate-200 bg-slate-50/70 dark:border-[#263449] dark:bg-[#162235]/50'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <div
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                            debt.debtType === 'credit_card'
                              ? 'bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400'
                              : 'bg-violet-100 text-[#7C3AED] dark:bg-violet-950/60 dark:text-violet-300'
                          }`}
                        >
                          <TypeIcon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <h3 className="truncate text-sm font-bold text-slate-900 dark:text-white">
                              {debt.name}
                            </h3>
                            <span className="font-mono-num rounded bg-slate-200/80 px-1.5 py-0.5 text-[10px] font-bold text-slate-700 dark:bg-[#263449] dark:text-slate-200">
                              {debt.aprPct}% APR
                            </span>
                          </div>
                          <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                            {dp.typeOptions[debt.debtType]}
                            {debt.lender ? ` · ${debt.lender}` : ''}
                          </p>
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-1.5">
                        <span
                          className={`font-mono-num inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold ${
                            isPaidOff
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                              : 'bg-violet-100 text-[#6D28D9] dark:bg-violet-950/60 dark:text-violet-300'
                          }`}
                        >
                          {isPaidOff && <CheckCircle2 className="h-3 w-3" />}
                          <span>{isPaidOff ? dp.paidOffBadge : `${pct}%`}</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => onDeleteDebt(debt.id)}
                          title={dp.deleteTitle}
                          aria-label={`${dp.deleteTitle}: ${debt.name}`}
                          className="rounded-lg p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Repayment Progress Bar */}
                    <div className="mt-3.5">
                      <div className="flex items-baseline justify-between gap-2 text-xs">
                        <span className="font-mono-num font-bold text-slate-900 dark:text-white">
                          {formatAmount(paidSoFar, debt.currency)}{' '}
                          <span className="font-normal text-slate-500 dark:text-slate-400">
                            {dp.repaidOfLabel} {formatAmount(debt.originalAmount, debt.currency)}
                          </span>
                        </span>
                        <span className="font-mono-num text-[11px] font-semibold text-rose-600 dark:text-rose-400">
                          {formatAmount(debt.remainingBalance, debt.currency)} {dp.remainingShort}
                        </span>
                      </div>
                      <div
                        role="progressbar"
                        aria-valuenow={pct}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`${debt.name} repayment progress`}
                        className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-slate-200/80 dark:bg-[#0B1220]"
                      >
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            isPaidOff ? 'bg-[#16A34A]' : 'bg-[#7C3AED]'
                          }`}
                          style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
                        />
                      </div>
                    </div>

                    {/* Estimated Payoff Date & Monthly Allocation */}
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200/80 bg-white px-3 py-2 text-[11px] dark:border-[#263449] dark:bg-[#0B1220]">
                      <span className="inline-flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-200">
                        <Calendar className="h-3.5 w-3.5 text-[#7C3AED]" />
                        <span>{dp.estPayoffLabel}</span>
                        <span
                          className={`font-mono-num font-bold ${
                            proj?.status === 'insufficient_surplus'
                              ? 'text-amber-700 dark:text-amber-300'
                              : 'text-emerald-700 dark:text-emerald-400'
                          }`}
                        >
                          {proj?.estimatedPayoffLabel ?? dp.beyondHorizon}
                          {proj?.monthsToPayoff && proj.monthsToPayoff > 0
                            ? ` (${proj.monthsToPayoff} ${dp.monthsUnit})`
                            : ''}
                        </span>
                      </span>

                      {!isPaidOff && proj && proj.monthlyAllocatedPayment > 0 && (
                        <span className="font-mono-num text-slate-500 dark:text-slate-400">
                          {dp.monthlyPlanLabel}{' '}
                          <strong className="text-slate-800 dark:text-slate-100">
                            {formatAmount(proj.monthlyAllocatedPayment, debt.currency)}
                          </strong>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Quick Payment Form */}
                  {!isPaidOff && (
                    <div className="mt-3 flex items-center gap-2 border-t border-slate-200/80 pt-3 dark:border-[#263449]">
                      <input
                        type="number"
                        min="1"
                        step="any"
                        value={paymentInputs[debt.id] ?? ''}
                        onChange={(e) =>
                          setPaymentInputs((prev) => ({
                            ...prev,
                            [debt.id]: e.target.value,
                          }))
                        }
                        placeholder={`${dp.payPlaceholder} (${debt.currency})`}
                        className="font-mono-num min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-[#7C3AED] focus:outline-none dark:border-[#263449] dark:bg-[#0B1220] dark:text-white"
                      />
                      <button
                        type="button"
                        onClick={() => handlePaymentSubmit(debt.id)}
                        className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-[#16A34A] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#15803D]"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>{dp.recordPaymentBtn}</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
