import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileText,
  PieChart,
  X,
} from 'lucide-react';
import { translations, type Locale } from '../i18n/translations';
import {
  exportFinancialData,
  type ExportDataset,
  type ExportFormat,
} from '../utils/exportFinancialData';
import type { SavingsGoal } from './BudgetGoals';
import type { BudgetAllocation, LinkedAccountConfig } from './OnboardingWizard';
import type { RecordedTransaction } from './TransactionInput';

interface ExportModalProps {
  open: boolean;
  onClose: () => void;
  initialDataset?: ExportDataset;
  locale: Locale;
  userName: string;
  userEmail: string;
  primaryCurrency: 'RWF' | 'USD';
  monthlyIncomeTarget: number;
  accounts: LinkedAccountConfig[];
  transactions: RecordedTransaction[];
  budgets: BudgetAllocation[];
  savingsGoals: SavingsGoal[];
  onExported?: (filename: string) => void;
}

export function ExportModal({
  open,
  onClose,
  initialDataset = 'financial_report',
  locale,
  userName,
  userEmail,
  primaryCurrency,
  monthlyIncomeTarget,
  accounts,
  transactions,
  budgets,
  savingsGoals,
  onExported,
}: ExportModalProps) {
  const ef = translations[locale].dashboard.exportFeature;

  const [dataset, setDataset] = useState<ExportDataset>(initialDataset);
  const [format, setFormat] = useState<ExportFormat>('csv');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [downloadedFile, setDownloadedFile] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setDataset(initialDataset);
    setDownloadedFile(null);
  }, [open, initialDataset]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const filteredTxnCount = transactions.filter((tx) => {
    if (fromDate && tx.date < fromDate) return false;
    if (toDate && tx.date > toDate) return false;
    return true;
  }).length;

  const handleDownload = () => {
    const filename = exportFinancialData({
      dataset,
      format,
      userName,
      userEmail,
      primaryCurrency,
      monthlyIncomeTarget,
      accounts,
      transactions,
      budgets,
      savingsGoals,
      fromDate: fromDate || undefined,
      toDate: toDate || undefined,
    });
    setDownloadedFile(filename);
    onExported?.(filename);
  };

  const datasetOptions: { id: ExportDataset; icon: typeof FileText }[] = [
    { id: 'financial_report', icon: FileText },
    { id: 'transaction_history', icon: FileSpreadsheet },
    { id: 'budget_summary', icon: PieChart },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-modal-title"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-[#263449] dark:bg-[#0B1220]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5 dark:border-[#263449]">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-[#7C3AED] dark:bg-violet-950/60">
              <Download className="h-5 w-5" />
            </div>
            <div>
              <h2
                id="export-modal-title"
                className="font-display text-lg font-bold text-slate-900 dark:text-white"
              >
                {ef.modalTitle}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">{ef.modalSubtitle}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={ef.cancel}
            className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-[#162235] dark:hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          {/* Dataset Selection */}
          <div>
            <span className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
              {ef.datasetLabel}
            </span>
            <div className="mt-2 space-y-2.5">
              {datasetOptions.map((opt) => {
                const Icon = opt.icon;
                const copy = ef.datasets[opt.id];
                const selected = dataset === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setDataset(opt.id);
                      setDownloadedFile(null);
                    }}
                    className={`flex w-full items-start gap-3 rounded-xl border p-3.5 text-left transition-colors ${
                      selected
                        ? 'border-[#7C3AED] bg-violet-50/70 dark:bg-violet-950/30'
                        : 'border-slate-200 bg-slate-50/60 hover:bg-slate-100/70 dark:border-[#263449] dark:bg-[#162235]/40 dark:hover:bg-[#162235]'
                    }`}
                  >
                    <div
                      className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                        selected
                          ? 'bg-[#7C3AED] text-white'
                          : 'bg-slate-200/70 text-slate-600 dark:bg-[#263449] dark:text-slate-300'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-900 dark:text-white">
                        {copy.title}
                      </p>
                      <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                        {copy.desc}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Format Selection */}
          <div>
            <span className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
              {ef.formatLabel}
            </span>
            <div className="mt-2 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {(
                [
                  { id: 'csv', title: ef.csvLabel, desc: ef.csvDesc, icon: FileSpreadsheet },
                  { id: 'pdf', title: ef.pdfLabel, desc: ef.pdfDesc, icon: FileText },
                ] as const
              ).map((fmt) => {
                const Icon = fmt.icon;
                const selected = format === fmt.id;
                return (
                  <button
                    key={fmt.id}
                    type="button"
                    onClick={() => {
                      setFormat(fmt.id);
                      setDownloadedFile(null);
                    }}
                    className={`flex items-start gap-2.5 rounded-xl border p-3 text-left transition-colors ${
                      selected
                        ? 'border-[#7C3AED] bg-violet-50/70 dark:bg-violet-950/30'
                        : 'border-slate-200 bg-slate-50/60 hover:bg-slate-100/70 dark:border-[#263449] dark:bg-[#162235]/40 dark:hover:bg-[#162235]'
                    }`}
                  >
                    <Icon
                      className={`mt-0.5 h-4 w-4 shrink-0 ${
                        selected ? 'text-[#7C3AED]' : 'text-slate-500 dark:text-slate-400'
                      }`}
                    />
                    <div>
                      <p className="text-xs font-bold text-slate-900 dark:text-white">
                        {fmt.title}
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                        {fmt.desc}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Optional Date Range */}
          <div>
            <span className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
              {ef.dateRangeLabel}
            </span>
            <div className="mt-2 grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="export-from-date"
                  className="block text-[11px] text-slate-500 dark:text-slate-400"
                >
                  {ef.fromDate}
                </label>
                <input
                  id="export-from-date"
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs text-slate-900 focus:border-[#7C3AED] focus:outline-none dark:border-[#263449] dark:bg-[#162235] dark:text-slate-100"
                />
              </div>
              <div>
                <label
                  htmlFor="export-to-date"
                  className="block text-[11px] text-slate-500 dark:text-slate-400"
                >
                  {ef.toDate}
                </label>
                <input
                  id="export-to-date"
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs text-slate-900 focus:border-[#7C3AED] focus:outline-none dark:border-[#263449] dark:bg-[#162235] dark:text-slate-100"
                />
              </div>
            </div>
          </div>

          {/* Data Scope Summary */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-xs text-slate-600 dark:border-[#263449] dark:bg-[#162235]/50 dark:text-slate-300">
            <span className="font-semibold text-slate-800 dark:text-slate-100">
              {ef.summaryPreview}{' '}
            </span>
            <span className="font-mono-num font-bold text-[#7C3AED]">{accounts.length}</span>{' '}
            {ef.accountsCount} ·{' '}
            <span className="font-mono-num font-bold text-[#7C3AED]">{filteredTxnCount}</span>{' '}
            {ef.transactionsCount} ·{' '}
            <span className="font-mono-num font-bold text-[#7C3AED]">{budgets.length}</span>{' '}
            {ef.budgetsCount} ·{' '}
            <span className="font-mono-num font-bold text-[#7C3AED]">{savingsGoals.length}</span>{' '}
            {ef.goalsCount}
          </div>

          {downloadedFile && (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs font-medium text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-950/40 dark:text-emerald-300">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-[#16A34A]" />
              <span>
                {ef.downloadedNotice} <span className="font-mono-num font-bold">{downloadedFile}</span>
              </span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2.5 border-t border-slate-200 bg-slate-50/70 px-6 py-4 dark:border-[#263449] dark:bg-[#0B1220]">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-[#263449] dark:bg-[#162235] dark:text-slate-200"
          >
            {ef.cancel}
          </button>
          <button
            type="button"
            onClick={handleDownload}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#7C3AED] px-5 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#6D28D9]"
          >
            <Download className="h-3.5 w-3.5" />
            <span>{format === 'csv' ? ef.downloadCsv : ef.downloadPdf}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
