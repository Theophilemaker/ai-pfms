import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowRightLeft,
  Camera,
  Check,
  FolderPlus,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Repeat,
  ScanLine,
  Sparkles,
  Tag,
  Target,
  Trash2,
  TrendingDown,
  TrendingUp,
  Upload,
  X,
} from 'lucide-react';
import { translations, type Locale } from '../i18n/translations';
import {
  SUPPORTED_TRANSACTION_CURRENCIES,
  computeNormalizedConversion,
  fetchLiveExchangeRates,
  formatCurrencyAmount,
  formatFxRateValue,
  getCurrencyDecimals,
  getDirectToBaseRate,
  isSupportedTransactionCurrency,
  type BaseCurrency,
  type ExchangeRateSnapshot,
  type SupportedTransactionCurrency,
} from '../utils/exchangeRates';

export type TransactionType = 'income' | 'expense';
export type RecurrenceFrequency = 'daily' | 'weekly' | 'monthly';

export interface RecordedTransaction {
  id: string;
  referenceNo: string;
  idempotencyKey: string;
  type: TransactionType;
  accountId: string;
  accountName: string;
  currency: string;
  category: string;
  tags?: string[];
  amount: number;
  date: string;
  createdAt?: string;
  description: string;
  isRecurring?: boolean;
  recurringFrequency?: RecurrenceFrequency;
  nextOccurrenceDate?: string;
  goalId?: string;
  goalName?: string;
  originalCurrency?: string;
  originalAmount?: number;
  exchangeRate?: number;
  rateTimestamp?: string;
}

interface ParsedReceiptResponse {
  merchantName?: string;
  date?: string;
  totalAmount?: number;
  currency?: string;
  suggestedCategory?: string;
  confidence?: 'high' | 'medium' | 'low';
  notes?: string;
  error?: string;
}

interface TransactionInputProps {
  open: boolean;
  onClose: () => void;
  onSave: (transaction: RecordedTransaction) => void;
  locale: Locale;
  baseCurrency?: BaseCurrency;
  initialType?: TransactionType;
  accounts?: { id: string; name: string; type: string; currency: string }[];
  goals?: { id: string; name: string; currency: 'RWF' | 'USD' }[];
  initialGoalId?: string;
  externalCustomCategories?: CustomCategoryStore;
  externalSavedTags?: string[];
  onTaxonomySync?: (categories: CustomCategoryStore, tags: string[]) => void;
}

export type CustomCategoryStore = Record<TransactionType, string[]>;

const CUSTOM_CATEGORIES_STORAGE_KEY = 'ai_pfms_custom_categories_v1';
const CUSTOM_TAGS_STORAGE_KEY = 'ai_pfms_custom_tags_v1';
const MAX_TAGS_PER_TRANSACTION = 8;

function getTodayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function computeNextOccurrenceDate(
  dateIso: string,
  frequency: RecurrenceFrequency
): string {
  const base = /^\d{4}-\d{2}-\d{2}$/.test(dateIso)
    ? new Date(`${dateIso}T00:00:00Z`)
    : new Date();

  if (frequency === 'daily') {
    base.setUTCDate(base.getUTCDate() + 1);
  } else if (frequency === 'weekly') {
    base.setUTCDate(base.getUTCDate() + 7);
  } else {
    const day = base.getUTCDate();
    base.setUTCMonth(base.getUTCMonth() + 1);
    if (base.getUTCDate() < day) {
      base.setUTCDate(0);
    }
  }
  return base.toISOString().slice(0, 10);
}

function loadCustomCategories(): CustomCategoryStore {
  if (typeof window === 'undefined') {
    return { income: [], expense: [] };
  }
  try {
    const raw = window.localStorage.getItem(CUSTOM_CATEGORIES_STORAGE_KEY);
    if (!raw) return { income: [], expense: [] };
    const parsed = JSON.parse(raw) as Partial<CustomCategoryStore>;
    return {
      income: Array.isArray(parsed.income)
        ? parsed.income.filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
        : [],
      expense: Array.isArray(parsed.expense)
        ? parsed.expense.filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
        : [],
    };
  } catch {
    return { income: [], expense: [] };
  }
}

function loadSavedTags(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(CUSTOM_TAGS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is string => typeof v === 'string' && v.trim().length > 0);
  } catch {
    return [];
  }
}

function normalizeTag(raw: string): string {
  return raw
    .trim()
    .replace(/^#+/, '')
    .replace(/\s+/g, '-')
    .slice(0, 28);
}

export function TransactionInput({
  open,
  onClose,
  onSave,
  locale,
  baseCurrency = 'RWF',
  initialType = 'expense',
  accounts,
  goals,
  initialGoalId = '',
  externalCustomCategories,
  externalSavedTags,
  onTaxonomySync,
}: TransactionInputProps) {
  const d = translations[locale].dashboard;
  const tm = d.transactionModal;
  const availableAccounts =
    accounts && accounts.length > 0 ? accounts : d.accountTypes;

  const [type, setType] = useState<TransactionType>(initialType);
  const [accountId, setAccountId] = useState<string>(availableAccounts[0].id);
  const [category, setCategory] = useState<string>('');
  const [selectedGoalId, setSelectedGoalId] = useState<string>(initialGoalId);
  const [entryCurrency, setEntryCurrency] =
    useState<SupportedTransactionCurrency>(baseCurrency);
  const [amountInput, setAmountInput] = useState<string>('');
  const [date, setDate] = useState<string>(getTodayIso);
  const [description, setDescription] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState<string>(() =>
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`
  );

  // Real-time Exchange Rate state
  const [fxSnapshot, setFxSnapshot] = useState<ExchangeRateSnapshot | null>(null);
  const [fxLoading, setFxLoading] = useState(false);
  const [fxError, setFxError] = useState<string | null>(null);
  const [manualRateInput, setManualRateInput] = useState<string>('');

  // Recurring Transaction state
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringFrequency, setRecurringFrequency] =
    useState<RecurrenceFrequency>('monthly');

  // Receipt Camera Scanner state
  const [scannerOpen, setScannerOpen] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [isScanningReceipt, setIsScanningReceipt] = useState(false);
  const [scannerError, setScannerError] = useState<string | null>(null);
  const [capturedPreviewUrl, setCapturedPreviewUrl] = useState<string | null>(null);
  const [scanResultSummary, setScanResultSummary] = useState<{
    merchant: string;
    date: string;
    total: number;
    confidence: 'high' | 'medium' | 'low';
  } | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // Personal Categories state
  const [customCategories, setCustomCategories] = useState<CustomCategoryStore>(() =>
    loadCustomCategories()
  );
  const [manageCategoriesOpen, setManageCategoriesOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [editingCategoryOriginal, setEditingCategoryOriginal] = useState<string | null>(null);
  const [editingCategoryValue, setEditingCategoryValue] = useState('');

  // Custom Transaction Tags state
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [savedTags, setSavedTags] = useState<string[]>(() => loadSavedTags());
  const [tagWarning, setTagWarning] = useState<string | null>(null);

  const defaultCategories =
    type === 'income' ? tm.incomeCategories : tm.expenseCategories;
  const personalCategories = customCategories[type];
  const allCategories = [...defaultCategories, ...personalCategories];

  const stopCameraStream = useCallback(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  }, []);

  useEffect(() => {
    if (externalCustomCategories) {
      setCustomCategories((prev) => ({
        income: Array.from(new Set([...prev.income, ...externalCustomCategories.income])).slice(0, 40),
        expense: Array.from(new Set([...prev.expense, ...externalCustomCategories.expense])).slice(0, 40),
      }));
    }
  }, [externalCustomCategories]);

  useEffect(() => {
    if (externalSavedTags && externalSavedTags.length > 0) {
      setSavedTags((prev) => Array.from(new Set([...externalSavedTags, ...prev])).slice(0, 40));
    }
  }, [externalSavedTags]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        CUSTOM_CATEGORIES_STORAGE_KEY,
        JSON.stringify(customCategories)
      );
    } catch {
      // Ignore storage quota restrictions
    }
    onTaxonomySync?.(customCategories, savedTags);
  }, [customCategories, savedTags, onTaxonomySync]);

  useEffect(() => {
    try {
      window.localStorage.setItem(CUSTOM_TAGS_STORAGE_KEY, JSON.stringify(savedTags));
    } catch {
      // Ignore storage quota restrictions
    }
  }, [savedTags]);

  const loadExchangeRates = useCallback(
    async (forceRefresh = false) => {
      setFxLoading(true);
      setFxError(null);
      try {
        const snapshot = await fetchLiveExchangeRates(baseCurrency, forceRefresh);
        setFxSnapshot(snapshot);
      } catch (err) {
        setFxError(err instanceof Error ? err.message : tm.fxUnavailableError);
      } finally {
        setFxLoading(false);
      }
    },
    [baseCurrency, tm.fxUnavailableError]
  );

  useEffect(() => {
    if (!open) {
      stopCameraStream();
      return;
    }
    setType(initialType);
    setAmountInput('');
    setDescription('');
    setError(null);
    setFxError(null);
    setManualRateInput('');
    setSelectedTags([]);
    setTagInput('');
    setTagWarning(null);
    setManageCategoriesOpen(false);
    setNewCategoryName('');
    setCategoryError(null);
    setEditingCategoryOriginal(null);
    setIsRecurring(false);
    setRecurringFrequency('monthly');
    setScannerOpen(false);
    setScannerError(null);
    setCapturedPreviewUrl(null);
    setScanResultSummary(null);
    setIsScanningReceipt(false);
    setDate(getTodayIso());
    setSelectedGoalId(initialGoalId || '');

    let defaultCurrency: SupportedTransactionCurrency = baseCurrency;
    if (initialGoalId && goals) {
      const targetGoal = goals.find((g) => g.id === initialGoalId);
      if (targetGoal) {
        if (isSupportedTransactionCurrency(targetGoal.currency)) {
          defaultCurrency = targetGoal.currency;
        }
        const matchingAccount = availableAccounts.find(
          (acc) => acc.currency === targetGoal.currency
        );
        if (matchingAccount) {
          setAccountId(matchingAccount.id);
        }
      }
    }
    setEntryCurrency(defaultCurrency);
    void loadExchangeRates(false);

    setIdempotencyKey(
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
  }, [
    open,
    initialType,
    initialGoalId,
    goals,
    availableAccounts,
    baseCurrency,
    loadExchangeRates,
    stopCameraStream,
  ]);

  useEffect(() => {
    setCategory(defaultCategories[0]);
    setEditingCategoryOriginal(null);
    setCategoryError(null);
  }, [type, locale]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!availableAccounts.some((acc) => acc.id === accountId)) {
      setAccountId(availableAccounts[0].id);
    }
  }, [availableAccounts, accountId]);

  useEffect(() => {
    return () => {
      stopCameraStream();
    };
  }, [stopCameraStream]);

  // Attach active MediaStream when <video> renders
  useEffect(() => {
    if (cameraActive && videoRef.current && mediaStreamRef.current) {
      videoRef.current.srcObject = mediaStreamRef.current;
      void videoRef.current.play().catch(() => {
        // Autoplay restriction fallback handled by muted + playsInline
      });
    }
  }, [cameraActive]);

  if (!open) return null;

  const selectedAccount =
    availableAccounts.find((a) => a.id === accountId) ?? availableAccounts[0];

  const scanReceiptImage = async (dataUrl: string, mimeType: string) => {
    setIsScanningReceipt(true);
    setScannerError(null);
    setScanResultSummary(null);
    setCapturedPreviewUrl(dataUrl);

    try {
      const response = await fetch('/api/scan-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: dataUrl,
          mimeType,
        }),
      });

      const payload = (await response.json()) as ParsedReceiptResponse;
      if (!response.ok) {
        setScannerError(payload.error || tm.scanApiError);
        return;
      }

      // Switch to expense for receipts cleanly
      setType('expense');

      const merchant = (payload.merchantName ?? '').trim();
      const parsedDate =
        payload.date && /^\d{4}-\d{2}-\d{2}$/.test(payload.date) ? payload.date : '';
      const parsedAmount =
        typeof payload.totalAmount === 'number' &&
        Number.isFinite(payload.totalAmount) &&
        payload.totalAmount > 0
          ? payload.totalAmount
          : 0;

      const scannedCurrRaw = (payload.currency ?? '').trim().toUpperCase();
      const detectedCurrency: SupportedTransactionCurrency | null =
        isSupportedTransactionCurrency(scannedCurrRaw) ? scannedCurrRaw : null;

      if (detectedCurrency) {
        setEntryCurrency(detectedCurrency);
        if (detectedCurrency === 'USD' || detectedCurrency === 'RWF') {
          const matchingAccount = availableAccounts.find(
            (acc) => acc.currency === detectedCurrency
          );
          if (matchingAccount) {
            setAccountId(matchingAccount.id);
          }
        }
      }

      if (merchant) {
        const notesSuffix = payload.notes?.trim() ? ` — ${payload.notes.trim()}` : '';
        setDescription(`${merchant}${notesSuffix}`.slice(0, 140));
      } else if (payload.notes?.trim()) {
        setDescription(payload.notes.trim().slice(0, 140));
      }

      if (parsedDate) {
        setDate(parsedDate);
      }

      if (parsedAmount > 0) {
        const targetCurrency = detectedCurrency ?? entryCurrency;
        setAmountInput(
          getCurrencyDecimals(targetCurrency) === 0
            ? String(Math.round(parsedAmount))
            : parsedAmount.toFixed(2)
        );
        setError(null);
      }

      if (payload.suggestedCategory) {
        const enIdx = translations.en.dashboard.transactionModal.expenseCategories.findIndex(
          (c) => c.toLowerCase() === payload.suggestedCategory?.toLowerCase()
        );
        const localizedList = tm.expenseCategories;
        if (enIdx >= 0 && localizedList[enIdx]) {
          setCategory(localizedList[enIdx]);
        } else {
          const directMatch = [...localizedList, ...customCategories.expense].find(
            (c) => c.toLowerCase() === payload.suggestedCategory?.toLowerCase()
          );
          if (directMatch) {
            setCategory(directMatch);
          }
        }
      }

      setScanResultSummary({
        merchant: merchant || '—',
        date: parsedDate || date,
        total: parsedAmount,
        confidence: payload.confidence ?? 'medium',
      });
    } catch {
      setScannerError(tm.scanApiError);
    } finally {
      setIsScanningReceipt(false);
    }
  };

  const handleOpenCamera = async () => {
    setScannerError(null);
    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices ||
      !navigator.mediaDevices.getUserMedia
    ) {
      setScannerError(tm.cameraUnavailableError);
      return;
    }

    try {
      stopCameraStream();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      mediaStreamRef.current = stream;
      setCameraActive(true);
    } catch (err) {
      const name = err instanceof DOMException ? err.name : '';
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        setScannerError(tm.cameraPermissionError);
      } else {
        setScannerError(tm.cameraUnavailableError);
      }
    }
  };

  const handleCaptureFrame = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, width, height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
    stopCameraStream();
    void scanReceiptImage(dataUrl, 'image/jpeg');
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    stopCameraStream();
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        void scanReceiptImage(reader.result, file.type || 'image/jpeg');
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleCreateCategory = () => {
    const trimmed = newCategoryName.trim().slice(0, 36);
    if (!trimmed) {
      setCategoryError(tm.errorCategoryEmpty);
      return;
    }
    const exists = allCategories.some(
      (cat) => cat.toLowerCase() === trimmed.toLowerCase()
    );
    if (exists) {
      setCategoryError(tm.errorCategoryDuplicate);
      return;
    }

    setCustomCategories((prev) => ({
      ...prev,
      [type]: [...prev[type], trimmed],
    }));
    setCategory(trimmed);
    setNewCategoryName('');
    setCategoryError(null);
  };

  const handleStartRenameCategory = (catName: string) => {
    setEditingCategoryOriginal(catName);
    setEditingCategoryValue(catName);
    setCategoryError(null);
  };

  const handleSaveRenameCategory = () => {
    if (!editingCategoryOriginal) return;
    const trimmed = editingCategoryValue.trim().slice(0, 36);
    if (!trimmed) {
      setCategoryError(tm.errorCategoryEmpty);
      return;
    }
    const duplicate = allCategories.some(
      (cat) =>
        cat !== editingCategoryOriginal &&
        cat.toLowerCase() === trimmed.toLowerCase()
    );
    if (duplicate) {
      setCategoryError(tm.errorCategoryDuplicate);
      return;
    }

    setCustomCategories((prev) => ({
      ...prev,
      [type]: prev[type].map((cat) =>
        cat === editingCategoryOriginal ? trimmed : cat
      ),
    }));
    if (category === editingCategoryOriginal) {
      setCategory(trimmed);
    }
    setEditingCategoryOriginal(null);
    setEditingCategoryValue('');
    setCategoryError(null);
  };

  const handleDeletePersonalCategory = (catName: string) => {
    setCustomCategories((prev) => ({
      ...prev,
      [type]: prev[type].filter((cat) => cat !== catName),
    }));
    if (category === catName) {
      setCategory(defaultCategories[0]);
    }
    if (editingCategoryOriginal === catName) {
      setEditingCategoryOriginal(null);
    }
  };

  const handleAddTag = (rawValue: string) => {
    const cleaned = normalizeTag(rawValue);
    if (!cleaned) return;

    const alreadySelected = selectedTags.some(
      (t) => t.toLowerCase() === cleaned.toLowerCase()
    );
    if (alreadySelected) {
      setTagInput('');
      return;
    }

    if (selectedTags.length >= MAX_TAGS_PER_TRANSACTION) {
      setTagWarning(tm.maxTagsReached);
      return;
    }

    setSelectedTags((prev) => [...prev, cleaned]);
    setSavedTags((prev) =>
      prev.some((t) => t.toLowerCase() === cleaned.toLowerCase())
        ? prev
        : [cleaned, ...prev].slice(0, 24)
    );
    setTagInput('');
    setTagWarning(null);
  };

  const handleToggleTagFromLibrary = (tag: string) => {
    const exists = selectedTags.some(
      (t) => t.toLowerCase() === tag.toLowerCase()
    );
    if (exists) {
      setSelectedTags((prev) =>
        prev.filter((t) => t.toLowerCase() !== tag.toLowerCase())
      );
      setTagWarning(null);
      return;
    }
    if (selectedTags.length >= MAX_TAGS_PER_TRANSACTION) {
      setTagWarning(tm.maxTagsReached);
      return;
    }
    setSelectedTags((prev) => [...prev, tag]);
    setTagWarning(null);
  };

  const handleDeleteSavedTag = (tag: string) => {
    setSavedTags((prev) =>
      prev.filter((t) => t.toLowerCase() !== tag.toLowerCase())
    );
    setSelectedTags((prev) =>
      prev.filter((t) => t.toLowerCase() !== tag.toLowerCase())
    );
  };

  const nextScheduledDate = isRecurring
    ? computeNextOccurrenceDate(date, recurringFrequency)
    : undefined;

  const isForeignCurrency = entryCurrency !== baseCurrency;
  const liveDirectRate = getDirectToBaseRate(entryCurrency, baseCurrency, fxSnapshot);
  const parsedManualRate = Number(manualRateInput);
  const manualRateValid =
    Number.isFinite(parsedManualRate) && parsedManualRate > 0 ? parsedManualRate : null;
  const effectiveDirectRate = isForeignCurrency
    ? (liveDirectRate ?? manualRateValid)
    : 1;

  const numericEnteredAmount = Number(amountInput);
  const conversionPreview =
    isForeignCurrency &&
    Number.isFinite(numericEnteredAmount) &&
    numericEnteredAmount > 0 &&
    effectiveDirectRate !== null
      ? computeNormalizedConversion({
          originalAmount: numericEnteredAmount,
          originalCurrency: entryCurrency,
          baseCurrency,
          directRateToBase: effectiveDirectRate,
          rateTimestamp: fxSnapshot?.updatedAt,
        })
      : null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numericAmount = Number(amountInput);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError(tm.errorAmount);
      return;
    }

    if (isForeignCurrency && (effectiveDirectRate === null || effectiveDirectRate <= 0)) {
      setError(tm.errorMissingFxRate);
      return;
    }

    let finalTags = [...selectedTags];
    const pendingTag = normalizeTag(tagInput);
    if (
      pendingTag &&
      finalTags.length < MAX_TAGS_PER_TRANSACTION &&
      !finalTags.some((t) => t.toLowerCase() === pendingTag.toLowerCase())
    ) {
      finalTags = [...finalTags, pendingTag];
      setSavedTags((prev) =>
        prev.some((t) => t.toLowerCase() === pendingTag.toLowerCase())
          ? prev
          : [pendingTag, ...prev].slice(0, 24)
      );
    }

    const conversion = isForeignCurrency
      ? computeNormalizedConversion({
          originalAmount: numericAmount,
          originalCurrency: entryCurrency,
          baseCurrency,
          directRateToBase: effectiveDirectRate as number,
          rateTimestamp: fxSnapshot?.updatedAt,
        })
      : null;

    const normalizedFinalAmount = conversion
      ? conversion.normalizedAmount
      : Math.round(numericAmount * 100) / 100;

    const activeCategory = category || defaultCategories[0];
    const linkedGoal = goals?.find((g) => g.id === selectedGoalId);
    const refSuffix = Math.floor(100000 + Math.random() * 900000);
    onSave({
      id: `${Date.now()}-${refSuffix}`,
      referenceNo: `TXN-${date.replace(/-/g, '')}-${refSuffix}`,
      idempotencyKey,
      type,
      accountId: selectedAccount.id,
      accountName: selectedAccount.name,
      currency: baseCurrency,
      category: activeCategory,
      tags: finalTags.length > 0 ? finalTags : undefined,
      amount: normalizedFinalAmount,
      date,
      createdAt: new Date().toISOString(),
      description: description.trim() || activeCategory,
      isRecurring: isRecurring || undefined,
      recurringFrequency: isRecurring ? recurringFrequency : undefined,
      nextOccurrenceDate: nextScheduledDate,
      goalId: linkedGoal?.id,
      goalName: linkedGoal?.name,
      originalCurrency: conversion?.originalCurrency,
      originalAmount: conversion?.originalAmount,
      exchangeRate: conversion?.exchangeRate,
      rateTimestamp: conversion?.rateTimestamp,
    });
    stopCameraStream();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="transaction-modal-title"
      onClick={() => {
        stopCameraStream();
        onClose();
      }}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-[#263449] dark:bg-[#0B1220]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2
              id="transaction-modal-title"
              className="font-display text-lg font-bold text-slate-900 dark:text-white"
            >
              {tm.title}
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {tm.subtitle}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                if (scannerOpen) {
                  stopCameraStream();
                  setScannerOpen(false);
                } else {
                  setScannerOpen(true);
                }
              }}
              aria-expanded={scannerOpen}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                scannerOpen
                  ? 'border-[#7C3AED] bg-violet-50 text-[#6D28D9] dark:border-violet-500/40 dark:bg-violet-950/40 dark:text-violet-300'
                  : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-[#263449] dark:bg-[#162235] dark:text-slate-200 dark:hover:bg-[#1E2D45]'
              }`}
            >
              <Camera className="h-3.5 w-3.5 text-[#7C3AED]" />
              <span className="hidden sm:inline">
                {scannerOpen ? tm.hideScannerBtn : tm.scanReceiptBtn}
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                stopCameraStream();
                onClose();
              }}
              aria-label={tm.cancel}
              className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-[#162235] dark:hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Camera Receipt Scanner Drawer */}
        {scannerOpen && (
          <div className="mt-4 rounded-xl border border-violet-200 bg-violet-50/60 p-4 dark:border-violet-500/30 dark:bg-violet-950/20">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#7C3AED] text-white">
                  <ScanLine className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                    {tm.scannerTitle}
                  </h3>
                  <p className="mt-0.5 text-[11px] leading-snug text-slate-600 dark:text-slate-300">
                    {tm.scannerSubtitle}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {!cameraActive ? (
                <button
                  type="button"
                  onClick={() => void handleOpenCamera()}
                  disabled={isScanningReceipt}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#7C3AED] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#6D28D9] disabled:opacity-60"
                >
                  <Camera className="h-3.5 w-3.5" />
                  <span>{tm.startCameraBtn}</span>
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={handleCaptureFrame}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#16A34A] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-emerald-700"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>{tm.captureBtn}</span>
                  </button>
                  <button
                    type="button"
                    onClick={stopCameraStream}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-[#263449] dark:bg-[#0B1220] dark:text-slate-200"
                  >
                    <X className="h-3.5 w-3.5" />
                    <span>{tm.stopCameraBtn}</span>
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isScanningReceipt}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60 dark:border-[#263449] dark:bg-[#0B1220] dark:text-slate-200 dark:hover:bg-[#162235]"
              >
                <Upload className="h-3.5 w-3.5 text-[#7C3AED]" />
                <span>{tm.uploadPhotoBtn}</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileSelected}
                className="hidden"
              />
            </div>

            {cameraActive && (
              <div className="mt-3 overflow-hidden rounded-xl border border-slate-300 bg-black dark:border-[#263449]">
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  autoPlay
                  className="max-h-56 w-full object-cover"
                />
              </div>
            )}

            <canvas ref={canvasRef} className="hidden" />

            {isScanningReceipt && (
              <div className="mt-3 flex items-center gap-2 rounded-lg border border-violet-200 bg-white/90 px-3 py-2 text-xs font-semibold text-[#6D28D9] dark:border-violet-500/30 dark:bg-[#0B1220] dark:text-violet-300">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>{tm.scanningStatus}</span>
              </div>
            )}

            {scannerError && (
              <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] font-medium text-rose-700 dark:border-rose-500/30 dark:bg-rose-950/40 dark:text-rose-300">
                {scannerError}
              </div>
            )}

            {scanResultSummary && (
              <div className="mt-3 flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50/90 p-2.5 text-[11px] text-emerald-950 dark:border-emerald-500/30 dark:bg-emerald-950/40 dark:text-emerald-100">
                {capturedPreviewUrl && (
                  <img
                    src={capturedPreviewUrl}
                    alt="Scanned receipt"
                    className="h-12 w-12 shrink-0 rounded-md border border-emerald-200 object-cover dark:border-emerald-500/30"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-1">
                    <span className="font-bold">{tm.scanSuccessPrefix}</span>
                    <span className="rounded bg-white/80 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800 dark:bg-[#0B1220] dark:text-emerald-300">
                      {scanResultSummary.confidence === 'high'
                        ? tm.confidenceHigh
                        : scanResultSummary.confidence === 'low'
                          ? tm.confidenceLow
                          : tm.confidenceMedium}
                    </span>
                  </div>
                  <p className="mt-1 truncate">
                    {tm.merchantLabel}: <strong>{scanResultSummary.merchant}</strong> ·{' '}
                    {tm.scannedDateLabel}: <strong>{scanResultSummary.date}</strong> ·{' '}
                    {tm.scannedTotalLabel}:{' '}
                    <strong className="font-mono-num">{scanResultSummary.total}</strong>
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
          {/* Income / Expense Segmented Selector */}
          <div>
            <span className="block text-xs font-medium text-slate-700 dark:text-slate-200">
              {tm.typeLabel}
            </span>
            <div className="mt-1.5 grid grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-[#263449] dark:bg-[#162235]">
              <button
                type="button"
                onClick={() => setType('income')}
                className={`inline-flex items-center justify-center gap-2 rounded-lg py-2 text-xs font-semibold transition-colors ${
                  type === 'income'
                    ? 'bg-[#16A34A] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
                }`}
              >
                <TrendingUp className="h-4 w-4" />
                <span>{tm.income}</span>
              </button>
              <button
                type="button"
                onClick={() => setType('expense')}
                className={`inline-flex items-center justify-center gap-2 rounded-lg py-2 text-xs font-semibold transition-colors ${
                  type === 'expense'
                    ? 'bg-[#7C3AED] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
                }`}
              >
                <TrendingDown className="h-4 w-4" />
                <span>{tm.expense}</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="txn-account"
                className="block text-xs font-medium text-slate-700 dark:text-slate-200"
              >
                {tm.accountLabel}
              </label>
              <select
                id="txn-account"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 focus:border-[#7C3AED] focus:outline-none dark:border-[#263449] dark:bg-[#162235] dark:text-slate-100"
              >
                {availableAccounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} ({acc.currency})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor="txn-category"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-200"
                >
                  {tm.categoryLabel}
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setManageCategoriesOpen((prev) => !prev);
                    setCategoryError(null);
                  }}
                  aria-expanded={manageCategoriesOpen}
                  className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold text-[#7C3AED] transition-colors hover:bg-violet-50 dark:text-violet-300 dark:hover:bg-violet-950/40"
                >
                  <FolderPlus className="h-3 w-3" />
                  <span>
                    {manageCategoriesOpen
                      ? tm.hideManageCategoriesBtn
                      : tm.manageCategoriesBtn}
                  </span>
                </button>
              </div>
              <select
                id="txn-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 focus:border-[#7C3AED] focus:outline-none dark:border-[#263449] dark:bg-[#162235] dark:text-slate-100"
              >
                <optgroup label={tm.defaultGroupLabel}>
                  {defaultCategories.map((cat) => (
                    <option key={`default-${cat}`} value={cat}>
                      {cat}
                    </option>
                  ))}
                </optgroup>
                {personalCategories.length > 0 && (
                  <optgroup label={tm.customGroupLabel}>
                    {personalCategories.map((cat) => (
                      <option key={`personal-${cat}`} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>
          </div>

          {/* Inline Personal Categories Creator & Manager */}
          {manageCategoriesOpen && (
            <div className="rounded-xl border border-violet-200 bg-violet-50/60 p-3.5 dark:border-violet-500/30 dark:bg-violet-950/20">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                  {tm.customGroupLabel} ({type === 'income' ? tm.income : tm.expense})
                </span>
                <span className="font-mono-num text-[11px] font-semibold text-[#7C3AED] dark:text-violet-300">
                  {personalCategories.length}
                </span>
              </div>

              <div className="mt-2.5 flex gap-2">
                <input
                  type="text"
                  maxLength={36}
                  value={newCategoryName}
                  onChange={(e) => {
                    setNewCategoryName(e.target.value);
                    setCategoryError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleCreateCategory();
                    }
                  }}
                  placeholder={tm.newCategoryPlaceholder}
                  aria-label={tm.newCategoryPlaceholder}
                  className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#7C3AED] focus:outline-none dark:border-[#263449] dark:bg-[#0B1220] dark:text-slate-100"
                />
                <button
                  type="button"
                  onClick={handleCreateCategory}
                  className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-[#7C3AED] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#6D28D9]"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>{tm.addCategoryBtn}</span>
                </button>
              </div>

              {categoryError && (
                <p className="mt-1.5 text-[11px] font-medium text-rose-600 dark:text-rose-400">
                  {categoryError}
                </p>
              )}

              {personalCategories.length === 0 ? (
                <p className="mt-2.5 text-[11px] text-slate-500 dark:text-slate-400">
                  {tm.noCustomCategories}
                </p>
              ) : (
                <ul className="mt-2.5 max-h-36 space-y-1.5 overflow-y-auto pr-0.5">
                  {personalCategories.map((cat) => {
                    const isEditing = editingCategoryOriginal === cat;
                    const isSelected = category === cat;
                    return (
                      <li
                        key={cat}
                        className="flex items-center justify-between gap-2 rounded-lg border border-slate-200/80 bg-white px-2.5 py-1.5 text-xs dark:border-[#263449] dark:bg-[#0B1220]"
                      >
                        {isEditing ? (
                          <div className="flex min-w-0 flex-1 items-center gap-1.5">
                            <input
                              type="text"
                              maxLength={36}
                              value={editingCategoryValue}
                              onChange={(e) => {
                                setEditingCategoryValue(e.target.value);
                                setCategoryError(null);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleSaveRenameCategory();
                                } else if (e.key === 'Escape') {
                                  e.stopPropagation();
                                  setEditingCategoryOriginal(null);
                                }
                              }}
                              className="min-w-0 flex-1 rounded border border-[#7C3AED] bg-slate-50 px-2 py-0.5 text-xs text-slate-900 focus:outline-none dark:bg-[#162235] dark:text-white"
                            />
                            <button
                              type="button"
                              onClick={handleSaveRenameCategory}
                              aria-label={tm.saveRenameLabel}
                              className="rounded p-1 text-[#16A34A] hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                            >
                              <Check className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingCategoryOriginal(null)}
                              aria-label={tm.cancel}
                              className="rounded p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-[#162235]"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => setCategory(cat)}
                              className={`min-w-0 flex-1 truncate text-left font-medium ${
                                isSelected
                                  ? 'font-semibold text-[#7C3AED] dark:text-violet-300'
                                  : 'text-slate-700 hover:text-slate-900 dark:text-slate-200 dark:hover:text-white'
                              }`}
                            >
                              {cat}
                            </button>
                            <div className="flex shrink-0 items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleStartRenameCategory(cat)}
                                aria-label={`${tm.renameCategoryLabel}: ${cat}`}
                                title={tm.renameCategoryLabel}
                                className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-[#162235] dark:hover:text-slate-200"
                              >
                                <Pencil className="h-3 w-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeletePersonalCategory(cat)}
                                aria-label={`${tm.deleteCategoryLabel}: ${cat}`}
                                title={tm.deleteCategoryLabel}
                                className="rounded p-1 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          </>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label
                htmlFor="txn-entry-currency"
                className="block text-xs font-medium text-slate-700 dark:text-slate-200"
              >
                {tm.entryCurrencyLabel}
              </label>
              <select
                id="txn-entry-currency"
                value={entryCurrency}
                onChange={(e) => {
                  const val = e.target.value;
                  if (isSupportedTransactionCurrency(val)) {
                    setEntryCurrency(val);
                    setError(null);
                    setManualRateInput('');
                  }
                }}
                className="font-mono-num mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-900 focus:border-[#7C3AED] focus:outline-none dark:border-[#263449] dark:bg-[#162235] dark:text-slate-100"
              >
                {SUPPORTED_TRANSACTION_CURRENCIES.map((curr) => (
                  <option key={curr.code} value={curr.code}>
                    {curr.code}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="txn-amount"
                className="block text-xs font-medium text-slate-700 dark:text-slate-200"
              >
                {tm.amountLabel} ({entryCurrency})
              </label>
              <input
                id="txn-amount"
                type="number"
                step={getCurrencyDecimals(entryCurrency) === 0 ? '1' : '0.01'}
                min="0.01"
                required
                value={amountInput}
                onChange={(e) => {
                  setAmountInput(e.target.value);
                  setError(null);
                }}
                placeholder={getCurrencyDecimals(entryCurrency) === 0 ? '25000' : '50.00'}
                className="font-mono-num mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#7C3AED] focus:outline-none dark:border-[#263449] dark:bg-[#162235] dark:text-slate-100"
              />
            </div>

            <div>
              <label
                htmlFor="txn-date"
                className="block text-xs font-medium text-slate-700 dark:text-slate-200"
              >
                {tm.dateLabel}
              </label>
              <input
                id="txn-date"
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 focus:border-[#7C3AED] focus:outline-none dark:border-[#263449] dark:bg-[#162235] dark:text-slate-100"
              />
            </div>
          </div>

          {/* Real-Time Multi-Currency FX Normalization Card */}
          {isForeignCurrency && (
            <div className="rounded-xl border border-sky-200 bg-sky-50/70 p-3.5 dark:border-sky-500/30 dark:bg-sky-950/20">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300">
                    <ArrowRightLeft className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900 dark:text-white">
                      {tm.baseCurrencyNote}: {baseCurrency}
                    </p>
                    <p className="font-mono-num text-[11px] text-slate-600 dark:text-slate-300">
                      {fxLoading ? (
                        tm.fetchingRateStatus
                      ) : liveDirectRate !== null ? (
                        <>
                          {tm.liveRateLabel}:{' '}
                          <strong>
                            1 {entryCurrency} = {formatFxRateValue(liveDirectRate, baseCurrency)}{' '}
                            {baseCurrency}
                          </strong>
                          {fxSnapshot?.provider ? ` · ${fxSnapshot.provider}` : ''}
                        </>
                      ) : (
                        tm.fxUnavailableError
                      )}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => void loadExchangeRates(true)}
                  disabled={fxLoading}
                  className="inline-flex items-center gap-1 rounded-lg border border-sky-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-sky-700 transition-colors hover:bg-sky-50 disabled:opacity-60 dark:border-sky-500/30 dark:bg-[#0B1220] dark:text-sky-300 dark:hover:bg-sky-950/40"
                >
                  <RefreshCw className={`h-3 w-3 ${fxLoading ? 'animate-spin' : ''}`} />
                  <span>{tm.refreshRateBtn}</span>
                </button>
              </div>

              {(fxError || liveDirectRate === null) && !fxLoading && (
                <div className="mt-2.5 rounded-lg border border-amber-200 bg-amber-50/80 p-2.5 dark:border-amber-500/30 dark:bg-amber-950/30">
                  <label
                    htmlFor="txn-manual-fx"
                    className="block text-[11px] font-semibold text-amber-900 dark:text-amber-200"
                  >
                    {tm.manualRateLabel} (1 {entryCurrency} = ? {baseCurrency})
                  </label>
                  <input
                    id="txn-manual-fx"
                    type="number"
                    step="any"
                    min="0.000001"
                    value={manualRateInput}
                    onChange={(e) => {
                      setManualRateInput(e.target.value);
                      setError(null);
                    }}
                    placeholder={tm.manualRatePlaceholder}
                    className="font-mono-num mt-1 w-full rounded-lg border border-amber-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-[#7C3AED] focus:outline-none dark:border-amber-500/40 dark:bg-[#0B1220] dark:text-white"
                  />
                </div>
              )}

              {conversionPreview && (
                <div className="mt-2.5 flex items-center justify-between gap-2 rounded-lg border border-sky-200/80 bg-white/90 px-3 py-2 text-xs dark:border-sky-500/20 dark:bg-[#0B1220]">
                  <span className="font-medium text-slate-600 dark:text-slate-300">
                    {tm.normalizedAmountLabel} ({baseCurrency}):
                  </span>
                  <span className="font-mono-num font-bold text-[#6D28D9] dark:text-violet-300">
                    {formatCurrencyAmount(conversionPreview.normalizedAmount, baseCurrency)}
                  </span>
                </div>
              )}
            </div>
          )}

          <div>
            <label
              htmlFor="txn-description"
              className="block text-xs font-medium text-slate-700 dark:text-slate-200"
            >
              {tm.descriptionLabel}
            </label>
            <input
              id="txn-description"
              type="text"
              maxLength={140}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={tm.descriptionPlaceholder}
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#7C3AED] focus:outline-none dark:border-[#263449] dark:bg-[#162235] dark:text-slate-100"
            />
          </div>

          {goals && goals.length > 0 && (
            <div>
              <label
                htmlFor="txn-goal"
                className="flex items-center gap-1.5 text-xs font-medium text-slate-700 dark:text-slate-200"
              >
                <Target className="h-3.5 w-3.5 text-[#7C3AED]" />
                <span>{tm.goalLabel}</span>
              </label>
              <select
                id="txn-goal"
                value={selectedGoalId}
                onChange={(e) => setSelectedGoalId(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 focus:border-[#7C3AED] focus:outline-none dark:border-[#263449] dark:bg-[#162235] dark:text-slate-100"
              >
                <option value="">{tm.noGoalOption}</option>
                {goals.map((goal) => (
                  <option key={goal.id} value={goal.id}>
                    {goal.name} ({goal.currency})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Recurring Transaction Toggle & Frequency */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 dark:border-[#263449] dark:bg-[#162235]/50">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-[#7C3AED] dark:bg-violet-950/60">
                  <Repeat className="h-3.5 w-3.5" />
                </div>
                <div>
                  <span className="block text-xs font-bold text-slate-800 dark:text-slate-100">
                    {tm.recurringToggleLabel}
                  </span>
                  <span className="block text-[11px] text-slate-500 dark:text-slate-400">
                    {tm.recurringToggleDesc}
                  </span>
                </div>
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={isRecurring}
                aria-label={tm.recurringToggleLabel}
                onClick={() => setIsRecurring((prev) => !prev)}
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7C3AED] ${
                  isRecurring ? 'bg-[#7C3AED]' : 'bg-slate-300 dark:bg-[#263449]'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition-transform ${
                    isRecurring ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {isRecurring && (
              <div className="mt-3 border-t border-slate-200/80 pt-3 dark:border-[#263449]">
                <span className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                  {tm.frequencyLabel}
                </span>
                <div className="mt-1.5 grid grid-cols-3 gap-2">
                  {(['daily', 'weekly', 'monthly'] as const).map((freq) => {
                    const active = recurringFrequency === freq;
                    return (
                      <button
                        key={freq}
                        type="button"
                        onClick={() => setRecurringFrequency(freq)}
                        className={`rounded-lg border py-1.5 text-xs font-semibold transition-colors ${
                          active
                            ? 'border-[#7C3AED] bg-[#7C3AED] text-white'
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-[#263449] dark:bg-[#0B1220] dark:text-slate-200 dark:hover:bg-[#162235]'
                        }`}
                      >
                        {tm.frequencies[freq]}
                      </button>
                    );
                  })}
                </div>
                <p className="font-mono-num mt-2 text-[11px] font-medium text-[#6D28D9] dark:text-violet-300">
                  {tm.nextRunLabel} {nextScheduledDate}
                </p>
              </div>
            )}
          </div>

          {/* Custom Transaction Tagging */}
          <div>
            <label
              htmlFor="txn-tags-input"
              className="flex items-center gap-1.5 text-xs font-medium text-slate-700 dark:text-slate-200"
            >
              <Tag className="h-3.5 w-3.5 text-[#7C3AED]" />
              <span>{tm.tagsLabel}</span>
            </label>

            <div className="mt-1.5 flex gap-2">
              <input
                id="txn-tags-input"
                type="text"
                maxLength={28}
                value={tagInput}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val.endsWith(',')) {
                    handleAddTag(val.slice(0, -1));
                  } else {
                    setTagInput(val);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddTag(tagInput);
                  }
                }}
                placeholder={tm.tagInputPlaceholder}
                className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#7C3AED] focus:outline-none dark:border-[#263449] dark:bg-[#162235] dark:text-slate-100"
              />
              <button
                type="button"
                onClick={() => handleAddTag(tagInput)}
                className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-[#263449] dark:bg-[#162235] dark:text-slate-200 dark:hover:bg-[#1e2d44]"
              >
                <Plus className="h-3.5 w-3.5 text-[#7C3AED]" />
                <span>{tm.addTagBtn}</span>
              </button>
            </div>

            {tagWarning && (
              <p className="mt-1 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                {tagWarning}
              </p>
            )}

            {selectedTags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {selectedTags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 rounded-md border border-violet-200 bg-violet-50 px-2 py-0.5 text-[11px] font-semibold text-[#6D28D9] dark:border-violet-500/30 dark:bg-violet-950/50 dark:text-violet-300"
                  >
                    <span>#{tag}</span>
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedTags((prev) => prev.filter((t) => t !== tag))
                      }
                      aria-label={`${tm.removeTagAria}: ${tag}`}
                      className="rounded p-0.5 hover:bg-violet-200/70 dark:hover:bg-violet-900/60"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {savedTags.length > 0 && (
              <div className="mt-2.5">
                <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  {tm.savedTagsLabel}:
                </p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {savedTags.map((tag) => {
                    const isActive = selectedTags.some(
                      (t) => t.toLowerCase() === tag.toLowerCase()
                    );
                    return (
                      <span
                        key={tag}
                        className={`inline-flex items-center rounded-md border text-[11px] transition-colors ${
                          isActive
                            ? 'border-[#7C3AED] bg-[#7C3AED] text-white'
                            : 'border-slate-200 bg-slate-50 text-slate-600 dark:border-[#263449] dark:bg-[#162235] dark:text-slate-300'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => handleToggleTagFromLibrary(tag)}
                          className="px-2 py-0.5 font-medium"
                        >
                          #{tag}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteSavedTag(tag)}
                          aria-label={`${tm.deleteSavedTagAria}: ${tag}`}
                          className={`mr-1 rounded p-0.5 ${
                            isActive
                              ? 'hover:bg-white/20'
                              : 'text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400'
                          }`}
                        >
                          <X className="h-2.5 w-2.5" />
                        </button>
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-medium text-rose-700 dark:border-rose-500/30 dark:bg-rose-950/40 dark:text-rose-300">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-2.5 border-t border-slate-100 pt-4 dark:border-[#263449]">
            <button
              type="button"
              onClick={() => {
                stopCameraStream();
                onClose();
              }}
              className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-[#263449] dark:text-slate-200 dark:hover:bg-[#162235]"
            >
              {tm.cancel}
            </button>
            <button
              type="submit"
              className="rounded-xl bg-[#7C3AED] px-5 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#6D28D9] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7C3AED]"
            >
              {tm.submit}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
