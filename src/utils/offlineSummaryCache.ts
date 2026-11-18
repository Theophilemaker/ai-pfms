import type { RecordedTransaction } from '../components/TransactionInput';

export interface NonSensitiveCategoryTotal {
  category: string;
  amount: number;
}

export interface NonSensitiveMonthlyTotal {
  monthKey: string;
  income: number;
  expenses: number;
}

export interface NonSensitiveTransactionSummary {
  id: 'latest';
  updatedAt: string;
  primaryCurrency: 'RWF' | 'USD';
  totalIncome: number;
  totalExpenses: number;
  netBalance: number;
  transactionCount: number;
  incomeCount: number;
  expenseCount: number;
  latestTransactionDate: string | null;
  categoryTotals: NonSensitiveCategoryTotal[];
  monthlyTotals: NonSensitiveMonthlyTotal[];
}

const DB_NAME = 'ai_pfms_offline_db';
const DB_VERSION = 1;
const STORE_NAME = 'transaction_summaries';
const SUMMARY_ID = 'latest';

function openSummaryDatabase(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    try {
      const req = window.indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

function postSummaryMessage(message: Record<string, unknown>): void {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  const controller = navigator.serviceWorker.controller;
  if (controller) {
    controller.postMessage(message);
    return;
  }
  navigator.serviceWorker.ready
    .then((registration) => {
      registration.active?.postMessage(message);
    })
    .catch(() => {
      // Service worker unavailable; direct IndexedDB write already succeeded.
    });
}

/**
 * Aggregates transactions into strictly non-sensitive totals (no PII,
 * no account identifiers, no descriptions, and no reference numbers).
 */
export function buildNonSensitiveSummary(params: {
  transactions: RecordedTransaction[];
  primaryCurrency: 'RWF' | 'USD';
  openingBalance: number;
}): NonSensitiveTransactionSummary {
  const { transactions, primaryCurrency, openingBalance } = params;

  const scoped = transactions.filter((tx) => tx.currency === primaryCurrency);
  const targetTx = scoped.length > 0 ? scoped : transactions;
  const fallbackCurrency: 'RWF' | 'USD' =
    targetTx[0]?.currency === 'USD' ? 'USD' : 'RWF';
  const activeCurrency: 'RWF' | 'USD' =
    scoped.length > 0
      ? primaryCurrency
      : targetTx.length > 0
        ? fallbackCurrency
        : primaryCurrency;

  let totalIncome = 0;
  let totalExpenses = 0;
  let incomeCount = 0;
  let expenseCount = 0;
  let latestTransactionDate: string | null = null;

  const catMap: Record<string, number> = {};
  const monthMap: Record<string, NonSensitiveMonthlyTotal> = {};

  targetTx.forEach((tx) => {
    if (!latestTransactionDate || tx.date > latestTransactionDate) {
      latestTransactionDate = tx.date;
    }
    const monthKey = tx.date.slice(0, 7);
    if (!monthMap[monthKey]) {
      monthMap[monthKey] = { monthKey, income: 0, expenses: 0 };
    }

    if (tx.type === 'income') {
      totalIncome += tx.amount;
      incomeCount += 1;
      monthMap[monthKey].income += tx.amount;
    } else {
      totalExpenses += tx.amount;
      expenseCount += 1;
      monthMap[monthKey].expenses += tx.amount;
      catMap[tx.category] = (catMap[tx.category] ?? 0) + tx.amount;
    }
  });

  const categoryTotals = Object.entries(catMap)
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 8);

  const monthlyTotals = Object.values(monthMap)
    .sort((a, b) => b.monthKey.localeCompare(a.monthKey))
    .slice(0, 12);

  return {
    id: SUMMARY_ID,
    updatedAt: new Date().toISOString(),
    primaryCurrency: activeCurrency,
    totalIncome,
    totalExpenses,
    netBalance: openingBalance + totalIncome - totalExpenses,
    transactionCount: targetTx.length,
    incomeCount,
    expenseCount,
    latestTransactionDate,
    categoryTotals,
    monthlyTotals,
  };
}

export async function saveOfflineTransactionSummary(
  summary: NonSensitiveTransactionSummary
): Promise<boolean> {
  postSummaryMessage({ type: 'CACHE_TRANSACTION_SUMMARY', summary });

  const db = await openSummaryDatabase();
  if (!db) return false;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(summary);
      tx.oncomplete = () => {
        db.close();
        resolve(true);
      };
      tx.onerror = () => {
        db.close();
        resolve(false);
      };
    } catch {
      db.close();
      resolve(false);
    }
  });
}

export async function loadOfflineTransactionSummary(): Promise<NonSensitiveTransactionSummary | null> {
  const db = await openSummaryDatabase();
  if (db) {
    const localResult = await new Promise<NonSensitiveTransactionSummary | null>((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(SUMMARY_ID);
        req.onsuccess = () => {
          db.close();
          resolve((req.result as NonSensitiveTransactionSummary | undefined) ?? null);
        };
        req.onerror = () => {
          db.close();
          resolve(null);
        };
      } catch {
        db.close();
        resolve(null);
      }
    });
    if (localResult) return localResult;
  }

  // Fallback to service worker virtual endpoint if active
  if (typeof fetch !== 'undefined' && 'serviceWorker' in navigator && navigator.serviceWorker.controller) {
    try {
      const res = await fetch('/offline-summary.json', { cache: 'no-store' });
      if (res.ok) {
        const data = (await res.json()) as {
          summary?: NonSensitiveTransactionSummary | null;
        };
        return data.summary ?? null;
      }
    } catch {
      return null;
    }
  }

  return null;
}

export async function clearOfflineTransactionSummary(): Promise<void> {
  postSummaryMessage({ type: 'CLEAR_TRANSACTION_SUMMARY' });

  const db = await openSummaryDatabase();
  if (!db) return;

  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.clear();
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        resolve();
      };
    } catch {
      db.close();
      resolve();
    }
  });
}
