import { useEffect, useMemo, useState } from 'react';
import { Download, Filter, Layers, Plus, Repeat, RotateCcw, Search, Target } from 'lucide-react';
import { translations, type Locale } from '../i18n/translations';
import type { RecordedTransaction, TransactionType } from './TransactionInput';

interface TransactionHistoryProps {
  transactions: RecordedTransaction[];
  locale: Locale;
  formatAmount: (amount: number, currency: string) => string;
  onRecordClick: (type?: TransactionType) => void;
  onExportClick?: () => void;
  defaultTypeFilter?: 'all' | TransactionType;
  initialSearchQuery?: string;
}

export function TransactionHistory({
  transactions,
  locale,
  formatAmount,
  onRecordClick,
  onExportClick,
  defaultTypeFilter = 'all',
  initialSearchQuery = '',
}: TransactionHistoryProps) {
  const d = translations[locale].dashboard;
  const th = d.transactionHistory;
  const tm = d.transactionModal;

  const [textQuery, setTextQuery] = useState<string>(initialSearchQuery);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | TransactionType>(defaultTypeFilter);
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [minAmount, setMinAmount] = useState<string>('');
  const [maxAmount, setMaxAmount] = useState<string>('');

  useEffect(() => {
    setTextQuery(initialSearchQuery);
  }, [initialSearchQuery]);

  const allCategories = useMemo(() => {
    const base = [...tm.incomeCategories, ...tm.expenseCategories];
    const fromRecorded = transactions.map((tx) => tx.category);
    return Array.from(new Set([...base, ...fromRecorded]));
  }, [tm.incomeCategories, tm.expenseCategories, transactions]);

  const filteredTransactions = useMemo(() => {
    const minVal = minAmount.trim() !== '' ? Number(minAmount) : null;
    const maxVal = maxAmount.trim() !== '' ? Number(maxAmount) : null;
    const q = textQuery.trim().toLowerCase();

    return transactions.filter((tx) => {
      if (q) {
        const matchesText =
          tx.description.toLowerCase().includes(q) ||
          tx.category.toLowerCase().includes(q) ||
          tx.accountName.toLowerCase().includes(q) ||
          tx.referenceNo.toLowerCase().includes(q) ||
          tx.date.includes(q) ||
          String(tx.amount).includes(q) ||
          Boolean(tx.originalCurrency?.toLowerCase().includes(q)) ||
          Boolean(tx.goalName?.toLowerCase().includes(q)) ||
          Boolean(tx.tags?.some((tag) => tag.toLowerCase().includes(q)));
        if (!matchesText) return false;
      }
      if (typeFilter !== 'all' && tx.type !== typeFilter) {
        return false;
      }
      if (categoryFilter !== 'all' && tx.category !== categoryFilter) {
        return false;
      }
      if (fromDate && tx.date < fromDate) {
        return false;
      }
      if (toDate && tx.date > toDate) {
        return false;
      }
      if (minVal !== null && Number.isFinite(minVal) && tx.amount < minVal) {
        return false;
      }
      if (maxVal !== null && Number.isFinite(maxVal) && tx.amount > maxVal) {
        return false;
      }
      return true;
    });
  }, [transactions, textQuery, typeFilter, categoryFilter, fromDate, toDate, minAmount, maxAmount]);

  const hasActiveFilters =
    textQuery.trim() !== '' ||
    categoryFilter !== 'all' ||
    typeFilter !== defaultTypeFilter ||
    fromDate !== '' ||
    toDate !== '' ||
    minAmount !== '' ||
    maxAmount !== '';

  const resetFilters = () => {
    setTextQuery('');
    setCategoryFilter('all');
    setTypeFilter(defaultTypeFilter);
    setFromDate('');
    setToDate('');
    setMinAmount('');
    setMaxAmount('');
  };

  return (
    <section
      aria-label={th.title}
      className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 dark:border-[#263449] dark:bg-[#0B1220]"
    >
      {/* Header Row */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-[#7C3AED]" />
            <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
              {th.title}
            </h2>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{th.subtitle}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-[#263449] dark:text-slate-200 dark:hover:bg-[#162235]"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>{th.resetFilters}</span>
            </button>
          )}
          {onExportClick && (
            <button
              type="button"
              onClick={onExportClick}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-[#263449] dark:text-slate-200 dark:hover:bg-[#162235]"
            >
              <Download className="h-3.5 w-3.5 text-[#7C3AED]" />
              <span>{d.exportFeature.buttonLabel}</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => onRecordClick(typeFilter === 'income' ? 'income' : 'expense')}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#7C3AED] px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#6D28D9]"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>{d.recordTransaction}</span>
          </button>
        </div>
      </div>

      {/* Filter Controls: Keyword, Category, Date Range, Amount Range, Type */}
      <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-[#263449] dark:bg-[#162235]/50">
        <div className="mb-3 flex flex-col justify-between gap-2.5 sm:flex-row sm:items-center">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200">
            <Filter className="h-3.5 w-3.5 text-[#7C3AED]" />
            <span>
              {th.showingCount}{' '}
              <span className="font-mono-num">{filteredTransactions.length}</span> {th.ofCount}{' '}
              <span className="font-mono-num">{transactions.length}</span> {th.recordsLabel}
            </span>
          </div>

          <div className="relative w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={textQuery}
              onChange={(e) => setTextQuery(e.target.value)}
              placeholder={th.searchPlaceholder}
              aria-label={th.searchPlaceholder}
              className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#7C3AED] focus:outline-none dark:border-[#263449] dark:bg-[#0B1220] dark:text-slate-100"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
          {/* Type Filter */}
          <div>
            <label
              htmlFor="filter-txn-type"
              className="block text-[11px] font-medium text-slate-600 dark:text-slate-300"
            >
              {th.typeLabel}
            </label>
            <select
              id="filter-txn-type"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as 'all' | TransactionType)}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-900 focus:border-[#7C3AED] focus:outline-none dark:border-[#263449] dark:bg-[#0B1220] dark:text-slate-100"
            >
              <option value="all">{th.allTypes}</option>
              <option value="income">{tm.income}</option>
              <option value="expense">{tm.expense}</option>
            </select>
          </div>

          {/* Category Filter */}
          <div>
            <label
              htmlFor="filter-txn-category"
              className="block text-[11px] font-medium text-slate-600 dark:text-slate-300"
            >
              {th.categoryLabel}
            </label>
            <select
              id="filter-txn-category"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-900 focus:border-[#7C3AED] focus:outline-none dark:border-[#263449] dark:bg-[#0B1220] dark:text-slate-100"
            >
              <option value="all">{th.allCategories}</option>
              {allCategories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* From Date */}
          <div>
            <label
              htmlFor="filter-txn-from"
              className="block text-[11px] font-medium text-slate-600 dark:text-slate-300"
            >
              {th.fromDateLabel}
            </label>
            <input
              id="filter-txn-from"
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-900 focus:border-[#7C3AED] focus:outline-none dark:border-[#263449] dark:bg-[#0B1220] dark:text-slate-100"
            />
          </div>

          {/* To Date */}
          <div>
            <label
              htmlFor="filter-txn-to"
              className="block text-[11px] font-medium text-slate-600 dark:text-slate-300"
            >
              {th.toDateLabel}
            </label>
            <input
              id="filter-txn-to"
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-900 focus:border-[#7C3AED] focus:outline-none dark:border-[#263449] dark:bg-[#0B1220] dark:text-slate-100"
            />
          </div>

          {/* Min Amount */}
          <div>
            <label
              htmlFor="filter-txn-min"
              className="block text-[11px] font-medium text-slate-600 dark:text-slate-300"
            >
              {th.minAmountLabel}
            </label>
            <input
              id="filter-txn-min"
              type="number"
              min="0"
              step="any"
              placeholder="0"
              value={minAmount}
              onChange={(e) => setMinAmount(e.target.value)}
              className="font-mono-num mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#7C3AED] focus:outline-none dark:border-[#263449] dark:bg-[#0B1220] dark:text-slate-100"
            />
          </div>

          {/* Max Amount */}
          <div>
            <label
              htmlFor="filter-txn-max"
              className="block text-[11px] font-medium text-slate-600 dark:text-slate-300"
            >
              {th.maxAmountLabel}
            </label>
            <input
              id="filter-txn-max"
              type="number"
              min="0"
              step="any"
              placeholder="∞"
              value={maxAmount}
              onChange={(e) => setMaxAmount(e.target.value)}
              className="font-mono-num mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#7C3AED] focus:outline-none dark:border-[#263449] dark:bg-[#0B1220] dark:text-slate-100"
            />
          </div>
        </div>
      </div>

      {/* Results Area */}
      {transactions.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-slate-200 p-8 text-center text-xs text-slate-500 dark:border-[#263449] dark:text-slate-400">
          {th.emptyNoData}
        </div>
      ) : filteredTransactions.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-slate-200 p-8 text-center text-xs text-slate-500 dark:border-[#263449] dark:text-slate-400">
          {th.emptyFiltered}
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="mt-4 hidden overflow-x-auto md:block">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-500 dark:border-[#263449] dark:text-slate-400">
                  <th className="py-2.5 pr-3">{th.colDate}</th>
                  <th className="px-3 py-2.5">{th.colRef}</th>
                  <th className="px-3 py-2.5">{th.colDescription}</th>
                  <th className="px-3 py-2.5">{th.colCategory}</th>
                  <th className="px-3 py-2.5">{th.colAccount}</th>
                  <th className="py-2.5 pl-3 text-right">{th.colAmount}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#263449]">
                {filteredTransactions.map((tx) => (
                  <tr
                    key={tx.id}
                    className="transition-colors hover:bg-slate-50/80 dark:hover:bg-[#162235]/40"
                  >
                    <td className="font-mono-num whitespace-nowrap py-3 pr-3 text-slate-600 dark:text-slate-300">
                      {tx.date}
                    </td>
                    <td className="font-mono-num whitespace-nowrap px-3 py-3 text-[11px] text-slate-500 dark:text-slate-400">
                      {tx.referenceNo}
                    </td>
                    <td className="max-w-[240px] px-3 py-3 font-medium text-slate-900 dark:text-white">
                      <p className="truncate">{tx.description}</p>
                      {(tx.isRecurring || tx.goalName || (tx.tags && tx.tags.length > 0)) && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {tx.goalName && (
                            <span className="inline-flex items-center gap-1 rounded border border-sky-200 bg-sky-50 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700 dark:border-sky-500/30 dark:bg-sky-950/40 dark:text-sky-300">
                              <Target className="h-2.5 w-2.5" />
                              <span>{tx.goalName}</span>
                            </span>
                          )}
                          {tx.isRecurring && tx.recurringFrequency && (
                            <span
                              title={
                                tx.nextOccurrenceDate
                                  ? `${tm.nextRunLabel} ${tx.nextOccurrenceDate}`
                                  : undefined
                              }
                              className="inline-flex items-center gap-1 rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-950/40 dark:text-emerald-300"
                            >
                              <Repeat className="h-2.5 w-2.5" />
                              <span>{tm.frequencies[tx.recurringFrequency]}</span>
                            </span>
                          )}
                          {tx.tags?.map((tag) => (
                            <span
                              key={tag}
                              className="rounded border border-violet-200 bg-violet-50 px-1.5 py-0.5 text-[10px] font-semibold text-[#6D28D9] dark:border-violet-500/30 dark:bg-violet-950/40 dark:text-violet-300"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-slate-600 dark:text-slate-300">
                      {tx.category}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-slate-600 dark:text-slate-300">
                      {tx.accountName}
                    </td>
                    <td
                      className={`font-mono-num whitespace-nowrap py-3 pl-3 text-right font-bold ${
                        tx.type === 'income'
                          ? 'text-[#16A34A]'
                          : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      <div>
                        {tx.type === 'income' ? '+' : '-'}
                        {formatAmount(tx.amount, tx.currency)}
                      </div>
                      {tx.originalCurrency &&
                        tx.originalAmount !== undefined &&
                        tx.originalCurrency !== tx.currency && (
                          <div className="mt-0.5 text-[10px] font-normal text-slate-500 dark:text-slate-400">
                            {tm.originalEntryLabel}: {formatAmount(tx.originalAmount, tx.originalCurrency)}
                            {tx.exchangeRate ? ` @ ${tx.exchangeRate}` : ''}
                          </div>
                        )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Compact Cards */}
          <ul className="mt-4 divide-y divide-slate-100 md:hidden dark:divide-[#263449]">
            {filteredTransactions.map((tx) => (
              <li key={tx.id} className="flex items-center justify-between gap-3 py-3 text-xs">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-900 dark:text-white">
                    {tx.description}
                  </p>
                  <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                    {tx.category} · {tx.accountName} · {tx.date}
                  </p>
                  {(tx.isRecurring || tx.goalName || (tx.tags && tx.tags.length > 0)) && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {tx.goalName && (
                        <span className="inline-flex items-center gap-1 rounded border border-sky-200 bg-sky-50 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700 dark:border-sky-500/30 dark:bg-sky-950/40 dark:text-sky-300">
                          <Target className="h-2.5 w-2.5" />
                          <span>{tx.goalName}</span>
                        </span>
                      )}
                      {tx.isRecurring && tx.recurringFrequency && (
                        <span className="inline-flex items-center gap-1 rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-950/40 dark:text-emerald-300">
                          <Repeat className="h-2.5 w-2.5" />
                          <span>{tm.frequencies[tx.recurringFrequency]}</span>
                        </span>
                      )}
                      {tx.tags?.map((tag) => (
                        <span
                          key={tag}
                          className="rounded border border-violet-200 bg-violet-50 px-1.5 py-0.5 text-[10px] font-semibold text-[#6D28D9] dark:border-violet-500/30 dark:bg-violet-950/40 dark:text-violet-300"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <span
                    className={`font-mono-num block font-bold ${
                      tx.type === 'income'
                        ? 'text-[#16A34A]'
                        : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {tx.type === 'income' ? '+' : '-'}
                    {formatAmount(tx.amount, tx.currency)}
                  </span>
                  {tx.originalCurrency &&
                    tx.originalAmount !== undefined &&
                    tx.originalCurrency !== tx.currency && (
                      <span className="font-mono-num mt-0.5 block text-[10px] text-slate-500 dark:text-slate-400">
                        {formatAmount(tx.originalAmount, tx.originalCurrency)}
                      </span>
                    )}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
