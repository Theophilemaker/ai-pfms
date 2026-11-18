import { Fragment, useMemo, useState } from 'react';
import {
  ArrowUpDown,
  CalendarRange,
  ChevronDown,
  ChevronUp,
  History,
  RotateCcw,
} from 'lucide-react';
import { translations, type Locale } from '../i18n/translations';
import type { BudgetAllocation } from './OnboardingWizard';
import type { RecordedTransaction } from './TransactionInput';

type DisciplineStatus = 'on_track' | 'near_limit' | 'over_budget';

interface CategoryMonthBreakdown {
  category: string;
  allocated: number;
  actualSpent: number;
  variance: number;
  utilizationPct: number;
  status: DisciplineStatus;
}

interface MonthlyBudgetHistoryRow {
  monthKey: string; // YYYY-MM
  monthLabel: string;
  isCurrentMonth: boolean;
  allocated: number;
  actualSpent: number;
  variance: number;
  utilizationPct: number;
  status: DisciplineStatus;
  categories: CategoryMonthBreakdown[];
}

interface BudgetHistoryProps {
  budgets: BudgetAllocation[];
  transactions: RecordedTransaction[];
  thresholdPct: number;
  primaryCurrency: 'RWF' | 'USD';
  locale: Locale;
  formatAmount: (amount: number, currency: string) => string;
}

function formatMonthLabel(monthKey: string, locale: Locale): string {
  const [yearStr, monthStr] = monthKey.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return monthKey;
  }
  const date = new Date(Date.UTC(year, month - 1, 1));
  return new Intl.DateTimeFormat(locale === 'rw' ? 'rw-RW' : 'en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

function classifyStatus(
  allocated: number,
  actualSpent: number,
  thresholdPct: number
): DisciplineStatus {
  if (allocated <= 0) {
    return actualSpent > 0 ? 'over_budget' : 'on_track';
  }
  const pct = Math.round((actualSpent / allocated) * 100);
  if (pct > 100) return 'over_budget';
  if (pct >= thresholdPct) return 'near_limit';
  return 'on_track';
}

export function BudgetHistory({
  budgets,
  transactions,
  thresholdPct,
  primaryCurrency,
  locale,
  formatAmount,
}: BudgetHistoryProps) {
  const bh = translations[locale].dashboard.budgetHistory;

  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | DisciplineStatus>('all');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null);

  const currentMonthKey = new Date().toISOString().slice(0, 7);

  const expenseTransactions = useMemo(
    () => transactions.filter((tx) => tx.type === 'expense'),
    [transactions]
  );

  const availableCategories = useMemo(() => {
    const fromBudgets = budgets.map((b) => b.category);
    const fromExpenses = expenseTransactions.map((tx) => tx.category);
    return Array.from(new Set([...fromBudgets, ...fromExpenses]));
  }, [budgets, expenseTransactions]);

  const allMonthlyRows: MonthlyBudgetHistoryRow[] = useMemo(() => {
    const monthKeys = new Set<string>();
    expenseTransactions.forEach((tx) => {
      if (tx.date && tx.date.length >= 7) {
        monthKeys.add(tx.date.slice(0, 7));
      }
    });

    if (budgets.length > 0) {
      monthKeys.add(currentMonthKey);
    }

    if (monthKeys.size === 0) return [];

    const budgetMap = budgets.reduce<Record<string, number>>((acc, b) => {
      acc[b.category] = b.monthlyLimit;
      return acc;
    }, {});

    return Array.from(monthKeys).map((monthKey) => {
      const monthExpenses = expenseTransactions.filter((tx) => tx.date.startsWith(monthKey));
      const spentByCat = monthExpenses.reduce<Record<string, number>>((acc, tx) => {
        acc[tx.category] = (acc[tx.category] ?? 0) + tx.amount;
        return acc;
      }, {});

      const monthCategories = Array.from(
        new Set([...Object.keys(budgetMap), ...Object.keys(spentByCat)])
      );

      const breakdown: CategoryMonthBreakdown[] = monthCategories
        .map((cat) => {
          const allocated = budgetMap[cat] ?? 0;
          const actualSpent = spentByCat[cat] ?? 0;
          const variance = allocated - actualSpent;
          const utilizationPct =
            allocated > 0
              ? Math.round((actualSpent / allocated) * 100)
              : actualSpent > 0
                ? 100
                : 0;
          return {
            category: cat,
            allocated,
            actualSpent,
            variance,
            utilizationPct,
            status: classifyStatus(allocated, actualSpent, thresholdPct),
          };
        })
        .sort((a, b) => b.actualSpent - a.actualSpent || b.allocated - a.allocated);

      const scopedBreakdown =
        categoryFilter === 'all'
          ? breakdown
          : breakdown.filter((row) => row.category === categoryFilter);

      const allocated = scopedBreakdown.reduce((sum, r) => sum + r.allocated, 0);
      const actualSpent = scopedBreakdown.reduce((sum, r) => sum + r.actualSpent, 0);
      const variance = allocated - actualSpent;
      const utilizationPct =
        allocated > 0
          ? Math.round((actualSpent / allocated) * 100)
          : actualSpent > 0
            ? 100
            : 0;

      return {
        monthKey,
        monthLabel: formatMonthLabel(monthKey, locale),
        isCurrentMonth: monthKey === currentMonthKey,
        allocated,
        actualSpent,
        variance,
        utilizationPct,
        status: classifyStatus(allocated, actualSpent, thresholdPct),
        categories: breakdown,
      };
    });
  }, [expenseTransactions, budgets, currentMonthKey, thresholdPct, categoryFilter, locale]);

  const filteredRows = useMemo(() => {
    return allMonthlyRows
      .filter((row) => (statusFilter === 'all' ? true : row.status === statusFilter))
      .sort((a, b) =>
        sortOrder === 'desc'
          ? b.monthKey.localeCompare(a.monthKey)
          : a.monthKey.localeCompare(b.monthKey)
      );
  }, [allMonthlyRows, statusFilter, sortOrder]);

  const disciplineStats = useMemo(() => {
    const count = filteredRows.length;
    if (count === 0) {
      return {
        monthsCount: 0,
        compliancePct: 0,
        cumulativeVariance: 0,
        avgUtilization: 0,
      };
    }
    const compliantCount = filteredRows.filter((r) => r.status !== 'over_budget').length;
    const cumulativeVariance = filteredRows.reduce((sum, r) => sum + r.variance, 0);
    const avgUtilization = Math.round(
      filteredRows.reduce((sum, r) => sum + r.utilizationPct, 0) / count
    );
    return {
      monthsCount: count,
      compliancePct: Math.round((compliantCount / count) * 100),
      cumulativeVariance,
      avgUtilization,
    };
  }, [filteredRows]);

  const statusMeta: Record<DisciplineStatus, { label: string; badgeClass: string }> = {
    on_track: {
      label: bh.statusOnTrack,
      badgeClass:
        'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
    },
    near_limit: {
      label: bh.statusNearLimit,
      badgeClass:
        'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300',
    },
    over_budget: {
      label: bh.statusOverBudget,
      badgeClass: 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300',
    },
  };

  const hasActiveFilters = categoryFilter !== 'all' || statusFilter !== 'all';

  return (
    <section
      aria-label={bh.title}
      className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 dark:border-[#263449] dark:bg-[#0B1220]"
    >
      {/* Header & Controls */}
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div>
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-[#7C3AED]" />
            <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
              {bh.title}
            </h2>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{bh.subtitle}</p>
        </div>

        {allMonthlyRows.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label={bh.categoryFilterLabel}
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 focus:border-[#7C3AED] focus:outline-none dark:border-[#263449] dark:bg-[#162235] dark:text-slate-200"
            >
              <option value="all">{bh.allCategories}</option>
              {availableCategories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>

            <select
              aria-label={bh.statusFilterLabel}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | DisciplineStatus)}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 focus:border-[#7C3AED] focus:outline-none dark:border-[#263449] dark:bg-[#162235] dark:text-slate-200"
            >
              <option value="all">{bh.statusAll}</option>
              <option value="on_track">{bh.statusOnTrack}</option>
              <option value="near_limit">{bh.statusNearLimit}</option>
              <option value="over_budget">{bh.statusOverBudget}</option>
            </select>

            <button
              type="button"
              onClick={() => setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'))}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100 dark:border-[#263449] dark:bg-[#162235] dark:text-slate-200 dark:hover:bg-[#1E2D45]"
            >
              <ArrowUpDown className="h-3.5 w-3.5 text-[#7C3AED]" />
              <span>{sortOrder === 'desc' ? bh.sortNewest : bh.sortOldest}</span>
            </button>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={() => {
                  setCategoryFilter('all');
                  setStatusFilter('all');
                }}
                className="inline-flex items-center gap-1 rounded-xl border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-[#6D28D9] hover:bg-violet-100 dark:border-violet-500/30 dark:bg-violet-950/40 dark:text-violet-300"
              >
                <RotateCcw className="h-3 w-3" />
                <span>{bh.resetFilters}</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Empty State */}
      {allMonthlyRows.length === 0 ? (
        <div className="mt-5 rounded-xl border border-dashed border-slate-200 bg-slate-50/70 p-6 text-center dark:border-[#263449] dark:bg-[#162235]/40">
          <CalendarRange className="mx-auto h-7 w-7 text-slate-400" />
          <p className="mt-2.5 text-sm font-semibold text-slate-800 dark:text-slate-100">
            {bh.emptyTitle}
          </p>
          <p className="mx-auto mt-1 max-w-md text-xs text-slate-500 dark:text-slate-400">
            {bh.emptyDesc}
          </p>
        </div>
      ) : (
        <>
          {/* Discipline Summary KPI Strip */}
          <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 dark:border-[#263449] dark:bg-[#162235]/50">
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                {bh.monthsTrackedLabel}
              </p>
              <p className="font-mono-num mt-1 text-lg font-bold text-slate-900 dark:text-white">
                {disciplineStats.monthsCount}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 dark:border-[#263449] dark:bg-[#162235]/50">
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                {bh.onBudgetRateLabel}
              </p>
              <p className="font-mono-num mt-1 text-lg font-bold text-[#16A34A]">
                {disciplineStats.compliancePct}%
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 dark:border-[#263449] dark:bg-[#162235]/50">
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                {bh.cumulativeVarianceLabel}
              </p>
              <p
                className={`font-mono-num mt-1 text-lg font-bold ${
                  disciplineStats.cumulativeVariance >= 0
                    ? 'text-[#16A34A]'
                    : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {disciplineStats.cumulativeVariance > 0 ? '+' : ''}
                {formatAmount(disciplineStats.cumulativeVariance, primaryCurrency)}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 dark:border-[#263449] dark:bg-[#162235]/50">
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                {bh.avgUtilizationLabel}
              </p>
              <p className="font-mono-num mt-1 text-lg font-bold text-[#7C3AED]">
                {disciplineStats.avgUtilization}%
              </p>
            </div>
          </div>

          {filteredRows.length === 0 ? (
            <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-xs text-slate-600 dark:border-[#263449] dark:bg-[#162235]/40 dark:text-slate-300">
              {bh.emptyFiltered}
            </div>
          ) : (
            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[700px] border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-[11px] font-bold tracking-wider text-slate-500 uppercase dark:border-[#263449] dark:text-slate-400">
                    <th className="py-3 pr-3">{bh.colMonth}</th>
                    <th className="px-3 py-3 text-right">{bh.colAllocated}</th>
                    <th className="px-3 py-3 text-right">{bh.colActualSpent}</th>
                    <th className="px-3 py-3 text-right">{bh.colVariance}</th>
                    <th className="px-3 py-3">{bh.colUtilization}</th>
                    <th className="px-3 py-3">{bh.colDiscipline}</th>
                    <th className="py-3 pl-3 text-right">{bh.colBreakdown}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-[#263449]">
                  {filteredRows.map((row) => {
                    const isExpanded = expandedMonth === row.monthKey;
                    const meta = statusMeta[row.status];
                    const barColor =
                      row.status === 'over_budget'
                        ? 'bg-rose-500'
                        : row.status === 'near_limit'
                          ? 'bg-amber-500'
                          : 'bg-[#16A34A]';

                    return (
                      <Fragment key={row.monthKey}>
                        <tr
                          className="transition-colors hover:bg-slate-50/80 dark:hover:bg-[#162235]/50"
                        >
                          <td className="py-3.5 pr-3 font-semibold text-slate-900 dark:text-white">
                            <div className="flex items-center gap-2">
                              <span>{row.monthLabel}</span>
                              {row.isCurrentMonth && (
                                <span className="rounded-md bg-violet-100 px-1.5 py-0.5 text-[10px] font-bold text-[#6D28D9] dark:bg-violet-950/60 dark:text-violet-300">
                                  {bh.currentBadge}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="font-mono-num px-3 py-3.5 text-right font-medium text-slate-700 dark:text-slate-200">
                            {formatAmount(row.allocated, primaryCurrency)}
                          </td>
                          <td className="font-mono-num px-3 py-3.5 text-right font-semibold text-slate-900 dark:text-white">
                            {formatAmount(row.actualSpent, primaryCurrency)}
                          </td>
                          <td
                            className={`font-mono-num px-3 py-3.5 text-right font-bold ${
                              row.variance >= 0
                                ? 'text-[#16A34A]'
                                : 'text-rose-600 dark:text-rose-400'
                            }`}
                          >
                            {row.variance > 0 ? '+' : ''}
                            {formatAmount(row.variance, primaryCurrency)}
                          </td>
                          <td className="px-3 py-3.5">
                            <div className="flex items-center gap-2">
                              <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100 dark:bg-[#162235]">
                                <div
                                  className={`h-full rounded-full ${barColor}`}
                                  style={{ width: `${Math.min(100, row.utilizationPct)}%` }}
                                />
                              </div>
                              <span className="font-mono-num font-semibold text-slate-700 dark:text-slate-200">
                                {row.utilizationPct}%
                              </span>
                            </div>
                          </td>
                          <td className="px-3 py-3.5">
                            <span
                              className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-bold ${meta.badgeClass}`}
                            >
                              {meta.label}
                            </span>
                          </td>
                          <td className="py-3.5 pl-3 text-right">
                            <button
                              type="button"
                              aria-expanded={isExpanded}
                              onClick={() =>
                                setExpandedMonth(isExpanded ? null : row.monthKey)
                              }
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-700 transition-colors hover:bg-slate-100 dark:border-[#263449] dark:text-slate-200 dark:hover:bg-[#162235]"
                            >
                              <span>{isExpanded ? bh.collapseBtn : bh.expandBtn}</span>
                              {isExpanded ? (
                                <ChevronUp className="h-3.5 w-3.5" />
                              ) : (
                                <ChevronDown className="h-3.5 w-3.5" />
                              )}
                            </button>
                          </td>
                        </tr>

                        {isExpanded && (
                          <tr
                            key={`${row.monthKey}-details`}
                            className="bg-slate-50/70 dark:bg-[#162235]/35"
                          >
                            <td colSpan={7} className="px-4 py-3.5">
                              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                                {row.categories.map((cat) => {
                                  const catMeta = statusMeta[cat.status];
                                  return (
                                    <div
                                      key={cat.category}
                                      className="rounded-xl border border-slate-200 bg-white p-3 dark:border-[#263449] dark:bg-[#0B1220]"
                                    >
                                      <div className="flex items-center justify-between gap-2">
                                        <span className="font-semibold text-slate-900 dark:text-white">
                                          {cat.category}
                                        </span>
                                        <span
                                          className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${catMeta.badgeClass}`}
                                        >
                                          {cat.utilizationPct}%
                                        </span>
                                      </div>
                                      <div className="font-mono-num mt-1.5 flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-300">
                                        <span>
                                          {formatAmount(cat.actualSpent, primaryCurrency)} /{' '}
                                          {formatAmount(cat.allocated, primaryCurrency)}
                                        </span>
                                        <span
                                          className={
                                            cat.variance >= 0
                                              ? 'font-semibold text-[#16A34A]'
                                              : 'font-semibold text-rose-600 dark:text-rose-400'
                                          }
                                        >
                                          {cat.variance > 0 ? '+' : ''}
                                          {formatAmount(cat.variance, primaryCurrency)}
                                        </span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
}
