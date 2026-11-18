import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ArrowRight, BellRing, SlidersHorizontal, X } from 'lucide-react';
import { translations, type Locale } from '../i18n/translations';
import type { BudgetAllocation } from './OnboardingWizard';
import type { RecordedTransaction } from './TransactionInput';

export interface BudgetThresholdToastItem {
  id: string;
  category: string;
  spent: number;
  limit: number;
  pct: number;
  thresholdPct: number;
  isExceeded: boolean;
}

interface BudgetThresholdNotifierProps {
  transactions: RecordedTransaction[];
  budgets: BudgetAllocation[];
  thresholdPct: number;
  primaryCurrency: 'RWF' | 'USD';
  locale: Locale;
  formatAmount: (amount: number, currency: string) => string;
  hasOtherToast?: boolean;
  onInspectBudgets: () => void;
}

export function BudgetThresholdNotifier({
  transactions,
  budgets,
  thresholdPct,
  primaryCurrency,
  locale,
  formatAmount,
  hasOtherToast = false,
  onInspectBudgets,
}: BudgetThresholdNotifierProps) {
  const bn = translations[locale].dashboard.budgetNotifier;
  const [toasts, setToasts] = useState<BudgetThresholdToastItem[]>([]);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const triggeredKeysRef = useRef<Set<string>>(new Set());

  const breachedCategories = useMemo(() => {
    const safeThreshold = Math.min(100, Math.max(10, Math.round(thresholdPct)));
    const expensesByCategory = transactions
      .filter((tx) => tx.type === 'expense')
      .reduce<Record<string, number>>((acc, tx) => {
        acc[tx.category] = (acc[tx.category] ?? 0) + tx.amount;
        return acc;
      }, {});

    return budgets
      .filter((b) => b.monthlyLimit > 0)
      .map((b) => {
        const spent = expensesByCategory[b.category] ?? 0;
        const pct = Math.round((spent / b.monthlyLimit) * 100);
        return {
          category: b.category,
          spent,
          limit: b.monthlyLimit,
          pct,
          thresholdPct: safeThreshold,
          isExceeded: pct >= 100,
        };
      })
      .filter((item) => item.pct >= safeThreshold);
  }, [transactions, budgets, thresholdPct]);

  useEffect(() => {
    const newlyTriggered: BudgetThresholdToastItem[] = [];

    breachedCategories.forEach((item) => {
      const eventKey = `${item.category}:${item.thresholdPct}:${item.pct}`;
      if (!triggeredKeysRef.current.has(eventKey)) {
        triggeredKeysRef.current.add(eventKey);
        newlyTriggered.push({
          id: `${eventKey}-${Date.now()}`,
          ...item,
        });
      }
    });

    if (newlyTriggered.length > 0) {
      setToasts((prev) => [...newlyTriggered, ...prev].slice(0, 3));
    }
  }, [breachedCategories]);

  useEffect(() => {
    if (toasts.length === 0) return;
    const timers = toasts
      .filter((toast) => toast.id !== hoveredId)
      .map((toast) =>
        window.setTimeout(() => {
          setToasts((prev) => prev.filter((item) => item.id !== toast.id));
        }, 7500)
      );

    return () => {
      timers.forEach((id) => window.clearTimeout(id));
    };
  }, [toasts, hoveredId]);

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className={`fixed right-4 z-50 flex w-full max-w-sm flex-col gap-2.5 pl-4 sm:pl-0 ${
        hasOtherToast ? 'bottom-32' : 'bottom-4'
      }`}
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="alert"
          onMouseEnter={() => setHoveredId(toast.id)}
          onMouseLeave={() => setHoveredId((curr) => (curr === toast.id ? null : curr))}
          className={`rounded-2xl border bg-white p-4 shadow-2xl transition-all dark:bg-[#0B1220] ${
            toast.isExceeded
              ? 'border-rose-300 dark:border-rose-500/40'
              : 'border-amber-300 dark:border-amber-500/40'
          }`}
        >
          <div className="flex items-start gap-3">
            <div
              className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                toast.isExceeded
                  ? 'bg-rose-100 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400'
                  : 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300'
              }`}
            >
              <AlertTriangle className="h-4 w-4" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="font-display truncate text-xs font-bold text-slate-900 dark:text-white">
                  {toast.isExceeded ? bn.toastTitleExceeded : bn.toastTitleWarning}
                </p>
                <span className="font-mono-num shrink-0 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-[#162235] dark:text-slate-300">
                  {bn.toastRuleBadge} ≥ {toast.thresholdPct}%
                </span>
              </div>

              <p className="mt-1 text-xs font-semibold text-slate-800 dark:text-slate-100">
                {toast.category}{' '}
                <span
                  className={`font-mono-num ${
                    toast.isExceeded
                      ? 'text-rose-600 dark:text-rose-400'
                      : 'text-amber-700 dark:text-amber-300'
                  }`}
                >
                  ({toast.pct}%)
                </span>
              </p>

              <p className="font-mono-num mt-0.5 text-[11px] text-slate-600 dark:text-slate-300">
                {formatAmount(toast.spent, primaryCurrency)} {bn.spentOfLabel}{' '}
                {formatAmount(toast.limit, primaryCurrency)}
              </p>

              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-[#162235]">
                <div
                  className={`h-full rounded-full transition-all ${
                    toast.isExceeded ? 'bg-rose-500' : 'bg-amber-500'
                  }`}
                  style={{ width: `${Math.min(100, toast.pct)}%` }}
                />
              </div>

              <button
                type="button"
                onClick={() => {
                  onInspectBudgets();
                  setToasts((prev) => prev.filter((item) => item.id !== toast.id));
                }}
                className="mt-2.5 inline-flex items-center gap-1 text-[11px] font-semibold text-[#7C3AED] hover:underline"
              >
                <span>{bn.viewBudgets}</span>
                <ArrowRight className="h-3 w-3" />
              </button>
            </div>

            <button
              type="button"
              onClick={() => setToasts((prev) => prev.filter((item) => item.id !== toast.id))}
              aria-label={bn.dismissToast}
              className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-[#162235] dark:hover:text-slate-200"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

interface BudgetThresholdControlProps {
  thresholdPct: number;
  monitoredCount: number;
  locale: Locale;
  onChange: (nextPct: number) => void;
}

const PRESET_THRESHOLDS = [50, 75, 80, 90, 100];

export function BudgetThresholdControl({
  thresholdPct,
  monitoredCount,
  locale,
  onChange,
}: BudgetThresholdControlProps) {
  const bn = translations[locale].dashboard.budgetNotifier;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-[#263449] dark:bg-[#0B1220]">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-[#7C3AED] dark:bg-violet-950/60">
            <BellRing className="h-5 w-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-sm font-bold text-slate-900 dark:text-white">
                {bn.controlTitle}
              </h2>
              <span className="font-mono-num rounded-md bg-violet-50 px-2 py-0.5 text-[11px] font-semibold text-[#6D28D9] dark:bg-violet-950/40 dark:text-violet-300">
                {bn.monitoringActive}: {monitoredCount} {bn.categoriesUnit}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{bn.controlDesc}</p>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={bn.presetLabel}>
            {PRESET_THRESHOLDS.map((pct) => {
              const active = thresholdPct === pct;
              return (
                <button
                  key={pct}
                  type="button"
                  onClick={() => onChange(pct)}
                  className={`font-mono-num rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
                    active
                      ? 'bg-[#7C3AED] text-white'
                      : 'border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-[#263449] dark:bg-[#162235] dark:text-slate-200 dark:hover:bg-[#1E2D45]'
                  }`}
                >
                  {pct}%
                </button>
              );
            })}
          </div>

          <label className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 dark:border-[#263449] dark:bg-[#162235]">
            <SlidersHorizontal className="h-3.5 w-3.5 shrink-0 text-[#7C3AED]" />
            <span className="sr-only">{bn.thresholdLabel}</span>
            <input
              type="range"
              min={10}
              max={100}
              step={5}
              value={thresholdPct}
              onChange={(e) => onChange(Number(e.target.value))}
              aria-label={bn.thresholdLabel}
              className="h-1.5 w-24 accent-[#7C3AED]"
            />
            <span className="font-mono-num w-9 text-right text-xs font-bold text-[#7C3AED]">
              {thresholdPct}%
            </span>
          </label>
        </div>
      </div>
    </div>
  );
}
