import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;

export const SUPPORTED_CURRENCIES = [
  'RWF',
  'USD',
  'EUR',
  'GBP',
  'KES',
  'UGX',
  'CAD',
  'ZAR',
] as const;

export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

export interface ParsedReceiptResult {
  merchantName: string;
  date: string;
  totalAmount: number;
  currency: SupportedCurrency | '';
  suggestedCategory: string;
  confidence: 'high' | 'medium' | 'low';
  notes: string;
}

interface CachedFxPayload {
  base: 'RWF' | 'USD';
  rates: Record<string, number>;
  provider: string;
  updatedAt: string;
  fetchedAtMs: number;
}

const FX_CACHE_TTL_MS = 15 * 60 * 1000;
const fxRateCache = new Map<'RWF' | 'USD', CachedFxPayload>();

async function fetchUpstreamRates(
  base: 'RWF' | 'USD'
): Promise<{ rates: Record<string, number>; provider: string; updatedAt: string }> {
  const endpoints = [
    {
      url: `https://open.er-api.com/v6/latest/${base}`,
      provider: 'open.er-api.com',
    },
    {
      url: `https://api.exchangerate-api.com/v4/latest/${base}`,
      provider: 'exchangerate-api.com',
    },
  ];

  let lastError: Error | null = null;

  for (const endpoint of endpoints) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(endpoint.url, {
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          'User-Agent': 'ai-pfms-fx-service/1.0',
        },
      });
      if (!response.ok) {
        throw new Error(`${endpoint.provider} returned HTTP ${response.status}`);
      }
      const data = (await response.json()) as {
        result?: string;
        rates?: Record<string, unknown>;
        time_last_update_utc?: string;
        date?: string;
      };
      if (data.result && data.result !== 'success') {
        throw new Error(`${endpoint.provider} returned result=${data.result}`);
      }
      if (!data.rates || typeof data.rates !== 'object') {
        throw new Error(`${endpoint.provider} response missing rates map`);
      }

      const normalizedRates: Record<string, number> = { [base]: 1 };
      for (const code of SUPPORTED_CURRENCIES) {
        if (code === base) {
          normalizedRates[code] = 1;
          continue;
        }
        const rawVal = data.rates[code];
        if (typeof rawVal === 'number' && Number.isFinite(rawVal) && rawVal > 0) {
          normalizedRates[code] = rawVal;
        }
      }

      if (Object.keys(normalizedRates).length < 4) {
        throw new Error(`${endpoint.provider} returned incomplete currency coverage`);
      }

      const parsedTime = data.time_last_update_utc
        ? new Date(data.time_last_update_utc)
        : new Date();
      const updatedAt = Number.isNaN(parsedTime.getTime())
        ? new Date().toISOString()
        : parsedTime.toISOString();

      return {
        rates: normalizedRates,
        provider: endpoint.provider,
        updatedAt,
      };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error('Upstream FX fetch failed');
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError ?? new Error('Unable to reach real-time exchange rate providers.');
}

const STANDARD_EXPENSE_CATEGORIES = [
  'Food',
  'Transport',
  'Housing',
  'Education',
  'Healthcare',
  'Utilities',
  'Communication',
  'Entertainment',
  'Shopping',
];

function createGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '12mb' }));

  app.get('/api/exchange-rates', async (req, res) => {
    const rawBase = typeof req.query.base === 'string' ? req.query.base.toUpperCase() : 'RWF';
    const base: 'RWF' | 'USD' = rawBase === 'USD' ? 'USD' : 'RWF';
    const forceRefresh = req.query.refresh === '1' || req.query.refresh === 'true';

    const cached = fxRateCache.get(base);
    if (!forceRefresh && cached && Date.now() - cached.fetchedAtMs < FX_CACHE_TTL_MS) {
      res.json({
        base: cached.base,
        rates: cached.rates,
        provider: cached.provider,
        updatedAt: cached.updatedAt,
        cached: true,
      });
      return;
    }

    try {
      const live = await fetchUpstreamRates(base);
      const entry: CachedFxPayload = {
        base,
        rates: live.rates,
        provider: live.provider,
        updatedAt: live.updatedAt,
        fetchedAtMs: Date.now(),
      };
      fxRateCache.set(base, entry);
      res.json({
        base: entry.base,
        rates: entry.rates,
        provider: entry.provider,
        updatedAt: entry.updatedAt,
        cached: false,
      });
    } catch (err) {
      if (cached) {
        res.json({
          base: cached.base,
          rates: cached.rates,
          provider: cached.provider,
          updatedAt: cached.updatedAt,
          cached: true,
        });
        return;
      }
      const message =
        err instanceof Error
          ? err.message
          : 'Real-time exchange rate service is temporarily unavailable.';
      console.error('Exchange rate fetch failed:', err);
      res.status(503).json({ error: message });
    }
  });

  app.post('/api/scan-receipt', async (req, res) => {
    try {
      const { imageBase64, mimeType } = req.body as {
        imageBase64?: string;
        mimeType?: string;
      };

      if (!imageBase64 || typeof imageBase64 !== 'string') {
        res.status(400).json({ error: 'Receipt image data is required.' });
        return;
      }

      const ai = createGeminiClient();
      if (!ai) {
        res.status(503).json({
          error:
            'Receipt scanning AI service is not configured. Add GEMINI_API_KEY in Settings > Secrets.',
        });
        return;
      }

      const cleanBase64 = imageBase64.replace(/^data:[^;]+;base64,/, '');
      const resolvedMimeType =
        typeof mimeType === 'string' && mimeType.startsWith('image/')
          ? mimeType
          : 'image/jpeg';

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: resolvedMimeType,
                data: cleanBase64,
              },
            },
            {
              text:
                'Analyze this receipt or invoice image and extract structured transaction fields. ' +
                'Return merchantName (store/vendor name), date in strict YYYY-MM-DD format (empty string if unreadable), ' +
                'totalAmount as a positive number (the final total paid, 0 if unreadable), ' +
                `currency as an ISO 4217 code from [${SUPPORTED_CURRENCIES.join(', ')}] (empty string if unclear), ` +
                `suggestedCategory chosen from [${STANDARD_EXPENSE_CATEGORIES.join(', ')}] (best match), ` +
                'confidence ("high", "medium", or "low"), and a brief 1-line notes summary of key items.',
            },
          ],
        },
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              merchantName: {
                type: Type.STRING,
                description: 'Extracted store, restaurant, or service provider name.',
              },
              date: {
                type: Type.STRING,
                description: 'Receipt date formatted as YYYY-MM-DD, or empty string if unreadable.',
              },
              totalAmount: {
                type: Type.NUMBER,
                description: 'Final total amount paid on the receipt.',
              },
              currency: {
                type: Type.STRING,
                description: `ISO currency code (${SUPPORTED_CURRENCIES.join(', ')}) or empty string.`,
              },
              suggestedCategory: {
                type: Type.STRING,
                description: 'Closest matching expense category.',
              },
              confidence: {
                type: Type.STRING,
                description: 'Extraction confidence: high, medium, or low.',
              },
              notes: {
                type: Type.STRING,
                description: 'Short summary of receipt line items or context.',
              },
            },
          },
        },
      });

      const rawText = (response.text ?? '{}').trim();
      const parsed = JSON.parse(rawText) as Partial<ParsedReceiptResult>;

      const validDate =
        typeof parsed.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(parsed.date.trim())
          ? parsed.date.trim()
          : '';
      const validTotal =
        typeof parsed.totalAmount === 'number' &&
        Number.isFinite(parsed.totalAmount) &&
        parsed.totalAmount > 0
          ? parsed.totalAmount
          : 0;
      const upperCurrency =
        typeof parsed.currency === 'string' ? parsed.currency.trim().toUpperCase() : '';
      const validCurrency: SupportedCurrency | '' = (
        SUPPORTED_CURRENCIES as readonly string[]
      ).includes(upperCurrency)
        ? (upperCurrency as SupportedCurrency)
        : '';
      const validConfidence =
        parsed.confidence === 'high' ||
        parsed.confidence === 'medium' ||
        parsed.confidence === 'low'
          ? parsed.confidence
          : 'medium';

      const result: ParsedReceiptResult = {
        merchantName:
          typeof parsed.merchantName === 'string' ? parsed.merchantName.trim().slice(0, 80) : '',
        date: validDate,
        totalAmount: validTotal,
        currency: validCurrency,
        suggestedCategory:
          typeof parsed.suggestedCategory === 'string' &&
          STANDARD_EXPENSE_CATEGORIES.includes(parsed.suggestedCategory)
            ? parsed.suggestedCategory
            : 'Shopping',
        confidence: validConfidence,
        notes: typeof parsed.notes === 'string' ? parsed.notes.trim().slice(0, 120) : '',
      };

      res.json(result);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unable to parse receipt image.';
      console.error('Receipt scan failed:', err);
      res.status(500).json({ error: message });
    }
  });

  app.post('/api/forecast-budget', async (req, res) => {
    try {
      const body = req.body as {
        currency?: string;
        locale?: string;
        horizonMonths?: number;
        monthlyIncomeTarget?: number;
        historicalMonths?: Array<{
          monthKey: string;
          label: string;
          totalSpent: number;
          totalIncome: number;
          categoryTotals: Record<string, number>;
        }>;
        currentBudgets?: Array<{ category: string; monthlyLimit: number }>;
        recurringExpenses?: Array<{
          category: string;
          description: string;
          amount: number;
          frequency: string;
        }>;
        upcomingMonths?: Array<{ monthKey: string; label: string }>;
      };

      const currency = body.currency === 'USD' ? 'USD' : 'RWF';
      const locale = body.locale === 'rw' ? 'rw' : 'en';
      const horizonMonths = body.horizonMonths === 3 ? 3 : 6;
      const monthlyIncomeTarget =
        typeof body.monthlyIncomeTarget === 'number' &&
        Number.isFinite(body.monthlyIncomeTarget) &&
        body.monthlyIncomeTarget >= 0
          ? body.monthlyIncomeTarget
          : 0;
      const historicalMonths = Array.isArray(body.historicalMonths)
        ? body.historicalMonths.slice(-12)
        : [];
      const currentBudgets = Array.isArray(body.currentBudgets)
        ? body.currentBudgets.slice(0, 40)
        : [];
      const recurringExpenses = Array.isArray(body.recurringExpenses)
        ? body.recurringExpenses.slice(0, 40)
        : [];
      const upcomingMonths = Array.isArray(body.upcomingMonths)
        ? body.upcomingMonths.slice(0, horizonMonths)
        : [];

      if (historicalMonths.length === 0 || upcomingMonths.length === 0) {
        res.status(400).json({
          error: 'Historical spending data and upcoming forecast months are required.',
        });
        return;
      }

      const ai = createGeminiClient();
      if (!ai) {
        res.status(503).json({
          error:
            'AI projection service requires GEMINI_API_KEY in Settings > Secrets.',
        });
        return;
      }

      const languageInstruction =
        locale === 'rw'
          ? 'Write all human-readable summary, rationale, and driver strings in clear Kinyarwanda.'
          : 'Write all human-readable summary, rationale, and driver strings in clear, concise English.';

      const promptPayload = {
        currency,
        horizonMonths,
        monthlyIncomeTarget,
        historicalMonths,
        currentBudgets,
        recurringExpenses,
        upcomingMonths,
      };

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents:
          'You are an expert personal finance forecasting engine. Analyze the historical monthly spending patterns, ' +
          'category-level spending averages, velocity/growth trends, recurring expenses, and existing monthly budget limits ' +
          `provided in the JSON below.\n\n${JSON.stringify(promptPayload)}\n\n` +
          `Forecast future monthly spending for EACH month in upcomingMonths (${upcomingMonths
            .map((m) => `${m.monthKey} (${m.label})`)
            .join(', ')}) in exact chronological order, keeping monthKey and label matching upcomingMonths. ` +
          'Also provide categoryRecommendations for every active spending or budgeted category with historicalMonthlyAvg, ' +
          'currentBudgetLimit, recommendedMonthlyBudget (realistic monthly budget need factoring trends & recurring costs), ' +
          'deltaPct (% change vs current budget or historical average), and a concise driver explanation. ' +
          'Set totalRecommendedMonthlyBudget to the sum of recommendedMonthlyBudget values. ' +
          'Set riskLevel to "low", "moderate", or "elevated" based on spending growth relative to income/budgets, ' +
          `and confidenceScore between 35 and 95 based on historical data consistency. ${languageInstruction}`,
        config: {
          systemInstruction:
            'Be quantitative, grounded strictly in the provided transaction history, and return valid JSON matching the schema.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              forecastMonths: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    monthKey: { type: Type.STRING },
                    label: { type: Type.STRING },
                    projectedSpending: { type: Type.NUMBER },
                    confidenceLow: { type: Type.NUMBER },
                    confidenceHigh: { type: Type.NUMBER },
                    rationale: { type: Type.STRING },
                  },
                },
              },
              categoryRecommendations: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    category: { type: Type.STRING },
                    historicalMonthlyAvg: { type: Type.NUMBER },
                    currentBudgetLimit: { type: Type.NUMBER },
                    recommendedMonthlyBudget: { type: Type.NUMBER },
                    deltaPct: { type: Type.NUMBER },
                    driver: { type: Type.STRING },
                  },
                },
              },
              totalRecommendedMonthlyBudget: { type: Type.NUMBER },
              aiSummary: { type: Type.STRING },
              riskLevel: { type: Type.STRING },
              confidenceScore: { type: Type.NUMBER },
            },
          },
        },
      });

      const rawText = (response.text ?? '{}').trim();
      const parsed = JSON.parse(rawText) as {
        forecastMonths?: Array<{
          monthKey?: string;
          label?: string;
          projectedSpending?: number;
          confidenceLow?: number;
          confidenceHigh?: number;
          rationale?: string;
        }>;
        categoryRecommendations?: Array<{
          category?: string;
          historicalMonthlyAvg?: number;
          currentBudgetLimit?: number;
          recommendedMonthlyBudget?: number;
          deltaPct?: number;
          driver?: string;
        }>;
        totalRecommendedMonthlyBudget?: number;
        aiSummary?: string;
        riskLevel?: string;
        confidenceScore?: number;
      };

      const roundMoney = (val: unknown, fallback = 0): number => {
        if (typeof val !== 'number' || !Number.isFinite(val) || val < 0) return fallback;
        return Math.round(val * 100) / 100;
      };

      const aiForecastByKey = new Map(
        (Array.isArray(parsed.forecastMonths) ? parsed.forecastMonths : []).map((m) => [
          String(m.monthKey ?? ''),
          m,
        ])
      );

      const forecastMonths = upcomingMonths.map((u, idx) => {
        const match = aiForecastByKey.get(u.monthKey) ?? parsed.forecastMonths?.[idx];
        const projectedSpending = roundMoney(match?.projectedSpending, 0);
        const lowRaw = roundMoney(match?.confidenceLow, Math.round(projectedSpending * 0.9 * 100) / 100);
        const highRaw = roundMoney(
          match?.confidenceHigh,
          Math.round(projectedSpending * 1.12 * 100) / 100
        );
        return {
          monthKey: u.monthKey,
          label: u.label,
          projectedSpending,
          confidenceLow: Math.min(lowRaw, projectedSpending),
          confidenceHigh: Math.max(highRaw, projectedSpending),
          rationale:
            typeof match?.rationale === 'string'
              ? match.rationale.trim().slice(0, 180)
              : '',
        };
      });

      const categoryRecommendations = (
        Array.isArray(parsed.categoryRecommendations) ? parsed.categoryRecommendations : []
      )
        .filter((c) => typeof c.category === 'string' && c.category.trim().length > 0)
        .slice(0, 20)
        .map((c) => ({
          category: String(c.category).trim().slice(0, 60),
          historicalMonthlyAvg: roundMoney(c.historicalMonthlyAvg, 0),
          currentBudgetLimit: roundMoney(c.currentBudgetLimit, 0),
          recommendedMonthlyBudget: roundMoney(c.recommendedMonthlyBudget, 0),
          deltaPct:
            typeof c.deltaPct === 'number' && Number.isFinite(c.deltaPct)
              ? Math.round(c.deltaPct)
              : 0,
          driver:
            typeof c.driver === 'string' ? c.driver.trim().slice(0, 160) : '',
        }));

      const summedRec = categoryRecommendations.reduce(
        (sum, item) => sum + item.recommendedMonthlyBudget,
        0
      );
      const totalRecommendedMonthlyBudget =
        roundMoney(parsed.totalRecommendedMonthlyBudget, 0) ||
        Math.round(summedRec * 100) / 100;

      const riskLevel =
        parsed.riskLevel === 'low' ||
        parsed.riskLevel === 'moderate' ||
        parsed.riskLevel === 'elevated'
          ? parsed.riskLevel
          : 'moderate';

      const confidenceScore =
        typeof parsed.confidenceScore === 'number' && Number.isFinite(parsed.confidenceScore)
          ? Math.min(99, Math.max(25, Math.round(parsed.confidenceScore)))
          : 74;

      res.json({
        modelName: 'gemini-4-hydrogen',
        currency,
        horizonMonths,
        forecastMonths,
        categoryRecommendations,
        totalRecommendedMonthlyBudget,
        aiSummary:
          typeof parsed.aiSummary === 'string'
            ? parsed.aiSummary.trim().slice(0, 560)
            : '',
        riskLevel,
        confidenceScore,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unable to generate AI budget forecast.';
      console.error('AI budget forecast failed:', err);
      res.status(500).json({ error: message });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`AI-PFMS server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
