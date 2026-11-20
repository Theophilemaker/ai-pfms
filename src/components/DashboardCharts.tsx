import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Minus, TrendingDown, TrendingUp } from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ReferenceLine,
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
  primaryCurrency?: 'RWF' | 'USD';
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

interface MonthlySpendingDatum {
  monthKey: string;
  label: string;
  spending: number;
  projectedSpending: number;
  income: number;
  netSavings: number;
  savingsRatePct: number | null;
  momChangePct: number | null;
  trendDirection: 'growth' | 'saving' | 'baseline';
  topCategory: string | null;
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

function formatCompactCurrency(value: number, currency: string): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}${Math.round(abs / 1_000)}k`;
  return currency === 'USD' ? `${sign}$${Math.round(abs)}` : String(Math.round(value));
}

function formatFullCurrency(value: number, currency: string): string {
  if (currency === 'USD') {
    return `${new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value)} USD`;
  }
  return `${new Intl.NumberFormat('en-US').format(Math.round(value))} RWF`;
}

function getLastSixMonthBuckets(now: Date = new Date()): { monthKey: string; label: string }[] {
  const baseYear = now.getFullYear();
  const baseMonth = now.getMonth();
  const buckets: { monthKey: string; label: string }[] = [];
  let crossYear = false;
  const startYear = new Date(baseYear, baseMonth - 5, 1).getFullYear();
  if (startYear !== baseYear) crossYear = true;

  for (let offset = 5; offset >= 0; offset -= 1) {
    const dt = new Date(baseYear, baseMonth - offset, 1);
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const shortMonth = new Intl.DateTimeFormat('en-US', { month: 'short' }).format(dt);
    const label = crossYear ? `${shortMonth} '${String(y).slice(-2)}` : shortMonth;
    buckets.push({ monthKey: `${y}-${m}`, label });
  }
  return buckets;
}

export function DashboardCharts({
  locale,
  theme,
  period,
  primaryCurrency = 'RWF',
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
  const [hoveredSpendingIndex, setHoveredSpendingIndex] = useState<number | null>(null);
  const [visibleSeries, setVisibleSeries] = useState<{ income: boolean; expenses: boolean }>({
    income: true,
    expenses: true,
  });
  const [showSpendingSavingsLine, setShowSpendingSavingsLine] = useState(true);
  const [showProjectedTrendLine, setShowProjectedTrendLine] = useState(true);
  const [showSixMonthAvgLine, setShowSixMonthAvgLine] = useState(true);

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

  const effectiveSpendingCurrency = useMemo<'RWF' | 'USD'>(() => {
    if (recordedTransactions.length === 0) return primaryCurrency;
    const hasPrimary = recordedTransactions.some((tx) => tx.currency === primaryCurrency);
    if (hasPrimary) return primaryCurrency;
    return recordedTransactions[0].currency === 'USD' ? 'USD' : 'RWF';
  }, [recordedTransactions, primaryCurrency]);

  const {
    monthlySpendingData,
    totalSixMonthSpend,
    avgMonthlySpend,
    totalSixMonthSavings,
    trajectoryKind,
    trajectoryPct,
    hasLiveMonthlyData,
  } = useMemo(() => {
    const buckets = getLastSixMonthBuckets();
    const scale = effectiveSpendingCurrency === 'USD' ? 0.001 : 1;

    const sampleSeed = [
      { spending: 640000, income: 1050000, topCategory: locale === 'rw' ? 'Ibiribwa' : 'Groceries' },
      { spending: 725000, income: 1080000, topCategory: locale === 'rw' ? 'Ubukode' : 'Housing & Rent' },
      { spending: 790000, income: 1120000, topCategory: locale === 'rw' ? 'Ubukode' : 'Housing & Rent' },
      { spending: 685000, income: 1150000, topCategory: locale === 'rw' ? 'Ingendo' : 'Transport' },
      { spending: 615000, income: 1210000, topCategory: locale === 'rw' ? 'Ibiribwa' : 'Groceries' },
      { spending: 560000, income: 1260000, topCategory: locale === 'rw' ? 'Amazi n’Umuriro' : 'Utilities' },
    ];

    const series: MonthlySpendingDatum[] = buckets.map((bucket, idx) => {
      if (viewMode === 'sample') {
        const seed = sampleSeed[idx];
        const spending = Math.round(seed.spending * scale * 100) / 100;
        const income = Math.round(seed.income * scale * 100) / 100;
        const netSavings = Math.round((income - spending) * 100) / 100;
        const savingsRatePct = income > 0 ? Math.round((netSavings / income) * 100) : null;
        return {
          monthKey: bucket.monthKey,
          label: bucket.label,
          spending,
          projectedSpending: spending,
          income,
          netSavings,
          savingsRatePct,
          momChangePct: null,
          trendDirection: 'baseline',
          topCategory: seed.topCategory,
        };
      }

      const monthTxns = recordedTransactions.filter(
        (tx) => tx.date.startsWith(bucket.monthKey) && tx.currency === effectiveSpendingCurrency
      );
      let spending = 0;
      let income = 0;
      const catTotals: Record<string, number> = {};

      monthTxns.forEach((tx) => {
        if (tx.type === 'expense') {
          spending += tx.amount;
          catTotals[tx.category] = (catTotals[tx.category] ?? 0) + tx.amount;
        } else {
          income += tx.amount;
        }
      });

      spending = Math.round(spending * 100) / 100;
      income = Math.round(income * 100) / 100;
      const netSavings = Math.round((income - spending) * 100) / 100;
      const savingsRatePct = income > 0 ? Math.round((netSavings / income) * 100) : null;
      const topEntry = Object.entries(catTotals).sort((a, b) => b[1] - a[1])[0];

      return {
        monthKey: bucket.monthKey,
        label: bucket.label,
        spending,
        projectedSpending: spending,
        income,
        netSavings,
        savingsRatePct,
        momChangePct: null,
        trendDirection: 'baseline',
        topCategory: topEntry ? topEntry[0] : null,
      };
    });

    for (let i = 0; i < series.length; i += 1) {
      if (i > 0) {
        const prev = series[i - 1];
        const curr = series[i];
        if (prev.spending > 0 && (curr.spending > 0 || prev.spending > 0)) {
          const pct = Math.round(((curr.spending - prev.spending) / prev.spending) * 100);
          curr.momChangePct = pct;
          curr.trendDirection = pct > 0 ? 'growth' : 'saving';
        }
      }
      // 3-month weighted baseline trend for Projected Spending line alongside actuals
      const startIdx = Math.max(0, i - 2);
      const windowSlice = series.slice(startIdx, i + 1).filter((m) => m.spending > 0);
      if (windowSlice.length > 0) {
        const weights = windowSlice.map((_, wIdx) => wIdx + 1);
        const wTotal = weights.reduce((a, b) => a + b, 0);
        const wAvg =
          windowSlice.reduce((sum, item, wIdx) => sum + item.spending * weights[wIdx], 0) /
          wTotal;
        series[i].projectedSpending = Math.round(wAvg * 100) / 100;
      } else {
        series[i].projectedSpending = 0;
      }
    }

    const totalSpend = series.reduce((sum, item) => sum + item.spending, 0);
    const totalIncome = series.reduce((sum, item) => sum + item.income, 0);
    const avgSpend = totalSpend / series.length;
    const totalSavings = series.reduce((sum, item) => sum + item.netSavings, 0);

    const earlierAvg =
      (series[0].spending + series[1].spending + series[2].spending) / 3;
    const recentAvg =
      (series[3].spending + series[4].spending + series[5].spending) / 3;

    let kind: 'saving' | 'growth' | 'steady' | 'no_data' = 'no_data';
    let shiftPct = 0;

    if (totalSpend > 0 || totalIncome > 0) {
      if (earlierAvg > 0) {
        shiftPct = Math.round(((recentAvg - earlierAvg) / earlierAvg) * 100);
        kind = shiftPct < 0 ? 'saving' : shiftPct > 0 ? 'growth' : 'steady';
      } else {
        const nonZeroMonths = series.filter((m) => m.spending > 0);
        if (nonZeroMonths.length >= 2) {
          const last = nonZeroMonths[nonZeroMonths.length - 1];
          const prev = nonZeroMonths[nonZeroMonths.length - 2];
          shiftPct = Math.round(((last.spending - prev.spending) / prev.spending) * 100);
          kind = shiftPct < 0 ? 'saving' : shiftPct > 0 ? 'growth' : 'steady';
        } else {
          kind = totalSavings >= 0 ? 'saving' : 'growth';
          shiftPct = 0;
        }
      }
    }

    return {
      monthlySpendingData: series,
      totalSixMonthSpend: Math.round(totalSpend * 100) / 100,
      avgMonthlySpend: Math.round(avgSpend * 100) / 100,
      totalSixMonthSavings: Math.round(totalSavings * 100) / 100,
      trajectoryKind: kind,
      trajectoryPct: shiftPct,
      hasLiveMonthlyData: totalSpend > 0 || totalIncome > 0,
    };
  }, [recordedTransactions, effectiveSpendingCurrency, viewMode, locale]);

  const gridColor = isDark ? '#263449' : '#E2E8F0';
  const axisColor = isDark ? '#94A3B8' : '#64748B';

  const activeAccountDatum =
    hoveredBarIndex !== null ? accountChartData[hoveredBarIndex] ?? null : null;

  const activeTrendDatum =
    hoveredTrendIndex !== null ? trendChartData[hoveredTrendIndex] ?? null : null;

  const activeSpendingDatum =
    hoveredSpendingIndex !== null
      ? monthlySpendingData[hoveredSpendingIndex] ?? null
      : null;

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
            {formatFullCurrency(value, 'RWF')}
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
                {formatFullCurrency(incomeVal, 'RWF')}
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
                {formatFullCurrency(expensesVal, 'RWF')}
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
            {formatFullCurrency(netVal, 'RWF')}
          </span>
        </div>
      </div>
    );
  };

  const renderSpendingTrendTooltip = ({ active, payload }: CustomTooltipProps) => {
    if (!active || !payload || payload.length === 0) return null;
    const row = payload[0]?.payload as MonthlySpendingDatum | undefined;
    if (!row) return null;

    return (
      <div className="min-w-[220px] rounded-xl border border-slate-200 bg-white/95 px-3.5 py-3 text-xs shadow-xl backdrop-blur-xs dark:border-[#263449] dark:bg-[#162235]/95">
        <div className="flex items-center justify-between gap-3">
          <p className="font-display font-bold text-slate-900 dark:text-white">{row.label}</p>
          {row.momChangePct !== null && (
            <span
              className={`font-mono-num rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                row.momChangePct > 0
                  ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                  : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
              }`}
            >
              {row.momChangePct > 0 ? `+${row.momChangePct}%` : `${row.momChangePct}%`}
            </span>
          )}
        </div>

        <div className="mt-2 space-y-1.5">
          <div className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
              <span
                className={`h-2 w-2 rounded-full ${
                  row.trendDirection === 'growth'
                    ? 'bg-rose-500'
                    : row.trendDirection === 'saving'
                      ? 'bg-emerald-500'
                      : 'bg-[#7C3AED]'
                }`}
              />
              {c.monthlySpendSeries}
            </span>
            <span className="font-mono-num font-bold text-slate-900 dark:text-white">
              {formatFullCurrency(row.spending, effectiveSpendingCurrency)}
            </span>
          </div>

          <div className="flex items-center justify-between gap-4">
            <span className="text-slate-500 dark:text-slate-400">{c.incomeSeries}</span>
            <span className="font-mono-num font-semibold text-slate-700 dark:text-slate-200">
              {formatFullCurrency(row.income, effectiveSpendingCurrency)}
            </span>
          </div>

          {showProjectedTrendLine && (
            <div className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                <span className="h-2 w-2 rounded-full bg-[#F59E0B]" />
                {c.projectedSpendSeries}
              </span>
              <span className="font-mono-num font-semibold text-amber-600 dark:text-amber-400">
                {formatFullCurrency(row.projectedSpending, effectiveSpendingCurrency)}
              </span>
            </div>
          )}

          <div className="flex items-center justify-between gap-4 border-t border-slate-100 pt-1.5 dark:border-[#263449]">
            <span className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
              <span className="h-2 w-2 rounded-full bg-[#0EA5E9]" />
              {c.netSavingsSeries}
            </span>
            <span
              className={`font-mono-num font-bold ${
                row.netSavings >= 0
                  ? 'text-[#16A34A] dark:text-emerald-400'
                  : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {row.netSavings > 0 ? '+' : ''}
              {formatFullCurrency(row.netSavings, effectiveSpendingCurrency)}
            </span>
          </div>

          {row.savingsRatePct !== null && (
            <div className="flex items-center justify-between gap-4 text-[11px]">
              <span className="text-slate-500 dark:text-slate-400">{c.savingsRateLabel}</span>
              <span className="font-mono-num font-semibold text-sky-600 dark:text-sky-400">
                {row.savingsRatePct}%
              </span>
            </div>
          )}

          {row.topCategory && (
            <div className="flex items-center justify-between gap-4 text-[11px]">
              <span className="text-slate-500 dark:text-slate-400">{c.topCategoryLabel}</span>
              <span className="truncate font-semibold text-slate-700 dark:text-slate-200">
                {row.topCategory}
              </span>
            </div>
          )}
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
                ? `${activeAccountDatum.name}: ${formatFullCurrency(activeAccountDatum.balance, 'RWF')}`
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
                  tickFormatter={(val) => formatCompactCurrency(Number(val), 'RWF')}
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
                  }${formatCompactCurrency(activeTrendDatum.income - activeTrendDatum.expenses, 'RWF')}`
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
                  tickFormatter={(val) => formatCompactCurrency(Number(val), 'RWF')}
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

        {/* 6-Month Spending Trends ComposedChart (Growth vs. Savings Highlights) */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.14, ease: 'easeOut' }}
          className="rounded-2xl border border-slate-200 bg-white p-5 transition-colors hover:border-violet-300 lg:col-span-2 dark:border-[#263449] dark:bg-[#0B1220] dark:hover:border-violet-500/40"
        >
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white">
                  {c.spendingTrendsTitle}
                </h3>
                {trajectoryKind === 'saving' && (
                  <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                    <TrendingDown className="h-3.5 w-3.5" />
                    <span>
                      {c.trendBadgeSaving}
                      {trajectoryPct < 0 ? ` (${trajectoryPct}%)` : ''}
                    </span>
                  </span>
                )}
                {trajectoryKind === 'growth' && (
                  <span className="inline-flex items-center gap-1 rounded-lg bg-rose-100 px-2 py-0.5 text-[11px] font-bold text-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
                    <TrendingUp className="h-3.5 w-3.5" />
                    <span>
                      {c.trendBadgeGrowth}
                      {trajectoryPct > 0 ? ` (+${trajectoryPct}%)` : ''}
                    </span>
                  </span>
                )}
                {trajectoryKind === 'steady' && (
                  <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-700 dark:bg-[#162235] dark:text-slate-300">
                    <Minus className="h-3.5 w-3.5" />
                    <span>{c.trendBadgeSteady}</span>
                  </span>
                )}
                {trajectoryKind === 'no_data' && (
                  <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500 dark:bg-[#162235] dark:text-slate-400">
                    <span>{c.trendBadgeNoData}</span>
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {c.spendingTrendsSubtitle}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <div className="text-left sm:text-right">
                <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  {c.sixMonthTotalLabel}
                </p>
                <p className="font-mono-num text-sm font-bold text-slate-900 dark:text-white">
                  {formatFullCurrency(totalSixMonthSpend, effectiveSpendingCurrency)}
                </p>
              </div>
              <div className="text-left sm:text-right">
                <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  {c.monthlyAvgLabel}
                </p>
                <p className="font-mono-num text-sm font-bold text-[#7C3AED] dark:text-violet-300">
                  {formatFullCurrency(avgMonthlySpend, effectiveSpendingCurrency)}
                </p>
              </div>
              <div className="text-left sm:text-right">
                <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  {c.sixMonthNetSavingsLabel}
                </p>
                <p
                  className={`font-mono-num text-sm font-bold ${
                    totalSixMonthSavings >= 0
                      ? 'text-[#16A34A] dark:text-emerald-400'
                      : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {totalSixMonthSavings > 0 ? '+' : ''}
                  {formatFullCurrency(totalSixMonthSavings, effectiveSpendingCurrency)}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px]">
            <span className="font-mono-num font-medium text-slate-500 dark:text-slate-400">
              {activeSpendingDatum
                ? `${activeSpendingDatum.label}: ${formatFullCurrency(
                    activeSpendingDatum.spending,
                    effectiveSpendingCurrency
                  )}${
                    activeSpendingDatum.momChangePct !== null
                      ? ` (${activeSpendingDatum.momChangePct > 0 ? '+' : ''}${
                          activeSpendingDatum.momChangePct
                        }% ${c.momChangeLabel})`
                      : ''
                  }`
                : !hasLiveMonthlyData && viewMode === 'live'
                  ? c.emptyLiveHint
                  : c.hoverHint}
            </span>

            {trajectoryKind !== 'no_data' && trajectoryPct !== 0 && (
              <span
                className={`font-medium ${
                  trajectoryPct < 0
                    ? 'text-emerald-700 dark:text-emerald-300'
                    : 'text-rose-700 dark:text-rose-300'
                }`}
              >
                {trajectoryPct > 0 ? `+${trajectoryPct}%` : `${trajectoryPct}%`}{' '}
                {trajectoryPct < 0 ? c.spendingDownHint : c.spendingUpHint}
              </span>
            )}
          </div>

          <div className="mt-3 h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                key={`${viewMode}-${effectiveSpendingCurrency}-6m`}
                data={monthlySpendingData}
                margin={{ top: 14, right: 16, left: 0, bottom: 0 }}
                onMouseMove={(state) => {
                  const idx = state?.activeTooltipIndex;
                  setHoveredSpendingIndex(typeof idx === 'number' ? idx : null);
                }}
                onMouseLeave={() => setHoveredSpendingIndex(null)}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: axisColor, fontSize: 12 }}
                  axisLine={{ stroke: gridColor }}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={(val) =>
                    formatCompactCurrency(Number(val), effectiveSpendingCurrency)
                  }
                  tick={{ fill: axisColor, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={54}
                />
                <Tooltip
                  cursor={{
                    fill: isDark ? 'rgba(124, 58, 237, 0.12)' : 'rgba(124, 58, 237, 0.06)',
                  }}
                  content={renderSpendingTrendTooltip}
                />
                {showSixMonthAvgLine && avgMonthlySpend > 0 && (
                  <ReferenceLine
                    y={avgMonthlySpend}
                    stroke="#7C3AED"
                    strokeDasharray="5 4"
                    strokeWidth={1.5}
                    label={{
                      value: `${c.sixMonthAvgLabel}: ${formatCompactCurrency(
                        avgMonthlySpend,
                        effectiveSpendingCurrency
                      )}`,
                      position: 'insideTopRight',
                      fill: isDark ? '#C4B5FD' : '#6D28D9',
                      fontSize: 11,
                      fontWeight: 600,
                    }}
                  />
                )}
                <Bar
                  dataKey="spending"
                  name={c.monthlySpendSeries}
                  radius={[8, 8, 0, 0]}
                  maxBarSize={48}
                  isAnimationActive
                  animationDuration={750}
                  onMouseEnter={(_, index) => setHoveredSpendingIndex(index)}
                  onMouseLeave={() => setHoveredSpendingIndex(null)}
                >
                  {monthlySpendingData.map((entry, idx) => {
                    const barColor =
                      entry.trendDirection === 'growth'
                        ? '#E11D48'
                        : entry.trendDirection === 'saving'
                          ? '#16A34A'
                          : '#7C3AED';
                    const isFocused =
                      hoveredSpendingIndex === null || hoveredSpendingIndex === idx;
                    return (
                      <Cell
                        key={`spend-cell-${entry.monthKey}`}
                        fill={barColor}
                        fillOpacity={isFocused ? 0.92 : 0.35}
                        style={{
                          transition: 'fill-opacity 180ms ease',
                          cursor: 'pointer',
                        }}
                      />
                    );
                  })}
                </Bar>
                {showProjectedTrendLine && (
                  <Line
                    type="monotone"
                    dataKey="projectedSpending"
                    name={c.projectedSpendSeries}
                    stroke="#F59E0B"
                    strokeWidth={2.5}
                    strokeDasharray="6 4"
                    dot={{
                      r: 3.5,
                      fill: '#F59E0B',
                      strokeWidth: 1.5,
                      stroke: isDark ? '#0B1220' : '#FFFFFF',
                    }}
                    activeDot={{
                      r: 5.5,
                      fill: '#F59E0B',
                      strokeWidth: 2,
                      stroke: isDark ? '#0B1220' : '#FFFFFF',
                    }}
                    isAnimationActive
                    animationDuration={850}
                  />
                )}
                {showSpendingSavingsLine && (
                  <Line
                    type="monotone"
                    dataKey="netSavings"
                    name={c.netSavingsSeries}
                    stroke="#0EA5E9"
                    strokeWidth={2.5}
                    dot={{
                      r: 4,
                      fill: '#0EA5E9',
                      strokeWidth: 2,
                      stroke: isDark ? '#0B1220' : '#FFFFFF',
                    }}
                    activeDot={{
                      r: 6,
                      fill: '#0EA5E9',
                      strokeWidth: 2,
                      stroke: isDark ? '#0B1220' : '#FFFFFF',
                    }}
                    isAnimationActive
                    animationDuration={850}
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 dark:border-[#263449]">
            <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-600 dark:text-slate-300">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-xs bg-[#16A34A]" />
                {c.trendBadgeSaving}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-xs bg-[#E11D48]" />
                {c.trendBadgeGrowth}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-xs bg-[#7C3AED]" />
                {locale === 'rw' ? 'Intangiriro' : 'Baseline'}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                aria-pressed={showProjectedTrendLine}
                onClick={() => setShowProjectedTrendLine((v) => !v)}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-all ${
                  showProjectedTrendLine
                    ? 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-300'
                    : 'border-slate-200 bg-slate-50 text-slate-400 opacity-70 hover:opacity-100 dark:border-[#263449] dark:bg-[#162235] dark:text-slate-500'
                }`}
              >
                <span className="h-2 w-2 rounded-full bg-[#F59E0B]" />
                <span>{c.projectedSpendSeries}</span>
              </button>
              <button
                type="button"
                aria-pressed={showSpendingSavingsLine}
                onClick={() => setShowSpendingSavingsLine((v) => !v)}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-all ${
                  showSpendingSavingsLine
                    ? 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/30 dark:bg-sky-950/40 dark:text-sky-300'
                    : 'border-slate-200 bg-slate-50 text-slate-400 opacity-70 hover:opacity-100 dark:border-[#263449] dark:bg-[#162235] dark:text-slate-500'
                }`}
              >
                <span className="h-2 w-2 rounded-full bg-[#0EA5E9]" />
                <span>{c.netSavingsSeries}</span>
              </button>
              <button
                type="button"
                aria-pressed={showSixMonthAvgLine}
                onClick={() => setShowSixMonthAvgLine((v) => !v)}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-all ${
                  showSixMonthAvgLine
                    ? 'border-violet-200 bg-violet-50 text-[#6D28D9] dark:border-violet-500/30 dark:bg-violet-950/40 dark:text-violet-300'
                    : 'border-slate-200 bg-slate-50 text-slate-400 opacity-70 hover:opacity-100 dark:border-[#263449] dark:bg-[#162235] dark:text-slate-500'
                }`}
              >
                <span className="h-0.5 w-3 bg-[#7C3AED]" />
                <span>{c.sixMonthAvgLabel}</span>
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
