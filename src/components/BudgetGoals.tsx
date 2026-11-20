import { useMemo, useState } from 'react';
import {
  ArrowRight,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Landmark,
  Link2,
  PiggyBank,
  Plus,
  Receipt,
  Tag,
  Target,
  Trash2,
  X,
} from 'lucide-react';
import { translations, type Locale } from '../i18n/translations';
import type { LinkedAccountConfig } from './OnboardingWizard';
import type { RecordedTransaction } from './TransactionInput';

export interface SavingsGoal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  currency: 'RWF' | 'USD';
  targetDate?: string;
  linkedAccountId?: string;
  linkedAccountName?: string;
  linkedCategory?: string;
  createdAt: string;
}

export interface GoalProgressComputation {
  linkedTransactions: RecordedTransaction[];
  linkedTxTotal: number;
  effectiveSaved: number;
  rawPct: number;
  pct: number;
  completed: boolean;
  remaining: number;
}

export function computeGoalProgress(
  goal: SavingsGoal,
  transactions: RecordedTransaction[]
): GoalProgressComputation {
  const linkedTransactions = transactions.filter((tx) => {
    if (tx.goalId && tx.goalId === goal.id) return true;
    if (
      !tx.goalId &&
      goal.linkedCategory &&
      tx.category.toLowerCase() === goal.linkedCategory.toLowerCase()
    ) {
      return true;
    }
    return false;
  });

  const linkedTxTotal = linkedTransactions
    .filter((tx) => tx.currency === goal.currency)
    .reduce((sum, tx) => sum + tx.amount, 0);

  const effectiveSaved = Math.round((goal.currentAmount + linkedTxTotal) * 100) / 100;
  const rawPct = goal.targetAmount > 0 ? (effectiveSaved / goal.targetAmount) * 100 : 0;
  const pct = Math.max(0, Math.min(100, rawPct));
  const completed = goal.targetAmount > 0 && effectiveSaved >= goal.targetAmount;
  const remaining = Math.max(0, Math.round((goal.targetAmount - effectiveSaved) * 100) / 100);

  return {
    linkedTransactions,
    linkedTxTotal,
    effectiveSaved,
    rawPct,
    pct,
    completed,
    remaining,
  };
}

interface BudgetGoalsProps {
  goals: SavingsGoal[];
  transactions: RecordedTransaction[];
  accounts: LinkedAccountConfig[];
  primaryCurrency: 'RWF' | 'USD';
  locale: Locale;
  formatAmount: (amount: number, currency: string) => string;
  onAddGoal: (goal: SavingsGoal) => void;
  onContributeGoal: (goalId: string, amount: number) => void;
  onDeleteGoal: (goalId: string) => void;
  onRecordLinkedTransaction?: (goal: SavingsGoal) => void;
  compact?: boolean;
  onViewAllGoals?: () => void;
}

interface CircularProgressRingProps {
  percent: number;
  completed: boolean;
  label: string;
}

function CircularProgressRing({ percent, completed, label }: CircularProgressRingProps) {
  const size = 76;
  const strokeWidth = 7;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, percent));
  const strokeDashoffset = circumference - (clamped / 100) * circumference;

  return (
    <div
      className="relative inline-flex shrink-0 items-center justify-center"
      role="img"
      aria-label={label}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          strokeWidth={strokeWidth}
          className="stroke-slate-100 dark:stroke-[#162235]"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className={`transition-all duration-500 ease-out ${
            completed ? 'stroke-[#16A34A]' : clamped >= 75 ? 'stroke-amber-500' : 'stroke-[#7C3AED]'
          }`}
        />
      </svg>
      <span
        className={`font-mono-num absolute text-xs font-bold ${
          completed ? 'text-[#16A34A]' : 'text-slate-900 dark:text-white'
        }`}
      >
        {Math.round(clamped)}%
      </span>
    </div>
  );
}

export function BudgetGoals({
  goals,
  transactions,
  accounts,
  primaryCurrency,
  locale,
  formatAmount,
  onAddGoal,
  onContributeGoal,
  onDeleteGoal,
  onRecordLinkedTransaction,
  compact = false,
  onViewAllGoals,
}: BudgetGoalsProps) {
  const d = translations[locale].dashboard;
  const bg = d.budgetGoals;
  const tm = d.transactionModal;

  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState('');
  const [targetAmountInput, setTargetAmountInput] = useState('');
  const [initialSavedInput, setInitialSavedInput] = useState('');
  const [currency, setCurrency] = useState<'RWF' | 'USD'>(primaryCurrency);
  const [linkedAccountId, setLinkedAccountId] = useState('');
  const [linkedCategory, setLinkedCategory] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [contributionInputs, setContributionInputs] = useState<Record<string, string>>({});
  const [expandedGoalIds, setExpandedGoalIds] = useState<Set<string>>(() => new Set());

  const availableCategories = useMemo(() => {
    const base = [...tm.incomeCategories, ...tm.expenseCategories];
    const fromTx = transactions.map((tx) => tx.category);
    return Array.from(new Set([...base, ...fromTx]));
  }, [tm.incomeCategories, tm.expenseCategories, transactions]);

  const handleCreateGoal = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    const targetVal = Number(targetAmountInput);
    const savedVal = initialSavedInput.trim() !== '' ? Math.max(0, Number(initialSavedInput)) : 0;

    if (!cleanName || !Number.isFinite(targetVal) || targetVal <= 0 || !Number.isFinite(savedVal)) {
      setFormError(bg.errorValidation);
      return;
    }

    const linkedAcc = accounts.find((a) => a.id === linkedAccountId);
    onAddGoal({
      id: `goal-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
      name: cleanName,
      targetAmount: Math.round(targetVal * 100) / 100,
      currentAmount: Math.round(savedVal * 100) / 100,
      currency,
      targetDate: targetDate || undefined,
      linkedAccountId: linkedAcc?.id,
      linkedAccountName: linkedAcc?.name,
      linkedCategory: linkedCategory || undefined,
      createdAt: new Date().toISOString(),
    });

    setName('');
    setTargetAmountInput('');
    setInitialSavedInput('');
    setLinkedAccountId('');
    setLinkedCategory('');
    setTargetDate('');
    setFormError(null);
    setFormOpen(false);
  };

  const handleContributionSubmit = (goalId: string) => {
    const raw = contributionInputs[goalId] ?? '';
    const amount = Number(raw);
    if (!Number.isFinite(amount) || amount <= 0) return;

    onContributeGoal(goalId, Math.round(amount * 100) / 100);
    setContributionInputs((prev) => ({ ...prev, [goalId]: '' }));
  };

  const toggleGoalTransactions = (goalId: string) => {
    setExpandedGoalIds((prev) => {
      const next = new Set(prev);
      if (next.has(goalId)) next.delete(goalId);
      else next.add(goalId);
      return next;
    });
  };

  const goalComputations = useMemo(() => {
    const map = new Map<string, GoalProgressComputation>();
    goals.forEach((g) => {
      map.set(g.id, computeGoalProgress(g, transactions));
    });
    return map;
  }, [goals, transactions]);

  const primaryCurrencyGoals = goals.filter((g) => g.currency === primaryCurrency);
  const totalSavedPrimary = primaryCurrencyGoals.reduce((sum, g) => {
    const progress = goalComputations.get(g.id);
    return sum + (progress ? progress.effectiveSaved : g.currentAmount);
  }, 0);
  const totalTargetPrimary = primaryCurrencyGoals.reduce((sum, g) => sum + g.targetAmount, 0);
  const overallPercent =
    totalTargetPrimary > 0
      ? Math.min(100, Math.round((totalSavedPrimary / totalTargetPrimary) * 100))
      : 0;

  const displayedGoals = compact ? goals.slice(0, 4) : goals;

  return (
    <section
      aria-label={bg.title}
      className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 dark:border-[#263449] dark:bg-[#0B1220]"
    >
      {/* Header */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-[#7C3AED]" />
            <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
              {bg.title}
            </h2>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{bg.subtitle}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {compact && onViewAllGoals && goals.length > 0 && (
            <button
              type="button"
              onClick={onViewAllGoals}
              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-[#263449] dark:text-slate-200 dark:hover:bg-[#162235]"
            >
              <span>{bg.viewAllGoals}</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setFormOpen((prev) => !prev);
              setFormError(null);
            }}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#7C3AED] px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#6D28D9]"
          >
            {formOpen ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
            <span>{formOpen ? bg.closeForm : bg.addGoal}</span>
          </button>
        </div>
      </div>

      {/* Summary Strip in Full View */}
      {!compact && goals.length > 0 && (
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-[#263449] dark:bg-[#162235]/50">
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              {bg.activeGoalsLabel}
            </p>
            <p className="font-mono-num mt-1 text-xl font-bold text-slate-900 dark:text-white">
              {goals.length}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-[#263449] dark:bg-[#162235]/50">
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              {bg.totalSavedLabel}
            </p>
            <p className="font-mono-num mt-1 text-xl font-bold text-[#16A34A]">
              {formatAmount(totalSavedPrimary, primaryCurrency)}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-[#263449] dark:bg-[#162235]/50">
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              {bg.combinedTargetLabel}
            </p>
            <p className="font-mono-num mt-1 text-xl font-bold text-slate-900 dark:text-white">
              {formatAmount(totalTargetPrimary, primaryCurrency)}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-[#263449] dark:bg-[#162235]/50">
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              {bg.overallProgressLabel}
            </p>
            <p className="font-mono-num mt-1 text-xl font-bold text-[#7C3AED]">
              {overallPercent}%
            </p>
          </div>
        </div>
      )}

      {/* New Financial Goal Form */}
      {formOpen && (
        <form
          onSubmit={handleCreateGoal}
          className="mt-5 space-y-4 rounded-xl border border-violet-200 bg-violet-50/50 p-4 dark:border-violet-500/30 dark:bg-[#162235]/70"
        >
          {/* Quick Goal Preset Chips */}
          <div>
            <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
              {bg.quickTemplatesLabel}
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {bg.quickTemplates.map((tpl) => (
                <button
                  key={tpl}
                  type="button"
                  onClick={() => {
                    setName(tpl);
                    setFormError(null);
                  }}
                  className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                    name.trim().toLowerCase() === tpl.toLowerCase()
                      ? 'border-[#7C3AED] bg-[#7C3AED] text-white'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-violet-300 dark:border-[#263449] dark:bg-[#0B1220] dark:text-slate-200'
                  }`}
                >
                  {tpl}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label
                htmlFor="goal-name"
                className="block text-[11px] font-semibold text-slate-700 dark:text-slate-200"
              >
                {bg.goalNameLabel}
              </label>
              <input
                id="goal-name"
                type="text"
                required
                maxLength={80}
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setFormError(null);
                }}
                placeholder={bg.goalNamePlaceholder}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#7C3AED] focus:outline-none dark:border-[#263449] dark:bg-[#0B1220] dark:text-slate-100"
              />
            </div>

            <div>
              <label
                htmlFor="goal-target"
                className="block text-[11px] font-semibold text-slate-700 dark:text-slate-200"
              >
                {bg.targetAmountLabel} ({currency})
              </label>
              <input
                id="goal-target"
                type="number"
                min="1"
                step={currency === 'USD' ? '0.01' : '1'}
                required
                value={targetAmountInput}
                onChange={(e) => {
                  setTargetAmountInput(e.target.value);
                  setFormError(null);
                }}
                placeholder={currency === 'USD' ? '1000' : '500000'}
                className="font-mono-num mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#7C3AED] focus:outline-none dark:border-[#263449] dark:bg-[#0B1220] dark:text-slate-100"
              />
            </div>

            <div>
              <label
                htmlFor="goal-initial-saved"
                className="block text-[11px] font-semibold text-slate-700 dark:text-slate-200"
              >
                {bg.initialSavedLabel}
              </label>
              <input
                id="goal-initial-saved"
                type="number"
                min="0"
                step={currency === 'USD' ? '0.01' : '1'}
                value={initialSavedInput}
                onChange={(e) => setInitialSavedInput(e.target.value)}
                placeholder="0"
                className="font-mono-num mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#7C3AED] focus:outline-none dark:border-[#263449] dark:bg-[#0B1220] dark:text-slate-100"
              />
            </div>

            <div>
              <label
                htmlFor="goal-currency"
                className="block text-[11px] font-semibold text-slate-700 dark:text-slate-200"
              >
                {bg.currencyLabel}
              </label>
              <select
                id="goal-currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value as 'RWF' | 'USD')}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-[#7C3AED] focus:outline-none dark:border-[#263449] dark:bg-[#0B1220] dark:text-slate-100"
              >
                <option value="RWF">RWF</option>
                <option value="USD">USD</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="goal-account"
                className="block text-[11px] font-semibold text-slate-700 dark:text-slate-200"
              >
                {bg.linkedAccountLabel}
              </label>
              <select
                id="goal-account"
                value={linkedAccountId}
                onChange={(e) => setLinkedAccountId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-[#7C3AED] focus:outline-none dark:border-[#263449] dark:bg-[#0B1220] dark:text-slate-100"
              >
                <option value="">{bg.noLinkedAccount}</option>
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} ({acc.currency})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="goal-category"
                className="block text-[11px] font-semibold text-slate-700 dark:text-slate-200"
              >
                {bg.linkedCategoryLabel}
              </label>
              <select
                id="goal-category"
                value={linkedCategory}
                onChange={(e) => setLinkedCategory(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-[#7C3AED] focus:outline-none dark:border-[#263449] dark:bg-[#0B1220] dark:text-slate-100"
              >
                <option value="">{bg.noLinkedCategory}</option>
                {availableCategories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="goal-date"
                className="block text-[11px] font-semibold text-slate-700 dark:text-slate-200"
              >
                {bg.targetDateLabel}
              </label>
              <input
                id="goal-date"
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-[#7C3AED] focus:outline-none dark:border-[#263449] dark:bg-[#0B1220] dark:text-slate-100"
              />
            </div>
          </div>

          {formError && (
            <p className="text-xs font-medium text-rose-600 dark:text-rose-400">{formError}</p>
          )}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-[#263449] dark:bg-[#0B1220] dark:text-slate-200"
            >
              {bg.closeForm}
            </button>
            <button
              type="submit"
              className="rounded-xl bg-[#7C3AED] px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#6D28D9]"
            >
              {bg.createGoal}
            </button>
          </div>
        </form>
      )}

      {/* Financial Goals Grid */}
      {goals.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-slate-200 p-6 text-center dark:border-[#263449]">
          <PiggyBank className="mx-auto h-7 w-7 text-slate-400" />
          <p className="mt-2 text-xs font-semibold text-slate-800 dark:text-slate-100">
            {bg.emptyTitle}
          </p>
          <p className="mx-auto mt-1 max-w-md text-xs text-slate-500 dark:text-slate-400">
            {bg.emptyDesc}
          </p>
        </div>
      ) : (
        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
          {displayedGoals.map((goal) => {
            const progress = goalComputations.get(goal.id) ?? computeGoalProgress(goal, transactions);
            const { linkedTransactions, linkedTxTotal, effectiveSaved, pct, completed, remaining } =
              progress;
            const isExpanded = expandedGoalIds.has(goal.id);
            const barColorClass = completed
              ? 'bg-[#16A34A]'
              : pct >= 75
                ? 'bg-amber-500'
                : 'bg-[#7C3AED]';

            return (
              <div
                key={goal.id}
                className="flex flex-col justify-between gap-3.5 rounded-xl border border-slate-200 bg-slate-50/50 p-4 transition-colors hover:border-violet-300 dark:border-[#263449] dark:bg-[#162235]/40 dark:hover:border-violet-500/40"
              >
                {/* Top Summary + Circular Ring */}
                <div className="flex items-start gap-4">
                  <CircularProgressRing
                    percent={pct}
                    completed={completed}
                    label={`${goal.name}: ${Math.round(pct)}%`}
                  />

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="font-display truncate text-sm font-bold text-slate-900 dark:text-white">
                          {goal.name}
                        </h3>
                        <span
                          className={`inline-flex items-center gap-1 text-[11px] font-semibold ${
                            completed ? 'text-[#16A34A]' : 'text-[#7C3AED]'
                          }`}
                        >
                          {completed && <CheckCircle2 className="h-3 w-3" />}
                          {completed ? bg.completedStatus : bg.inProgressStatus}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => onDeleteGoal(goal.id)}
                        aria-label={`${bg.deleteGoal}: ${goal.name}`}
                        className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
                      <div>
                        <span className="text-slate-500 dark:text-slate-400">{bg.savedLabel}: </span>
                        <span className="font-mono-num font-bold text-slate-900 dark:text-white">
                          {formatAmount(effectiveSaved, goal.currency)}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 dark:text-slate-400">{bg.targetLabel}: </span>
                        <span className="font-mono-num font-semibold text-slate-700 dark:text-slate-200">
                          {formatAmount(goal.targetAmount, goal.currency)}
                        </span>
                      </div>
                    </div>

                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
                      <span>
                        {bg.remainingLabel}:{' '}
                        <span className="font-mono-num font-semibold text-slate-700 dark:text-slate-200">
                          {formatAmount(remaining, goal.currency)}
                        </span>
                      </span>
                      {goal.linkedAccountName && (
                        <span className="inline-flex items-center gap-1">
                          <Landmark className="h-3 w-3 text-[#7C3AED]" />
                          {goal.linkedAccountName}
                        </span>
                      )}
                      {goal.linkedCategory && (
                        <span className="inline-flex items-center gap-1">
                          <Tag className="h-3 w-3 text-[#7C3AED]" />
                          {goal.linkedCategory}
                        </span>
                      )}
                      {goal.targetDate && (
                        <span className="font-mono-num inline-flex items-center gap-1">
                          <Calendar className="h-3 w-3 text-[#7C3AED]" />
                          {goal.targetDate}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Transaction-Driven Linear Progress Bar */}
                <div>
                  <div className="mb-1 flex items-center justify-between text-[11px]">
                    <span className="font-medium text-slate-600 dark:text-slate-300">
                      {formatAmount(effectiveSaved, goal.currency)} /{' '}
                      {formatAmount(goal.targetAmount, goal.currency)}
                    </span>
                    <span
                      className={`font-mono-num font-bold ${
                        completed
                          ? 'text-[#16A34A]'
                          : pct >= 75
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-[#7C3AED]'
                      }`}
                    >
                      {Math.round(pct)}%
                    </span>
                  </div>
                  <div
                    role="progressbar"
                    aria-valuenow={Math.round(pct)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`${goal.name} progress`}
                    className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200/80 dark:bg-[#0B1220]"
                  >
                    <div
                      className={`h-full rounded-full transition-all duration-500 ease-out ${barColorClass}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>

                  {/* Direct vs Linked Transaction Attribution Strip */}
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-slate-500 dark:text-slate-400">
                      <span>
                        {bg.manualSavedLabel}:{' '}
                        <span className="font-mono-num font-semibold text-slate-700 dark:text-slate-200">
                          {formatAmount(goal.currentAmount, goal.currency)}
                        </span>
                      </span>
                      <span className="inline-flex items-center gap-1 text-[#6D28D9] dark:text-violet-300">
                        <Link2 className="h-3 w-3" />
                        <span>{bg.linkedTxLabel}:</span>
                        <span className="font-mono-num font-bold">
                          +{formatAmount(linkedTxTotal, goal.currency)}
                        </span>
                      </span>
                    </div>

                    {linkedTransactions.length > 0 && (
                      <button
                        type="button"
                        onClick={() => toggleGoalTransactions(goal.id)}
                        className="inline-flex items-center gap-1 font-semibold text-[#7C3AED] hover:underline"
                      >
                        <Receipt className="h-3 w-3" />
                        <span>
                          {linkedTransactions.length} {bg.linkedTxCountLabel}
                        </span>
                        {isExpanded ? (
                          <ChevronUp className="h-3 w-3" />
                        ) : (
                          <ChevronDown className="h-3 w-3" />
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {/* Linked Transaction Evidence Drawer */}
                {(isExpanded || linkedTransactions.length === 0) && (
                  <div className="rounded-lg border border-slate-200/80 bg-white/80 p-2.5 text-[11px] dark:border-[#263449] dark:bg-[#0B1220]/70">
                    {linkedTransactions.length === 0 ? (
                      <p className="text-slate-500 dark:text-slate-400">{bg.noLinkedTxYet}</p>
                    ) : (
                      <ul className="space-y-1.5">
                        {linkedTransactions.slice(0, 5).map((tx) => (
                          <li
                            key={tx.id}
                            className="flex items-center justify-between gap-2 border-b border-slate-100 pb-1 last:border-none last:pb-0 dark:border-[#263449]/70"
                          >
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-slate-800 dark:text-slate-100">
                                {tx.description}
                              </p>
                              <p className="font-mono-num text-[10px] text-slate-500 dark:text-slate-400">
                                {tx.date} · {tx.category}
                              </p>
                            </div>
                            <span className="font-mono-num shrink-0 font-bold text-[#16A34A]">
                              +{formatAmount(tx.amount, tx.currency)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                {/* Quick Deposit + Link Transaction Controls */}
                <div className="flex flex-wrap items-center gap-2 border-t border-slate-200/80 pt-3 dark:border-[#263449]">
                  <input
                    type="number"
                    min="1"
                    step={goal.currency === 'USD' ? '0.01' : '1'}
                    value={contributionInputs[goal.id] ?? ''}
                    onChange={(e) =>
                      setContributionInputs((prev) => ({
                        ...prev,
                        [goal.id]: e.target.value,
                      }))
                    }
                    placeholder={`${bg.addContributionPlaceholder} (${goal.currency})`}
                    aria-label={`${bg.addContributionPlaceholder} ${goal.name}`}
                    className="font-mono-num min-w-[120px] flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#7C3AED] focus:outline-none dark:border-[#263449] dark:bg-[#0B1220] dark:text-slate-100"
                  />
                  <button
                    type="button"
                    onClick={() => handleContributionSubmit(goal.id)}
                    className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-[#7C3AED] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#6D28D9]"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>{bg.addContributionBtn}</span>
                  </button>
                  {onRecordLinkedTransaction && (
                    <button
                      type="button"
                      onClick={() => onRecordLinkedTransaction(goal)}
                      className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1.5 text-xs font-semibold text-[#6D28D9] transition-colors hover:bg-violet-100 dark:border-violet-500/30 dark:bg-violet-950/40 dark:text-violet-300 dark:hover:bg-violet-900/50"
                    >
                      <Link2 className="h-3.5 w-3.5" />
                      <span>{bg.recordLinkedTxBtn}</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
