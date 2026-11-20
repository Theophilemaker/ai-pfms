import { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  Calendar,
  Check,
  CheckCheck,
  Plus,
  Receipt,
  ShieldAlert,
  Target,
  Trash2,
  X,
} from 'lucide-react';
import { translations, type Locale } from '../i18n/translations';
import type { BudgetAllocation } from './OnboardingWizard';
import type { RecordedTransaction } from './TransactionInput';

export type AlertKind = 'bill_due' | 'budget_threshold' | 'unusual_activity';
export type AlertSeverity = 'info' | 'warning' | 'critical';

export interface ScheduledBill {
  id: string;
  title: string;
  amount: number;
  currency: 'RWF' | 'USD';
  dueDate: string;
  paid: boolean;
}

export interface FinancialAlert {
  id: string;
  kind: AlertKind;
  severity: AlertSeverity;
  title: string;
  message: string;
  timestamp: string;
  targetSection: 'bills' | 'budgets' | 'transactions';
  amountText?: string;
}

function daysBetweenIso(fromIso: string, toIso: string): number {
  const start = new Date(`${fromIso}T00:00:00`);
  const end = new Date(`${toIso}T00:00:00`);
  return Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

export function evaluateFinancialAlerts(params: {
  bills: ScheduledBill[];
  budgets: BudgetAllocation[];
  transactions: RecordedTransaction[];
  primaryCurrency: 'RWF' | 'USD';
  monthlyIncomeTarget: number;
  budgetThresholdPct?: number;
  categoryThresholds?: Record<string, number>;
  locale: Locale;
  formatAmount: (amount: number, currency: string) => string;
}): FinancialAlert[] {
  const {
    bills,
    budgets,
    transactions,
    primaryCurrency,
    monthlyIncomeTarget,
    budgetThresholdPct = 80,
    categoryThresholds = {},
    locale,
    formatAmount,
  } = params;

  const nc = translations[locale].dashboard.notificationsCenter;
  const todayIso = new Date().toISOString().slice(0, 10);
  const nowIso = new Date().toISOString();
  const alerts: FinancialAlert[] = [];

  // 1. Upcoming & Overdue Bills (unpaid within 7 days or overdue)
  bills
    .filter((bill) => !bill.paid)
    .forEach((bill) => {
      const diff = daysBetweenIso(todayIso, bill.dueDate);
      if (diff < 0) {
        alerts.push({
          id: `bill-overdue-${bill.id}-${bill.dueDate}`,
          kind: 'bill_due',
          severity: 'critical',
          title: nc.billOverdueTitle,
          message: `${bill.title} ${nc.billOverdueMsg} ${bill.dueDate}.`,
          timestamp: nowIso,
          targetSection: 'bills',
          amountText: formatAmount(bill.amount, bill.currency),
        });
      } else if (diff === 0) {
        alerts.push({
          id: `bill-today-${bill.id}-${bill.dueDate}`,
          kind: 'bill_due',
          severity: 'warning',
          title: nc.billDueTodayTitle,
          message: `${bill.title} ${nc.billDueTodayMsg} (${bill.dueDate}).`,
          timestamp: nowIso,
          targetSection: 'bills',
          amountText: formatAmount(bill.amount, bill.currency),
        });
      } else if (diff <= 7) {
        alerts.push({
          id: `bill-soon-${bill.id}-${bill.dueDate}`,
          kind: 'bill_due',
          severity: 'info',
          title: nc.billDueSoonTitle,
          message: `${bill.title} ${nc.billDueSoonMsg} ${diff} ${nc.daysLabel} (${bill.dueDate}).`,
          timestamp: nowIso,
          targetSection: 'bills',
          amountText: formatAmount(bill.amount, bill.currency),
        });
      }
    });

  // 2. Budget Threshold Warnings (>= configured thresholdPct warning, >= 100% critical)
  const currentMonthKey = todayIso.slice(0, 7);
  const expensesByCategory = transactions
    .filter((tx) => tx.type === 'expense' && tx.date.startsWith(currentMonthKey))
    .reduce<Record<string, number>>((acc, tx) => {
      acc[tx.category] = (acc[tx.category] ?? 0) + tx.amount;
      return acc;
    }, {});

  const safeThreshold = Math.min(100, Math.max(10, Math.round(budgetThresholdPct)));

  budgets.forEach((b) => {
    if (b.monthlyLimit <= 0) return;
    const spent = expensesByCategory[b.category] ?? 0;
    const pct = Math.round((spent / b.monthlyLimit) * 100);
    const rawCatThreshold = categoryThresholds[b.category] ?? safeThreshold;
    const effectiveThreshold = Math.min(100, Math.max(10, Math.round(rawCatThreshold)));

    if (pct >= 100) {
      alerts.push({
        id: `budget-over-${b.category}-${pct}`,
        kind: 'budget_threshold',
        severity: 'critical',
        title: `${nc.budgetExceededTitle}: ${b.category}`,
        message: `${b.category} ${nc.budgetExceededMsg} ${pct}% ${nc.ofLimitWord} (${formatAmount(spent, primaryCurrency)} / ${formatAmount(b.monthlyLimit, primaryCurrency)}).`,
        timestamp: nowIso,
        targetSection: 'budgets',
        amountText: `${pct}%`,
      });
    } else if (pct >= effectiveThreshold) {
      alerts.push({
        id: `budget-warn-${b.category}-${pct}-${effectiveThreshold}`,
        kind: 'budget_threshold',
        severity: 'warning',
        title: `${nc.budgetWarningTitle}: ${b.category}`,
        message: `${b.category} ${nc.budgetWarningMsg} ${pct}% ${nc.ofLimitWord} (${formatAmount(spent, primaryCurrency)} / ${formatAmount(b.monthlyLimit, primaryCurrency)}).`,
        timestamp: nowIso,
        targetSection: 'budgets',
        amountText: `${pct}%`,
      });
    }
  });

  // 3. Unusual Transaction Activity
  const expenses = transactions.filter((tx) => tx.type === 'expense');
  const avgExpense =
    expenses.length > 0
      ? expenses.reduce((sum, tx) => sum + tx.amount, 0) / expenses.length
      : 0;

  transactions.forEach((tx) => {
    const fallbackHighThreshold = tx.currency === 'USD' ? 500 : 500_000;
    const incomeHighThreshold =
      monthlyIncomeTarget > 0 && tx.currency === primaryCurrency
        ? monthlyIncomeTarget * 0.5
        : Infinity;
    const outlierByAvg =
      tx.type === 'expense' && expenses.length >= 3 && tx.amount >= avgExpense * 2.5;
    const outlierByIncomeOrAbs =
      tx.type === 'expense' &&
      (tx.amount >= incomeHighThreshold || tx.amount >= fallbackHighThreshold);

    if (outlierByAvg || outlierByIncomeOrAbs) {
      alerts.push({
        id: `unusual-high-${tx.id}`,
        kind: 'unusual_activity',
        severity: 'warning',
        title: nc.unusualHighTitle,
        message: `"${tx.description}" (${tx.category} · ${tx.date}) ${nc.unusualHighMsg}`,
        timestamp: tx.createdAt ?? nowIso,
        targetSection: 'transactions',
        amountText: formatAmount(tx.amount, tx.currency),
      });
    }
  });

  // Duplicate transaction check (same date, type, amount, category)
  const signatureCounts = transactions.reduce<Record<string, RecordedTransaction[]>>(
    (acc, tx) => {
      const sig = `${tx.date}|${tx.type}|${tx.amount}|${tx.category}`;
      if (!acc[sig]) acc[sig] = [];
      acc[sig].push(tx);
      return acc;
    },
    {}
  );

  Object.entries(signatureCounts).forEach(([sig, group]) => {
    if (group.length > 1) {
      const sample = group[0];
      alerts.push({
        id: `unusual-dup-${sig}`,
        kind: 'unusual_activity',
        severity: 'warning',
        title: nc.unusualDuplicateTitle,
        message: `${nc.unusualDuplicateMsg} ${sample.date} (${sample.category} · ${group.length}×).`,
        timestamp: sample.createdAt ?? nowIso,
        targetSection: 'transactions',
        amountText: formatAmount(sample.amount, sample.currency),
      });
    }
  });

  // High frequency spending on a single day (>= 4 expenses)
  const dailyExpenseCounts = expenses.reduce<Record<string, number>>((acc, tx) => {
    acc[tx.date] = (acc[tx.date] ?? 0) + 1;
    return acc;
  }, {});

  Object.entries(dailyExpenseCounts).forEach(([date, count]) => {
    if (count >= 4) {
      alerts.push({
        id: `unusual-freq-${date}-${count}`,
        kind: 'unusual_activity',
        severity: 'info',
        title: nc.unusualFrequencyTitle,
        message: `${count} ${nc.unusualFrequencyMsg} ${date}.`,
        timestamp: nowIso,
        targetSection: 'transactions',
      });
    }
  });

  const severityRank: Record<AlertSeverity, number> = {
    critical: 0,
    warning: 1,
    info: 2,
  };

  return alerts.sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);
}

interface NotificationBellDropdownProps {
  alerts: FinancialAlert[];
  readIds: Set<string>;
  locale: Locale;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onNavigateSection: (section: 'bills' | 'budgets' | 'transactions' | 'notifications') => void;
}

export function NotificationBellDropdown({
  alerts,
  readIds,
  locale,
  onMarkRead,
  onMarkAllRead,
  onNavigateSection,
}: NotificationBellDropdownProps) {
  const nc = translations[locale].dashboard.notificationsCenter;
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onMouseDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const unreadCount = alerts.filter((a) => !readIds.has(a.id)).length;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label={`${nc.bellAriaLabel} (${unreadCount})`}
        aria-expanded={open}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-700 transition-colors hover:bg-slate-100 dark:border-[#263449] dark:text-slate-200 dark:hover:bg-[#162235]"
      >
        <Bell className="h-4 w-4 text-[#7C3AED]" />
        {unreadCount > 0 && (
          <span className="font-mono-num absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          role="region"
          aria-label={nc.title}
          className="absolute right-0 top-full z-40 mt-2 w-[310px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl sm:w-[390px] dark:border-[#263449] dark:bg-[#0B1220]"
        >
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-[#263449]">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-[#7C3AED]" />
              <span className="font-display text-xs font-bold text-slate-900 dark:text-white">
                {nc.title}
              </span>
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={onMarkAllRead}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#7C3AED] hover:underline"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                <span>{nc.markAllRead}</span>
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto p-2">
            {alerts.length === 0 ? (
              <div className="px-3 py-6 text-center">
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                  {nc.emptyTitle}
                </p>
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  {nc.emptyDesc}
                </p>
              </div>
            ) : (
              <ul className="space-y-1.5">
                {alerts.slice(0, 6).map((alert) => {
                  const isRead = readIds.has(alert.id);
                  const Icon =
                    alert.kind === 'bill_due'
                      ? Receipt
                      : alert.kind === 'budget_threshold'
                        ? Target
                        : ShieldAlert;

                  const toneClasses =
                    alert.severity === 'critical'
                      ? 'bg-rose-100 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400'
                      : alert.severity === 'warning'
                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300'
                        : 'bg-violet-100 text-[#7C3AED] dark:bg-violet-950/60 dark:text-violet-300';

                  return (
                    <li
                      key={alert.id}
                      className={`rounded-xl border p-2.5 transition-colors ${
                        isRead
                          ? 'border-slate-100 bg-white opacity-75 dark:border-[#263449] dark:bg-[#0B1220]'
                          : 'border-violet-200/80 bg-violet-50/40 dark:border-violet-500/30 dark:bg-[#162235]/60'
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <div
                          className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${toneClasses}`}
                        >
                          <Icon className="h-3.5 w-3.5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="truncate text-xs font-bold text-slate-900 dark:text-white">
                              {alert.title}
                            </p>
                            {alert.amountText && (
                              <span className="font-mono-num shrink-0 text-[11px] font-bold text-slate-900 dark:text-white">
                                {alert.amountText}
                              </span>
                            )}
                          </div>
                          <p className="mt-0.5 text-[11px] leading-snug text-slate-600 dark:text-slate-300">
                            {alert.message}
                          </p>
                          <div className="mt-2 flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => {
                                onMarkRead(alert.id);
                                onNavigateSection(alert.targetSection);
                                setOpen(false);
                              }}
                              className="text-[11px] font-semibold text-[#7C3AED] hover:underline"
                            >
                              {nc.actionInspect}
                            </button>
                            {!isRead && (
                              <button
                                type="button"
                                onClick={() => onMarkRead(alert.id)}
                                className="text-[11px] font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                              >
                                {nc.markRead}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="border-t border-slate-100 bg-slate-50/80 px-4 py-2.5 text-center dark:border-[#263449] dark:bg-[#0B1220]">
            <button
              type="button"
              onClick={() => {
                onNavigateSection('notifications');
                setOpen(false);
              }}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#7C3AED] hover:underline"
            >
              <span>{nc.openCenter}</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

interface NotificationCenterProps {
  alerts: FinancialAlert[];
  readIds: Set<string>;
  locale: Locale;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onDismiss: (id: string) => void;
  onNavigateSection: (section: 'bills' | 'budgets' | 'transactions') => void;
}

export function NotificationCenter({
  alerts,
  readIds,
  locale,
  onMarkRead,
  onMarkAllRead,
  onDismiss,
  onNavigateSection,
}: NotificationCenterProps) {
  const nc = translations[locale].dashboard.notificationsCenter;
  const [filter, setFilter] = useState<'all' | AlertKind>('all');

  const unreadCount = alerts.filter((a) => !readIds.has(a.id)).length;
  const billCount = alerts.filter((a) => a.kind === 'bill_due').length;
  const budgetCount = alerts.filter((a) => a.kind === 'budget_threshold').length;
  const unusualCount = alerts.filter((a) => a.kind === 'unusual_activity').length;

  const visibleAlerts =
    filter === 'all' ? alerts : alerts.filter((a) => a.kind === filter);

  return (
    <section className="space-y-6" aria-label={nc.title}>
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
            {nc.title}
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{nc.subtitle}</p>
        </div>

        {unreadCount > 0 && (
          <button
            type="button"
            onClick={onMarkAllRead}
            className="inline-flex items-center gap-1.5 self-start rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 sm:self-auto dark:border-[#263449] dark:bg-[#0B1220] dark:text-slate-200 dark:hover:bg-[#162235]"
          >
            <CheckCheck className="h-4 w-4 text-[#7C3AED]" />
            <span>{nc.markAllRead}</span>
          </button>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: nc.unreadLabel, count: unreadCount, accent: 'text-[#7C3AED]' },
          { label: nc.billsAlertsLabel, count: billCount, accent: 'text-amber-600 dark:text-amber-400' },
          { label: nc.budgetAlertsLabel, count: budgetCount, accent: 'text-rose-600 dark:text-rose-400' },
          { label: nc.unusualAlertsLabel, count: unusualCount, accent: 'text-blue-600 dark:text-blue-400' },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-[#263449] dark:bg-[#0B1220]"
          >
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {card.label}
            </p>
            <p className={`font-mono-num mt-2 text-2xl font-bold ${card.accent}`}>
              {card.count}
            </p>
          </div>
        ))}
      </div>

      {/* Filter Tabs */}
      <div
        className="inline-flex flex-wrap items-center gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1 dark:border-[#263449] dark:bg-[#0B1220]"
        role="group"
        aria-label={nc.title}
      >
        {(
          [
            { id: 'all', label: nc.filterAll },
            { id: 'bill_due', label: nc.filterBills },
            { id: 'budget_threshold', label: nc.filterBudgets },
            { id: 'unusual_activity', label: nc.filterUnusual },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setFilter(tab.id)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              filter === tab.id
                ? 'bg-white text-slate-900 shadow-xs dark:bg-[#7C3AED] dark:text-white'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Alerts List */}
      {visibleAlerts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center dark:border-[#263449] dark:bg-[#0B1220]">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">
            {nc.emptyTitle}
          </p>
          <p className="mx-auto mt-1.5 max-w-md text-xs text-slate-500 dark:text-slate-400">
            {nc.emptyDesc}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {visibleAlerts.map((alert) => {
            const isRead = readIds.has(alert.id);
            const Icon =
              alert.kind === 'bill_due'
                ? Receipt
                : alert.kind === 'budget_threshold'
                  ? AlertTriangle
                  : ShieldAlert;

            const toneClasses =
              alert.severity === 'critical'
                ? 'bg-rose-100 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400'
                : alert.severity === 'warning'
                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300'
                  : 'bg-violet-100 text-[#7C3AED] dark:bg-violet-950/60 dark:text-violet-300';

            const severityLabel =
              alert.severity === 'critical'
                ? nc.severityCritical
                : alert.severity === 'warning'
                  ? nc.severityWarning
                  : nc.severityInfo;

            return (
              <div
                key={alert.id}
                className={`flex flex-col justify-between gap-4 rounded-2xl border p-5 transition-colors sm:flex-row sm:items-center ${
                  isRead
                    ? 'border-slate-200 bg-white opacity-80 dark:border-[#263449] dark:bg-[#0B1220]'
                    : 'border-violet-200 bg-white dark:border-violet-500/40 dark:bg-[#0B1220]'
                }`}
              >
                <div className="flex min-w-0 items-start gap-3.5">
                  <div
                    className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${toneClasses}`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-display text-sm font-bold text-slate-900 dark:text-white">
                        {alert.title}
                      </h2>
                      <span
                        className={`text-[11px] font-semibold ${
                          alert.severity === 'critical'
                            ? 'text-rose-600 dark:text-rose-400'
                            : alert.severity === 'warning'
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-[#7C3AED]'
                        }`}
                      >
                        {severityLabel}
                      </span>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                      {alert.message}
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-2.5 pl-13 sm:pl-0">
                  {alert.amountText && (
                    <span className="font-mono-num text-sm font-bold text-slate-900 dark:text-white">
                      {alert.amountText}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      onMarkRead(alert.id);
                      onNavigateSection(alert.targetSection);
                    }}
                    className="inline-flex items-center gap-1 rounded-xl bg-[#7C3AED] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#6D28D9]"
                  >
                    <span>{nc.actionInspect}</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                  {!isRead && (
                    <button
                      type="button"
                      onClick={() => onMarkRead(alert.id)}
                      className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-[#263449] dark:text-slate-200 dark:hover:bg-[#162235]"
                    >
                      {nc.markRead}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onDismiss(alert.id)}
                    aria-label={nc.dismiss}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-[#162235] dark:hover:text-slate-200"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

interface BillsSectionProps {
  bills: ScheduledBill[];
  primaryCurrency: 'RWF' | 'USD';
  locale: Locale;
  formatAmount: (amount: number, currency: string) => string;
  onAddBill: (bill: ScheduledBill) => void;
  onTogglePaid: (billId: string) => void;
  onDeleteBill: (billId: string) => void;
}

export function BillsSection({
  bills,
  primaryCurrency,
  locale,
  formatAmount,
  onAddBill,
  onTogglePaid,
  onDeleteBill,
}: BillsSectionProps) {
  const bm = translations[locale].dashboard.billsManager;

  const [formOpen, setFormOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [amountInput, setAmountInput] = useState('');
  const [currency, setCurrency] = useState<'RWF' | 'USD'>(primaryCurrency);
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return d.toISOString().slice(0, 10);
  });
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numericAmount = Number(amountInput);
    if (!title.trim() || !dueDate || !Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError(bm.errorValidation);
      return;
    }

    onAddBill({
      id: `bill-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
      title: title.trim(),
      amount: Math.round(numericAmount * 100) / 100,
      currency,
      dueDate,
      paid: false,
    });
    setTitle('');
    setAmountInput('');
    setError(null);
    setFormOpen(false);
  };

  return (
    <section className="space-y-6" aria-label={bm.title}>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
            {bm.title}
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{bm.subtitle}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setFormOpen((p) => !p);
            setError(null);
          }}
          className="inline-flex items-center gap-1.5 self-start rounded-xl bg-[#7C3AED] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#6D28D9] sm:self-auto"
        >
          {formOpen ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          <span>{formOpen ? bm.cancel : bm.addBill}</span>
        </button>
      </div>

      {formOpen && (
        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-2xl border border-violet-200 bg-violet-50/50 p-5 dark:border-violet-500/30 dark:bg-[#0B1220]"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label
                htmlFor="bill-title"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-200"
              >
                {bm.billTitleLabel}
              </label>
              <input
                id="bill-title"
                type="text"
                required
                maxLength={80}
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setError(null);
                }}
                placeholder={bm.billTitlePlaceholder}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#7C3AED] focus:outline-none dark:border-[#263449] dark:bg-[#162235] dark:text-slate-100"
              />
            </div>

            <div>
              <label
                htmlFor="bill-amount"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-200"
              >
                {bm.amountLabel} ({currency})
              </label>
              <input
                id="bill-amount"
                type="number"
                min="1"
                step={currency === 'USD' ? '0.01' : '1'}
                required
                value={amountInput}
                onChange={(e) => {
                  setAmountInput(e.target.value);
                  setError(null);
                }}
                placeholder={currency === 'USD' ? '45.00' : '25000'}
                className="font-mono-num mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#7C3AED] focus:outline-none dark:border-[#263449] dark:bg-[#162235] dark:text-slate-100"
              />
            </div>

            <div>
              <label
                htmlFor="bill-currency"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-200"
              >
                {bm.currencyLabel}
              </label>
              <select
                id="bill-currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value as 'RWF' | 'USD')}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-[#7C3AED] focus:outline-none dark:border-[#263449] dark:bg-[#162235] dark:text-slate-100"
              >
                <option value="RWF">RWF</option>
                <option value="USD">USD</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="bill-due-date"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-200"
              >
                {bm.dueDateLabel}
              </label>
              <input
                id="bill-due-date"
                type="date"
                required
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-[#7C3AED] focus:outline-none dark:border-[#263449] dark:bg-[#162235] dark:text-slate-100"
              />
            </div>
          </div>

          {error && (
            <p className="text-xs font-medium text-rose-600 dark:text-rose-400">{error}</p>
          )}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-[#263449] dark:bg-[#162235] dark:text-slate-200"
            >
              {bm.cancel}
            </button>
            <button
              type="submit"
              className="rounded-xl bg-[#7C3AED] px-4 py-2 text-xs font-semibold text-white hover:bg-[#6D28D9]"
            >
              {bm.saveBill}
            </button>
          </div>
        </form>
      )}

      {bills.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center dark:border-[#263449] dark:bg-[#0B1220]">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">{bm.emptyTitle}</p>
          <p className="mx-auto mt-1.5 max-w-md text-xs text-slate-500 dark:text-slate-400">
            {bm.emptyDesc}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {bills.map((bill) => (
            <div
              key={bill.id}
              className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 dark:border-[#263449] dark:bg-[#0B1220]"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Receipt className="h-4 w-4 shrink-0 text-[#7C3AED]" />
                  <h2 className="font-display truncate text-sm font-bold text-slate-900 dark:text-white">
                    {bill.title}
                  </h2>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                  <span className="font-mono-num inline-flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5 text-[#7C3AED]" />
                    {bill.dueDate}
                  </span>
                  <span
                    className={`font-semibold ${
                      bill.paid ? 'text-[#16A34A]' : 'text-amber-600 dark:text-amber-400'
                    }`}
                  >
                    {bill.paid ? bm.paidBadge : bm.unpaidBadge}
                  </span>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2.5">
                <span className="font-mono-num text-sm font-bold text-slate-900 dark:text-white">
                  {formatAmount(bill.amount, bill.currency)}
                </span>
                <button
                  type="button"
                  onClick={() => onTogglePaid(bill.id)}
                  className={`inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors ${
                    bill.paid
                      ? 'border border-emerald-200 bg-emerald-50 text-[#16A34A] dark:border-emerald-500/30 dark:bg-emerald-950/30'
                      : 'bg-[#7C3AED] text-white hover:bg-[#6D28D9]'
                  }`}
                >
                  <Check className="h-3.5 w-3.5" />
                  <span>{bm.markPaid}</span>
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteBill(bill.id)}
                  aria-label={bm.deleteBill}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
