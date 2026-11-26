import { useEffect, useMemo, useState } from 'react';
import type {
  Account,
  AlertItem,
  AppSettings,
  AppState,
  BudgetConfig,
  CalendarNote,
  Transaction,
} from '../types';
import { currentMonthISO, formatVND, getRemainingDaysInMonth, todayISO, uid } from '../lib/format';
import {
  cancelNoteReminder,
  scheduleNoteReminder,
  sendImmediateAlert,
} from '../lib/notifications';

const STORAGE_KEY = 'wealthflow_app_state_v1';

const DEFAULT_STATE: AppState = {
  accounts: [
    { id: 'acc-cash', name: 'Tiền mặt', type: 'cash', balance: 2_500_000, color: '#10b981' },
    { id: 'acc-bank', name: 'Ngân hàng', type: 'bank', balance: 18_500_000, color: '#3b82f6' },
    { id: 'acc-momo', name: 'MoMo', type: 'ewallet', balance: 1_800_000, color: '#ec4899' },
    { id: 'acc-save', name: 'Tiết kiệm', type: 'savings', balance: 45_000_000, color: '#f59e0b' },
    { id: 'acc-inv', name: 'Vàng / Đầu tư', type: 'investment', balance: 25_000_000, color: '#8b5cf6' },
    { id: 'acc-debt', name: 'Thẻ tín dụng', type: 'debt', balance: 3_200_000, color: '#ef4444' },
  ],
  transactions: [
    {
      id: 'tx-1',
      type: 'expense',
      amount: 45_000,
      category: 'Ăn uống',
      note: 'Cà phê sáng',
      accountId: 'acc-momo',
      date: todayISO(),
      createdAt: Date.now() - 7200_000,
    },
    {
      id: 'tx-2',
      type: 'expense',
      amount: 65_000,
      category: 'Ăn uống',
      note: 'Cơm trưa văn phòng',
      accountId: 'acc-cash',
      date: todayISO(),
      createdAt: Date.now() - 3600_000,
    },
  ],
  budget: {
    monthlyLimit: 10_000_000,
    alertThresholdPercent: 80,
    categoryLimits: {
      'Ăn uống': 3_500_000,
      'Di chuyển': 1_200_000,
      'Mua sắm': 2_000_000,
    },
  },
  notes: [
    {
      id: 'note-1',
      title: 'Thanh toán thẻ tín dụng',
      content: 'Kiểm tra sao kê trước khi quá hạn',
      date: todayISO(),
      time: '20:00',
      remind: true,
      done: false,
      tag: 'bill',
      createdAt: Date.now(),
    },
  ],
  settings: {
    geminiApiKey: '',
    privacyMode: false,
    notificationsEnabled: true,
    voiceReplyEnabled: true,
  },
  chatMessages: [
    {
      id: 'chat-welcome',
      role: 'assistant',
      text: 'Chào bạn! Mình là trợ lý cá nhân của bạn. Mình nắm toàn bộ ví tiền, chi tiêu, lịch hẹn và sẽ tự ghi nhớ thói quen của bạn qua từng lần trò chuyện. Bấm 🎙️ để nói chuyện hoặc nhắn tin nhé!',
      createdAt: Date.now(),
    },
  ],
  memories: [],
};

function loadInitialState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_STATE,
      ...parsed,
      budget: { ...DEFAULT_STATE.budget, ...(parsed.budget || {}) },
      settings: { ...DEFAULT_STATE.settings, ...(parsed.settings || {}) },
    };
  } catch {
    return DEFAULT_STATE;
  }
}

export function useAppStore() {
  const [state, setState] = useState<AppState>(loadInitialState);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore storage quota errors
    }
  }, [state]);

  const netWorth = useMemo(() => {
    return state.accounts.reduce(
      (sum, acc) => (acc.type === 'debt' ? sum - acc.balance : sum + acc.balance),
      0
    );
  }, [state.accounts]);

  const totalAssets = useMemo(() => {
    return state.accounts
      .filter((a) => a.type !== 'debt')
      .reduce((sum, a) => sum + a.balance, 0);
  }, [state.accounts]);

  const totalDebt = useMemo(() => {
    return state.accounts
      .filter((a) => a.type === 'debt')
      .reduce((sum, a) => sum + a.balance, 0);
  }, [state.accounts]);

  const monthSummary = useMemo(() => {
    const month = currentMonthISO();
    const monthTx = state.transactions.filter((t) => t.date.startsWith(month));
    const income = monthTx
      .filter((t) => t.type === 'income')
      .reduce((s, t) => s + t.amount, 0);
    const expense = monthTx
      .filter((t) => t.type === 'expense')
      .reduce((s, t) => s + t.amount, 0);

    const byCategory: Record<string, number> = {};
    for (const t of monthTx) {
      if (t.type === 'expense') {
        byCategory[t.category] = (byCategory[t.category] || 0) + t.amount;
      }
    }

    const remainingBudget = Math.max(0, state.budget.monthlyLimit - expense);
    const remainingDays = getRemainingDaysInMonth();
    const safeDailySpend = Math.floor(remainingBudget / remainingDays);
    const budgetPercent =
      state.budget.monthlyLimit > 0
        ? Math.round((expense / state.budget.monthlyLimit) * 100)
        : 0;

    return {
      month,
      income,
      expense,
      byCategory,
      remainingBudget,
      safeDailySpend,
      budgetPercent,
    };
  }, [state.transactions, state.budget.monthlyLimit]);

  const alerts = useMemo<AlertItem[]>(() => {
    const list: AlertItem[] = [];
    const { budgetPercent, expense, byCategory } = monthSummary;

    if (state.budget.monthlyLimit > 0) {
      if (budgetPercent >= 100) {
        list.push({
          id: 'alert-month-over',
          level: 'danger',
          title: 'Vượt ngân sách tháng!',
          message: `Đã chi ${formatVND(expense)} (${budgetPercent}% hạn mức ${formatVND(
            state.budget.monthlyLimit
          )}).`,
        });
      } else if (budgetPercent >= state.budget.alertThresholdPercent) {
        list.push({
          id: 'alert-month-warn',
          level: 'warning',
          title: `Sắp chạm trần ngân sách (${budgetPercent}%)`,
          message: `Còn ${formatVND(monthSummary.remainingBudget)} cho ${getRemainingDaysInMonth()} ngày cuối tháng.`,
        });
      }
    }

    for (const [cat, limit] of Object.entries(state.budget.categoryLimits)) {
      const spent = byCategory[cat] || 0;
      if (limit > 0 && spent >= limit) {
        list.push({
          id: `alert-cat-${cat}`,
          level: 'danger',
          title: `Vượt hạn mức "${cat}"`,
          message: `Đã tiêu ${formatVND(spent)} / ${formatVND(limit)}.`,
        });
      } else if (limit > 0 && spent >= limit * 0.85) {
        list.push({
          id: `alert-cat-warn-${cat}`,
          level: 'warning',
          title: `Danh mục "${cat}" sắp đầy`,
          message: `Đã dùng ${Math.round((spent / limit) * 100)}% (${formatVND(spent)}).`,
        });
      }
    }

    const today = todayISO();
    const dueToday = state.notes.filter((n) => !n.done && n.date <= today);
    if (dueToday.length > 0) {
      list.push({
        id: 'alert-notes-due',
        level: 'info',
        title: `Có ${dueToday.length} lịch / việc cần xử lý hôm nay`,
        message: dueToday.map((n) => n.title).slice(0, 2).join(' • '),
      });
    }

    return list;
  }, [monthSummary, state.budget, state.notes]);

  function addTransaction(input: Omit<Transaction, 'id' | 'createdAt'>) {
    const tx: Transaction = { ...input, id: uid(), createdAt: Date.now() };
    setState((prev) => {
      const nextAccounts = prev.accounts.map((acc) => {
        if (tx.type === 'expense' && acc.id === tx.accountId) {
          return {
            ...acc,
            balance: acc.type === 'debt' ? acc.balance + tx.amount : acc.balance - tx.amount,
          };
        }
        if (tx.type === 'income' && acc.id === tx.accountId) {
          return {
            ...acc,
            balance: acc.type === 'debt' ? Math.max(0, acc.balance - tx.amount) : acc.balance + tx.amount,
          };
        }
        if (tx.type === 'transfer') {
          if (acc.id === tx.accountId) {
            return { ...acc, balance: acc.balance - tx.amount };
          }
          if (acc.id === tx.toAccountId) {
            return {
              ...acc,
              balance: acc.type === 'debt' ? Math.max(0, acc.balance - tx.amount) : acc.balance + tx.amount,
            };
          }
        }
        return acc;
      });

      const nextExpense =
        tx.type === 'expense' && tx.date.startsWith(currentMonthISO())
          ? monthSummary.expense + tx.amount
          : monthSummary.expense;

      if (
        prev.settings.notificationsEnabled &&
        prev.budget.monthlyLimit > 0 &&
        nextExpense >= prev.budget.monthlyLimit * (prev.budget.alertThresholdPercent / 100)
      ) {
        const pct = Math.round((nextExpense / prev.budget.monthlyLimit) * 100);
        void sendImmediateAlert(
          pct >= 100 ? '🚨 Vượt ngân sách tháng!' : `⚠️ Đã dùng ${pct}% ngân sách`,
          `Tổng chi tháng này: ${formatVND(nextExpense)}`
        );
      }

      return {
        ...prev,
        accounts: nextAccounts,
        transactions: [tx, ...prev.transactions],
      };
    });
  }

  function deleteTransaction(id: string) {
    setState((prev) => {
      const target = prev.transactions.find((t) => t.id === id);
      if (!target) return prev;
      const nextAccounts = prev.accounts.map((acc) => {
        if (target.type === 'expense' && acc.id === target.accountId) {
          return {
            ...acc,
            balance: acc.type === 'debt' ? Math.max(0, acc.balance - target.amount) : acc.balance + target.amount,
          };
        }
        if (target.type === 'income' && acc.id === target.accountId) {
          return {
            ...acc,
            balance: acc.type === 'debt' ? acc.balance + target.amount : acc.balance - target.amount,
          };
        }
        if (target.type === 'transfer') {
          if (acc.id === target.accountId) return { ...acc, balance: acc.balance + target.amount };
          if (acc.id === target.toAccountId) {
            return {
              ...acc,
              balance: acc.type === 'debt' ? acc.balance + target.amount : acc.balance - target.amount,
            };
          }
        }
        return acc;
      });
      return {
        ...prev,
        accounts: nextAccounts,
        transactions: prev.transactions.filter((t) => t.id !== id),
      };
    });
  }

  function addAccount(acc: Omit<Account, 'id'>) {
    setState((prev) => ({
      ...prev,
      accounts: [...prev.accounts, { ...acc, id: uid() }],
    }));
  }

  function updateAccountBalance(id: string, balance: number) {
    setState((prev) => ({
      ...prev,
      accounts: prev.accounts.map((a) => (a.id === id ? { ...a, balance } : a)),
    }));
  }

  function deleteAccount(id: string) {
    setState((prev) => ({
      ...prev,
      accounts: prev.accounts.filter((a) => a.id !== id),
    }));
  }

  function updateBudget(budget: BudgetConfig) {
    setState((prev) => ({ ...prev, budget }));
  }

  function addNote(input: Omit<CalendarNote, 'id' | 'createdAt'>) {
    const note: CalendarNote = { ...input, id: uid(), createdAt: Date.now() };
    setState((prev) => ({ ...prev, notes: [note, ...prev.notes] }));
    if (state.settings.notificationsEnabled) {
      void scheduleNoteReminder(note);
    }
  }

  function toggleNoteDone(id: string) {
    setState((prev) => ({
      ...prev,
      notes: prev.notes.map((n) => {
        if (n.id !== id) return n;
        const done = !n.done;
        if (done) void cancelNoteReminder(id);
        return { ...n, done };
      }),
    }));
  }

  function deleteNote(id: string) {
    void cancelNoteReminder(id);
    setState((prev) => ({
      ...prev,
      notes: prev.notes.filter((n) => n.id !== id),
    }));
  }

  function updateSettings(partial: Partial<AppSettings>) {
    setState((prev) => ({
      ...prev,
      settings: { ...prev.settings, ...partial },
    }));
  }

  function importData(jsonStr: string): boolean {
    try {
      const parsed = JSON.parse(jsonStr);
      if (!parsed.accounts || !parsed.transactions) return false;
      setState({
        ...DEFAULT_STATE,
        ...parsed,
      });
      return true;
    } catch {
      return false;
    }
  }

  function addChatMessage(role: 'user' | 'assistant', text: string) {
    setState((prev) => ({
      ...prev,
      chatMessages: [
        ...prev.chatMessages,
        { id: uid(), role, text, createdAt: Date.now() },
      ].slice(-60),
    }));
  }

  function clearChat() {
    setState((prev) => ({
      ...prev,
      chatMessages: DEFAULT_STATE.chatMessages,
    }));
  }

  function addMemories(facts: string[]) {
    const cleaned = facts.map((f) => f.trim()).filter(Boolean);
    if (!cleaned.length) return;
    setState((prev) => {
      const existingLower = new Set(prev.memories.map((m) => m.fact.toLowerCase()));
      const additions = cleaned
        .filter((f) => !existingLower.has(f.toLowerCase()))
        .map((fact) => ({ id: uid(), fact, createdAt: Date.now() }));
      if (!additions.length) return prev;
      return {
        ...prev,
        memories: [...additions, ...prev.memories].slice(0, 50),
      };
    });
  }

  function deleteMemory(id: string) {
    setState((prev) => ({
      ...prev,
      memories: prev.memories.filter((m) => m.id !== id),
    }));
  }

  return {
    state,
    netWorth,
    totalAssets,
    totalDebt,
    monthSummary,
    alerts,
    addTransaction,
    deleteTransaction,
    addAccount,
    updateAccountBalance,
    deleteAccount,
    updateBudget,
    addNote,
    toggleNoteDone,
    deleteNote,
    updateSettings,
    importData,
    addChatMessage,
    clearChat,
    addMemories,
    deleteMemory,
  };
}
