/* AI-PFMS Service Worker — Strict Financial Privacy Policy + Offline Summary IndexedDB Layer
 * Only static public shell assets, offline.html, and non-sensitive aggregated transaction
 * summaries (stored in IndexedDB without PII or raw descriptions) are cached offline.
 * Sensitive financial APIs, auth routes, documents, and private records remain Network-Only.
 */
const CACHE_NAME = 'ai-pfms-shell-v2';

const SUMMARY_DB_NAME = 'ai_pfms_offline_db';
const SUMMARY_DB_VERSION = 1;
const SUMMARY_STORE = 'transaction_summaries';
const SUMMARY_KEY = 'latest';

const STATIC_SHELL_ASSETS = [
  '/manifest.webmanifest',
  '/offline.html',
  '/assets/icons/icon.svg',
  '/assets/icons/icon-192.png',
  '/assets/icons/icon-512.png',
  '/assets/icons/icon-maskable-192.png',
  '/assets/icons/icon-maskable-512.png',
  '/assets/icons/apple-touch-icon.png',
];

const NEVER_CACHE_PREFIXES = [
  '/api/',
  '/login',
  '/register',
  '/logout',
  '/2fa',
  '/reset-password',
  '/forgot-password',
  '/verify-email',
  '/dashboard',
  '/accounts',
  '/transactions',
  '/income',
  '/expenses',
  '/transfers',
  '/budgets',
  '/savings',
  '/debts',
  '/bills',
  '/reports',
  '/ai-insights',
  '/family',
  '/documents',
  '/notifications',
  '/settings',
  '/admin',
];

function sanitizeSummaryPayload(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const categoryTotals = Array.isArray(raw.categoryTotals)
    ? raw.categoryTotals
        .filter((item) => item && typeof item.category === 'string' && Number.isFinite(Number(item.amount)))
        .slice(0, 12)
        .map((item) => ({
          category: String(item.category).slice(0, 48),
          amount: Number(item.amount),
        }))
    : [];

  const monthlyTotals = Array.isArray(raw.monthlyTotals)
    ? raw.monthlyTotals
        .filter((item) => item && typeof item.monthKey === 'string')
        .slice(0, 24)
        .map((item) => ({
          monthKey: String(item.monthKey).slice(0, 7),
          income: Number(item.income) || 0,
          expenses: Number(item.expenses) || 0,
        }))
    : [];

  return {
    id: SUMMARY_KEY,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : new Date().toISOString(),
    primaryCurrency: raw.primaryCurrency === 'USD' ? 'USD' : 'RWF',
    totalIncome: Number(raw.totalIncome) || 0,
    totalExpenses: Number(raw.totalExpenses) || 0,
    netBalance: Number(raw.netBalance) || 0,
    transactionCount: Math.max(0, Math.round(Number(raw.transactionCount) || 0)),
    incomeCount: Math.max(0, Math.round(Number(raw.incomeCount) || 0)),
    expenseCount: Math.max(0, Math.round(Number(raw.expenseCount) || 0)),
    latestTransactionDate:
      typeof raw.latestTransactionDate === 'string' ? raw.latestTransactionDate.slice(0, 10) : null,
    categoryTotals,
    monthlyTotals,
  };
}

function openSummaryDB() {
  return new Promise((resolve, reject) => {
    const request = self.indexedDB.open(SUMMARY_DB_NAME, SUMMARY_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(SUMMARY_STORE)) {
        db.createObjectStore(SUMMARY_STORE, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function writeSummaryToIDB(rawSummary) {
  const sanitized = sanitizeSummaryPayload(rawSummary);
  if (!sanitized) return null;
  const db = await openSummaryDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SUMMARY_STORE, 'readwrite');
    const store = tx.objectStore(SUMMARY_STORE);
    store.put(sanitized);
    tx.oncomplete = () => {
      db.close();
      resolve(sanitized);
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

async function readSummaryFromIDB() {
  const db = await openSummaryDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SUMMARY_STORE, 'readonly');
    const store = tx.objectStore(SUMMARY_STORE);
    const req = store.get(SUMMARY_KEY);
    req.onsuccess = () => {
      db.close();
      resolve(req.result || null);
    };
    req.onerror = () => {
      db.close();
      reject(req.error);
    };
  });
}

async function clearSummariesFromIDB() {
  const db = await openSummaryDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SUMMARY_STORE, 'readwrite');
    const store = tx.objectStore(SUMMARY_STORE);
    store.clear();
    tx.oncomplete = () => {
      db.close();
      resolve(true);
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_SHELL_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || typeof data !== 'object') return;

  const reply = (payload) => {
    if (event.ports && event.ports[0]) {
      event.ports[0].postMessage(payload);
    } else if (event.source && typeof event.source.postMessage === 'function') {
      event.source.postMessage(payload);
    }
  };

  if (data.type === 'CACHE_TRANSACTION_SUMMARY') {
    event.waitUntil(
      writeSummaryToIDB(data.summary)
        .then((saved) => reply({ ok: true, summary: saved }))
        .catch(() => reply({ ok: false }))
    );
  } else if (data.type === 'GET_CACHED_TRANSACTION_SUMMARY') {
    event.waitUntil(
      readSummaryFromIDB()
        .then((summary) => reply({ ok: true, summary }))
        .catch(() => reply({ ok: false, summary: null }))
    );
  } else if (data.type === 'CLEAR_TRANSACTION_SUMMARY') {
    event.waitUntil(
      clearSummariesFromIDB()
        .then(() => reply({ ok: true }))
        .catch(() => reply({ ok: false }))
    );
  }
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  // Non-sensitive offline summary virtual endpoint backed by IndexedDB
  if (url.pathname === '/offline-summary.json') {
    event.respondWith(
      readSummaryFromIDB()
        .then((summary) => {
          return new Response(
            JSON.stringify({
              cachedOffline: true,
              summary,
            }),
            {
              status: 200,
              headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-store',
              },
            }
          );
        })
        .catch(() => {
          return new Response(
            JSON.stringify({ cachedOffline: true, summary: null }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }
          );
        })
    );
    return;
  }

  // Strictly enforce Network-Only for all sensitive/authenticated endpoints
  if (NEVER_CACHE_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))) {
    event.respondWith(
      fetch(request).catch(() => {
        if (request.mode === 'navigate') {
          return caches.match('/offline.html');
        }
        return new Response(
          JSON.stringify({
            success: false,
            error: 'OFFLINE',
            message: 'Internet connection required to access full financial records.',
          }),
          { status: 503, headers: { 'Content-Type': 'application/json' } }
        );
      })
    );
    return;
  }

  // Navigation requests: Network-first with safe offline fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/offline.html'))
    );
    return;
  }

  // Only allow static shell assets from cache
  const isStaticAsset =
    url.pathname.startsWith('/assets/') ||
    url.pathname === '/manifest.webmanifest' ||
    url.pathname === '/offline.html';

  if (!isStaticAsset) {
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) {
        return cached;
      }
      return fetch(request).then((response) => {
        const cacheControl = response.headers.get('Cache-Control') || '';
        const hasCookie = response.headers.has('Set-Cookie');
        if (
          response.ok &&
          !hasCookie &&
          !cacheControl.toLowerCase().includes('no-store')
        ) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      });
    })
  );
});
