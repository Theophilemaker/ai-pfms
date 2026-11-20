import { useMemo, useState } from 'react';
import {
  Activity,
  ArrowRight,
  Clock,
  Landmark,
  Plus,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { translations, type Locale } from '../i18n/translations';
import type { RecordedTransaction } from './TransactionInput';

export type AccountUpdateKind =
  | 'account_linked'
  | 'balance_initialized'
  | 'budget_configured';

export interface AccountUpdateEvent {
  id: string;
  timestamp: string;
  kind: AccountUpdateKind;
  title: string;
  detail: string;
  accountName?: string;
  amount?: number;
  currency?: string;
}

interface RecentActivityProps {
  transactions: RecordedTransaction[];
  accountUpdates: AccountUpdateEvent[];
  locale: Locale;
  formatAmount: (amount: number, currency: string) => string;
  onViewAllTransactions: () => void;
  onViewAccounts: () => void;
  onRecordTransaction: () => void;
  onLaunchSetup: () => void;
}

type ActivityFilter = 'all' | 'transactions' | 'accounts';

interface UnifiedActivityItem {
  id: string;
  category: 'transaction' | 'account_update';
  timestamp: string;
  sortKey: number;
  title: string;
  subtitle: string;
  tagLabel: string;
  tagTone: 'income' | 'expense' | 'account' | 'budget';
  amountText?: string;
  amountTone?: 'income' | 'expense' | 'neutral';
  iconType: 'income' | 'expense' | 'account' | 'budget';
  targetSection: 'transactions' | 'accounts' | 'budgets';
}

function formatActivityTimestamp(iso: string, locale: Locale, justNowLabel: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    return iso;
  }
  const diffSeconds = Math.floor((Date.now() - parsed.getTime()) / 1000);
  if (diffSeconds >= 0 && diffSeconds < 45) {
    return `${justNowLabel} · ${parsed.toLocaleTimeString(locale === 'rw' ? 'en-US' : 'en-US', {
      hour: '2-digit',
      minute: '2-digit',
    })}`;
  }
  const datePart = parsed.toLocaleDateString('en-CA');
  const timePart = parsed.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${datePart} · ${timePart}`;
}

export function RecentActivity({
  transactions,
  accountUpdates,
  locale,
  formatAmount,
  onViewAllTransactions,
  onViewAccounts,
  onRecordTransaction,
  onLaunchSetup,
}: RecentActivityProps) {
  const d = translations[locale].dashboard;
  const ra = d.recentActivity;
  const [filter, setFilter] = useState<ActivityFilter>('all');

  const unifiedFeed = useMemo<UnifiedActivityItem[]>(() => {
    const txnItems: UnifiedActivityItem[] = transactions.map((tx) => {
      const iso = tx.createdAt ?? `${tx.date}T12:00:00.000Z`;
      const sortKey = Date.parse(iso) || 0;
      const isIncome = tx.type === 'income';
      const fxNote =
        tx.originalCurrency &&
        tx.originalAmount !== undefined &&
        tx.originalCurrency !== tx.currency
          ? ` · ${formatAmount(tx.originalAmount, tx.originalCurrency)}`
          : '';
      return {
        id: `txn-${tx.id}`,
        category: 'transaction',
        timestamp: iso,
        sortKey,
        title: tx.description,
        subtitle: `${tx.category} · ${tx.accountName} · ${tx.referenceNo}${fxNote}`,
        tagLabel: isIncome ? ra.transactionTagIncome : ra.transactionTagExpense,
        tagTone: isIncome ? 'income' : 'expense',
        amountText: `${isIncome ? '+' : '-'}${formatAmount(tx.amount, tx.currency)}`,
        amountTone: isIncome ? 'income' : 'expense',
        iconType: isIncome ? 'income' : 'expense',
        targetSection: 'transactions',
      };
    });

    const updateItems: UnifiedActivityItem[] = accountUpdates.map((upd) => {
      const sortKey = Date.parse(upd.timestamp) || 0;
      const isBudget = upd.kind === 'budget_configured';
      const tagLabel =
        upd.kind === 'balance_initialized'
          ? ra.balanceInitializedTag
          : isBudget
            ? ra.budgetConfiguredTag
            : ra.accountLinkedTag;

      return {
        id: `upd-${upd.id}`,
        category: 'account_update',
        timestamp: upd.timestamp,
        sortKey,
        title: upd.title,
        subtitle: upd.detail,
        tagLabel,
        tagTone: isBudget ? 'budget' : 'account',
        amountText:
          upd.amount !== undefined && upd.currency
            ? formatAmount(upd.amount, upd.currency)
            : undefined,
        amountTone: 'neutral',
        iconType: isBudget ? 'budget' : 'account',
        targetSection: isBudget ? 'budgets' : 'accounts',
      };
    });

    return [...txnItems, ...updateItems]
      .sort((a, b) => b.sortKey - a.sortKey)
      .slice(0, 12);
  }, [transactions, accountUpdates, ra, formatAmount]);

  const visibleItems = useMemo(() => {
    if (filter === 'transactions') {
      return unifiedFeed.filter((item) => item.category === 'transaction');
    }
    if (filter === 'accounts') {
      return unifiedFeed.filter((item) => item.category === 'account_update');
    }
    return unifiedFeed;
  }, [unifiedFeed, filter]);

  return (
    <section
      aria-label={ra.title}
      className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 dark:border-[#263449] dark:bg-[#0B1220]"
    >
      {/* Header Row */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-[#7C3AED]" />
            <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
              {ra.title}
            </h2>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{ra.subtitle}</p>
        </div>

        {/* Filter Segmented Control */}
        <div
          className="inline-flex shrink-0 items-center gap-1 self-start rounded-xl border border-slate-200 bg-slate-100 p-1 sm:self-auto dark:border-[#263449] dark:bg-[#162235]"
          role="group"
          aria-label={ra.title}
        >
          {(
            [
              { id: 'all', label: ra.filterAll },
              { id: 'transactions', label: ra.filterTransactions },
              { id: 'accounts', label: ra.filterAccounts },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                filter === tab.id
                  ? 'bg-white text-slate-900 shadow-xs dark:bg-[#7C3AED] dark:text-white'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Activity Feed */}
      {visibleItems.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-slate-200 p-6 text-center dark:border-[#263449]">
          <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">
            {ra.emptyTitle}
          </p>
          <p className="mx-auto mt-1 max-w-md text-xs text-slate-500 dark:text-slate-400">
            {ra.emptyDesc}
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5">
            <button
              type="button"
              onClick={onRecordTransaction}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#7C3AED] px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#6D28D9]"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>{d.recordTransaction}</span>
            </button>
            <button
              type="button"
              onClick={onLaunchSetup}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-[#263449] dark:bg-[#162235] dark:text-slate-200"
            >
              <Sparkles className="h-3.5 w-3.5 text-[#7C3AED]" />
              <span>{d.onboardingWizard.resumeButton}</span>
            </button>
          </div>
        </div>
      ) : (
        <>
          <ul className="mt-4 divide-y divide-slate-100 dark:divide-[#263449]">
            {visibleItems.map((item) => {
              const Icon =
                item.iconType === 'income'
                  ? TrendingUp
                  : item.iconType === 'expense'
                    ? TrendingDown
                    : item.iconType === 'budget'
                      ? Target
                      : Landmark;

              const iconClasses =
                item.iconType === 'income'
                  ? 'bg-emerald-100 text-[#16A34A] dark:bg-emerald-950/50 dark:text-emerald-400'
                  : item.iconType === 'expense'
                    ? 'bg-rose-100 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400'
                    : 'bg-violet-100 text-[#7C3AED] dark:bg-violet-950/60 dark:text-violet-300';

              const amountClasses =
                item.amountTone === 'income'
                  ? 'text-[#16A34A]'
                  : item.amountTone === 'expense'
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-slate-900 dark:text-white';

              return (
                <li
                  key={item.id}
                  className="flex flex-col justify-between gap-2.5 py-3.5 sm:flex-row sm:items-center"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <div
                      className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${iconClasses}`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <p className="truncate text-xs font-semibold text-slate-900 dark:text-white">
                          {item.title}
                        </p>
                        <span className="text-[11px] font-medium text-[#7C3AED] dark:text-violet-300">
                          {item.tagLabel}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-[11px] text-slate-500 dark:text-slate-400">
                        {item.subtitle}
                      </p>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center justify-between gap-4 pl-12 sm:flex-col sm:items-end sm:justify-center sm:gap-0.5 sm:pl-0">
                    {item.amountText && (
                      <span className={`font-mono-num text-xs font-bold ${amountClasses}`}>
                        {item.amountText}
                      </span>
                    )}
                    <span className="font-mono-num inline-flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
                      <Clock className="h-3 w-3" />
                      {formatActivityTimestamp(item.timestamp, locale, ra.justNow)}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="mt-4 flex flex-wrap items-center justify-end gap-4 border-t border-slate-100 pt-3.5 dark:border-[#263449]">
            <button
              type="button"
              onClick={onViewAccounts}
              className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 transition-colors hover:text-[#7C3AED] dark:text-slate-300 dark:hover:text-violet-300"
            >
              <span>{ra.viewAccounts}</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={onViewAllTransactions}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#7C3AED] hover:underline"
            >
              <span>{ra.viewAllTransactions}</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </>
      )}
    </section>
  );
}
