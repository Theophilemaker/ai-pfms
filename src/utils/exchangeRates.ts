export const SUPPORTED_TRANSACTION_CURRENCIES = [
  { code: 'RWF', label: 'RWF — Rwandan Franc', decimals: 0 },
  { code: 'USD', label: 'USD — US Dollar', decimals: 2 },
  { code: 'EUR', label: 'EUR — Euro', decimals: 2 },
  { code: 'GBP', label: 'GBP — British Pound', decimals: 2 },
  { code: 'KES', label: 'KES — Kenyan Shilling', decimals: 2 },
  { code: 'UGX', label: 'UGX — Ugandan Shilling', decimals: 0 },
  { code: 'CAD', label: 'CAD — Canadian Dollar', decimals: 2 },
  { code: 'ZAR', label: 'ZAR — South African Rand', decimals: 2 },
] as const;

export type BaseCurrency = 'RWF' | 'USD';
export type SupportedTransactionCurrency =
  (typeof SUPPORTED_TRANSACTION_CURRENCIES)[number]['code'];

export interface ExchangeRateSnapshot {
  base: BaseCurrency;
  rates: Record<string, number>;
  provider: string;
  updatedAt: string;
  cached: boolean;
}

export interface NormalizedConversionResult {
  originalAmount: number;
  originalCurrency: SupportedTransactionCurrency;
  baseCurrency: BaseCurrency;
  normalizedAmount: number;
  exchangeRate: number;
  rateTimestamp: string;
}

export function isSupportedTransactionCurrency(
  code: string
): code is SupportedTransactionCurrency {
  return SUPPORTED_TRANSACTION_CURRENCIES.some((c) => c.code === code);
}

export function getCurrencyDecimals(currency: string): number {
  const found = SUPPORTED_TRANSACTION_CURRENCIES.find(
    (c) => c.code === currency.toUpperCase()
  );
  if (found) return found.decimals;
  return currency.toUpperCase() === 'RWF' ? 0 : 2;
}

export function formatCurrencyAmount(amount: number, currency: string): string {
  const code = (currency || 'RWF').toUpperCase();
  const decimals = getCurrencyDecimals(code);
  const safeAmount = Number.isFinite(amount) ? amount : 0;

  if (decimals === 0) {
    return `${new Intl.NumberFormat('en-US', {
      maximumFractionDigits: 0,
    }).format(Math.round(safeAmount))} ${code}`;
  }

  return `${new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(safeAmount)} ${code}`;
}

export function formatFxRateValue(rate: number, baseCurrency: BaseCurrency): string {
  if (!Number.isFinite(rate) || rate <= 0) return '—';
  if (baseCurrency === 'RWF' && rate >= 10) {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(rate);
  }
  if (rate >= 1) {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    }).format(rate);
  }
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 4,
    maximumFractionDigits: 6,
  }).format(rate);
}

export async function fetchLiveExchangeRates(
  baseCurrency: BaseCurrency,
  forceRefresh = false
): Promise<ExchangeRateSnapshot> {
  const query = `/api/exchange-rates?base=${encodeURIComponent(baseCurrency)}${
    forceRefresh ? '&refresh=1' : ''
  }`;
  const response = await fetch(query, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });

  const payload = (await response.json()) as Partial<ExchangeRateSnapshot> & {
    error?: string;
  };

  if (!response.ok || !payload.rates) {
    throw new Error(
      payload.error || 'Real-time exchange rate service is temporarily unavailable.'
    );
  }

  return {
    base: payload.base === 'USD' ? 'USD' : 'RWF',
    rates: payload.rates,
    provider: payload.provider || 'FX Feed',
    updatedAt: payload.updatedAt || new Date().toISOString(),
    cached: Boolean(payload.cached),
  };
}

/**
 * Returns the direct multiplier: 1 unit of `fromCurrency` = rate units of `baseCurrency`.
 * Backend returns `rates[code]` as units of `code` per 1 unit of `baseCurrency`,
 * so directToBaseRate = 1 / rates[fromCurrency].
 */
export function getDirectToBaseRate(
  fromCurrency: SupportedTransactionCurrency,
  baseCurrency: BaseCurrency,
  snapshot: ExchangeRateSnapshot | null
): number | null {
  if (fromCurrency === baseCurrency) {
    return 1;
  }
  if (!snapshot || snapshot.base !== baseCurrency) {
    return null;
  }
  const unitsPerBase = snapshot.rates[fromCurrency];
  if (typeof unitsPerBase !== 'number' || !Number.isFinite(unitsPerBase) || unitsPerBase <= 0) {
    return null;
  }
  return 1 / unitsPerBase;
}

export function computeNormalizedConversion(params: {
  originalAmount: number;
  originalCurrency: SupportedTransactionCurrency;
  baseCurrency: BaseCurrency;
  directRateToBase: number;
  rateTimestamp?: string;
}): NormalizedConversionResult {
  const {
    originalAmount,
    originalCurrency,
    baseCurrency,
    directRateToBase,
    rateTimestamp,
  } = params;

  const cleanOriginal = Math.round(originalAmount * 100) / 100;
  const rawConverted = cleanOriginal * directRateToBase;
  const normalizedAmount =
    baseCurrency === 'RWF'
      ? Math.max(1, Math.round(rawConverted))
      : Math.max(0.01, Math.round(rawConverted * 100) / 100);

  return {
    originalAmount: cleanOriginal,
    originalCurrency,
    baseCurrency,
    normalizedAmount,
    exchangeRate: Number(directRateToBase.toFixed(6)),
    rateTimestamp: rateTimestamp || new Date().toISOString(),
  };
}
