import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  Copy,
  Cpu,
  PiggyBank,
  Plus,
  RefreshCw,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { translations, type Locale } from '../i18n/translations';
import type { SavingsGoal } from './BudgetGoals';
import type { BudgetAllocation, LinkedAccountConfig } from './OnboardingWizard';
import type { RecordedTransaction } from './TransactionInput';

export type InsightFocusMode = 'summary' | 'savings' | 'budgets' | 'anomalies';

export interface InsightActionItem {
  title: string;
  detail: string;
  impact: 'high' | 'medium' | 'low';
  targetSection?: 'transactions' | 'budgets' | 'savings';
}

export interface CategoryInsightRow {
  category: string;
  amount: number;
  sharePct: number;
  budgetLimit?: number;
}

export interface MockLLMInsightReport {
  generatedAt: string;
  focusMode: InsightFocusMode;
  headline: string;
  narrativeParagraphs: string[];
  netCashFlow: number;
  totalIncome: number;
  totalExpenses: number;
  savingsRatePct: number | null;
  avgDailySpend: number;
  topCategory: CategoryInsightRow | null;
  categoryBreakdown: CategoryInsightRow[];
  actionableAdvice: InsightActionItem[];
}

export interface AnalyzeFinancesParams {
  transactions: RecordedTransaction[];
  accounts: LinkedAccountConfig[];
  budgets: BudgetAllocation[];
  savingsGoals: SavingsGoal[];
  primaryCurrency: 'RWF' | 'USD';
  monthlyIncomeTarget: number;
  locale: Locale;
  focusMode: InsightFocusMode;
  customPrompt?: string;
  formatAmount: (amount: number, currency: string) => string;
}

export function generateMockLLMFinancialAnalysis({
  transactions,
  accounts,
  budgets,
  savingsGoals,
  primaryCurrency,
  monthlyIncomeTarget,
  locale,
  focusMode,
  customPrompt = '',
  formatAmount,
}: AnalyzeFinancesParams): MockLLMInsightReport {
  const isRw = locale === 'rw';
  const currencyTx = transactions.filter((tx) => tx.currency === primaryCurrency);
  const analysisTx = currencyTx.length > 0 ? currencyTx : transactions;
  const activeCurrency =
    currencyTx.length > 0 ? primaryCurrency : (analysisTx[0]?.currency ?? primaryCurrency);

  const incomeTx = analysisTx.filter((tx) => tx.type === 'income');
  const expenseTx = analysisTx.filter((tx) => tx.type === 'expense');

  const totalIncome = incomeTx.reduce((sum, tx) => sum + tx.amount, 0);
  const totalExpenses = expenseTx.reduce((sum, tx) => sum + tx.amount, 0);
  const netCashFlow = totalIncome - totalExpenses;

  const incomeBase = totalIncome > 0 ? totalIncome : monthlyIncomeTarget;
  const savingsRatePct =
    incomeBase > 0 ? Math.round(((incomeBase - totalExpenses) / incomeBase) * 100) : null;

  const uniqueExpenseDays = new Set(expenseTx.map((tx) => tx.date)).size;
  const avgDailySpend =
    uniqueExpenseDays > 0 ? Math.round(totalExpenses / uniqueExpenseDays) : 0;

  const categoryTotals = expenseTx.reduce<Record<string, number>>((acc, tx) => {
    acc[tx.category] = (acc[tx.category] ?? 0) + tx.amount;
    return acc;
  }, {});

  const budgetByCat = budgets.reduce<Record<string, number>>((acc, b) => {
    acc[b.category] = b.monthlyLimit;
    return acc;
  }, {});

  const categoryBreakdown: CategoryInsightRow[] = Object.entries(categoryTotals)
    .map(([category, amount]) => ({
      category,
      amount,
      sharePct: totalExpenses > 0 ? Math.round((amount / totalExpenses) * 100) : 0,
      budgetLimit: budgetByCat[category],
    }))
    .sort((a, b) => b.amount - a.amount);

  const topCategory = categoryBreakdown[0] ?? null;

  const largestExpense = expenseTx.reduce<RecordedTransaction | null>(
    (max, tx) => (!max || tx.amount > max.amount ? tx : max),
    null
  );

  const avgExpense = expenseTx.length > 0 ? totalExpenses / expenseTx.length : 0;
  const outlierExpenses =
    expenseTx.length >= 3
      ? expenseTx.filter((tx) => tx.amount >= avgExpense * 2)
      : [];

  const budgetOvershoots = budgets
    .map((b) => {
      const spent = categoryTotals[b.category] ?? 0;
      const pct = b.monthlyLimit > 0 ? Math.round((spent / b.monthlyLimit) * 100) : 0;
      return { category: b.category, limit: b.monthlyLimit, spent, pct };
    })
    .filter((b) => b.pct >= 80)
    .sort((a, b) => b.pct - a.pct);

  const totalGoalRemaining = savingsGoals.reduce(
    (sum, g) => sum + Math.max(0, g.targetAmount - g.currentAmount),
    0
  );

  const promptClean = customPrompt.trim();
  const promptLower = promptClean.toLowerCase();

  // Check if user's custom prompt mentions a specific expense category
  const mentionedCategory = categoryBreakdown.find((row) =>
    promptLower.includes(row.category.toLowerCase())
  );

  const accountSpendTotals = expenseTx.reduce<Record<string, number>>((acc, tx) => {
    acc[tx.accountName] = (acc[tx.accountName] ?? 0) + tx.amount;
    return acc;
  }, {});
  const topAccountEntry = Object.entries(accountSpendTotals).sort((a, b) => b[1] - a[1])[0];

  const headline = isRw
    ? netCashFlow >= 0
      ? `Ubwizigame bw’inyongera bwa ${formatAmount(netCashFlow, activeCurrency)} mu bikorwa ${analysisTx.length}`
      : `Ikinyuranyo gihomba cya ${formatAmount(Math.abs(netCashFlow), activeCurrency)} mu bikorwa ${analysisTx.length}`
    : netCashFlow >= 0
      ? `Net Cash-Flow Surplus of ${formatAmount(netCashFlow, activeCurrency)} Across ${analysisTx.length} Entries`
      : `Cash-Flow Deficit of ${formatAmount(Math.abs(netCashFlow), activeCurrency)} Across ${analysisTx.length} Entries`;

  const narrativeParagraphs: string[] = [];

  // Paragraph 1: Overall financial position
  if (isRw) {
    narrativeParagraphs.push(
      `Mu gusesengura ibikorwa ${analysisTx.length} byanditswe mu ifaranga rya ${activeCurrency}, ibyinjiye byose bigera kuri ${formatAmount(totalIncome, activeCurrency)} naho ibyasohotse bingana na ${formatAmount(totalExpenses, activeCurrency)}. ${
        netCashFlow >= 0
          ? `Urugendo rw’amafaranga ruri mu nyungu ya ${formatAmount(netCashFlow, activeCurrency)}${
              savingsRatePct !== null ? ` (igipimo cyo kuzigama cya ${savingsRatePct}%)` : ''
            }.`
          : `Ibikoreshwa biruta ibyinjiye ho ${formatAmount(Math.abs(netCashFlow), activeCurrency)}, bikaba bisaba kugabanya ibyiciro bitari ngombwa.`
      }`
    );
  } else {
    narrativeParagraphs.push(
      `Based on ${analysisTx.length} recorded ${activeCurrency} ledger ${
        analysisTx.length === 1 ? 'entry' : 'entries'
      }, total inflows stand at ${formatAmount(totalIncome, activeCurrency)} against ${formatAmount(
        totalExpenses,
        activeCurrency
      )} in outflows. ${
        netCashFlow >= 0
          ? `Your cash flow is positive by ${formatAmount(netCashFlow, activeCurrency)}${
              savingsRatePct !== null
                ? `, reflecting a ${savingsRatePct}% retention rate against your income baseline`
                : ''
            }.`
          : `Outflows currently exceed recorded inflows by ${formatAmount(
              Math.abs(netCashFlow),
              activeCurrency
            )}, signaling a cash-flow shortfall that merits attention.`
      }`
    );
  }

  // Paragraph 2: Focus-specific or prompt-specific analysis
  if (mentionedCategory) {
    narrativeParagraphs.push(
      isRw
        ? `Ku bijyanye n’icyiciro cya ${mentionedCategory.category} wabajije: hamaze gukoreshwa ${formatAmount(mentionedCategory.amount, activeCurrency)} (${mentionedCategory.sharePct}% by’ibyasohotse byose)${
            mentionedCategory.budgetLimit
              ? `, ugereranyije n’umupaka w’ukwezi wa ${formatAmount(mentionedCategory.budgetLimit, activeCurrency)}`
              : ''
          }. Kugabanya 15% muri iki cyiciro byazigama ${formatAmount(Math.round(mentionedCategory.amount * 0.15), activeCurrency)}.`
        : `Addressing your focus on "${mentionedCategory.category}": this category accounts for ${formatAmount(
            mentionedCategory.amount,
            activeCurrency
          )} (${mentionedCategory.sharePct}% of total expenses)${
            mentionedCategory.budgetLimit
              ? ` out of a ${formatAmount(mentionedCategory.budgetLimit, activeCurrency)} monthly budget limit`
              : ''
          }. Trimming 15% here would immediately free up ${formatAmount(
            Math.round(mentionedCategory.amount * 0.15),
            activeCurrency
          )} toward savings or debt reduction.`
    );
  } else if (focusMode === 'savings') {
    const suggestedMonthlySave = Math.max(
      0,
      Math.round((netCashFlow > 0 ? netCashFlow : incomeBase * 0.15) * 0.5)
    );
    narrativeParagraphs.push(
      isRw
        ? `Mu isesengura ryo kuzigama: ${
            savingsGoals.length > 0
              ? `ufite intego ${savingsGoals.length} zisigaje ${formatAmount(totalGoalRemaining, primaryCurrency)} kugira ngo zigerweho.`
              : `ntabwo urashyiraho intego zo kuzigama muri sisitemu.`
          } Kwigomwa byibura ${formatAmount(suggestedMonthlySave, activeCurrency)} buri gihe byihutisha umutekano w’imari yawe.`
        : `Savings Strategy Synthesis: ${
            savingsGoals.length > 0
              ? `you currently track ${savingsGoals.length} active savings ${
                  savingsGoals.length === 1 ? 'goal' : 'goals'
                } with ${formatAmount(totalGoalRemaining, primaryCurrency)} remaining to reach full funding.`
              : `no active savings goals are configured yet.`
          } Automating a recurring transfer of ${formatAmount(
            suggestedMonthlySave,
            activeCurrency
          )} right after income arrives will lock in progress before discretionary spending occurs.`
    );
  } else if (focusMode === 'budgets') {
    narrativeParagraphs.push(
      isRw
        ? budgets.length > 0
          ? `Mu igenzura ry’ingengo y’imari (${budgets.length} byiciro): ${
              budgetOvershoots.length > 0
                ? `${budgetOvershoots[0].category} igeze kuri ${budgetOvershoots[0].pct}% by’umupaka wayo (${formatAmount(budgetOvershoots[0].spent, activeCurrency)} / ${formatAmount(budgetOvershoots[0].limit, activeCurrency)}).`
                : `ibyiciro byose by’ingengo biracyari munsi ya 80% y’imipaka yabyo.`
            }`
          : `Nta ngengo y’imari irashyirwaho kugira ngo igereranywe n’ibyasohotse. Fungura umufasha wo gutangira ushyireho imipaka kuri buri cyiciro.`
        : budgets.length > 0
          ? `Budget Adherence Analysis (${budgets.length} configured categories): ${
              budgetOvershoots.length > 0
                ? `${budgetOvershoots[0].category} is running hottest at ${budgetOvershoots[0].pct}% utilization (${formatAmount(
                    budgetOvershoots[0].spent,
                    activeCurrency
                  )} of ${formatAmount(budgetOvershoots[0].limit, activeCurrency)}).`
                : `all monitored categories remain comfortably below the 80% warning threshold.`
            }`
          : `No monthly budget limits are configured yet to benchmark category spending. Setting limits for your top categories will enable automated threshold alerts.`
    );
  } else if (focusMode === 'anomalies') {
    narrativeParagraphs.push(
      isRw
        ? outlierExpenses.length > 0
          ? `Mu isuzuma ry’ibidasanzwe: habonetse ibikorwa ${outlierExpenses.length} biruta inshuro ebyiri impuzandengo ya ${formatAmount(Math.round(avgExpense), activeCurrency)}, icya mbere kikaba "${outlierExpenses[0].description}" (${formatAmount(outlierExpenses[0].amount, outlierExpenses[0].currency)}).`
          : `Nta gikorwa kirenze cyane impuzandengo (${formatAmount(Math.round(avgExpense), activeCurrency)}) cyabonetse mu mikoreshereze yawe kugeza ubu.`
        : outlierExpenses.length > 0
          ? `Outlier & Velocity Review: detected ${outlierExpenses.length} expense ${
              outlierExpenses.length === 1 ? 'entry' : 'entries'
            } at least 2x above your ${formatAmount(
              Math.round(avgExpense),
              activeCurrency
            )} average expense—led by "${outlierExpenses[0].description}" (${formatAmount(
              outlierExpenses[0].amount,
              outlierExpenses[0].currency
            )} on ${outlierExpenses[0].date}).`
          : `Outlier & Velocity Review: spending entries remain evenly distributed around your ${formatAmount(
              Math.round(avgExpense),
              activeCurrency
            )} average expense with no sharp single-transaction spikes.`
    );
  } else if (topCategory) {
    narrativeParagraphs.push(
      isRw
        ? `Icyiciro cyatwaye amafaranga menshi ni ${topCategory.category} bingana na ${formatAmount(topCategory.amount, activeCurrency)} (${topCategory.sharePct}% by’ibyasohotse byose), mu gihe impuzandengo yo gusohora ku munsi ari ${formatAmount(avgDailySpend, activeCurrency)}${
            topAccountEntry ? `, kandi konti yakoreshejwe cyane ni ${topAccountEntry[0]}` : ''
          }.`
        : `Spending concentration is led by ${topCategory.category} at ${formatAmount(
            topCategory.amount,
            activeCurrency
          )} (${topCategory.sharePct}% of total outflows), with an active daily spend pace of ${formatAmount(
            avgDailySpend,
            activeCurrency
          )}${topAccountEntry ? ` routed primarily through ${topAccountEntry[0]}` : ''}.`
    );
  } else {
    narrativeParagraphs.push(
      isRw
        ? `Kugeza ubu handitswe ibyinjiye gusa (${formatAmount(totalIncome, activeCurrency)}). Komeza kwandika ibisohoka kugira ngo isesengura rigaragaze imigabane y’ibyiciro.`
        : `Only inflow entries (${formatAmount(
            totalIncome,
            activeCurrency
          )}) have been recorded so far. Recording day-to-day expenses will unlock category breakdown and burn-rate projections.`
    );
  }

  if (promptClean && !mentionedCategory) {
    narrativeParagraphs.push(
      isRw
        ? `Icyo wasuzumishije ("${promptClean}"): mu mibare ufite ubu kuri konti ${accounts.length}, igikorwa kinini gisohoka ni ${
            largestExpense
              ? `${largestExpense.description} (${formatAmount(largestExpense.amount, largestExpense.currency)})`
              : 'ntacyo'
          }, kandi amahirwe yihuse ari mu kugenzura icyiciro cya mbere gifata ${topCategory?.sharePct ?? 0}%.`
        : `Regarding your question ("${promptClean}"): across your ${accounts.length} active accounts, your single largest outflow is ${
            largestExpense
              ? `"${largestExpense.description}" (${formatAmount(
                  largestExpense.amount,
                  largestExpense.currency
                )})`
              : 'not yet recorded'
          }, making top-category optimization (${
            topCategory ? `${topCategory.category} at ${topCategory.sharePct}%` : 'steady inflows'
          }) your highest-leverage next step.`
    );
  }

  // Actionable Advice Generation
  const actionableAdvice: InsightActionItem[] = [];

  if (topCategory && topCategory.sharePct >= 35) {
    const save10 = Math.round(topCategory.amount * 0.1);
    actionableAdvice.push({
      title: isRw
        ? `Gabanya 10% muri ${topCategory.category}`
        : `Trim ${topCategory.category} by 10%`,
      detail: isRw
        ? `${topCategory.category} ifata ${topCategory.sharePct}% by’ibyasohotse byose. Kugabanyaho 10% bizazigama ${formatAmount(save10, activeCurrency)}.`
        : `${topCategory.category} represents ${topCategory.sharePct}% of all spending. A modest 10% reduction saves ${formatAmount(save10, activeCurrency)} this cycle.`,
      impact: 'high',
      targetSection: 'transactions',
    });
  }

  if (budgetOvershoots.length > 0) {
    const worst = budgetOvershoots[0];
    actionableAdvice.push({
      title: isRw
        ? `Hagarika gusesagura muri ${worst.category}`
        : `Rebalance ${worst.category} Budget`,
      detail: isRw
        ? `Umupaka wa ${worst.category} ugeze kuri ${worst.pct}%. Genzura ibisohoka muri iki cyiciro cyangwa wongereho umupaka ukwiye.`
        : `${worst.category} has reached ${worst.pct}% of its ${formatAmount(worst.limit, activeCurrency)} cap. Pause non-essential purchases here until the next cycle.`,
      impact: 'high',
      targetSection: 'budgets',
    });
  } else if (budgets.length === 0 && expenseTx.length > 0) {
    actionableAdvice.push({
      title: isRw
        ? 'Shyiraho imipaka y’ingengo y’imari'
        : 'Assign Monthly Category Budgets',
      detail: isRw
        ? 'Kugira ngo ubone imiburo mbere yo kurenza urugero, shyiraho ingengo y’ukwezi kuri buri cyiciro.'
        : 'Configure monthly caps in Budgets so real-time alerts warn you automatically at 80% utilization.',
      impact: 'medium',
      targetSection: 'budgets',
    });
  }

  if (savingsGoals.length === 0) {
    actionableAdvice.push({
      title: isRw
        ? 'Tangira intego yo kuzigama'
        : 'Create a Dedicated Savings Goal',
      detail: isRw
        ? 'Shyiraho intego y’ubwizigame (urugero: Ikigega cy’ibiza) kugira ngo amafaranga asigara agire icyerekezo.'
        : 'Channel net cash-flow surpluses into a tracked milestone ring in Savings Goals to protect your reserves.',
      impact: 'medium',
      targetSection: 'savings',
    });
  } else if (netCashFlow > 0) {
    const alloc = Math.round(netCashFlow * 0.35);
    actionableAdvice.push({
      title: isRw
        ? `Ongera ${formatAmount(alloc, activeCurrency)} ku ntego zo kuzigama`
        : `Allocate ${formatAmount(alloc, activeCurrency)} to Goals`,
      detail: isRw
        ? `Ufite inyongera ya ${formatAmount(netCashFlow, activeCurrency)}. Kujyana 35% mu ntego zawe byihutisha kugera kuri ${savingsGoals[0].name}.`
        : `With a ${formatAmount(netCashFlow, activeCurrency)} surplus, directing 35% toward "${savingsGoals[0].name}" accelerates completion without straining cash flow.`,
      impact: 'medium',
      targetSection: 'savings',
    });
  }

  if (actionableAdvice.length === 0) {
    actionableAdvice.push({
      title: isRw
        ? 'Komeza kwandika ibikorwa buri munsi'
        : 'Maintain Consistent Ledger Logging',
      detail: isRw
        ? 'Kwandika ibyinjiye n’ibisohoka buri munsi bituma isesengura rya AI rirushaho gutanga imibare yizewe.'
        : 'Continue recording transactions as they occur so daily burn-rate and anomaly models stay sharp.',
      impact: 'low',
      targetSection: 'transactions',
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    focusMode,
    headline,
    narrativeParagraphs,
    netCashFlow,
    totalIncome,
    totalExpenses,
    savingsRatePct,
    avgDailySpend,
    topCategory,
    categoryBreakdown: categoryBreakdown.slice(0, 5),
    actionableAdvice: actionableAdvice.slice(0, 3),
  };
}

export function runMockLLMFinancialAnalysis(
  params: AnalyzeFinancesParams
): Promise<MockLLMInsightReport> {
  return new Promise((resolve) => {
    window.setTimeout(() => {
      resolve(generateMockLLMFinancialAnalysis(params));
    }, 320);
  });
}

interface AIInsightsProps {
  transactions: RecordedTransaction[];
  accounts: LinkedAccountConfig[];
  budgets: BudgetAllocation[];
  savingsGoals: SavingsGoal[];
  primaryCurrency: 'RWF' | 'USD';
  monthlyIncomeTarget: number;
  locale: Locale;
  formatAmount: (amount: number, currency: string) => string;
  onRecordClick: () => void;
  onNavigateSection: (section: 'transactions' | 'budgets' | 'savings') => void;
}

export function AIInsights({
  transactions,
  accounts,
  budgets,
  savingsGoals,
  primaryCurrency,
  monthlyIncomeTarget,
  locale,
  formatAmount,
  onRecordClick,
  onNavigateSection,
}: AIInsightsProps) {
  const ai = translations[locale].dashboard.aiInsights;

  const [focusMode, setFocusMode] = useState<InsightFocusMode>('summary');
  const [promptInput, setPromptInput] = useState('');
  const [appliedPrompt, setAppliedPrompt] = useState('');
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [report, setReport] = useState<MockLLMInsightReport | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (transactions.length === 0) {
      setReport(null);
      setIsAnalyzing(false);
      return;
    }

    let cancelled = false;
    setIsAnalyzing(true);

    runMockLLMFinancialAnalysis({
      transactions,
      accounts,
      budgets,
      savingsGoals,
      primaryCurrency,
      monthlyIncomeTarget,
      locale,
      focusMode,
      customPrompt: appliedPrompt,
      formatAmount,
    }).then((result) => {
      if (!cancelled) {
        setReport(result);
        setIsAnalyzing(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [
    transactions,
    accounts,
    budgets,
    savingsGoals,
    primaryCurrency,
    monthlyIncomeTarget,
    locale,
    focusMode,
    appliedPrompt,
    refreshNonce,
  ]);

  const handleCopySummary = async () => {
    if (!report) return;
    const text = [
      report.headline,
      '',
      ...report.narrativeParagraphs,
      '',
      ...report.actionableAdvice.map((item) => `• ${item.title}: ${item.detail}`),
    ].join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      // Clipboard unavailable in restricted context
    }
  };

  const focusTabs: { id: InsightFocusMode; label: string }[] = [
    { id: 'summary', label: ai.focusModes.summary },
    { id: 'savings', label: ai.focusModes.savings },
    { id: 'budgets', label: ai.focusModes.budgets },
    { id: 'anomalies', label: ai.focusModes.anomalies },
  ];

  const activeCurrency =
    transactions.some((t) => t.currency === primaryCurrency)
      ? primaryCurrency
      : (transactions[0]?.currency ?? primaryCurrency);

  return (
    <section className="space-y-6" aria-label={ai.title}>
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              {ai.title}
            </h1>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-200 bg-violet-50 px-2.5 py-0.5 text-[11px] font-semibold text-[#6D28D9] dark:border-violet-500/30 dark:bg-violet-950/40 dark:text-violet-300">
              <Cpu className="h-3 w-3" />
              <span>{ai.engineBadge}</span>
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{ai.subtitle}</p>
        </div>

        {transactions.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
            <button
              type="button"
              onClick={handleCopySummary}
              disabled={!report || isAnalyzing}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-[#263449] dark:bg-[#0B1220] dark:text-slate-200 dark:hover:bg-[#162235]"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-[#16A34A]" />
              ) : (
                <Copy className="h-3.5 w-3.5 text-[#7C3AED]" />
              )}
              <span>{copied ? ai.copiedBtn : ai.copyBtn}</span>
            </button>
            <button
              type="button"
              onClick={() => setRefreshNonce((n) => n + 1)}
              disabled={isAnalyzing}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#7C3AED] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#6D28D9] disabled:opacity-60"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isAnalyzing ? 'animate-spin' : ''}`} />
              <span>{ai.refreshBtn}</span>
            </button>
          </div>
        )}
      </div>

      {/* Empty State when no transaction history exists */}
      {transactions.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center dark:border-[#263449] dark:bg-[#0B1220]">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-100 text-[#7C3AED] dark:bg-violet-950/60">
            <Sparkles className="h-6 w-6" />
          </div>
          <h2 className="font-display mt-4 text-lg font-bold text-slate-900 dark:text-white">
            {ai.emptyTitle}
          </h2>
          <p className="mx-auto mt-1.5 max-w-lg text-xs leading-relaxed text-slate-600 dark:text-slate-300">
            {ai.emptyDesc}
          </p>
          <button
            type="button"
            onClick={onRecordClick}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#7C3AED] px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-[#6D28D9]"
          >
            <Plus className="h-4 w-4" />
            <span>{ai.recordCta}</span>
          </button>
        </div>
      ) : (
        <>
          {/* Analysis Lens Tabs & Custom Focus Prompt */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-[#263449] dark:bg-[#0B1220]">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label={ai.focusLabel}>
                {focusTabs.map((tab) => {
                  const active = focusMode === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setFocusMode(tab.id)}
                      className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors ${
                        active
                          ? 'bg-[#7C3AED] text-white'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-[#162235] dark:text-slate-200 dark:hover:bg-[#1E2D45]'
                      }`}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setAppliedPrompt(promptInput.trim());
                  setRefreshNonce((n) => n + 1);
                }}
                className="flex w-full items-center gap-2 lg:max-w-md"
              >
                <input
                  type="text"
                  value={promptInput}
                  onChange={(e) => setPromptInput(e.target.value)}
                  placeholder={ai.promptPlaceholder}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#7C3AED] focus:bg-white focus:outline-none dark:border-[#263449] dark:bg-[#162235] dark:text-slate-100 dark:focus:bg-[#0B1220]"
                />
                <button
                  type="submit"
                  className="shrink-0 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-semibold text-[#6D28D9] transition-colors hover:bg-violet-100 dark:border-violet-500/30 dark:bg-violet-950/40 dark:text-violet-300"
                >
                  {ai.promptSubmit}
                </button>
              </form>
            </div>

            {/* Quick Prompt Chips */}
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 dark:border-[#263449]">
              {ai.quickPrompts.map((qp) => (
                <button
                  key={qp}
                  type="button"
                  onClick={() => {
                    setPromptInput(qp);
                    setAppliedPrompt(qp);
                    setRefreshNonce((n) => n + 1);
                  }}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600 transition-colors hover:border-violet-300 hover:text-[#7C3AED] dark:border-[#263449] dark:bg-[#162235] dark:text-slate-300 dark:hover:text-violet-300"
                >
                  {qp}
                </button>
              ))}
            </div>
          </div>

          {isAnalyzing || !report ? (
            <div className="flex items-center gap-3 rounded-2xl border border-violet-200 bg-violet-50/70 p-6 text-xs font-semibold text-[#6D28D9] dark:border-violet-500/30 dark:bg-violet-950/30 dark:text-violet-300">
              <RefreshCw className="h-4 w-4 animate-spin" />
              <span>{ai.analyzingLabel}</span>
            </div>
          ) : (
            <>
              {/* Summary Metrics Strip */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-[#263449] dark:bg-[#0B1220]">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      {ai.metricNetFlow}
                    </span>
                    {report.netCashFlow >= 0 ? (
                      <TrendingUp className="h-4 w-4 text-[#16A34A]" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-rose-500" />
                    )}
                  </div>
                  <p
                    className={`font-mono-num mt-2 text-xl font-bold ${
                      report.netCashFlow >= 0
                        ? 'text-[#16A34A]'
                        : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {report.netCashFlow > 0 ? '+' : ''}
                    {formatAmount(report.netCashFlow, activeCurrency)}
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-[#263449] dark:bg-[#0B1220]">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      {ai.metricSavingsRate}
                    </span>
                    <PiggyBank className="h-4 w-4 text-[#7C3AED]" />
                  </div>
                  <p className="font-mono-num mt-2 text-xl font-bold text-slate-900 dark:text-white">
                    {report.savingsRatePct !== null ? `${report.savingsRatePct}%` : '—'}
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-[#263449] dark:bg-[#0B1220]">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      {ai.metricDailyBurn}
                    </span>
                    <Target className="h-4 w-4 text-[#7C3AED]" />
                  </div>
                  <p className="font-mono-num mt-2 text-xl font-bold text-slate-900 dark:text-white">
                    {formatAmount(report.avgDailySpend, activeCurrency)}
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-[#263449] dark:bg-[#0B1220]">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      {ai.metricTxCount}
                    </span>
                    <Cpu className="h-4 w-4 text-[#7C3AED]" />
                  </div>
                  <p className="font-mono-num mt-2 text-xl font-bold text-slate-900 dark:text-white">
                    {transactions.length}
                  </p>
                </div>
              </div>

              {/* Narrative Summary + Category Breakdown */}
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
                <div className="rounded-2xl border border-slate-200 bg-white p-6 lg:col-span-7 dark:border-[#263449] dark:bg-[#0B1220]">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-[#7C3AED] dark:bg-violet-950/60">
                      <Sparkles className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold tracking-wide text-[#7C3AED] uppercase">
                        {ai.narrativeHeading}
                      </p>
                      <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                        {report.headline}
                      </h2>
                    </div>
                  </div>

                  <div className="mt-4 space-y-3 text-sm leading-relaxed text-slate-700 dark:text-slate-200">
                    {report.narrativeParagraphs.map((para, idx) => (
                      <p key={idx}>{para}</p>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-6 lg:col-span-5 dark:border-[#263449] dark:bg-[#0B1220]">
                  <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                    {ai.breakdownHeading}
                  </h2>

                  {report.categoryBreakdown.length === 0 ? (
                    <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                      {ai.emptyDesc}
                    </p>
                  ) : (
                    <div className="mt-4 space-y-3.5">
                      {report.categoryBreakdown.map((row) => (
                        <div key={row.category}>
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-slate-800 dark:text-slate-100">
                              {row.category}
                            </span>
                            <span className="font-mono-num text-slate-600 dark:text-slate-300">
                              {formatAmount(row.amount, activeCurrency)} ({row.sharePct}%)
                            </span>
                          </div>
                          <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-[#162235]">
                            <div
                              className="h-full rounded-full bg-[#7C3AED] transition-all"
                              style={{ width: `${Math.min(100, row.sharePct)}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Actionable Financial Advice */}
              <div>
                <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                  {ai.adviceHeading}
                </h2>
                <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-3">
                  {report.actionableAdvice.map((advice, idx) => {
                    const impactBadge =
                      advice.impact === 'high'
                        ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300'
                        : advice.impact === 'medium'
                          ? 'bg-violet-100 text-[#6D28D9] dark:bg-violet-950/50 dark:text-violet-300'
                          : 'bg-slate-100 text-slate-700 dark:bg-[#162235] dark:text-slate-300';
                    const impactLabel =
                      advice.impact === 'high'
                        ? ai.impactHigh
                        : advice.impact === 'medium'
                          ? ai.impactMedium
                          : ai.impactLow;

                    return (
                      <div
                        key={idx}
                        className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 dark:border-[#263449] dark:bg-[#0B1220]"
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${impactBadge}`}
                            >
                              {advice.impact === 'high' && (
                                <AlertTriangle className="h-3 w-3" />
                              )}
                              {impactLabel}
                            </span>
                          </div>
                          <h3 className="font-display mt-3 text-sm font-bold text-slate-900 dark:text-white">
                            {advice.title}
                          </h3>
                          <p className="mt-1.5 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                            {advice.detail}
                          </p>
                        </div>

                        {advice.targetSection && (
                          <button
                            type="button"
                            onClick={() => onNavigateSection(advice.targetSection!)}
                            className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-[#7C3AED] hover:underline"
                          >
                            <span>{ai.inspectAction}</span>
                            <ArrowRight className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}
