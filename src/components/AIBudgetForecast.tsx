import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  Calendar,
  Check,
  CheckCircle2,
  Cpu,
  RefreshCw,
  SlidersHorizontal,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { translations, type Locale } from '../i18n/translations';
import type { BudgetAllocation } from './OnboardingWizard';
import type { RecordedTransaction } from './TransactionInput';

export interface ForecastMonthProjection {
  monthKey: string;
  label: string;
  projectedSpending: number;
  confidenceLow: number;
  confidenceHigh: number;
  rationale: string;
}

export interface CategoryBudgetRecommendation {
  category: string;
  historicalMonthlyAvg: number;
  currentBudgetLimit: number;
  recommendedMonthlyBudget: number;
  deltaPct: number;
  driver: string;
}

export interface SavedBudgetForecast {
  id: string;
  currency: 'RWF' | 'USD';
  horizonMonths: 3 | 6;
  modelName: string;
  totalRecommendedMonthlyBudget: number;
  confidenceScore: number;
  riskLevel: 'low' | 'moderate' | 'elevated';
  aiSummary: string;
  forecastMonths: ForecastMonthProjection[];
  categoryRecommendations: CategoryBudgetRecommendation[];
  updatedAt: string;
}

export interface HistoricalMonthBucket {
  monthKey: string;
  label: string;
  totalSpent: number;
  totalIncome: number;
  categoryTotals: Record<string, number>;
}

export interface ForecastChartPoint {
  monthKey: string;
  label: string;
  kind: 'actual' | 'forecast';
  actualSpending: number | null;
  projectedSpending: number | null;
  actualIncome: number | null;
  budgetCap: number | null;
  confidenceRange: [number, number] | null;
  rationale?: string;
}

interface AIBudgetForecastProps {
  transactions: RecordedTransaction[];
  budgets: BudgetAllocation[];
  primaryCurrency: 'RWF' | 'USD';
  monthlyIncomeTarget: number;
  locale: Locale;
  formatAmount: (amount: number, currency: string) => string;
  savedForecast: SavedBudgetForecast | null;
  onSaveForecast: (forecast: SavedBudgetForecast) => Promise<void> | void;
  onApplyBudgetRecommendation: (category: string, monthlyLimit: number) => void;
  onApplyAllBudgetRecommendations: (
    recommendations: Array<{ category: string; monthlyLimit: number }>
  ) => void;
  onRecordClick?: () => void;
}

function getMonthWindows(horizonMonths: 3 | 6, now: Date = new Date()): {
  historical: { monthKey: string; label: string }[];
  upcoming: { monthKey: string; label: string }[];
} {
  const baseYear = now.getFullYear();
  const baseMonth = now.getMonth();

  const historical: { monthKey: string; label: string }[] = [];
  for (let offset = 5; offset >= 0; offset -= 1) {
    const dt = new Date(baseYear, baseMonth - offset, 1);
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const shortM = new Intl.DateTimeFormat('en-US', { month: 'short' }).format(dt);
    historical.push({
      monthKey: `${y}-${m}`,
      label: `${shortM} '${String(y).slice(-2)}`,
    });
  }

  const upcoming: { monthKey: string; label: string }[] = [];
  for (let ahead = 1; ahead <= horizonMonths; ahead += 1) {
    const dt = new Date(baseYear, baseMonth + ahead, 1);
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const shortM = new Intl.DateTimeFormat('en-US', { month: 'short' }).format(dt);
    upcoming.push({
      monthKey: `${y}-${m}`,
      label: `${shortM} '${String(y).slice(-2)}`,
    });
  }

  return { historical, upcoming };
}

function formatCompactAxis(value: number, currency: string): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}${Math.round(abs / 1_000)}k`;
  return currency === 'USD' ? `${sign}$${Math.round(abs)}` : String(Math.round(value));
}

function computeStatisticalProjection(params: {
  historicalMonths: HistoricalMonthBucket[];
  upcomingMonths: { monthKey: string; label: string }[];
  budgets: BudgetAllocation[];
  recurringMonthlyFloor: number;
}): {
  projectedMonths: ForecastMonthProjection[];
  historicalFitted: number[];
  categoryBaselines: CategoryBudgetRecommendation[];
  trendSlopePct: number;
} {
  const { historicalMonths, upcomingMonths, budgets, recurringMonthlyFloor } = params;
  const nonZeroIndices = historicalMonths
    .map((m, idx) => (m.totalSpent > 0 ? idx : -1))
    .filter((idx) => idx >= 0);

  const activeSpends = nonZeroIndices.map((idx) => historicalMonths[idx].totalSpent);
  const overallAvg =
    activeSpends.length > 0
      ? activeSpends.reduce((s, v) => s + v, 0) / activeSpends.length
      : 0;

  // Weighted average emphasizing recent 3 active months
  let weightedBase = overallAvg;
  if (activeSpends.length > 0) {
    const recent = activeSpends.slice(-3);
    const weights = recent.map((_, i) => i + 1);
    const wSum = weights.reduce((a, b) => a + b, 0);
    weightedBase = recent.reduce((sum, val, i) => sum + val * weights[i], 0) / wSum;
  }
  weightedBase = Math.max(weightedBase, recurringMonthlyFloor);

  // Dampened month-over-month linear slope
  let monthlyDelta = 0;
  if (activeSpends.length >= 2) {
    const n = activeSpends.length;
    const xMean = (n - 1) / 2;
    const yMean = overallAvg;
    let num = 0;
    let den = 0;
    for (let i = 0; i < n; i += 1) {
      num += (i - xMean) * (activeSpends[i] - yMean);
      den += (i - xMean) * (i - xMean);
    }
    const rawSlope = den > 0 ? num / den : 0;
    // Clamp slope to +/- 12% of base per month so spikes do not explode long horizons
    const maxStep = Math.max(1, weightedBase * 0.12);
    monthlyDelta = Math.max(-maxStep, Math.min(maxStep, rawSlope * 0.55));
  }

  const trendSlopePct =
    weightedBase > 0 ? Math.round((monthlyDelta / weightedBase) * 100) : 0;

  // Compute historical fitted values so the Projected Spending line is visible alongside actuals
  const historicalFitted = historicalMonths.map((bucket, idx) => {
    if (idx === historicalMonths.length - 1) {
      return Math.round(bucket.totalSpent * 100) / 100;
    }
    const sliceStart = Math.max(0, idx - 2);
    const windowVals = historicalMonths
      .slice(sliceStart, idx + 1)
      .map((m) => m.totalSpent)
      .filter((v) => v > 0);
    if (windowVals.length === 0) return 0;
    const avg = windowVals.reduce((s, v) => s + v, 0) / windowVals.length;
    return Math.round(avg * 100) / 100;
  });

  const projectedMonths: ForecastMonthProjection[] = upcomingMonths.map((u, idx) => {
    const step = idx + 1;
    const projectedRaw = Math.max(
      recurringMonthlyFloor,
      weightedBase + monthlyDelta * step
    );
    const projectedSpending = Math.round(projectedRaw * 100) / 100;
    const spread = Math.min(0.24, 0.08 + idx * 0.025);
    return {
      monthKey: u.monthKey,
      label: u.label,
      projectedSpending,
      confidenceLow: Math.round(projectedSpending * (1 - spread) * 100) / 100,
      confidenceHigh: Math.round(projectedSpending * (1 + spread) * 100) / 100,
      rationale: '',
    };
  });

  // Category-level baselines
  const budgetMap = new Map(
    budgets.filter((b) => b.enabled).map((b) => [b.category, b.monthlyLimit])
  );
  const categorySet = new Set<string>(budgetMap.keys());
  historicalMonths.forEach((m) => {
    Object.keys(m.categoryTotals).forEach((cat) => categorySet.add(cat));
  });

  const activeMonthDivisor = Math.max(1, nonZeroIndices.length);
  const categoryBaselines: CategoryBudgetRecommendation[] = Array.from(categorySet)
    .map((category) => {
      const catSeries = historicalMonths.map((m) => m.categoryTotals[category] ?? 0);
      const totalCat = catSeries.reduce((s, v) => s + v, 0);
      const avg = Math.round((totalCat / activeMonthDivisor) * 100) / 100;
      const currentLimit = budgetMap.get(category) ?? 0;
      const recentAvg =
        catSeries.slice(-2).reduce((s, v) => s + v, 0) /
        Math.max(1, catSeries.slice(-2).filter((v) => v > 0).length || 2);
      const blended = Math.max(avg, recentAvg * 0.65 + avg * 0.35);
      const recommended = Math.round(blended * 1.04 * 100) / 100;
      const baseRef = currentLimit > 0 ? currentLimit : avg;
      const deltaPct =
        baseRef > 0 ? Math.round(((recommended - baseRef) / baseRef) * 100) : 0;

      return {
        category,
        historicalMonthlyAvg: avg,
        currentBudgetLimit: currentLimit,
        recommendedMonthlyBudget: recommended,
        deltaPct,
        driver: '',
      };
    })
    .filter((row) => row.historicalMonthlyAvg > 0 || row.currentBudgetLimit > 0)
    .sort((a, b) => b.recommendedMonthlyBudget - a.recommendedMonthlyBudget);

  return {
    projectedMonths,
    historicalFitted,
    categoryBaselines,
    trendSlopePct,
  };
}

export function AIBudgetForecast({
  transactions,
  budgets,
  primaryCurrency,
  monthlyIncomeTarget,
  locale,
  formatAmount,
  savedForecast,
  onSaveForecast,
  onApplyBudgetRecommendation,
  onApplyAllBudgetRecommendations,
  onRecordClick,
}: AIBudgetForecastProps) {
  const f = translations[locale].dashboard.budgetForecast;

  const [horizonMonths, setHorizonMonths] = useState<3 | 6>(
    savedForecast?.horizonMonths === 3 ? 3 : 6
  );
  const [adjustmentPct, setAdjustmentPct] = useState<number>(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [appliedCategory, setAppliedCategory] = useState<string | null>(null);
  const [appliedAllNotice, setAppliedAllNotice] = useState(false);
  const [localForecast, setLocalForecast] = useState<SavedBudgetForecast | null>(savedForecast);

  useEffect(() => {
    if (savedForecast) {
      setLocalForecast(savedForecast);
    }
  }, [savedForecast]);

  const effectiveCurrency = useMemo<'RWF' | 'USD'>(() => {
    if (transactions.length === 0) return primaryCurrency;
    if (transactions.some((tx) => tx.currency === primaryCurrency)) {
      return primaryCurrency;
    }
    return transactions[0].currency === 'USD' ? 'USD' : 'RWF';
  }, [transactions, primaryCurrency]);

  const activeBudgets = useMemo(
    () => budgets.filter((b) => b.enabled && b.monthlyLimit > 0),
    [budgets]
  );

  const totalCurrentBudgetCap = useMemo(
    () => activeBudgets.reduce((sum, b) => sum + b.monthlyLimit, 0),
    [activeBudgets]
  );

  const { historical: historicalWindow, upcoming: upcomingWindow } = useMemo(
    () => getMonthWindows(horizonMonths),
    [horizonMonths]
  );

  const historicalMonths: HistoricalMonthBucket[] = useMemo(() => {
    return historicalWindow.map((bucket) => {
      const monthTxns = transactions.filter(
        (tx) => tx.date.startsWith(bucket.monthKey) && tx.currency === effectiveCurrency
      );
      let totalSpent = 0;
      let totalIncome = 0;
      const categoryTotals: Record<string, number> = {};

      monthTxns.forEach((tx) => {
        if (tx.type === 'expense') {
          totalSpent += tx.amount;
          categoryTotals[tx.category] = (categoryTotals[tx.category] ?? 0) + tx.amount;
        } else {
          totalIncome += tx.amount;
        }
      });

      return {
        monthKey: bucket.monthKey,
        label: bucket.label,
        totalSpent: Math.round(totalSpent * 100) / 100,
        totalIncome: Math.round(totalIncome * 100) / 100,
        categoryTotals,
      };
    });
  }, [historicalWindow, transactions, effectiveCurrency]);

  const recurringExpenses = useMemo(() => {
    return transactions
      .filter(
        (tx) =>
          tx.isRecurring &&
          tx.type === 'expense' &&
          tx.currency === effectiveCurrency
      )
      .map((tx) => ({
        category: tx.category,
        description: tx.description,
        amount: tx.amount,
        frequency: tx.recurringFrequency,
      }));
  }, [transactions, effectiveCurrency]);

  const recurringMonthlyFloor = useMemo(() => {
    return recurringExpenses.reduce((sum, item) => {
      if (item.frequency === 'daily') return sum + item.amount * 30;
      if (item.frequency === 'weekly') return sum + item.amount * 4.33;
      if (item.frequency === 'monthly') return sum + item.amount;
      return sum;
    }, 0);
  }, [recurringExpenses]);

  const statistical = useMemo(
    () =>
      computeStatisticalProjection({
        historicalMonths,
        upcomingMonths: upcomingWindow,
        budgets: activeBudgets,
        recurringMonthlyFloor,
      }),
    [historicalMonths, upcomingWindow, activeBudgets, recurringMonthlyFloor]
  );

  const activeAiForecast = useMemo(() => {
    if (!localForecast) return null;
    if (localForecast.currency !== effectiveCurrency) return null;
    return localForecast;
  }, [localForecast, effectiveCurrency]);

  const hasHistoricalExpenses = useMemo(
    () => historicalMonths.some((m) => m.totalSpent > 0),
    [historicalMonths]
  );

  const adjustmentMultiplier = 1 + adjustmentPct / 100;

  const chartData: ForecastChartPoint[] = useMemo(() => {
    const histPoints: ForecastChartPoint[] = historicalMonths.map((bucket, idx) => ({
      monthKey: bucket.monthKey,
      label: bucket.label,
      kind: 'actual',
      actualSpending: bucket.totalSpent,
      projectedSpending:
        statistical.historicalFitted[idx] > 0
          ? Math.round(statistical.historicalFitted[idx] * 100) / 100
          : bucket.totalSpent,
      actualIncome: bucket.totalIncome,
      budgetCap: totalCurrentBudgetCap > 0 ? totalCurrentBudgetCap : null,
      confidenceRange: null,
    }));

    const aiByKey = new Map(
      (activeAiForecast?.forecastMonths ?? []).map((item) => [item.monthKey, item])
    );

    const forecastPoints: ForecastChartPoint[] = upcomingWindow.map((u, idx) => {
      const aiMatch = aiByKey.get(u.monthKey);
      const statMatch = statistical.projectedMonths[idx];
      const baseProj = aiMatch ? aiMatch.projectedSpending : statMatch?.projectedSpending ?? 0;
      const baseLow = aiMatch ? aiMatch.confidenceLow : statMatch?.confidenceLow ?? 0;
      const baseHigh = aiMatch ? aiMatch.confidenceHigh : statMatch?.confidenceHigh ?? 0;

      const projectedSpending = Math.round(baseProj * adjustmentMultiplier * 100) / 100;
      const low = Math.round(baseLow * adjustmentMultiplier * 100) / 100;
      const high = Math.round(baseHigh * adjustmentMultiplier * 100) / 100;

      return {
        monthKey: u.monthKey,
        label: u.label,
        kind: 'forecast',
        actualSpending: null,
        projectedSpending,
        actualIncome: null,
        budgetCap: totalCurrentBudgetCap > 0 ? totalCurrentBudgetCap : null,
        confidenceRange: [low, high],
        rationale: aiMatch?.rationale || undefined,
      };
    });

    return [...histPoints, ...forecastPoints];
  }, [
    historicalMonths,
    upcomingWindow,
    statistical,
    activeAiForecast,
    totalCurrentBudgetCap,
    adjustmentMultiplier,
  ]);

  const effectiveRecommendations: CategoryBudgetRecommendation[] = useMemo(() => {
    const baseList =
      activeAiForecast && activeAiForecast.categoryRecommendations.length > 0
        ? activeAiForecast.categoryRecommendations
        : statistical.categoryBaselines;

    return baseList.map((row) => {
      const scaledRecommended =
        Math.round(row.recommendedMonthlyBudget * adjustmentMultiplier * 100) / 100;
      const refBase =
        row.currentBudgetLimit > 0 ? row.currentBudgetLimit : row.historicalMonthlyAvg;
      const deltaPct =
        refBase > 0
          ? Math.round(((scaledRecommended - refBase) / refBase) * 100)
          : row.deltaPct;
      return {
        ...row,
        recommendedMonthlyBudget: scaledRecommended,
        deltaPct,
      };
    });
  }, [activeAiForecast, statistical.categoryBaselines, adjustmentMultiplier]);

  const nextMonthProjection =
    chartData.find((pt) => pt.kind === 'forecast')?.projectedSpending ?? 0;

  const totalRecommendedMonthlyBudget = useMemo(() => {
    if (effectiveRecommendations.length > 0) {
      return (
        Math.round(
          effectiveRecommendations.reduce(
            (sum, item) => sum + item.recommendedMonthlyBudget,
            0
          ) * 100
        ) / 100
      );
    }
    return nextMonthProjection;
  }, [effectiveRecommendations, nextMonthProjection]);

  const budgetGap =
    totalCurrentBudgetCap > 0
      ? Math.round((totalRecommendedMonthlyBudget - totalCurrentBudgetCap) * 100) / 100
      : 0;

  const handleGenerateAiForecast = async () => {
    if (!hasHistoricalExpenses && activeBudgets.length === 0) return;
    setIsGenerating(true);
    setApiError(null);

    try {
      const response = await fetch('/api/forecast-budget', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currency: effectiveCurrency,
          locale,
          horizonMonths,
          monthlyIncomeTarget,
          historicalMonths,
          currentBudgets: activeBudgets.map((b) => ({
            category: b.category,
            monthlyLimit: b.monthlyLimit,
          })),
          recurringExpenses,
          upcomingMonths: upcomingWindow,
        }),
      });

      const payload = (await response.json()) as Partial<SavedBudgetForecast> & {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error || f.apiErrorFallback);
      }

      const nextForecast: SavedBudgetForecast = {
        id: 'latest',
        currency: effectiveCurrency,
        horizonMonths,
        modelName: payload.modelName || 'gemini-4-hydrogen',
        totalRecommendedMonthlyBudget:
          typeof payload.totalRecommendedMonthlyBudget === 'number'
            ? payload.totalRecommendedMonthlyBudget
            : totalRecommendedMonthlyBudget,
        confidenceScore:
          typeof payload.confidenceScore === 'number' ? payload.confidenceScore : 75,
        riskLevel:
          payload.riskLevel === 'low' ||
          payload.riskLevel === 'moderate' ||
          payload.riskLevel === 'elevated'
            ? payload.riskLevel
            : 'moderate',
        aiSummary: typeof payload.aiSummary === 'string' ? payload.aiSummary : '',
        forecastMonths: Array.isArray(payload.forecastMonths)
          ? payload.forecastMonths
          : [],
        categoryRecommendations: Array.isArray(payload.categoryRecommendations)
          ? payload.categoryRecommendations
          : [],
        updatedAt: new Date().toISOString(),
      };

      setLocalForecast(nextForecast);
      await onSaveForecast(nextForecast);
    } catch (err) {
      const msg = err instanceof Error ? err.message : f.apiErrorFallback;
      setApiError(msg);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleApplyCategory = (category: string, monthlyLimit: number) => {
    onApplyBudgetRecommendation(category, monthlyLimit);
    setAppliedCategory(category);
    window.setTimeout(() => {
      setAppliedCategory((curr) => (curr === category ? null : curr));
    }, 2400);
  };

  const handleApplyAll = () => {
    const items = effectiveRecommendations
      .filter((r) => r.recommendedMonthlyBudget > 0)
      .map((r) => ({
        category: r.category,
        monthlyLimit: r.recommendedMonthlyBudget,
      }));
    if (items.length === 0) return;
    onApplyAllBudgetRecommendations(items);
    setAppliedAllNotice(true);
    window.setTimeout(() => setAppliedAllNotice(false), 3000);
  };

  const isDark =
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
  const gridColor = isDark ? '#263449' : '#E2E8F0';
  const axisColor = isDark ? '#94A3B8' : '#64748B';

  return (
    <section
      className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 dark:border-[#263449] dark:bg-[#0B1220]"
      aria-label={f.title}
    >
      {/* Header Row */}
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
              {f.title}
            </h2>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-200 bg-violet-50 px-2.5 py-0.5 text-[11px] font-semibold text-[#6D28D9] dark:border-violet-500/30 dark:bg-violet-950/40 dark:text-violet-300">
              <Cpu className="h-3 w-3" />
              <span>
                {activeAiForecast ? f.aiEngineActiveBadge : f.baselineEngineBadge}
              </span>
            </span>
            {activeAiForecast && (
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                  activeAiForecast.riskLevel === 'elevated'
                    ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300'
                    : activeAiForecast.riskLevel === 'low'
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                      : 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300'
                }`}
              >
                {activeAiForecast.riskLevel === 'elevated' ? (
                  <AlertTriangle className="h-3 w-3" />
                ) : (
                  <CheckCircle2 className="h-3 w-3" />
                )}
                <span>
                  {f.riskLabels[activeAiForecast.riskLevel]} · {activeAiForecast.confidenceScore}%{' '}
                  {f.confidenceWord}
                </span>
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{f.subtitle}</p>
        </div>

        {/* Controls: Horizon + Run Gemini AI Forecast */}
        <div className="flex flex-wrap items-center gap-2.5 self-start lg:self-auto">
          <div
            className="inline-flex items-center rounded-xl border border-slate-200 bg-slate-100 p-1 dark:border-[#263449] dark:bg-[#162235]"
            role="group"
            aria-label={f.horizonLabel}
          >
            <button
              type="button"
              onClick={() => setHorizonMonths(3)}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
                horizonMonths === 3
                  ? 'bg-white text-slate-900 shadow-xs dark:bg-[#7C3AED] dark:text-white'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-300'
              }`}
            >
              {f.horizon3m}
            </button>
            <button
              type="button"
              onClick={() => setHorizonMonths(6)}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
                horizonMonths === 6
                  ? 'bg-white text-slate-900 shadow-xs dark:bg-[#7C3AED] dark:text-white'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-300'
              }`}
            >
              {f.horizon6m}
            </button>
          </div>

          <button
            type="button"
            onClick={() => void handleGenerateAiForecast()}
            disabled={isGenerating || (!hasHistoricalExpenses && activeBudgets.length === 0)}
            className="inline-flex items-center gap-2 rounded-xl bg-[#7C3AED] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#6D28D9] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isGenerating ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            <span>
              {isGenerating
                ? f.generatingBtn
                : activeAiForecast
                  ? f.regenerateBtn
                  : f.generateBtn}
            </span>
          </button>
        </div>
      </div>

      {/* API Error Alert (never silently masked) */}
      {apiError && (
        <div
          role="alert"
          className="mt-4 flex items-start justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs text-amber-900 dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-200"
        >
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <div>
              <p className="font-semibold">{f.apiErrorTitle}</p>
              <p className="mt-0.5 opacity-90">{apiError}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setApiError(null)}
            className="shrink-0 font-semibold underline hover:no-underline"
          >
            {f.dismissError}
          </button>
        </div>
      )}

      {!hasHistoricalExpenses && activeBudgets.length === 0 ? (
        <div className="mt-5 rounded-xl border border-dashed border-slate-200 bg-slate-50/70 p-8 text-center dark:border-[#263449] dark:bg-[#162235]/40">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-violet-100 text-[#7C3AED] dark:bg-violet-950/60">
            <Calendar className="h-5 w-5" />
          </div>
          <h3 className="font-display mt-3 text-sm font-bold text-slate-900 dark:text-white">
            {f.emptyTitle}
          </h3>
          <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-slate-600 dark:text-slate-300">
            {f.emptyDesc}
          </p>
          {onRecordClick && (
            <button
              type="button"
              onClick={onRecordClick}
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-[#7C3AED] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#6D28D9]"
            >
              <span>{f.emptyCta}</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Summary KPI Strip */}
          <div className="mt-5 grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-[#263449] dark:bg-[#162235]/60">
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                {f.kpiNextMonthProjected}
              </p>
              <p className="font-mono-num mt-1.5 text-lg font-bold text-amber-600 dark:text-amber-400">
                {formatAmount(nextMonthProjection, effectiveCurrency)}
              </p>
              <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                {upcomingWindow[0]?.label}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-[#263449] dark:bg-[#162235]/60">
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                {f.kpiRecommendedBudget}
              </p>
              <p className="font-mono-num mt-1.5 text-lg font-bold text-[#7C3AED] dark:text-violet-300">
                {formatAmount(totalRecommendedMonthlyBudget, effectiveCurrency)}
              </p>
              <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                {effectiveRecommendations.length} {f.categoriesTrackedWord}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-[#263449] dark:bg-[#162235]/60">
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                {f.kpiBudgetVariance}
              </p>
              <p
                className={`font-mono-num mt-1.5 text-lg font-bold ${
                  totalCurrentBudgetCap === 0
                    ? 'text-slate-700 dark:text-slate-200'
                    : budgetGap > 0
                      ? 'text-rose-600 dark:text-rose-400'
                      : 'text-[#16A34A] dark:text-emerald-400'
                }`}
              >
                {totalCurrentBudgetCap > 0
                  ? `${budgetGap > 0 ? '+' : ''}${formatAmount(budgetGap, effectiveCurrency)}`
                  : f.noBudgetSetShort}
              </p>
              <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                {totalCurrentBudgetCap > 0
                  ? `${f.currentCapPrefix} ${formatAmount(totalCurrentBudgetCap, effectiveCurrency)}`
                  : f.configureBudgetsHint}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-[#263449] dark:bg-[#162235]/60">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  {f.kpiVelocity}
                </span>
                {statistical.trendSlopePct <= 0 ? (
                  <TrendingDown className="h-4 w-4 text-[#16A34A]" />
                ) : (
                  <TrendingUp className="h-4 w-4 text-rose-500" />
                )}
              </div>
              <p
                className={`font-mono-num mt-1.5 text-lg font-bold ${
                  statistical.trendSlopePct <= 0
                    ? 'text-[#16A34A] dark:text-emerald-400'
                    : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {statistical.trendSlopePct > 0
                  ? `+${statistical.trendSlopePct}%`
                  : `${statistical.trendSlopePct}%`}
              </p>
              <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                {f.monthlyMomentumHint}
              </p>
            </div>
          </div>

          {/* Scenario Sensitivity Slider + AI Summary Banner */}
          <div className="mt-4 flex flex-col justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3 sm:flex-row sm:items-center dark:border-[#263449] dark:bg-[#162235]/50">
            <div className="flex items-center gap-2.5 text-xs text-slate-700 dark:text-slate-200">
              <SlidersHorizontal className="h-4 w-4 shrink-0 text-[#7C3AED]" />
              <span className="font-semibold">{f.scenarioLabel}:</span>
              <span className="font-mono-num rounded-md bg-white px-2 py-0.5 font-bold text-[#6D28D9] shadow-2xs dark:bg-[#0B1220] dark:text-violet-300">
                {adjustmentPct > 0 ? `+${adjustmentPct}%` : `${adjustmentPct}%`}
              </span>
            </div>

            <div className="flex flex-1 items-center gap-3 sm:max-w-xs">
              <span className="font-mono-num text-[11px] text-slate-500">-20%</span>
              <input
                type="range"
                min={-20}
                max={20}
                step={2}
                value={adjustmentPct}
                onChange={(e) => setAdjustmentPct(Number(e.target.value))}
                aria-label={f.scenarioLabel}
                className="h-1.5 w-full cursor-pointer accent-[#7C3AED]"
              />
              <span className="font-mono-num text-[11px] text-slate-500">+20%</span>
              {adjustmentPct !== 0 && (
                <button
                  type="button"
                  onClick={() => setAdjustmentPct(0)}
                  className="text-[11px] font-semibold text-[#7C3AED] hover:underline"
                >
                  {f.resetScenario}
                </button>
              )}
            </div>
          </div>

          {activeAiForecast?.aiSummary && (
            <div className="mt-4 rounded-xl border border-violet-200 bg-violet-50/60 px-4 py-3 text-xs leading-relaxed text-slate-800 dark:border-violet-500/30 dark:bg-violet-950/30 dark:text-slate-200">
              <div className="flex items-start gap-2.5">
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[#7C3AED] dark:text-violet-300" />
                <div>
                  <span className="font-bold text-[#6D28D9] dark:text-violet-300">
                    {f.aiSummaryPrefix}:{' '}
                  </span>
                  <span>{activeAiForecast.aiSummary}</span>
                </div>
              </div>
            </div>
          )}

          {/* Recharts Actual Spending vs Projected Spending Line Chart */}
          <div className="mt-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white">
                {f.chartTitle}
              </h3>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                {f.chartSubtitle}
              </span>
            </div>

            <div className="mt-3 h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={chartData}
                  margin={{ top: 14, right: 18, left: 4, bottom: 4 }}
                >
                  <defs>
                    <linearGradient id="forecastBandGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.22} />
                      <stop offset="95%" stopColor="#F59E0B" stopOpacity={0.04} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: axisColor, fontSize: 11 }}
                    axisLine={{ stroke: gridColor }}
                    tickLine={false}
                  />
                  <YAxis
                    tickFormatter={(val) =>
                      formatCompactAxis(Number(val), effectiveCurrency)
                    }
                    tick={{ fill: axisColor, fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    width={54}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload || payload.length === 0) return null;
                      const pt = payload[0]?.payload as ForecastChartPoint | undefined;
                      if (!pt) return null;
                      return (
                        <div className="max-w-[260px] rounded-xl border border-slate-200 bg-white/95 px-3.5 py-2.5 text-xs shadow-xl backdrop-blur-xs dark:border-[#263449] dark:bg-[#162235]/95">
                          <div className="flex items-center justify-between gap-3">
                            <p className="font-display font-bold text-slate-900 dark:text-white">
                              {pt.label}
                            </p>
                            <span
                              className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                                pt.kind === 'forecast'
                                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                                  : 'bg-violet-100 text-[#6D28D9] dark:bg-violet-950/60 dark:text-violet-300'
                              }`}
                            >
                              {pt.kind === 'forecast' ? f.tagForecast : f.tagActual}
                            </span>
                          </div>

                          <div className="mt-2 space-y-1">
                            {pt.actualSpending !== null && (
                              <div className="flex items-center justify-between gap-4">
                                <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                                  <span className="h-2 w-2 rounded-xs bg-[#7C3AED]" />
                                  {f.actualSpendingSeries}
                                </span>
                                <span className="font-mono-num font-bold text-slate-900 dark:text-white">
                                  {formatAmount(pt.actualSpending, effectiveCurrency)}
                                </span>
                              </div>
                            )}

                            {pt.projectedSpending !== null && (
                              <div className="flex items-center justify-between gap-4">
                                <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                                  <span className="h-2 w-2 rounded-full bg-[#F59E0B]" />
                                  {f.projectedSpendingSeries}
                                </span>
                                <span className="font-mono-num font-bold text-amber-600 dark:text-amber-400">
                                  {formatAmount(pt.projectedSpending, effectiveCurrency)}
                                </span>
                              </div>
                            )}

                            {pt.budgetCap !== null && (
                              <div className="flex items-center justify-between gap-4 border-t border-slate-100 pt-1 text-[11px] dark:border-[#263449]">
                                <span className="text-slate-500 dark:text-slate-400">
                                  {f.currentBudgetSeries}
                                </span>
                                <span className="font-mono-num font-semibold text-emerald-600 dark:text-emerald-400">
                                  {formatAmount(pt.budgetCap, effectiveCurrency)}
                                </span>
                              </div>
                            )}

                            {pt.confidenceRange && (
                              <div className="flex items-center justify-between gap-4 text-[11px]">
                                <span className="text-slate-500 dark:text-slate-400">
                                  {f.rangeLabel}
                                </span>
                                <span className="font-mono-num text-slate-700 dark:text-slate-200">
                                  {formatCompactAxis(pt.confidenceRange[0], effectiveCurrency)} –{' '}
                                  {formatCompactAxis(pt.confidenceRange[1], effectiveCurrency)}
                                </span>
                              </div>
                            )}
                          </div>

                          {pt.rationale && (
                            <p className="mt-2 border-t border-slate-100 pt-1.5 text-[11px] leading-snug text-slate-600 dark:border-[#263449] dark:text-slate-300">
                              {pt.rationale}
                            </p>
                          )}
                        </div>
                      );
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />

                  {totalCurrentBudgetCap > 0 && (
                    <ReferenceLine
                      y={totalCurrentBudgetCap}
                      stroke="#16A34A"
                      strokeDasharray="4 4"
                      strokeWidth={1.5}
                      label={{
                        value: `${f.currentBudgetSeries}: ${formatCompactAxis(
                          totalCurrentBudgetCap,
                          effectiveCurrency
                        )}`,
                        position: 'insideTopRight',
                        fill: isDark ? '#6EE7B7' : '#15803D',
                        fontSize: 11,
                        fontWeight: 600,
                      }}
                    />
                  )}

                  <Area
                    type="monotone"
                    dataKey="confidenceRange"
                    name={f.confidenceBandSeries}
                    stroke="none"
                    fill="url(#forecastBandGrad)"
                    connectNulls={false}
                    legendType="none"
                  />

                  <Bar
                    dataKey="actualSpending"
                    name={f.actualSpendingSeries}
                    fill="#7C3AED"
                    fillOpacity={0.85}
                    radius={[6, 6, 0, 0]}
                    maxBarSize={42}
                  />

                  <Line
                    type="monotone"
                    dataKey="projectedSpending"
                    name={f.projectedSpendingSeries}
                    stroke="#F59E0B"
                    strokeWidth={3}
                    strokeDasharray="6 4"
                    dot={{
                      r: 4,
                      fill: '#F59E0B',
                      strokeWidth: 2,
                      stroke: isDark ? '#0B1220' : '#FFFFFF',
                    }}
                    activeDot={{
                      r: 6,
                      fill: '#F59E0B',
                      strokeWidth: 2,
                      stroke: isDark ? '#0B1220' : '#FFFFFF',
                    }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Category-Level Budget Recommendations Table */}
          {effectiveRecommendations.length > 0 && (
            <div className="mt-6 border-t border-slate-100 pt-5 dark:border-[#263449]">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div>
                  <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white">
                    {f.categoryTableTitle}
                  </h3>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    {f.categoryTableSubtitle}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleApplyAll}
                  className="inline-flex items-center gap-1.5 self-start rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs font-semibold text-emerald-800 transition-colors hover:bg-emerald-100 sm:self-auto dark:border-emerald-500/30 dark:bg-emerald-950/40 dark:text-emerald-300"
                >
                  {appliedAllNotice ? (
                    <Check className="h-3.5 w-3.5 text-[#16A34A]" />
                  ) : (
                    <CheckCircle2 className="h-3.5 w-3.5 text-[#16A34A]" />
                  )}
                  <span>{appliedAllNotice ? f.appliedAllBtn : f.applyAllBtn}</span>
                </button>
              </div>

              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase dark:border-[#263449] dark:text-slate-400">
                      <th className="py-2.5 pr-3">{f.colCategory}</th>
                      <th className="py-2.5 px-3 text-right">{f.colHistoricalAvg}</th>
                      <th className="py-2.5 px-3 text-right">{f.colCurrentBudget}</th>
                      <th className="py-2.5 px-3 text-right">{f.colProjectedNeed}</th>
                      <th className="py-2.5 px-3 text-right">{f.colVariance}</th>
                      <th className="py-2.5 pl-3 text-right">{f.colAction}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-[#263449]">
                    {effectiveRecommendations.map((row) => {
                      const wasApplied = appliedCategory === row.category;
                      return (
                        <tr
                          key={row.category}
                          className="transition-colors hover:bg-slate-50/80 dark:hover:bg-[#162235]/50"
                        >
                          <td className="py-3 pr-3">
                            <p className="font-semibold text-slate-900 dark:text-white">
                              {row.category}
                            </p>
                            {row.driver && (
                              <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                                {row.driver}
                              </p>
                            )}
                          </td>
                          <td className="font-mono-num py-3 px-3 text-right text-slate-600 dark:text-slate-300">
                            {formatAmount(row.historicalMonthlyAvg, effectiveCurrency)}
                          </td>
                          <td className="font-mono-num py-3 px-3 text-right text-slate-600 dark:text-slate-300">
                            {row.currentBudgetLimit > 0
                              ? formatAmount(row.currentBudgetLimit, effectiveCurrency)
                              : '—'}
                          </td>
                          <td className="font-mono-num py-3 px-3 text-right font-bold text-[#7C3AED] dark:text-violet-300">
                            {formatAmount(row.recommendedMonthlyBudget, effectiveCurrency)}
                          </td>
                          <td className="font-mono-num py-3 px-3 text-right">
                            <span
                              className={`inline-flex rounded-md px-1.5 py-0.5 text-[11px] font-bold ${
                                row.deltaPct > 5
                                  ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300'
                                  : row.deltaPct < -5
                                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                                    : 'bg-slate-100 text-slate-700 dark:bg-[#162235] dark:text-slate-300'
                              }`}
                            >
                              {row.deltaPct > 0 ? `+${row.deltaPct}%` : `${row.deltaPct}%`}
                            </span>
                          </td>
                          <td className="py-3 pl-3 text-right">
                            <button
                              type="button"
                              onClick={() =>
                                handleApplyCategory(
                                  row.category,
                                  row.recommendedMonthlyBudget
                                )
                              }
                              className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                                wasApplied
                                  ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-950/40 dark:text-emerald-300'
                                  : 'border-violet-200 bg-violet-50 text-[#6D28D9] hover:bg-violet-100 dark:border-violet-500/30 dark:bg-violet-950/40 dark:text-violet-300'
                              }`}
                            >
                              {wasApplied ? (
                                <>
                                  <Check className="h-3 w-3" />
                                  <span>{f.appliedBtn}</span>
                                </>
                              ) : (
                                <span>{f.applyBtn}</span>
                              )}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
