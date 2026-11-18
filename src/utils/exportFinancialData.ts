import { jsPDF } from 'jspdf';
import type { BudgetAllocation, LinkedAccountConfig } from '../components/OnboardingWizard';
import type { SavingsGoal } from '../components/BudgetGoals';
import type { RecordedTransaction } from '../components/TransactionInput';

export type ExportDataset = 'financial_report' | 'transaction_history' | 'budget_summary';
export type ExportFormat = 'csv' | 'pdf';

export interface ExportPayload {
  dataset: ExportDataset;
  format: ExportFormat;
  userName: string;
  userEmail: string;
  primaryCurrency: 'RWF' | 'USD';
  monthlyIncomeTarget: number;
  accounts: LinkedAccountConfig[];
  transactions: RecordedTransaction[];
  budgets: BudgetAllocation[];
  savingsGoals: SavingsGoal[];
  fromDate?: string;
  toDate?: string;
}

function escapeCsvCell(value: string | number): string {
  const str = String(value ?? '');
  // Guard against spreadsheet formula injection on string cells
  const safe = /^[=+\-@]/.test(str) && typeof value === 'string' ? `'${str}` : str;
  if (/[",\r\n]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

function toCsvContent(rows: (string | number)[][]): string {
  return '\uFEFF' + rows.map((row) => row.map(escapeCsvCell).join(',')).join('\r\n');
}

function triggerBlobDownload(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function formatMoney(amount: number, currency: string): string {
  if (currency === 'USD') {
    return `${new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount)} USD`;
  }
  return `${new Intl.NumberFormat('en-US').format(amount)} RWF`;
}

function filterTransactionsByDate(
  transactions: RecordedTransaction[],
  fromDate?: string,
  toDate?: string
): RecordedTransaction[] {
  return transactions.filter((tx) => {
    if (fromDate && tx.date < fromDate) return false;
    if (toDate && tx.date > toDate) return false;
    return true;
  });
}

function computeAccountNetMap(transactions: RecordedTransaction[]): Record<string, number> {
  return transactions.reduce<Record<string, number>>((acc, tx) => {
    const delta = tx.type === 'income' ? tx.amount : -tx.amount;
    acc[tx.accountId] = (acc[tx.accountId] ?? 0) + delta;
    return acc;
  }, {});
}

function computeExpensesByCategory(transactions: RecordedTransaction[]): Record<string, number> {
  return transactions
    .filter((tx) => tx.type === 'expense')
    .reduce<Record<string, number>>((acc, tx) => {
      acc[tx.category] = (acc[tx.category] ?? 0) + tx.amount;
      return acc;
    }, {});
}

function buildFilename(dataset: ExportDataset, format: ExportFormat): string {
  const dateStamp = new Date().toISOString().slice(0, 10);
  const slug =
    dataset === 'financial_report'
      ? 'ai-pfms-financial-report'
      : dataset === 'transaction_history'
        ? 'ai-pfms-transactions'
        : 'ai-pfms-budget-summary';
  return `${slug}-${dateStamp}.${format}`;
}

export function exportFinancialData(payload: ExportPayload): string {
  const filename = buildFilename(payload.dataset, payload.format);
  const filteredTxns = filterTransactionsByDate(
    payload.transactions,
    payload.fromDate,
    payload.toDate
  );

  if (payload.format === 'csv') {
    const csv = generateCsv(payload, filteredTxns);
    triggerBlobDownload(csv, filename, 'text/csv;charset=utf-8;');
    return filename;
  }

  generatePdf(payload, filteredTxns, filename);
  return filename;
}

function generateCsv(
  payload: ExportPayload,
  filteredTxns: RecordedTransaction[]
): string {
  const accountDeltas = computeAccountNetMap(filteredTxns);
  const expensesByCat = computeExpensesByCategory(filteredTxns);
  const generatedAt = new Date().toISOString();

  if (payload.dataset === 'transaction_history') {
    const rows: (string | number)[][] = [
      ['AI-PFMS Transaction History Export'],
      ['Account Holder', payload.userName, 'Email', payload.userEmail],
      ['Generated At', generatedAt, 'Date Filter', `${payload.fromDate || 'Start'} to ${payload.toDate || 'Present'}`],
      [],
      ['Date', 'Reference No', 'Type', 'Category', 'Account', 'Description', 'Currency', 'Amount'],
      ...filteredTxns.map((tx) => [
        tx.date,
        tx.referenceNo,
        tx.type,
        tx.category,
        tx.accountName,
        tx.description,
        tx.currency,
        tx.type === 'income' ? tx.amount : -tx.amount,
      ]),
    ];
    return toCsvContent(rows);
  }

  if (payload.dataset === 'budget_summary') {
    const rows: (string | number)[][] = [
      ['AI-PFMS Budget & Savings Goals Summary'],
      ['Account Holder', payload.userName, 'Primary Currency', payload.primaryCurrency],
      ['Monthly Income Target', payload.monthlyIncomeTarget, 'Generated At', generatedAt],
      [],
      ['Monthly Budget Allocations'],
      ['Category', 'Monthly Limit', 'Spent', 'Remaining', 'Utilization (%)', 'Status'],
      ...payload.budgets.map((b) => {
        const spent = expensesByCat[b.category] ?? 0;
        const remaining = b.monthlyLimit - spent;
        const pct = b.monthlyLimit > 0 ? Math.round((spent / b.monthlyLimit) * 100) : 0;
        return [
          b.category,
          b.monthlyLimit,
          spent,
          remaining,
          `${pct}%`,
          spent > b.monthlyLimit ? 'Over Budget' : 'On Track',
        ];
      }),
      [],
      ['Savings Goals'],
      ['Goal Name', 'Currency', 'Saved', 'Target', 'Remaining', 'Progress (%)', 'Linked Account', 'Target Date'],
      ...payload.savingsGoals.map((g) => {
        const pct = g.targetAmount > 0 ? Math.min(100, Math.round((g.currentAmount / g.targetAmount) * 100)) : 0;
        return [
          g.name,
          g.currency,
          g.currentAmount,
          g.targetAmount,
          Math.max(0, g.targetAmount - g.currentAmount),
          `${pct}%`,
          g.linkedAccountName ?? 'Unlinked',
          g.targetDate ?? '-',
        ];
      }),
    ];
    return toCsvContent(rows);
  }

  // Comprehensive Financial Report
  const rwfOpening = payload.accounts
    .filter((a) => a.currency === 'RWF')
    .reduce((sum, a) => sum + a.openingBalance, 0);
  const rwfIncome = filteredTxns
    .filter((t) => t.currency === 'RWF' && t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);
  const rwfExpenses = filteredTxns
    .filter((t) => t.currency === 'RWF' && t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  const rows: (string | number)[][] = [
    ['AI-PFMS Comprehensive Financial Report'],
    ['Account Holder', payload.userName, 'Email', payload.userEmail],
    ['Generated At', generatedAt, 'Date Range', `${payload.fromDate || 'All'} to ${payload.toDate || 'Present'}`],
    [],
    ['Summary KPIs (RWF)'],
    ['Total Net Balance (RWF)', rwfOpening + rwfIncome - rwfExpenses],
    ['Total Income (RWF)', rwfIncome],
    ['Total Expenses (RWF)', rwfExpenses],
    ['Net Cash Flow (RWF)', rwfIncome - rwfExpenses],
    [],
    ['Financial Accounts'],
    ['Account Name', 'Provider', 'Type', 'Currency', 'Status', 'Opening Balance', 'Period Net Change', 'Current Balance'],
    ...payload.accounts.map((acc) => {
      const delta = accountDeltas[acc.id] ?? 0;
      return [
        acc.name,
        acc.providerLabel || '-',
        acc.type,
        acc.currency,
        acc.status,
        acc.openingBalance,
        delta,
        acc.openingBalance + delta,
      ];
    }),
    [],
    ['Transactions'],
    ['Date', 'Reference No', 'Type', 'Category', 'Account', 'Description', 'Currency', 'Amount'],
    ...filteredTxns.map((tx) => [
      tx.date,
      tx.referenceNo,
      tx.type,
      tx.category,
      tx.accountName,
      tx.description,
      tx.currency,
      tx.type === 'income' ? tx.amount : -tx.amount,
    ]),
  ];

  return toCsvContent(rows);
}

function generatePdf(
  payload: ExportPayload,
  filteredTxns: RecordedTransaction[],
  filename: string
): void {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 40;
  let y = 0;

  const accountDeltas = computeAccountNetMap(filteredTxns);
  const expensesByCat = computeExpensesByCategory(filteredTxns);

  const reportTitle =
    payload.dataset === 'financial_report'
      ? 'Comprehensive Financial Report'
      : payload.dataset === 'transaction_history'
        ? 'Transaction History Ledger'
        : 'Budget & Savings Goals Summary';

  const drawHeader = () => {
    doc.setFillColor(124, 58, 237); // #7C3AED
    doc.rect(0, 0, pageWidth, 68, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('AI-PFMS', margin, 28);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.text(reportTitle, margin, 48);

    doc.setFontSize(9);
    doc.text(
      `Generated: ${new Date().toLocaleString('en-US')}`,
      pageWidth - margin,
      28,
      { align: 'right' }
    );
    doc.text(`${payload.userName} (${payload.userEmail})`, pageWidth - margin, 48, {
      align: 'right',
    });
    y = 92;
  };

  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - 48) {
      doc.addPage();
      y = 48;
    }
  };

  const drawSectionTitle = (title: string) => {
    ensureSpace(32);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text(title, margin, y);
    y += 6;
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, y, pageWidth - margin, y);
    y += 16;
  };

  const drawTable = (headers: string[], colWidths: number[], rows: string[][]) => {
    ensureSpace(26);
    doc.setFillColor(248, 250, 252);
    doc.rect(margin, y - 12, pageWidth - margin * 2, 18, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);

    let x = margin + 4;
    headers.forEach((h, i) => {
      doc.text(h, x, y);
      x += colWidths[i];
    });
    y += 14;

    if (rows.length === 0) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text('No records available for the selected filters.', margin + 4, y);
      y += 20;
      return;
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    rows.forEach((row, rowIdx) => {
      ensureSpace(18);
      if (rowIdx % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(margin, y - 10, pageWidth - margin * 2, 15, 'F');
      }
      doc.setTextColor(15, 23, 42);
      let cx = margin + 4;
      row.forEach((cell, i) => {
        const maxChars = Math.max(6, Math.floor(colWidths[i] / 5));
        const text = cell.length > maxChars ? `${cell.slice(0, maxChars - 1)}...` : cell;
        doc.text(text, cx, y);
        cx += colWidths[i];
      });
      y += 15;
    });
    y += 10;
  };

  drawHeader();

  // Filter period subtitle
  if (payload.fromDate || payload.toDate) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text(
      `Date Range: ${payload.fromDate || 'Beginning'} to ${payload.toDate || 'Present'}`,
      margin,
      y
    );
    y += 18;
  }

  if (payload.dataset === 'financial_report') {
    const rwfOpening = payload.accounts
      .filter((a) => a.currency === 'RWF')
      .reduce((sum, a) => sum + a.openingBalance, 0);
    const rwfIncome = filteredTxns
      .filter((t) => t.currency === 'RWF' && t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
    const rwfExpenses = filteredTxns
      .filter((t) => t.currency === 'RWF' && t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);

    drawSectionTitle('Financial Overview (RWF)');
    const kpis = [
      { label: 'Total Balance', value: formatMoney(rwfOpening + rwfIncome - rwfExpenses, 'RWF') },
      { label: 'Total Income', value: formatMoney(rwfIncome, 'RWF') },
      { label: 'Total Expenses', value: formatMoney(rwfExpenses, 'RWF') },
      { label: 'Net Cash Flow', value: formatMoney(rwfIncome - rwfExpenses, 'RWF') },
    ];
    const boxW = (pageWidth - margin * 2 - 24) / 4;
    kpis.forEach((k, idx) => {
      const bx = margin + idx * (boxW + 8);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(bx, y - 6, boxW, 42, 4, 4, 'S');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(k.label, bx + 8, y + 8);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      doc.text(k.value, bx + 8, y + 25);
    });
    y += 56;

    drawSectionTitle('Financial Accounts');
    drawTable(
      ['Account', 'Provider', 'Type', 'Currency', 'Current Balance'],
      [145, 95, 95, 65, 115],
      payload.accounts.map((acc) => [
        acc.name,
        acc.providerLabel || '-',
        acc.type,
        acc.currency,
        formatMoney(acc.openingBalance + (accountDeltas[acc.id] ?? 0), acc.currency),
      ])
    );
  }

  if (payload.dataset === 'financial_report' || payload.dataset === 'transaction_history') {
    drawSectionTitle(`Transactions (${filteredTxns.length})`);
    drawTable(
      ['Date', 'Ref No', 'Description', 'Category', 'Account', 'Amount'],
      [62, 85, 128, 75, 85, 80],
      filteredTxns.map((tx) => [
        tx.date,
        tx.referenceNo,
        tx.description,
        tx.category,
        tx.accountName,
        `${tx.type === 'income' ? '+' : '-'}${formatMoney(tx.amount, tx.currency)}`,
      ])
    );
  }

  if (payload.dataset === 'budget_summary' || payload.dataset === 'financial_report') {
    drawSectionTitle(`Monthly Budget Allocations (${payload.budgets.length})`);
    drawTable(
      ['Category', 'Monthly Limit', 'Spent', 'Remaining', 'Status'],
      [130, 105, 105, 105, 70],
      payload.budgets.map((b) => {
        const spent = expensesByCat[b.category] ?? 0;
        const remaining = b.monthlyLimit - spent;
        return [
          b.category,
          formatMoney(b.monthlyLimit, payload.primaryCurrency),
          formatMoney(spent, payload.primaryCurrency),
          formatMoney(remaining, payload.primaryCurrency),
          spent > b.monthlyLimit ? 'Over' : 'On Track',
        ];
      })
    );

    drawSectionTitle(`Savings Goals (${payload.savingsGoals.length})`);
    drawTable(
      ['Goal', 'Saved', 'Target', 'Progress', 'Target Date'],
      [150, 105, 105, 65, 90],
      payload.savingsGoals.map((g) => {
        const pct =
          g.targetAmount > 0
            ? Math.min(100, Math.round((g.currentAmount / g.targetAmount) * 100))
            : 0;
        return [
          g.name,
          formatMoney(g.currentAmount, g.currency),
          formatMoney(g.targetAmount, g.currency),
          `${pct}%`,
          g.targetDate || '-',
        ];
      })
    );
  }

  // Footer page numbers
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i += 1) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `AI Personal Finance Management System (AI-PFMS) · Page ${i} of ${pageCount}`,
      pageWidth / 2,
      pageHeight - 20,
      { align: 'center' }
    );
  }

  doc.save(filename);
}
