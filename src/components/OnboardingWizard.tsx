import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Globe,
  Landmark,
  PiggyBank,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
  Target,
  Wallet,
  X,
} from 'lucide-react';
import { translations, type Locale } from '../i18n/translations';

export interface LinkedAccountConfig {
  id: string;
  name: string;
  type: string;
  currency: string;
  status: string;
  providerLabel: string;
  openingBalance: number;
  enabled: boolean;
}

export interface BudgetAllocation {
  category: string;
  monthlyLimit: number;
  enabled: boolean;
}

export interface OnboardingResult {
  primaryCurrency: 'RWF' | 'USD';
  monthlyIncomeTarget: number;
  accounts: LinkedAccountConfig[];
  budgets: BudgetAllocation[];
}

interface OnboardingWizardProps {
  open: boolean;
  userName: string;
  locale: Locale;
  initialCurrency?: 'RWF' | 'USD';
  initialMonthlyIncome?: number;
  initialAccounts?: LinkedAccountConfig[];
  initialBudgets?: BudgetAllocation[];
  onComplete: (result: OnboardingResult) => void;
  onSkip: () => void;
}

const PRESET_WEIGHTS: Record<number, number> = {
  0: 0.25, // Food
  1: 0.12, // Transport
  2: 0.30, // Housing
  3: 0.08, // Education
  4: 0.07, // Healthcare
  5: 0.10, // Utilities
  6: 0.05, // Communication
  7: 0.03, // Entertainment
};

export function OnboardingWizard({
  open,
  userName,
  locale,
  initialCurrency = 'RWF',
  initialMonthlyIncome = 0,
  initialAccounts,
  initialBudgets,
  onComplete,
  onSkip,
}: OnboardingWizardProps) {
  const d = translations[locale].dashboard;
  const ow = d.onboardingWizard;
  const categories = d.transactionModal.expenseCategories;

  const [step, setStep] = useState<number>(0);
  const [primaryCurrency, setPrimaryCurrency] = useState<'RWF' | 'USD'>(initialCurrency);
  const [monthlyIncomeInput, setMonthlyIncomeInput] = useState<string>(
    initialMonthlyIncome > 0 ? String(initialMonthlyIncome) : ''
  );
  const [accounts, setAccounts] = useState<LinkedAccountConfig[]>(() =>
    initialAccounts && initialAccounts.length > 0
      ? initialAccounts
      : d.accountTypes.map((acc, idx) => ({
          id: acc.id,
          name: acc.name,
          type: acc.type,
          currency: acc.currency,
          status: acc.status,
          providerLabel: '',
          openingBalance: 0,
          enabled: idx < 3,
        }))
  );
  const [budgets, setBudgets] = useState<BudgetAllocation[]>(() =>
    initialBudgets && initialBudgets.length > 0
      ? initialBudgets
      : categories.slice(0, 6).map((cat, idx) => ({
          category: cat,
          monthlyLimit: 0,
          enabled: idx < 4,
        }))
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setStep(0);
    setError(null);
    if (initialAccounts && initialAccounts.length > 0) {
      setAccounts(initialAccounts);
    }
    if (initialBudgets && initialBudgets.length > 0) {
      setBudgets(initialBudgets);
    }
  }, [open, initialAccounts, initialBudgets]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onSkip();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onSkip]);

  if (!open) return null;

  const accountIconMap: Record<string, typeof Wallet> = {
    cash: Wallet,
    bank: Landmark,
    momo: Smartphone,
    savings: PiggyBank,
    fx: Globe,
  };

  const parsedMonthlyIncome = Math.max(0, Number(monthlyIncomeInput) || 0);
  const enabledAccounts = accounts.filter((acc) => acc.enabled);
  const enabledBudgets = budgets.filter((b) => b.enabled);
  const totalBudgeted = enabledBudgets.reduce((sum, b) => sum + Math.max(0, b.monthlyLimit), 0);
  const projectedSavings = parsedMonthlyIncome - totalBudgeted;

  const formatMoney = (val: number, cur: string = primaryCurrency) =>
    cur === 'USD'
      ? `${new Intl.NumberFormat('en-US', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(val)} USD`
      : `${new Intl.NumberFormat('en-US').format(val)} RWF`;

  const toggleAccount = (id: string) => {
    setError(null);
    setAccounts((prev) =>
      prev.map((acc) => (acc.id === id ? { ...acc, enabled: !acc.enabled } : acc))
    );
  };

  const updateAccountField = (
    id: string,
    field: 'providerLabel' | 'openingBalance',
    value: string
  ) => {
    setAccounts((prev) =>
      prev.map((acc) => {
        if (acc.id !== id) return acc;
        if (field === 'openingBalance') {
          const parsed = Math.max(0, Number(value) || 0);
          return { ...acc, openingBalance: parsed };
        }
        return { ...acc, providerLabel: value };
      })
    );
  };

  const toggleBudgetCategory = (category: string) => {
    setError(null);
    setBudgets((prev) => {
      const exists = prev.some((b) => b.category === category);
      if (exists) {
        return prev.map((b) => (b.category === category ? { ...b, enabled: !b.enabled } : b));
      }
      return [...prev, { category, monthlyLimit: 0, enabled: true }];
    });
  };

  const updateBudgetLimit = (category: string, value: string) => {
    const parsed = Math.max(0, Number(value) || 0);
    setError(null);
    setBudgets((prev) =>
      prev.map((b) => (b.category === category ? { ...b, monthlyLimit: parsed } : b))
    );
  };

  const applyStarterPresets = () => {
    const basePool =
      parsedMonthlyIncome > 0
        ? Math.round(parsedMonthlyIncome * 0.75)
        : primaryCurrency === 'USD'
          ? 1000
          : 300000;

    setBudgets(
      categories.map((cat, idx) => {
        const weight = PRESET_WEIGHTS[idx] ?? 0;
        const raw = basePool * weight;
        const rounded =
          primaryCurrency === 'USD'
            ? Math.round(raw)
            : Math.round(raw / 5000) * 5000;
        return {
          category: cat,
          monthlyLimit: weight > 0 ? rounded : 0,
          enabled: weight > 0,
        };
      })
    );
    setError(null);
  };

  const handleNext = () => {
    setError(null);
    if (step === 1 && enabledAccounts.length === 0) {
      setError(ow.accountsStep.errorAtLeastOne);
      return;
    }
    if (step < ow.steps.length - 1) {
      setStep((s) => s + 1);
    }
  };

  const handleComplete = () => {
    onComplete({
      primaryCurrency,
      monthlyIncomeTarget: parsedMonthlyIncome,
      accounts: accounts.map((acc) => ({
        ...acc,
        status: acc.enabled ? (locale === 'rw' ? 'Yahujwe' : 'Linked') : acc.status,
      })),
      budgets: budgets.filter((b) => b.enabled && b.monthlyLimit > 0),
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-wizard-title"
    >
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-[#263449] dark:bg-[#0B1220]">
        {/* Header */}
        <div className="border-b border-slate-200 px-6 py-5 dark:border-[#263449]">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-[#7C3AED] dark:bg-violet-950/60">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[11px] font-semibold tracking-wider text-[#7C3AED] uppercase">
                  {ow.badge}
                </p>
                <h2
                  id="onboarding-wizard-title"
                  className="font-display text-lg font-bold text-slate-900 dark:text-white"
                >
                  {ow.title}, {userName}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">{ow.subtitle}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onSkip}
              aria-label={ow.skip}
              className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-[#162235] dark:hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Stepper */}
          <nav aria-label="Onboarding progress" className="mt-5 grid grid-cols-4 gap-2">
            {ow.steps.map((st, idx) => {
              const isCompleted = idx < step;
              const isCurrent = idx === step;
              return (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => {
                    if (idx <= step) {
                      setError(null);
                      setStep(idx);
                    }
                  }}
                  disabled={idx > step}
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs font-semibold transition-colors ${
                    isCurrent
                      ? 'border-[#7C3AED] bg-violet-50 text-[#6D28D9] dark:bg-violet-950/40 dark:text-violet-300'
                      : isCompleted
                        ? 'border-emerald-300 bg-emerald-50/70 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-950/30 dark:text-emerald-300'
                        : 'border-slate-200 bg-slate-50 text-slate-400 dark:border-[#263449] dark:bg-[#162235]/40 dark:text-slate-500'
                  }`}
                >
                  <span
                    className={`font-mono-num flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                      isCurrent
                        ? 'bg-[#7C3AED] text-white'
                        : isCompleted
                          ? 'bg-[#16A34A] text-white'
                          : 'bg-slate-200 text-slate-600 dark:bg-[#263449] dark:text-slate-400'
                    }`}
                  >
                    {isCompleted ? <Check className="h-3 w-3" /> : idx + 1}
                  </span>
                  <span className="truncate">{st.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {/* Step 1: Financial Baseline */}
          {step === 0 && (
            <div className="space-y-5">
              <div>
                <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                  {ow.profileStep.heading}
                </h3>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                  {ow.profileStep.desc}
                </p>
              </div>

              <div>
                <span className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                  {ow.profileStep.currencyLabel}
                </span>
                <div className="mt-2 grid grid-cols-2 gap-3">
                  {(['RWF', 'USD'] as const).map((cur) => (
                    <button
                      key={cur}
                      type="button"
                      onClick={() => setPrimaryCurrency(cur)}
                      className={`flex items-center justify-between rounded-xl border px-4 py-3 text-sm font-semibold transition-colors ${
                        primaryCurrency === cur
                          ? 'border-[#7C3AED] bg-violet-50 text-[#6D28D9] dark:bg-violet-950/40 dark:text-violet-300'
                          : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-[#263449] dark:bg-[#162235] dark:text-slate-200'
                      }`}
                    >
                      <span className="font-mono-num">{cur}</span>
                      {primaryCurrency === cur && <Check className="h-4 w-4 text-[#7C3AED]" />}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label
                  htmlFor="onboarding-monthly-income"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-200"
                >
                  {ow.profileStep.monthlyIncomeLabel} ({primaryCurrency})
                </label>
                <input
                  id="onboarding-monthly-income"
                  type="number"
                  min="0"
                  step={primaryCurrency === 'RWF' ? '1000' : '10'}
                  value={monthlyIncomeInput}
                  onChange={(e) => setMonthlyIncomeInput(e.target.value)}
                  placeholder={primaryCurrency === 'RWF' ? '450000' : '1500'}
                  className="font-mono-num mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#7C3AED] focus:outline-none dark:border-[#263449] dark:bg-[#162235] dark:text-slate-100"
                />
                <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                  {ow.profileStep.monthlyIncomeHint}
                </p>
              </div>
            </div>
          )}

          {/* Step 2: Link Accounts */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                    {ow.accountsStep.heading}
                  </h3>
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                    {ow.accountsStep.desc}
                  </p>
                </div>
                <span className="font-mono-num text-xs font-semibold text-[#7C3AED]">
                  {enabledAccounts.length} / {accounts.length} {ow.accountsStep.selectedCount}
                </span>
              </div>

              <div className="space-y-3">
                {accounts.map((acc) => {
                  const Icon = accountIconMap[acc.id] ?? Wallet;
                  return (
                    <div
                      key={acc.id}
                      className={`rounded-xl border p-4 transition-colors ${
                        acc.enabled
                          ? 'border-[#7C3AED]/60 bg-violet-50/40 dark:border-[#7C3AED]/50 dark:bg-violet-950/20'
                          : 'border-slate-200 bg-slate-50/60 opacity-75 dark:border-[#263449] dark:bg-[#162235]/40'
                      }`}
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <label className="flex cursor-pointer items-center gap-3">
                          <input
                            type="checkbox"
                            checked={acc.enabled}
                            onChange={() => toggleAccount(acc.id)}
                            className="h-4 w-4 rounded border-slate-300 text-[#7C3AED] focus:ring-[#7C3AED]"
                          />
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-[#7C3AED] dark:bg-violet-950/60">
                            <Icon className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-900 dark:text-white">
                              {acc.name}
                            </p>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                              {acc.type} · {acc.currency}
                            </p>
                          </div>
                        </label>

                        {acc.enabled && (
                          <div className="grid grid-cols-1 gap-2 sm:w-80 sm:grid-cols-2">
                            <input
                              type="text"
                              value={acc.providerLabel}
                              onChange={(e) =>
                                updateAccountField(acc.id, 'providerLabel', e.target.value)
                              }
                              placeholder={ow.accountsStep.providerPlaceholder}
                              aria-label={`${acc.name} provider`}
                              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#7C3AED] focus:outline-none dark:border-[#263449] dark:bg-[#0B1220] dark:text-slate-100"
                            />
                            <div className="relative">
                              <input
                                type="number"
                                min="0"
                                step={acc.currency === 'USD' ? '0.01' : '1'}
                                value={acc.openingBalance === 0 ? '' : acc.openingBalance}
                                onChange={(e) =>
                                  updateAccountField(acc.id, 'openingBalance', e.target.value)
                                }
                                placeholder={`${ow.accountsStep.openingBalanceLabel} (${acc.currency})`}
                                aria-label={`${acc.name} ${ow.accountsStep.openingBalanceLabel}`}
                                className="font-mono-num w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#7C3AED] focus:outline-none dark:border-[#263449] dark:bg-[#0B1220] dark:text-slate-100"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 3: Initial Budget Setup */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                    {ow.budgetStep.heading}
                  </h3>
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                    {ow.budgetStep.desc}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={applyStarterPresets}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-[#6D28D9] transition-colors hover:bg-violet-100 dark:border-violet-500/30 dark:bg-violet-950/40 dark:text-violet-300"
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  <span>{ow.budgetStep.presetRecommended}</span>
                </button>
              </div>

              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {categories.map((cat) => {
                  const entry = budgets.find((b) => b.category === cat) ?? {
                    category: cat,
                    monthlyLimit: 0,
                    enabled: false,
                  };
                  return (
                    <div
                      key={cat}
                      className={`flex items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 transition-colors ${
                        entry.enabled
                          ? 'border-[#7C3AED]/50 bg-violet-50/40 dark:border-[#7C3AED]/40 dark:bg-violet-950/20'
                          : 'border-slate-200 bg-slate-50/60 dark:border-[#263449] dark:bg-[#162235]/40'
                      }`}
                    >
                      <label className="flex min-w-0 cursor-pointer items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={entry.enabled}
                          onChange={() => toggleBudgetCategory(cat)}
                          aria-label={`${ow.budgetStep.categoryToggle}: ${cat}`}
                          className="h-4 w-4 rounded border-slate-300 text-[#7C3AED] focus:ring-[#7C3AED]"
                        />
                        <span className="truncate text-xs font-semibold text-slate-800 dark:text-slate-100">
                          {cat}
                        </span>
                      </label>

                      <input
                        type="number"
                        min="0"
                        step={primaryCurrency === 'RWF' ? '1000' : '5'}
                        disabled={!entry.enabled}
                        value={entry.monthlyLimit === 0 ? '' : entry.monthlyLimit}
                        onChange={(e) => updateBudgetLimit(cat, e.target.value)}
                        placeholder={`0 ${primaryCurrency}`}
                        aria-label={`${cat} ${ow.budgetStep.limitLabel}`}
                        className="font-mono-num w-32 shrink-0 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-right text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#7C3AED] focus:outline-none disabled:opacity-45 dark:border-[#263449] dark:bg-[#0B1220] dark:text-slate-100"
                      />
                    </div>
                  );
                })}
              </div>

              <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2 dark:border-[#263449] dark:bg-[#162235]/60">
                <div>
                  <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    {ow.budgetStep.totalAllocated}
                  </p>
                  <p className="font-mono-num mt-1 text-base font-bold text-slate-900 dark:text-white">
                    {formatMoney(totalBudgeted)}
                  </p>
                </div>
                {parsedMonthlyIncome > 0 && (
                  <div>
                    <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                      {ow.budgetStep.projectedSavings}
                    </p>
                    <p
                      className={`font-mono-num mt-1 text-base font-bold ${
                        projectedSavings >= 0
                          ? 'text-[#16A34A]'
                          : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {formatMoney(projectedSavings)}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 4: Review & Confirm */}
          {step === 3 && (
            <div className="space-y-5">
              <div>
                <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                  {ow.reviewStep.heading}
                </h3>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                  {ow.reviewStep.desc}
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {/* Linked Accounts Summary */}
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-[#263449] dark:bg-[#162235]/50">
                  <div className="flex items-center gap-2">
                    <Landmark className="h-4 w-4 text-[#7C3AED]" />
                    <h4 className="font-display text-xs font-bold text-slate-900 uppercase dark:text-white">
                      {ow.reviewStep.accountsSummary} ({enabledAccounts.length})
                    </h4>
                  </div>
                  <ul className="mt-3 space-y-2">
                    {enabledAccounts.map((acc) => (
                      <li
                        key={acc.id}
                        className="flex items-center justify-between gap-2 border-b border-slate-200/70 pb-2 text-xs last:border-b-0 last:pb-0 dark:border-[#263449]"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-slate-900 dark:text-white">
                            {acc.name}
                          </p>
                          {acc.providerLabel && (
                            <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                              {acc.providerLabel}
                            </p>
                          )}
                        </div>
                        <span className="font-mono-num shrink-0 font-bold text-slate-900 dark:text-white">
                          {formatMoney(acc.openingBalance, acc.currency)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Budget Summary */}
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-[#263449] dark:bg-[#162235]/50">
                  <div className="flex items-center gap-2">
                    <Target className="h-4 w-4 text-[#7C3AED]" />
                    <h4 className="font-display text-xs font-bold text-slate-900 uppercase dark:text-white">
                      {ow.reviewStep.budgetSummary}
                    </h4>
                  </div>

                  {parsedMonthlyIncome > 0 && (
                    <div className="mt-3 flex items-center justify-between border-b border-slate-200 pb-2 text-xs dark:border-[#263449]">
                      <span className="text-slate-500 dark:text-slate-400">
                        {ow.reviewStep.monthlyTarget}
                      </span>
                      <span className="font-mono-num font-bold text-[#16A34A]">
                        {formatMoney(parsedMonthlyIncome)}
                      </span>
                    </div>
                  )}

                  <ul className="mt-3 space-y-2">
                    {enabledBudgets
                      .filter((b) => b.monthlyLimit > 0)
                      .map((b) => (
                        <li
                          key={b.category}
                          className="flex items-center justify-between gap-2 text-xs"
                        >
                          <span className="text-slate-700 dark:text-slate-200">{b.category}</span>
                          <span className="font-mono-num font-semibold text-slate-900 dark:text-white">
                            {formatMoney(b.monthlyLimit)}
                          </span>
                        </li>
                      ))}
                  </ul>

                  <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-2.5 text-xs font-bold dark:border-[#263449]">
                    <span className="text-slate-800 dark:text-slate-100">
                      {ow.budgetStep.totalAllocated}
                    </span>
                    <span className="font-mono-num text-[#7C3AED]">
                      {formatMoney(totalBudgeted)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-700 dark:border-rose-500/30 dark:bg-rose-950/40 dark:text-rose-300">
              {error}
            </div>
          )}
        </div>

        {/* Footer Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50/70 px-6 py-4 dark:border-[#263449] dark:bg-[#0B1220]">
          <button
            type="button"
            onClick={onSkip}
            className="text-xs font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
          >
            {ow.skip}
          </button>

          <div className="flex items-center gap-2.5">
            {step > 0 && (
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setStep((s) => s - 1);
                }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-[#263449] dark:bg-[#162235] dark:text-slate-200"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>{ow.back}</span>
              </button>
            )}

            {step < ow.steps.length - 1 ? (
              <button
                type="button"
                onClick={handleNext}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#7C3AED] px-5 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#6D28D9]"
              >
                <span>{ow.next}</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleComplete}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#16A34A] px-5 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#15803D]"
              >
                <Check className="h-3.5 w-3.5" />
                <span>{ow.finish}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
