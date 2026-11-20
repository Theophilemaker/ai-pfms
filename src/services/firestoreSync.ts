import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import type {
  CategoryBudgetRecommendation,
  ForecastMonthProjection,
  SavedBudgetForecast,
} from '../components/AIBudgetForecast';
import type { DebtAccount, DebtType } from '../components/DebtPayoff';
import type { SavingsGoal } from '../components/BudgetGoals';
import type { ScheduledBill } from '../components/NotificationCenter';
import type {
  BudgetAllocation,
  LinkedAccountConfig,
} from '../components/OnboardingWizard';
import type { AccountUpdateEvent } from '../components/RecentActivity';
import type {
  RecurrenceFrequency,
  RecordedTransaction,
} from '../components/TransactionInput';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';

export interface UserProfileDoc {
  uid: string;
  email: string;
  displayName: string;
  primaryCurrency: 'RWF' | 'USD';
  monthlyIncomeTarget: number;
  onboardingCompleted: boolean;
  budgetThresholdPct: number;
  categoryThresholds: Record<string, number>;
  customCategoriesIncome: string[];
  customCategoriesExpense: string[];
  savedTags: string[];
  createdAt?: Timestamp | string;
}

export function toSafeDocId(raw: string): string {
  const sanitized = raw
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 96);
  if (sanitized.length > 0) return sanitized;
  return `doc-${Date.now()}`;
}

function clampString(value: string, maxLen: number, fallback = ''): string {
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  return trimmed.slice(0, maxLen);
}

function clampAmount(value: number, min = 0): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(1_000_000_000_000, Math.max(min, Math.round(value * 100) / 100));
}

function timestampToIso(ts: unknown): string | undefined {
  if (ts instanceof Timestamp) {
    return ts.toDate().toISOString();
  }
  if (typeof ts === 'string') return ts;
  return undefined;
}

export async function ensureUserProfile(params: {
  uid: string;
  email: string;
  displayName: string;
}): Promise<{ isNewProfile: boolean; profile: UserProfileDoc }> {
  const path = `users/${params.uid}`;
  const ref = doc(db, 'users', params.uid);

  try {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const data = snap.data() as Partial<UserProfileDoc>;
      return {
        isNewProfile: !Boolean(data.onboardingCompleted),
        profile: {
          uid: params.uid,
          email: data.email || params.email,
          displayName: data.displayName || params.displayName,
          primaryCurrency: data.primaryCurrency === 'USD' ? 'USD' : 'RWF',
          monthlyIncomeTarget:
            typeof data.monthlyIncomeTarget === 'number' ? data.monthlyIncomeTarget : 0,
          onboardingCompleted: Boolean(data.onboardingCompleted),
          budgetThresholdPct:
            typeof data.budgetThresholdPct === 'number' ? data.budgetThresholdPct : 80,
          categoryThresholds:
            data.categoryThresholds && typeof data.categoryThresholds === 'object'
              ? data.categoryThresholds
              : {},
          customCategoriesIncome: Array.isArray(data.customCategoriesIncome)
            ? data.customCategoriesIncome
            : [],
          customCategoriesExpense: Array.isArray(data.customCategoriesExpense)
            ? data.customCategoriesExpense
            : [],
          savedTags: Array.isArray(data.savedTags) ? data.savedTags : [],
          createdAt: data.createdAt,
        },
      };
    }

    const safeDisplayName = clampString(params.displayName, 100, 'AI-PFMS Member');
    const newProfile = {
      uid: params.uid,
      email: clampString(params.email, 254),
      displayName: safeDisplayName,
      primaryCurrency: 'RWF' as const,
      monthlyIncomeTarget: 0,
      onboardingCompleted: false,
      budgetThresholdPct: 80,
      categoryThresholds: {},
      customCategoriesIncome: [],
      customCategoriesExpense: [],
      savedTags: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    await setDoc(ref, newProfile);
    return {
      isNewProfile: true,
      profile: {
        uid: params.uid,
        email: newProfile.email,
        displayName: safeDisplayName,
        primaryCurrency: 'RWF',
        monthlyIncomeTarget: 0,
        onboardingCompleted: false,
        budgetThresholdPct: 80,
        categoryThresholds: {},
        customCategoriesIncome: [],
        customCategoriesExpense: [],
        savedTags: [],
      },
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export function subscribeUserProfile(
  uid: string,
  onData: (profile: UserProfileDoc) => void
): Unsubscribe {
  const path = `users/${uid}`;
  return onSnapshot(
    doc(db, 'users', uid),
    (snap) => {
      if (!snap.exists()) return;
      const data = snap.data() as Partial<UserProfileDoc>;
      onData({
        uid,
        email: data.email || '',
        displayName: data.displayName || 'AI-PFMS Member',
        primaryCurrency: data.primaryCurrency === 'USD' ? 'USD' : 'RWF',
        monthlyIncomeTarget:
          typeof data.monthlyIncomeTarget === 'number' ? data.monthlyIncomeTarget : 0,
        onboardingCompleted: Boolean(data.onboardingCompleted),
        budgetThresholdPct:
          typeof data.budgetThresholdPct === 'number' ? data.budgetThresholdPct : 80,
        categoryThresholds:
          data.categoryThresholds && typeof data.categoryThresholds === 'object'
            ? data.categoryThresholds
            : {},
        customCategoriesIncome: Array.isArray(data.customCategoriesIncome)
          ? data.customCategoriesIncome
          : [],
        customCategoriesExpense: Array.isArray(data.customCategoriesExpense)
          ? data.customCategoriesExpense
          : [],
        savedTags: Array.isArray(data.savedTags) ? data.savedTags : [],
        createdAt: data.createdAt,
      });
    },
    (error) => handleFirestoreError(error, OperationType.GET, path)
  );
}

export async function updateUserProfilePreferences(
  uid: string,
  updates: Partial<{
    primaryCurrency: 'RWF' | 'USD';
    monthlyIncomeTarget: number;
    onboardingCompleted: boolean;
    budgetThresholdPct: number;
    categoryThresholds: Record<string, number>;
    customCategoriesIncome: string[];
    customCategoriesExpense: string[];
    savedTags: string[];
  }>
): Promise<void> {
  const path = `users/${uid}`;
  try {
    const payload: Record<string, unknown> = {
      updatedAt: serverTimestamp(),
    };
    if (updates.primaryCurrency !== undefined) {
      payload.primaryCurrency = updates.primaryCurrency === 'USD' ? 'USD' : 'RWF';
    }
    if (updates.monthlyIncomeTarget !== undefined) {
      payload.monthlyIncomeTarget = clampAmount(updates.monthlyIncomeTarget, 0);
    }
    if (updates.onboardingCompleted !== undefined) {
      payload.onboardingCompleted = Boolean(updates.onboardingCompleted);
    }
    if (updates.budgetThresholdPct !== undefined) {
      payload.budgetThresholdPct = Math.min(
        100,
        Math.max(10, Math.round(updates.budgetThresholdPct))
      );
    }
    if (updates.categoryThresholds !== undefined) {
      const cleanMap: Record<string, number> = {};
      Object.entries(updates.categoryThresholds)
        .slice(0, 40)
        .forEach(([k, v]) => {
          if (typeof v === 'number' && Number.isFinite(v)) {
            cleanMap[clampString(k, 60)] = Math.min(100, Math.max(10, Math.round(v)));
          }
        });
      payload.categoryThresholds = cleanMap;
    }
    if (updates.customCategoriesIncome !== undefined) {
      payload.customCategoriesIncome = updates.customCategoriesIncome
        .slice(0, 40)
        .map((c) => clampString(c, 36))
        .filter(Boolean);
    }
    if (updates.customCategoriesExpense !== undefined) {
      payload.customCategoriesExpense = updates.customCategoriesExpense
        .slice(0, 40)
        .map((c) => clampString(c, 36))
        .filter(Boolean);
    }
    if (updates.savedTags !== undefined) {
      payload.savedTags = updates.savedTags
        .slice(0, 40)
        .map((t) => clampString(t, 28))
        .filter(Boolean);
    }

    await updateDoc(doc(db, 'users', uid), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export function subscribeUserAccounts(
  uid: string,
  onData: (accounts: LinkedAccountConfig[]) => void
): Unsubscribe {
  const path = `users/${uid}/accounts`;
  return onSnapshot(
    collection(db, 'users', uid, 'accounts'),
    (snap) => {
      const items: LinkedAccountConfig[] = snap.docs.map((docSnap) => {
        const d = docSnap.data();
        return {
          id: String(d.id ?? docSnap.id),
          name: String(d.name ?? ''),
          type: String(d.type ?? ''),
          currency: d.currency === 'USD' ? 'USD' : 'RWF',
          status: String(d.status ?? 'Active'),
          providerLabel: String(d.providerLabel ?? ''),
          openingBalance: typeof d.openingBalance === 'number' ? d.openingBalance : 0,
          enabled: Boolean(d.enabled),
        };
      });
      onData(items);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, path)
  );
}

export function subscribeUserTransactions(
  uid: string,
  onData: (txs: RecordedTransaction[]) => void
): Unsubscribe {
  const path = `users/${uid}/transactions`;
  const q = query(collection(db, 'users', uid, 'transactions'), orderBy('date', 'desc'));
  return onSnapshot(
    q,
    (snap) => {
      const items: RecordedTransaction[] = snap.docs.map((docSnap) => {
        const d = docSnap.data();
        const isRecurring = Boolean(d.isRecurring);
        const freq = d.recurringFrequency as string | undefined;
        const validFreq: RecurrenceFrequency | undefined =
          isRecurring && (freq === 'daily' || freq === 'weekly' || freq === 'monthly')
            ? freq
            : undefined;
        return {
          id: String(d.id ?? docSnap.id),
          referenceNo: String(d.referenceNo ?? ''),
          idempotencyKey: String(d.idempotencyKey ?? docSnap.id),
          type: d.type === 'income' ? 'income' : 'expense',
          accountId: String(d.accountId ?? ''),
          accountName: String(d.accountName ?? ''),
          currency: d.currency === 'USD' ? 'USD' : 'RWF',
          category: String(d.category ?? ''),
          tags: Array.isArray(d.tags) && d.tags.length > 0 ? (d.tags as string[]) : undefined,
          amount: typeof d.amount === 'number' ? d.amount : 0,
          date: String(d.date ?? ''),
          createdAt: timestampToIso(d.createdAt),
          description: String(d.description ?? ''),
          isRecurring: isRecurring || undefined,
          recurringFrequency: validFreq,
          nextOccurrenceDate:
            isRecurring && typeof d.nextOccurrenceDate === 'string' && d.nextOccurrenceDate
              ? d.nextOccurrenceDate
              : undefined,
          goalId: typeof d.goalId === 'string' && d.goalId ? d.goalId : undefined,
          goalName: typeof d.goalName === 'string' && d.goalName ? d.goalName : undefined,
          originalCurrency:
            typeof d.originalCurrency === 'string' && d.originalCurrency
              ? d.originalCurrency
              : undefined,
          originalAmount:
            typeof d.originalAmount === 'number' && d.originalAmount > 0
              ? d.originalAmount
              : undefined,
          exchangeRate:
            typeof d.exchangeRate === 'number' && d.exchangeRate > 0
              ? d.exchangeRate
              : undefined,
          rateTimestamp:
            typeof d.rateTimestamp === 'string' && d.rateTimestamp
              ? d.rateTimestamp
              : undefined,
        };
      });
      onData(items);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, path)
  );
}

export async function createTransactionDoc(
  uid: string,
  txn: RecordedTransaction
): Promise<void> {
  const docId = toSafeDocId(txn.id || txn.idempotencyKey);
  const path = `users/${uid}/transactions/${docId}`;
  try {
    const cleanTags = (txn.tags ?? [])
      .slice(0, 8)
      .map((t) => clampString(t, 28))
      .filter(Boolean);
    const isRecurring = Boolean(txn.isRecurring && txn.recurringFrequency);

    const payload: Record<string, unknown> = {
      id: docId,
      uid,
      referenceNo: clampString(txn.referenceNo, 64, `TXN-${docId}`),
      idempotencyKey: clampString(txn.idempotencyKey, 128, docId),
      type: txn.type === 'income' ? 'income' : 'expense',
      accountId: clampString(txn.accountId, 80, 'cash'),
      accountName: clampString(txn.accountName, 80, 'Primary Cash Wallet'),
      currency: txn.currency === 'USD' ? 'USD' : 'RWF',
      category: clampString(txn.category, 60, 'General'),
      tags: cleanTags,
      amount: clampAmount(txn.amount, 0.01),
      date: /^\d{4}-\d{2}-\d{2}$/.test(txn.date)
        ? txn.date
        : new Date().toISOString().slice(0, 10),
      description: clampString(txn.description, 160, clampString(txn.category, 60, 'Transaction')),
      isRecurring,
      recurringFrequency: isRecurring && txn.recurringFrequency ? txn.recurringFrequency : 'none',
      nextOccurrenceDate:
        isRecurring && txn.nextOccurrenceDate ? clampString(txn.nextOccurrenceDate, 10) : '',
      goalId: clampString(txn.goalId ?? '', 128),
      goalName: clampString(txn.goalName ?? '', 100),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    if (
      txn.originalCurrency &&
      txn.originalCurrency.trim().length >= 3 &&
      typeof txn.originalAmount === 'number' &&
      Number.isFinite(txn.originalAmount) &&
      txn.originalAmount > 0 &&
      typeof txn.exchangeRate === 'number' &&
      Number.isFinite(txn.exchangeRate) &&
      txn.exchangeRate > 0
    ) {
      payload.originalCurrency = clampString(txn.originalCurrency.toUpperCase(), 6);
      payload.originalAmount = clampAmount(txn.originalAmount, 0.01);
      payload.exchangeRate = Math.min(100_000_000, Math.max(0.000001, txn.exchangeRate));
      if (txn.rateTimestamp) {
        payload.rateTimestamp = clampString(txn.rateTimestamp, 40);
      }
    }

    await setDoc(doc(db, 'users', uid, 'transactions', docId), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function advanceRecurringTransactionDoc(
  uid: string,
  txId: string,
  nextOccurrenceDate: string
): Promise<void> {
  const docId = toSafeDocId(txId);
  const path = `users/${uid}/transactions/${docId}`;
  try {
    await updateDoc(doc(db, 'users', uid, 'transactions', docId), {
      nextOccurrenceDate: clampString(nextOccurrenceDate, 10),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export function subscribeUserBudgets(
  uid: string,
  onData: (budgets: BudgetAllocation[]) => void
): Unsubscribe {
  const path = `users/${uid}/budgets`;
  return onSnapshot(
    collection(db, 'users', uid, 'budgets'),
    (snap) => {
      const items: BudgetAllocation[] = snap.docs.map((docSnap) => {
        const d = docSnap.data();
        return {
          category: String(d.category ?? ''),
          monthlyLimit: typeof d.monthlyLimit === 'number' ? d.monthlyLimit : 0,
          enabled: Boolean(d.enabled),
        };
      });
      onData(items);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, path)
  );
}

export function subscribeUserSavingsGoals(
  uid: string,
  onData: (goals: SavingsGoal[]) => void
): Unsubscribe {
  const path = `users/${uid}/savingsGoals`;
  return onSnapshot(
    collection(db, 'users', uid, 'savingsGoals'),
    (snap) => {
      const items: SavingsGoal[] = snap.docs.map((docSnap) => {
        const d = docSnap.data();
        return {
          id: String(d.id ?? docSnap.id),
          name: String(d.name ?? ''),
          targetAmount: typeof d.targetAmount === 'number' ? d.targetAmount : 0,
          currentAmount: typeof d.currentAmount === 'number' ? d.currentAmount : 0,
          currency: d.currency === 'USD' ? 'USD' : 'RWF',
          targetDate: typeof d.targetDate === 'string' && d.targetDate ? d.targetDate : undefined,
          linkedAccountId:
            typeof d.linkedAccountId === 'string' && d.linkedAccountId
              ? d.linkedAccountId
              : undefined,
          linkedAccountName:
            typeof d.linkedAccountName === 'string' && d.linkedAccountName
              ? d.linkedAccountName
              : undefined,
          linkedCategory:
            typeof d.linkedCategory === 'string' && d.linkedCategory
              ? d.linkedCategory
              : undefined,
          createdAt: timestampToIso(d.createdAt) ?? new Date().toISOString(),
        };
      });
      onData(items);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, path)
  );
}

export async function createSavingsGoalDoc(uid: string, goal: SavingsGoal): Promise<void> {
  const docId = toSafeDocId(goal.id);
  const path = `users/${uid}/savingsGoals/${docId}`;
  try {
    await setDoc(doc(db, 'users', uid, 'savingsGoals', docId), {
      id: docId,
      uid,
      name: clampString(goal.name, 100, 'Savings Goal'),
      targetAmount: clampAmount(goal.targetAmount, 0.01),
      currentAmount: clampAmount(goal.currentAmount, 0),
      currency: goal.currency === 'USD' ? 'USD' : 'RWF',
      targetDate: clampString(goal.targetDate ?? '', 10),
      linkedAccountId: clampString(goal.linkedAccountId ?? '', 80),
      linkedAccountName: clampString(goal.linkedAccountName ?? '', 80),
      linkedCategory: clampString(goal.linkedCategory ?? '', 60),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateSavingsGoalAmountDoc(
  uid: string,
  goalId: string,
  newAmount: number
): Promise<void> {
  const docId = toSafeDocId(goalId);
  const path = `users/${uid}/savingsGoals/${docId}`;
  try {
    await updateDoc(doc(db, 'users', uid, 'savingsGoals', docId), {
      currentAmount: clampAmount(newAmount, 0),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteSavingsGoalDoc(uid: string, goalId: string): Promise<void> {
  const docId = toSafeDocId(goalId);
  const path = `users/${uid}/savingsGoals/${docId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'savingsGoals', docId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export function subscribeUserDebts(
  uid: string,
  onData: (debts: DebtAccount[]) => void
): Unsubscribe {
  const path = `users/${uid}/debts`;
  return onSnapshot(
    collection(db, 'users', uid, 'debts'),
    (snap) => {
      const items: DebtAccount[] = snap.docs.map((docSnap) => {
        const d = docSnap.data();
        const rawType = String(d.debtType ?? 'loan');
        const validType: DebtType =
          rawType === 'credit_card' || rawType === 'mortgage' || rawType === 'other'
            ? rawType
            : 'loan';
        return {
          id: String(d.id ?? docSnap.id),
          name: String(d.name ?? ''),
          debtType: validType,
          lender: typeof d.lender === 'string' && d.lender ? d.lender : undefined,
          originalAmount: typeof d.originalAmount === 'number' ? d.originalAmount : 0,
          remainingBalance: typeof d.remainingBalance === 'number' ? d.remainingBalance : 0,
          aprPct: typeof d.aprPct === 'number' ? d.aprPct : 0,
          minimumMonthlyPayment:
            typeof d.minimumMonthlyPayment === 'number' ? d.minimumMonthlyPayment : 0,
          currency: d.currency === 'USD' ? 'USD' : 'RWF',
          createdAt: timestampToIso(d.createdAt) ?? new Date().toISOString(),
        };
      });
      onData(items);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, path)
  );
}

export async function createDebtDoc(uid: string, debt: DebtAccount): Promise<void> {
  const docId = toSafeDocId(debt.id);
  const path = `users/${uid}/debts/${docId}`;
  try {
    await setDoc(doc(db, 'users', uid, 'debts', docId), {
      id: docId,
      uid,
      name: clampString(debt.name, 100, 'Loan / Credit Card'),
      debtType: debt.debtType,
      lender: clampString(debt.lender ?? '', 80),
      originalAmount: clampAmount(debt.originalAmount, 0.01),
      remainingBalance: clampAmount(debt.remainingBalance, 0),
      aprPct: Math.min(100, Math.max(0, Math.round(debt.aprPct * 100) / 100)),
      minimumMonthlyPayment: clampAmount(debt.minimumMonthlyPayment, 0),
      currency: debt.currency === 'USD' ? 'USD' : 'RWF',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateDebtBalanceDoc(
  uid: string,
  debtId: string,
  remainingBalance: number
): Promise<void> {
  const docId = toSafeDocId(debtId);
  const path = `users/${uid}/debts/${docId}`;
  try {
    await updateDoc(doc(db, 'users', uid, 'debts', docId), {
      remainingBalance: clampAmount(remainingBalance, 0),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteDebtDoc(uid: string, debtId: string): Promise<void> {
  const docId = toSafeDocId(debtId);
  const path = `users/${uid}/debts/${docId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'debts', docId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export function subscribeUserBills(
  uid: string,
  onData: (bills: ScheduledBill[]) => void
): Unsubscribe {
  const path = `users/${uid}/bills`;
  return onSnapshot(
    collection(db, 'users', uid, 'bills'),
    (snap) => {
      const items: ScheduledBill[] = snap.docs.map((docSnap) => {
        const d = docSnap.data();
        return {
          id: String(d.id ?? docSnap.id),
          title: String(d.title ?? ''),
          amount: typeof d.amount === 'number' ? d.amount : 0,
          currency: d.currency === 'USD' ? 'USD' : 'RWF',
          dueDate: String(d.dueDate ?? ''),
          paid: Boolean(d.paid),
        };
      });
      onData(items);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, path)
  );
}

export async function createBillDoc(uid: string, bill: ScheduledBill): Promise<void> {
  const docId = toSafeDocId(bill.id);
  const path = `users/${uid}/bills/${docId}`;
  try {
    await setDoc(doc(db, 'users', uid, 'bills', docId), {
      id: docId,
      uid,
      title: clampString(bill.title, 100, 'Scheduled Bill'),
      amount: clampAmount(bill.amount, 0.01),
      currency: bill.currency === 'USD' ? 'USD' : 'RWF',
      dueDate: /^\d{4}-\d{2}-\d{2}$/.test(bill.dueDate)
        ? bill.dueDate
        : new Date().toISOString().slice(0, 10),
      paid: Boolean(bill.paid),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateBillPaidDoc(
  uid: string,
  billId: string,
  paid: boolean
): Promise<void> {
  const docId = toSafeDocId(billId);
  const path = `users/${uid}/bills/${docId}`;
  try {
    await updateDoc(doc(db, 'users', uid, 'bills', docId), {
      paid: Boolean(paid),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteBillDoc(uid: string, billId: string): Promise<void> {
  const docId = toSafeDocId(billId);
  const path = `users/${uid}/bills/${docId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'bills', docId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export function subscribeUserAccountUpdates(
  uid: string,
  onData: (events: AccountUpdateEvent[]) => void
): Unsubscribe {
  const path = `users/${uid}/accountUpdates`;
  const q = query(collection(db, 'users', uid, 'accountUpdates'), orderBy('timestamp', 'desc'));
  return onSnapshot(
    q,
    (snap) => {
      const items: AccountUpdateEvent[] = snap.docs.map((docSnap) => {
        const d = docSnap.data();
        const kind =
          d.kind === 'balance_initialized' || d.kind === 'budget_configured'
            ? d.kind
            : 'account_linked';
        return {
          id: String(d.id ?? docSnap.id),
          timestamp: String(d.timestamp ?? ''),
          kind,
          title: String(d.title ?? ''),
          detail: String(d.detail ?? ''),
          accountName: typeof d.accountName === 'string' && d.accountName ? d.accountName : undefined,
          amount: typeof d.amount === 'number' && d.amount > 0 ? d.amount : undefined,
          currency: typeof d.currency === 'string' && d.currency ? d.currency : undefined,
        };
      });
      onData(items);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, path)
  );
}

export async function saveOnboardingWorkspace(params: {
  uid: string;
  primaryCurrency: 'RWF' | 'USD';
  monthlyIncomeTarget: number;
  accounts: LinkedAccountConfig[];
  existingAccountIds: string[];
  budgets: BudgetAllocation[];
  existingBudgets: BudgetAllocation[];
  events: AccountUpdateEvent[];
}): Promise<void> {
  const { uid } = params;
  const path = `users/${uid}`;
  try {
    const batch = writeBatch(db);
    const existingAccSet = new Set(params.existingAccountIds.map((id) => toSafeDocId(id)));
    const existingBudgetSet = new Set(
      params.existingBudgets.map((b) => toSafeDocId(`budget-${b.category}`))
    );

    batch.update(doc(db, 'users', uid), {
      primaryCurrency: params.primaryCurrency === 'USD' ? 'USD' : 'RWF',
      monthlyIncomeTarget: clampAmount(params.monthlyIncomeTarget, 0),
      onboardingCompleted: true,
      updatedAt: serverTimestamp(),
    });

    params.accounts.forEach((acc) => {
      const accId = toSafeDocId(acc.id);
      const ref = doc(db, 'users', uid, 'accounts', accId);
      const mutableFields = {
        name: clampString(acc.name, 80, 'Account'),
        type: clampString(acc.type, 60, 'Cash Account'),
        currency: acc.currency === 'USD' ? 'USD' : 'RWF',
        status: clampString(acc.status || 'Active', 40, 'Active'),
        providerLabel: clampString(acc.providerLabel ?? '', 80),
        openingBalance: clampAmount(acc.openingBalance, 0),
        enabled: Boolean(acc.enabled),
        updatedAt: serverTimestamp(),
      };
      if (existingAccSet.has(accId)) {
        batch.update(ref, mutableFields);
      } else {
        batch.set(ref, {
          id: accId,
          uid,
          ...mutableFields,
          createdAt: serverTimestamp(),
        });
      }
    });

    const newBudgetIds = new Set(params.budgets.map((b) => toSafeDocId(`budget-${b.category}`)));
    params.existingBudgets.forEach((oldB) => {
      const oldId = toSafeDocId(`budget-${oldB.category}`);
      if (!newBudgetIds.has(oldId)) {
        batch.delete(doc(db, 'users', uid, 'budgets', oldId));
      }
    });

    params.budgets.forEach((b) => {
      const budgetId = toSafeDocId(`budget-${b.category}`);
      const ref = doc(db, 'users', uid, 'budgets', budgetId);
      const mutableFields = {
        category: clampString(b.category, 60, 'Budget'),
        monthlyLimit: clampAmount(b.monthlyLimit, 0),
        enabled: Boolean(b.enabled),
        updatedAt: serverTimestamp(),
      };
      if (existingBudgetSet.has(budgetId)) {
        batch.update(ref, mutableFields);
      } else {
        batch.set(ref, {
          id: budgetId,
          uid,
          ...mutableFields,
          createdAt: serverTimestamp(),
        });
      }
    });

    params.events.forEach((ev) => {
      const evId = toSafeDocId(ev.id);
      batch.set(doc(db, 'users', uid, 'accountUpdates', evId), {
        id: evId,
        uid,
        timestamp: clampString(ev.timestamp, 40, new Date().toISOString()),
        kind: ev.kind,
        title: clampString(ev.title, 100, 'Workspace Update'),
        detail: clampString(ev.detail, 160),
        accountName: clampString(ev.accountName ?? '', 80),
        amount: clampAmount(ev.amount ?? 0, 0),
        currency: clampString(ev.currency ?? params.primaryCurrency, 10),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export type BudgetAlertStatus = 'warning_90' | 'exceeded_100' | 'acknowledged';

export interface BudgetAlertDoc {
  id: string;
  category: string;
  monthKey: string;
  spentAmount: number;
  budgetLimit: number;
  utilizationPct: number;
  thresholdPct: number;
  currency: 'RWF' | 'USD';
  status: BudgetAlertStatus;
  pushDispatched: boolean;
  createdAt?: string;
}

export interface CategorySpendingMonitorResult {
  monthKey: string;
  thresholdPct: number;
  checkedCategories: number;
  breachedCategories: BudgetAlertDoc[];
  triggeredNotifications: BudgetAlertDoc[];
}

export function getBudgetPushPermissionState(): NotificationPermission | 'unsupported' {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}

export async function requestBudgetPushPermission(): Promise<
  NotificationPermission | 'unsupported'
> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  if (Notification.permission !== 'default') {
    return Notification.permission;
  }
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

function formatAlertMoney(amount: number, currency: 'RWF' | 'USD'): string {
  if (currency === 'USD') {
    return `${new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount)} USD`;
  }
  return `${new Intl.NumberFormat('en-US').format(Math.round(amount))} RWF`;
}

export async function dispatchBudgetPushNotification(
  alert: BudgetAlertDoc,
  locale: 'en' | 'rw' = 'en'
): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }
  if (Notification.permission !== 'granted') {
    return false;
  }

  const isExceeded = alert.utilizationPct >= 100 || alert.status === 'exceeded_100';
  const spentFmt = formatAlertMoney(alert.spentAmount, alert.currency);
  const limitFmt = formatAlertMoney(alert.budgetLimit, alert.currency);

  const title =
    locale === 'rw'
      ? isExceeded
        ? `Ingengo y’Imari Yarenze (100%+): ${alert.category}`
        : `Imburira y’Ingengo (${alert.thresholdPct}%+): ${alert.category}`
      : isExceeded
        ? `Budget Exceeded (100%+): ${alert.category}`
        : `Budget Alert (>${alert.thresholdPct}%): ${alert.category}`;

  const body =
    locale === 'rw'
      ? `Umaze gukoresha ${alert.utilizationPct}% by’ingengo ya ${alert.category} muri ${alert.monthKey} (${spentFmt} / ${limitFmt}).`
      : `You have spent ${alert.utilizationPct}% of your ${alert.category} budget for ${alert.monthKey} (${spentFmt} / ${limitFmt}).`;

  try {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration && typeof registration.showNotification === 'function') {
        await registration.showNotification(title, {
          body,
          icon: '/assets/icons/icon-192.png',
          badge: '/assets/icons/icon-192.png',
          tag: alert.id,
          data: {
            url: '/?section=budgets',
            category: alert.category,
            monthKey: alert.monthKey,
          },
        });
        return true;
      }
    }

    new Notification(title, {
      body,
      icon: '/assets/icons/icon-192.png',
      tag: alert.id,
    });
    return true;
  } catch {
    return false;
  }
}

export function subscribeUserBudgetAlerts(
  uid: string,
  onData: (alerts: BudgetAlertDoc[]) => void
): Unsubscribe {
  const path = `users/${uid}/budgetAlerts`;
  const q = query(collection(db, 'users', uid, 'budgetAlerts'), orderBy('updatedAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => {
      const items: BudgetAlertDoc[] = snap.docs.map((docSnap) => {
        const d = docSnap.data();
        const status: BudgetAlertStatus =
          d.status === 'exceeded_100' || d.status === 'acknowledged'
            ? d.status
            : 'warning_90';
        return {
          id: String(d.id ?? docSnap.id),
          category: String(d.category ?? ''),
          monthKey: String(d.monthKey ?? ''),
          spentAmount: typeof d.spentAmount === 'number' ? d.spentAmount : 0,
          budgetLimit: typeof d.budgetLimit === 'number' ? d.budgetLimit : 0,
          utilizationPct: typeof d.utilizationPct === 'number' ? d.utilizationPct : 0,
          thresholdPct: typeof d.thresholdPct === 'number' ? d.thresholdPct : 90,
          currency: d.currency === 'USD' ? 'USD' : 'RWF',
          status,
          pushDispatched: Boolean(d.pushDispatched),
          createdAt: timestampToIso(d.createdAt),
        };
      });
      onData(items);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, path)
  );
}

export async function acknowledgeBudgetAlertDoc(
  uid: string,
  alertId: string
): Promise<void> {
  const docId = toSafeDocId(alertId);
  const path = `users/${uid}/budgetAlerts/${docId}`;
  try {
    await updateDoc(doc(db, 'users', uid, 'budgetAlerts', docId), {
      status: 'acknowledged',
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

/**
 * Firestore service layer function that monitors monthly spending per category
 * against allocated budgets in `users/{uid}/budgets` and `users/{uid}/transactions`.
 * When monthly spending for a category exceeds `thresholdPct` (default: 90%),
 * it persists a deduplicated alert record in `users/{uid}/budgetAlerts` and
 * triggers a browser / PWA Service Worker push notification.
 */
export async function monitorMonthlyCategorySpendingAndNotify(params: {
  uid: string;
  monthKey?: string;
  thresholdPct?: number;
  primaryCurrency?: 'RWF' | 'USD';
  locale?: 'en' | 'rw';
  dispatchPush?: boolean;
}): Promise<CategorySpendingMonitorResult> {
  const {
    uid,
    monthKey = new Date().toISOString().slice(0, 7),
    thresholdPct = 90,
    primaryCurrency = 'RWF',
    locale = 'en',
    dispatchPush = true,
  } = params;

  const safeMonthKey = /^\d{4}-\d{2}$/.test(monthKey)
    ? monthKey
    : new Date().toISOString().slice(0, 7);
  const safeThreshold = Math.min(100, Math.max(10, Math.round(thresholdPct)));
  const monthStart = `${safeMonthKey}-01`;
  const monthEnd = `${safeMonthKey}-31`;

  const budgetsPath = `users/${uid}/budgets`;
  const txnsPath = `users/${uid}/transactions`;

  let budgetDocs: { category: string; monthlyLimit: number; enabled: boolean }[] = [];
  try {
    const budgetSnap = await getDocs(collection(db, 'users', uid, 'budgets'));
    budgetDocs = budgetSnap.docs
      .map((snap) => {
        const d = snap.data();
        return {
          category: String(d.category ?? ''),
          monthlyLimit: typeof d.monthlyLimit === 'number' ? d.monthlyLimit : 0,
          enabled: Boolean(d.enabled),
        };
      })
      .filter((b) => b.category.length > 0 && b.monthlyLimit > 0 && b.enabled);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, budgetsPath);
  }

  if (budgetDocs.length === 0) {
    return {
      monthKey: safeMonthKey,
      thresholdPct: safeThreshold,
      checkedCategories: 0,
      breachedCategories: [],
      triggeredNotifications: [],
    };
  }

  const spentByCategory: Record<string, number> = {};
  try {
    const monthQuery = query(
      collection(db, 'users', uid, 'transactions'),
      where('date', '>=', monthStart),
      where('date', '<=', monthEnd)
    );
    const txnSnap = await getDocs(monthQuery);
    txnSnap.docs.forEach((snap) => {
      const d = snap.data();
      if (d.type === 'expense' && typeof d.amount === 'number' && typeof d.category === 'string') {
        spentByCategory[d.category] = (spentByCategory[d.category] ?? 0) + d.amount;
      }
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, txnsPath);
  }

  const breachedCategories: BudgetAlertDoc[] = [];
  const triggeredNotifications: BudgetAlertDoc[] = [];
  const safeCurrency: 'RWF' | 'USD' = primaryCurrency === 'USD' ? 'USD' : 'RWF';

  for (const budget of budgetDocs) {
    const spent = clampAmount(spentByCategory[budget.category] ?? 0, 0);
    const limit = clampAmount(budget.monthlyLimit, 0.01);
    const thresholdAmount = limit * (safeThreshold / 100);

    // Trigger strictly when monthly category spending exceeds the threshold (default >90%)
    if (spent <= thresholdAmount) {
      continue;
    }

    const utilizationPct = Math.min(
      100000,
      Math.max(0, Math.round((spent / limit) * 1000) / 10)
    );
    const nextSeverityStatus: BudgetAlertStatus =
      spent > limit || utilizationPct >= 100 ? 'exceeded_100' : 'warning_90';
    const alertId = toSafeDocId(
      `budget-alert-${safeMonthKey}-${budget.category}-${safeThreshold}`
    );
    const alertPath = `users/${uid}/budgetAlerts/${alertId}`;
    const alertRef = doc(db, 'users', uid, 'budgetAlerts', alertId);

    try {
      const existingSnap = await getDoc(alertRef);
      const alertDoc: BudgetAlertDoc = {
        id: alertId,
        category: clampString(budget.category, 60, 'Budget'),
        monthKey: safeMonthKey,
        spentAmount: spent,
        budgetLimit: limit,
        utilizationPct,
        thresholdPct: safeThreshold,
        currency: safeCurrency,
        status: nextSeverityStatus,
        pushDispatched: false,
      };

      if (!existingSnap.exists()) {
        const dispatched = dispatchPush
          ? await dispatchBudgetPushNotification(alertDoc, locale)
          : false;
        alertDoc.pushDispatched = dispatched;

        await setDoc(alertRef, {
          id: alertDoc.id,
          uid,
          category: alertDoc.category,
          monthKey: alertDoc.monthKey,
          spentAmount: alertDoc.spentAmount,
          budgetLimit: alertDoc.budgetLimit,
          utilizationPct: alertDoc.utilizationPct,
          thresholdPct: alertDoc.thresholdPct,
          currency: alertDoc.currency,
          status: alertDoc.status,
          pushDispatched: dispatched,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        breachedCategories.push(alertDoc);
        if (dispatched) {
          triggeredNotifications.push(alertDoc);
        }
      } else {
        const existingData = existingSnap.data();
        const existingStatus = existingData.status as BudgetAlertStatus | undefined;
        const alreadyDispatched = Boolean(existingData.pushDispatched);
        const escalatedToExceeded =
          existingStatus === 'warning_90' && nextSeverityStatus === 'exceeded_100';
        const finalStatus: BudgetAlertStatus =
          existingStatus === 'acknowledged' ? 'acknowledged' : nextSeverityStatus;

        let dispatchedNow = false;
        if (
          dispatchPush &&
          existingStatus !== 'acknowledged' &&
          (!alreadyDispatched || escalatedToExceeded)
        ) {
          dispatchedNow = await dispatchBudgetPushNotification(
            { ...alertDoc, status: finalStatus },
            locale
          );
        }

        const finalDispatched = alreadyDispatched || dispatchedNow;
        alertDoc.status = finalStatus;
        alertDoc.pushDispatched = finalDispatched;

        if (
          existingData.spentAmount !== spent ||
          existingData.budgetLimit !== limit ||
          existingData.utilizationPct !== utilizationPct ||
          existingStatus !== finalStatus ||
          alreadyDispatched !== finalDispatched
        ) {
          await updateDoc(alertRef, {
            spentAmount: spent,
            budgetLimit: limit,
            utilizationPct,
            status: finalStatus,
            pushDispatched: finalDispatched,
            updatedAt: serverTimestamp(),
          });
        }

        breachedCategories.push(alertDoc);
        if (dispatchedNow) {
          triggeredNotifications.push(alertDoc);
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, alertPath);
    }
  }

  return {
    monthKey: safeMonthKey,
    thresholdPct: safeThreshold,
    checkedCategories: budgetDocs.length,
    breachedCategories,
    triggeredNotifications,
  };
}

function safeParseJsonArray<T>(raw: unknown): T[] {
  if (typeof raw !== 'string' || !raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

export function subscribeUserBudgetForecast(
  uid: string,
  onData: (forecast: SavedBudgetForecast | null) => void
): Unsubscribe {
  const path = `users/${uid}/budgetForecasts/latest`;
  return onSnapshot(
    doc(db, 'users', uid, 'budgetForecasts', 'latest'),
    (snap) => {
      if (!snap.exists()) {
        onData(null);
        return;
      }
      const d = snap.data();
      const riskRaw = String(d.riskLevel ?? 'moderate');
      const riskLevel =
        riskRaw === 'low' || riskRaw === 'elevated' ? riskRaw : 'moderate';
      onData({
        id: String(d.id ?? 'latest'),
        currency: d.currency === 'USD' ? 'USD' : 'RWF',
        horizonMonths: d.horizonMonths === 3 ? 3 : 6,
        modelName: String(d.modelName ?? 'gemini-4-hydrogen'),
        totalRecommendedMonthlyBudget:
          typeof d.totalRecommendedMonthlyBudget === 'number'
            ? d.totalRecommendedMonthlyBudget
            : 0,
        confidenceScore:
          typeof d.confidenceScore === 'number' ? d.confidenceScore : 75,
        riskLevel,
        aiSummary: String(d.aiSummary ?? ''),
        forecastMonths: safeParseJsonArray<ForecastMonthProjection>(
          d.forecastMonthsJson
        ),
        categoryRecommendations: safeParseJsonArray<CategoryBudgetRecommendation>(
          d.categoryRecommendationsJson
        ),
        updatedAt: timestampToIso(d.updatedAt) ?? new Date().toISOString(),
      });
    },
    (error) => handleFirestoreError(error, OperationType.GET, path)
  );
}

export async function saveBudgetForecastDoc(
  uid: string,
  forecast: SavedBudgetForecast
): Promise<void> {
  const docId = 'latest';
  const path = `users/${uid}/budgetForecasts/${docId}`;
  const ref = doc(db, 'users', uid, 'budgetForecasts', docId);

  const forecastMonthsJson = clampString(
    JSON.stringify(forecast.forecastMonths.slice(0, 6)),
    8000,
    '[]'
  );
  const categoryRecommendationsJson = clampString(
    JSON.stringify(forecast.categoryRecommendations.slice(0, 20)),
    12000,
    '[]'
  );
  const riskLevel =
    forecast.riskLevel === 'low' || forecast.riskLevel === 'elevated'
      ? forecast.riskLevel
      : 'moderate';
  const sharedFields = {
    currency: forecast.currency === 'USD' ? 'USD' : 'RWF',
    horizonMonths: forecast.horizonMonths === 3 ? 3 : 6,
    modelName: clampString(forecast.modelName, 60, 'gemini-4-hydrogen'),
    totalRecommendedMonthlyBudget: clampAmount(
      forecast.totalRecommendedMonthlyBudget,
      0
    ),
    confidenceScore: Math.min(
      100,
      Math.max(0, Math.round(forecast.confidenceScore))
    ),
    riskLevel,
    aiSummary: clampString(forecast.aiSummary, 600, ''),
    forecastMonthsJson,
    categoryRecommendationsJson,
  };

  try {
    const existing = await getDoc(ref);
    if (existing.exists()) {
      await updateDoc(ref, {
        ...sharedFields,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(ref, {
        id: docId,
        uid,
        ...sharedFields,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function upsertBudgetAllocationDoc(
  uid: string,
  allocation: BudgetAllocation
): Promise<void> {
  const docId = toSafeDocId(`budget-${allocation.category}`);
  const path = `users/${uid}/budgets/${docId}`;
  const ref = doc(db, 'users', uid, 'budgets', docId);

  try {
    const existing = await getDoc(ref);
    if (existing.exists()) {
      await updateDoc(ref, {
        category: clampString(allocation.category, 60, 'Budget'),
        monthlyLimit: clampAmount(allocation.monthlyLimit, 0),
        enabled: Boolean(allocation.enabled),
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(ref, {
        id: docId,
        uid,
        category: clampString(allocation.category, 60, 'Budget'),
        monthlyLimit: clampAmount(allocation.monthlyLimit, 0),
        enabled: Boolean(allocation.enabled),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

