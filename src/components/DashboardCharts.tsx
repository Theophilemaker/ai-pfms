import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { translations, type Locale, type ThemeMode } from '../i18n/translations';
import type { RecordedTransaction } from './TransactionInput';

interface DashboardChartsProps {
  locale: Locale;
  theme: ThemeMode;
  period: 'month' | 'days30' | 'ytd';
  recordedTransactions?: RecordedTransaction[];
  accounts?: { id: string; name: string; currency: string; openingBalance?: number }[];
}

interface AccountChartDatum {
  name: string;
  fullName: string;
  balance: number;
}

interface TrendChartDatum {
  label: string;
  income: number;
  expenses: number;
}

interface TooltipPayloadItem {
  value?: unknown;
  name?: unknown;
  payload?: unknown;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: readonly TooltipPayloadItem[];
  label?: string | number;
}

const ACCOUNT_COLORS = ['#7C3AED', '#2563EB', '#16A34A', '#0D9488', '#D97706'];

function formatCompactRwf(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `${Math.round(value / 1_000)}k`;
  return String(value);
}

function formatFullRwf(value: number): string {
  return `${new Intl.NumberFormat('en-US').format(value)} RWF`;
}

export function DashboardCharts({
  locale,
  theme,
  period,
  recordedTransactions = [],
  accounts,
}: DashboardChartsProps) {
  const d = translations[locale].dashboard;
  const c = d.charts;

  const hasOpeningBalance = (accounts ?? []).some((a) => (a.openingBalance ?? 0) > 0);

  const [viewMode, setViewMode] = useState<'sample' | 'live'>(() =>
    recordedTransactions.length > 0 || hasOpeningBalance ? 'live' : 'sample'
  );

  useEffect(() => {
    if (recordedTransactions.length > 0 || hasOpeningBalance) {
      setViewMode('live');
    }
  }, [recordedTransactions.length, hasOpeningBalance]);

  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof document !== 'undefined') {
      return document.documentElement.classList.contains('dark');
    }
    return false;
  });

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const resolve = () => {
      const darkActive = theme === 'dark' || (theme === 'system' && media.matches);
      setIsDark(darkActive);
    };
    resolve();
    media.addEventListener('change', resolve);
    return () => media.removeEventListener('change', resolve);
  }, [theme]);

  const [hoveredBarIndex, setHoveredBarIndex] = useState<number | null>(null);
  const [hoveredTrendIndex, setHoveredTrendIndex] = useState<number | null>(null);
  const [visibleSeries, setVisibleSeries] = useState<{ income: boolean; expenses: boolean }>({
    income: true,
    expenses: true,
  });

  const sampleAccountBalances: AccountChartDatum[] = [
    { name: 'Cash', fullName: d.accountTypes[0].name, balance: 185000 },
    { name: locale === 'rw' ? 'Banki' : 'Bank', fullName: d.accountTypes[1].name, balance: 1420000 },
    { name: 'MoMo', fullName: d.accountTypes[2].name, balance: 460000 },
    {
      name: locale === 'rw' ? 'Kuzigama' : 'Savings',
      fullName: d.accountTypes[3].name,
      balance: 950000,
    },
    { name: 'FX (USD)', fullName: d.accountTypes[4].name, balance: 680000 },
  ];

  const accountTotals = recordedTransactions.reduce<Record<string, number>>((acc, txn) => {
    const signed = txn.type === 'income' ? txn.amount : -txn.amount;
    acc[txn.accountId] = (acc[txn.accountId] ?? 0) + signed;
    return acc;
  }, {});

  const openingMap = (accounts ?? []).reduce<Record<string, number>>((acc, item) => {
    acc[item.id] = item.openingBalance ?? 0;
    return acc;
  }, {});

  const liveAccountBalances: AccountChartDatum[] = [
    {
      name: 'Cash',
      fullName: d.accountTypes[0].name,
      balance: (openingMap.cash ?? 0) + (accountTotals.cash ?? 0),
    },
    {
      name: locale === 'rw' ? 'Banki' : 'Bank',
      fullName: d.accountTypes[1].name,
      balance: (openingMap.bank ?? 0) + (accountTotals.bank ?? 0),
    },
    {
      name: 'MoMo',
      fullName: d.accountTypes[2].name,
      balance: (openingMap.momo ?? 0) + (accountTotals.momo ?? 0),
    },
    {
      name: locale === 'rw' ? 'Kuzigama' : 'Savings',
      fullName: d.accountTypes[3].name,
      balance: (openingMap.savings ?? 0) + (accountTotals.savings ?? 0),
    },
    {
      name: 'FX (USD)',
      fullName: d.accountTypes[4].name,
      balance: (openingMap.fx ?? 0) + (accountTotals.fx ?? 0),
    },
  ];

  const accountChartData =
    viewMode === 'sample' ? sampleAccountBalances : liveAccountBalances;

  const totalAccountPositiveBalance = accountChartData.reduce(
    (sum, item) => sum + Math.max(0, item.balance),
    0
  );

  const sampleTrendsByPeriod: Record<'month' | 'days30' | 'ytd', TrendChartDatum[]> = {
    month: [
      { label: 'Wk 1', income: 420000, expenses: 195000 },
      { label: 'Wk 2', income: 180000, expenses: 240000 },
      { label: 'Wk 3', income: 510000, expenses: 215000 },
      { label: 'Wk 4', income: 290000, expenses: 175000 },
    ],
    days30: [
      { label: 'D1–5', income: 310000, expenses: 140000 },
      { label: 'D6–10', income: 95000, expenses: 185000 },
      { label: 'D11–15', income: 440000, expenses: 205000 },
      { label: 'D16–20', income: 120000, expenses: 160000 },
      { label: 'D21–25', income: 260000, expenses: 190000 },
      { label: 'D26–30', income: 175000, expenses: 135000 },
    ],
    ytd: [
      { label: 'Jan', income: 980000, expenses: 640000 },
      { label: 'Feb', income: 1050000, expenses: 710000 },
      { label: 'Mar', income: 1120000, expenses: 685000 },
      { label: 'Apr', income: 990000, expenses: 730000 },
      { label: 'May', income: 1240000, expenses: 760000 },
      { label: 'Jun', income: 1180000, expenses: 695000 },
      { label: 'Jul', income: 1310000, expenses: 810000 },
    ],
  };

  const liveTrendByDate = Object.values(
    recordedTransactions.reduce<Record<string, TrendChartDatum>>((acc, txn) => {
      if (!acc[txn.date]) {
        acc[txn.date] = { label: txn.date.slice(5), income: 0, expenses: 0 };
      }
      if (txn.type === 'income') acc[txn.date].income += txn.amount;
      else acc[txn.date].expenses += txn.amount;
      return acc;
    }, {})
  ).sort((a, b) => a.label.localeCompare(b.label));

  const trendChartData =
    viewMode === 'sample'
      ? sampleTrendsByPeriod[period]
      : liveTrendByDate.length > 0
        ? liveTrendByDate
        : sampleTrendsByPeriod[period].map((pt) => ({
            ...pt,
            income: 0,
            expenses: 0,
          }));

  const gridColor = isDark ? '#263449' : '#E2E8F0';
  const axisColor = isDark ? '#94A3B8' : '#64748B';

  const activeAccountDatum =
    hoveredBarIndex !== null ? accountChartData[hoveredBarIndex] ?? null : null;

  const activeTrendDatum =
    hoveredTrendIndex !== null ? trendChartData[hoveredTrendIndex] ?? null : null;

  const handleToggleSeries = (key: 'income' | 'expenses') => {
    setVisibleSeries((prev) => {
      const otherKey = key === 'income' ? 'expenses' : 'income';
      if (prev[key] && !prev[otherKey]) {
        return prev;
      }
      return { ...prev, [key]: !prev[key] };
    });
  };

  const renderBalanceTooltip = ({ active, payload }: CustomTooltipProps) => {
    if (!active || !payload || payload.length === 0) return null;
    const item = payload[0];
    const row = item.payload as Partial<AccountChartDatum> | undefined;
    const rawVal = Array.isArray(item.value) ? item.value[0] : item.value;
    const value = Number(rawVal ?? 0);
    const fullName = row?.fullName ?? row?.name ?? '';
    const sharePct =
      totalAccountPositiveBalance > 0
        ? Math.round((Math.max(0, value) / totalAccountPositiveBalance) * 100)
        : 0;

    return (
      <div className="rounded-xl border border-slate-200 bg-white/95 px-3.5 py-2.5 text-xs shadow-xl backdrop-blur-xs dark:border-[#263449] dark:bg-[#162235]/95">
        <p className="font-display font-bold text-slate-900 dark:text-white">{fullName}</p>
        <div className="mt-1.5 flex items-center justify-between gap-4">
          <span className="text-slate-500 dark:text-slate-400">{c.balanceSeries}</span>
          <span className="font-mono-num font-bold text-[#7C3AED] dark:text-violet-300">
            {formatFullRwf(value)}
          </span>
        </div>
        <div className="mt-1 flex items-center justify-between gap-4 border-t border-slate-100 pt-1 text-[11px] dark:border-[#263449]">
          <span className="text-slate-500 dark:text-slate-400">{c.shareLabel}</span>
          <span className="font-mono-num font-semibold text-slate-700 dark:text-slate-200">
            {sharePct}%
          </span>
        </div>
      </div>
    );
  };

  const renderTrendTooltip = ({ active, payload, label }: CustomTooltipProps) => {
    if (!active || !payload || payload.length === 0) return null;
    const row = payload[0]?.payload as Partial<TrendChartDatum> | undefined;
    const incomeVal = Number(row?.income ?? 0);
    const expensesVal = Number(row?.expenses ?? 0);
    const netVal = incomeVal - expensesVal;

    return (
      <div className="min-w-[190px] rounded-xl border border-slate-200 bg-white/95 px-3.5 py-2.5 text-xs shadow-xl backdrop-blur-xs dark:border-[#263449] dark:bg-[#162235]/95">
        <p className="font-display font-bold text-slate-900 dark:text-white">
          {String(label ?? '')}
        </p>
        <div className="mt-1.5 space-y-1">
          {visibleSeries.income && (
            <div className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                <span className="h-2 w-2 rounded-full bg-[#16A34A]" />
                {c.incomeSeries}
              </span>
              <span className="font-mono-num font-semibold text-[#16A34A]">
                {formatFullRwf(incomeVal)}
              </span>
            </div>
          )}
          {visibleSeries.expenses && (
            <div className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                <span className="h-2 w-2 rounded-full bg-[#7C3AED]" />
                {c.expenseSeries}
              </span>
              <span className="font-mono-num font-semibold text-[#7C3AED] dark:text-violet-300">
                {formatFullRwf(expensesVal)}
              </span>
            </div>
          )}
        </div>
        <div className="mt-1.5 flex items-center justify-between gap-4 border-t border-slate-100 pt-1.5 text-[11px] dark:border-[#263449]">
          <span className="text-slate-500 dark:text-slate-400">{c.netCashFlow}</span>
          <span
            className={`font-mono-num font-bold ${
              netVal >= 0 ? 'text-[#16A34A]' : 'text-rose-600 dark:text-rose-400'
            }`}
          >
            {netVal > 0 ? '+' : ''}
            {formatFullRwf(netVal)}
          </span>
        </div>
      </div>
    );
  };

  return (
    <section className="mt-8" aria-label={c.sectionTitle}>
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
            {c.sectionTitle}
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            {viewMode === 'sample' ? c.sampleDisclaimer : c.liveDisclaimer}
          </p>
        </div>

        {/* Functional Segmented Control: Sample Illustration vs Live Ledger */}
        <div
          className="inline-flex shrink-0 items-center gap-1 self-start rounded-xl border border-slate-200 bg-slate-100 p-1 sm:self-auto dark:border-[#263449] dark:bg-[#0B1220]"
          role="group"
          aria-label="Chart data mode"
        >
          <button
            type="button"
            onClick={() => setViewMode('sample')}
            className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              viewMode === 'sample'
                ? 'bg-white text-slate-900 shadow-xs dark:bg-[#7C3AED] dark:text-white'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
            }`}
          >
            {c.modeSample}
          </button>
          <button
            type="button"
            onClick={() => setViewMode('live')}
            className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              viewMode === 'live'
                ? 'bg-white text-slate-900 shadow-xs dark:bg-[#7C3AED] dark:text-white'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
            }`}
          >
            {c.modeLive}
          </button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Account Balances BarChart */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="rounded-2xl border border-slate-200 bg-white p-5 transition-colors hover:border-violet-300 dark:border-[#263449] dark:bg-[#0B1220] dark:hover:border-violet-500/40"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white">
              {c.balanceChartTitle}
            </h3>
            <span className="font-mono-num text-[11px] font-medium text-slate-500 dark:text-slate-400">
              {activeAccountDatum
                ? `${activeAccountDatum.name}: ${formatFullRwf(activeAccountDatum.balance)}`
                : c.hoverHint}
            </span>
          </div>

          <div className="mt-4 h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                key={`${viewMode}-bars`}
                data={accountChartData}
                margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
                onMouseMove={(state) => {
                  const idx = state?.activeTooltipIndex;
                  setHoveredBarIndex(typeof idx === 'number' ? idx : null);
                }}
                onMouseLeave={() => setHoveredBarIndex(null)}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fill: axisColor, fontSize: 12 }}
                  axisLine={{ stroke: gridColor }}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={formatCompactRwf}
                  tick={{ fill: axisColor, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={48}
                />
                <Tooltip
                  cursor={{
                    fill: isDark ? 'rgba(124, 58, 237, 0.14)' : 'rgba(124, 58, 237, 0.08)',
                    radius: 8,
                  }}
                  content={renderBalanceTooltip}
                />
                <Bar
                  dataKey="balance"
                  name={c.balanceSeries}
                  radius={[6, 6, 0, 0]}
                  maxBarSize={44}
                  isAnimationActive
                  animationBegin={100}
                  animationDuration={750}
                  animationEasing="ease-out"
                  onMouseEnter={(_, index) => setHoveredBarIndex(index)}
                  onMouseLeave={() => setHoveredBarIndex(null)}
                >
                  {accountChartData.map((_, idx) => {
                    const isFocused = hoveredBarIndex === null || hoveredBarIndex === idx;
                    const isHovered = hoveredBarIndex === idx;
                    return (
                      <Cell
                        key={`cell-${idx}`}
                        fill={ACCOUNT_COLORS[idx % ACCOUNT_COLORS.length]}
                        fillOpacity={isFocused ? 1 : 0.35}
                        style={{
                          transition: 'fill-opacity 180ms ease, filter 180ms ease',
                          cursor: 'pointer',
                          filter: isHovered ? 'brightness(1.08)' : 'none',
                        }}
                      />
                    );
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">{c.balanceSummary}</p>
        </motion.div>

        {/* Historical Spending & Income Trends AreaChart */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.08, ease: 'easeOut' }}
          className="rounded-2xl border border-slate-200 bg-white p-5 transition-colors hover:border-violet-300 dark:border-[#263449] dark:bg-[#0B1220] dark:hover:border-violet-500/40"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white">
              {c.trendChartTitle}
            </h3>
            <span className="font-mono-num text-[11px] font-medium text-slate-500 dark:text-slate-400">
              {activeTrendDatum
                ? `${activeTrendDatum.label} · ${c.netCashFlow}: ${
                    activeTrendDatum.income - activeTrendDatum.expenses > 0 ? '+' : ''
                  }${formatCompactRwf(activeTrendDatum.income - activeTrendDatum.expenses)}`
                : c.toggleSeriesHint}
            </span>
          </div>

          <div className="mt-4 h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                key={`${viewMode}-${period}-area`}
                data={trendChartData}
                margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
                onMouseMove={(state) => {
                  const idx = state?.activeTooltipIndex;
                  setHoveredTrendIndex(typeof idx === 'number' ? idx : null);
                }}
                onMouseLeave={() => setHoveredTrendIndex(null)}
              >
                <defs>
                  <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#16A34A" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="#16A34A" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#7C3AED" stopOpacity={0.32} />
                    <stop offset="95%" stopColor="#7C3AED" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: axisColor, fontSize: 12 }}
                  axisLine={{ stroke: gridColor }}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={formatCompactRwf}
                  tick={{ fill: axisColor, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={48}
                />
                <Tooltip
                  cursor={{
                    stroke: '#7C3AED',
                    strokeWidth: 1.5,
                    strokeDasharray: '4 4',
                  }}
                  content={renderTrendTooltip}
                />
                {visibleSeries.income && (
                  <Area
                    type="monotone"
                    dataKey="income"
                    name={c.incomeSeries}
                    stroke="#16A34A"
                    strokeWidth={2.25}
                    fillOpacity={1}
                    fill="url(#incomeGrad)"
                    dot={{ r: 3, fill: '#16A34A', strokeWidth: 1.5, stroke: isDark ? '#0B1220' : '#FFFFFF' }}
                    activeDot={{ r: 6, fill: '#16A34A', strokeWidth: 2, stroke: isDark ? '#0B1220' : '#FFFFFF' }}
                    isAnimationActive
                    animationBegin={140}
                    animationDuration={850}
                    animationEasing="ease-out"
                  />
                )}
                {visibleSeries.expenses && (
                  <Area
                    type="monotone"
                    dataKey="expenses"
                    name={c.expenseSeries}
                    stroke="#7C3AED"
                    strokeWidth={2.25}
                    fillOpacity={1}
                    fill="url(#expenseGrad)"
                    dot={{ r: 3, fill: '#7C3AED', strokeWidth: 1.5, stroke: isDark ? '#0B1220' : '#FFFFFF' }}
                    activeDot={{ r: 6, fill: '#7C3AED', strokeWidth: 2, stroke: isDark ? '#0B1220' : '#FFFFFF' }}
                    isAnimationActive
                    animationBegin={280}
                    animationDuration={850}
                    animationEasing="ease-out"
                  />
                )}
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Interactive Series Legend Toggles */}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-slate-500 dark:text-slate-400">{c.trendSummary}</p>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                aria-pressed={visibleSeries.income}
                onClick={() => handleToggleSeries('income')}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-all ${
                  visibleSeries.income
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-950/40 dark:text-emerald-300'
                    : 'border-slate-200 bg-slate-50 text-slate-400 opacity-70 hover:opacity-100 dark:border-[#263449] dark:bg-[#162235] dark:text-slate-500'
                }`}
              >
                <span className="h-2 w-2 rounded-full bg-[#16A34A]" />
                <span>{c.incomeSeries}</span>
              </button>
              <button
                type="button"
                aria-pressed={visibleSeries.expenses}
                onClick={() => handleToggleSeries('expenses')}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-all ${
                  visibleSeries.expenses
                    ? 'border-violet-200 bg-violet-50 text-[#6D28D9] dark:border-violet-500/30 dark:bg-violet-950/40 dark:text-violet-300'
                    : 'border-slate-200 bg-slate-50 text-slate-400 opacity-70 hover:opacity-100 dark:border-[#263449] dark:bg-[#162235] dark:text-slate-500'
                }`}
              >
                <span className="h-2 w-2 rounded-full bg-[#7C3AED]" />
                <span>{c.expenseSeries}</span>
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
