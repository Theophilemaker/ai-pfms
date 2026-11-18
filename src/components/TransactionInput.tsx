import { useEffect, useState } from 'react';
import {
  Check,
  FolderPlus,
  Pencil,
  Plus,
  Tag,
  Trash2,
  TrendingDown,
  TrendingUp,
  X,
} from 'lucide-react';
import { translations, type Locale } from '../i18n/translations';

export type TransactionType = 'income' | 'expense';

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
}

interface TransactionInputProps {
  open: boolean;
  onClose: () => void;
  onSave: (transaction: RecordedTransaction) => void;
  locale: Locale;
  initialType?: TransactionType;
  accounts?: { id: string; name: string; type: string; currency: string }[];
}

type CustomCategoryStore = Record<TransactionType, string[]>;

const CUSTOM_CATEGORIES_STORAGE_KEY = 'ai_pfms_custom_categories_v1';
const CUSTOM_TAGS_STORAGE_KEY = 'ai_pfms_custom_tags_v1';
const MAX_TAGS_PER_TRANSACTION = 8;

function getTodayIso(): string {
  return new Date().toISOString().slice(0, 10);
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
  initialType = 'expense',
  accounts,
}: TransactionInputProps) {
  const d = translations[locale].dashboard;
  const tm = d.transactionModal;
  const availableAccounts =
    accounts && accounts.length > 0 ? accounts : d.accountTypes;

  const [type, setType] = useState<TransactionType>(initialType);
  const [accountId, setAccountId] = useState<string>(availableAccounts[0].id);
  const [category, setCategory] = useState<string>('');
  const [amountInput, setAmountInput] = useState<string>('');
  const [date, setDate] = useState<string>(getTodayIso);
  const [description, setDescription] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState<string>(() =>
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`
  );

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

  useEffect(() => {
    try {
      window.localStorage.setItem(
        CUSTOM_CATEGORIES_STORAGE_KEY,
        JSON.stringify(customCategories)
      );
    } catch {
      // Ignore storage quota restrictions
    }
  }, [customCategories]);

  useEffect(() => {
    try {
      window.localStorage.setItem(CUSTOM_TAGS_STORAGE_KEY, JSON.stringify(savedTags));
    } catch {
      // Ignore storage quota restrictions
    }
  }, [savedTags]);

  useEffect(() => {
    if (!open) return;
    setType(initialType);
    setAmountInput('');
    setDescription('');
    setError(null);
    setSelectedTags([]);
    setTagInput('');
    setTagWarning(null);
    setManageCategoriesOpen(false);
    setNewCategoryName('');
    setCategoryError(null);
    setEditingCategoryOriginal(null);
    setDate(getTodayIso());
    setIdempotencyKey(
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
  }, [open, initialType]);

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

  if (!open) return null;

  const selectedAccount =
    availableAccounts.find((a) => a.id === accountId) ?? availableAccounts[0];

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numericAmount = Number(amountInput);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError(tm.errorAmount);
      return;
    }

    // Include any pending typed tag if the user didn't press Enter before submitting
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

    const activeCategory = category || defaultCategories[0];
    const refSuffix = Math.floor(100000 + Math.random() * 900000);
    onSave({
      id: `${Date.now()}-${refSuffix}`,
      referenceNo: `TXN-${date.replace(/-/g, '')}-${refSuffix}`,
      idempotencyKey,
      type,
      accountId: selectedAccount.id,
      accountName: selectedAccount.name,
      currency: selectedAccount.currency,
      category: activeCategory,
      tags: finalTags.length > 0 ? finalTags : undefined,
      amount: Math.round(numericAmount * 100) / 100,
      date,
      createdAt: new Date().toISOString(),
      description: description.trim() || activeCategory,
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="transaction-modal-title"
      onClick={onClose}
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
          <button
            type="button"
            onClick={onClose}
            aria-label={tm.cancel}
            className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-[#162235] dark:hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

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

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="txn-amount"
                className="block text-xs font-medium text-slate-700 dark:text-slate-200"
              >
                {tm.amountLabel} ({selectedAccount.currency})
              </label>
              <input
                id="txn-amount"
                type="number"
                step={selectedAccount.currency === 'RWF' ? '1' : '0.01'}
                min="0.01"
                required
                value={amountInput}
                onChange={(e) => {
                  setAmountInput(e.target.value);
                  setError(null);
                }}
                placeholder={selectedAccount.currency === 'RWF' ? '25000' : '50.00'}
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
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-[#7C3AED] focus:outline-none dark:border-[#263449] dark:bg-[#162235] dark:text-slate-100"
              />
            </div>
          </div>

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
              onClick={onClose}
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
