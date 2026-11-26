import { useState } from 'react';
import { Plus, SlidersHorizontal, Trash2 } from 'lucide-react';
import type { Account, BudgetConfig, Transaction, TransactionType } from '../types';
import { formatVND, todayISO } from '../lib/format';

interface BudgetTabProps {
  budget: BudgetConfig;
  byCategory: Record<string, number>;
  transactions: Transaction[];
  accounts: Account[];
  privacyMode: boolean;
  onUpdateBudget: (b: BudgetConfig) => void;
  onAddTransaction: (tx: Omit<Transaction, 'id' | 'createdAt'>) => void;
  onDeleteTransaction: (id: string) => void;
}

const CATEGORIES = [
  'Ăn uống',
  'Di chuyển',
  'Mua sắm',
  'Hóa đơn',
  'Giải trí',
  'Sức khỏe',
  'Học tập',
  'Khác',
];

export function BudgetTab({
  budget,
  byCategory,
  transactions,
  accounts,
  privacyMode,
  onUpdateBudget,
  onAddTransaction,
  onDeleteTransaction,
}: BudgetTabProps) {
  const [showManual, setShowManual] = useState(false);
  const [txType, setTxType] = useState<TransactionType>('expense');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Ăn uống');
  const [note, setNote] = useState('');
  const [accountId, setAccountId] = useState(accounts[0]?.id || '');
  const [toAccountId, setToAccountId] = useState(accounts[1]?.id || accounts[0]?.id || '');

  const [editingBudget, setEditingBudget] = useState(false);
  const [monthlyInput, setMonthlyInput] = useState(String(budget.monthlyLimit));
  const [thresholdInput, setThresholdInput] = useState(String(budget.alertThresholdPercent));

  function handleSaveBudget(e: React.FormEvent) {
    e.preventDefault();
    onUpdateBudget({
      ...budget,
      monthlyLimit: Number(monthlyInput.replace(/[^\d]/g, '')) || 0,
      alertThresholdPercent: Math.min(100, Math.max(10, Number(thresholdInput) || 80)),
    });
    setEditingBudget(false);
  }

  function handleAddManual(e: React.FormEvent) {
    e.preventDefault();
    const num = Number(amount.replace(/[^\d]/g, ''));
    if (!num || !accountId) return;
    onAddTransaction({
      type: txType,
      amount: num,
      category: txType === 'income' ? 'Thu nhập' : txType === 'transfer' ? 'Chuyển khoản' : category,
      note: note.trim() || category,
      accountId,
      toAccountId: txType === 'transfer' ? toAccountId : undefined,
      date: todayISO(),
    });
    setAmount('');
    setNote('');
    setShowManual(false);
  }

  return (
    <div className="space-y-4">
      {/* Monthly Budget Hero */}
      <div className="rounded-2xl bg-gradient-to-br from-orange-500 to-rose-500 p-5 text-white shadow-lg shadow-rose-500/20 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[11px] font-medium text-orange-100">Hạn mức chi tiêu tháng</div>
            <div className="tabular-nums mt-0.5 text-2xl font-extrabold text-white">
              {formatVND(budget.monthlyLimit, privacyMode)}
            </div>
            <div className="text-[11px] text-orange-50/90">
              Cảnh báo khi đạt {budget.alertThresholdPercent}%
            </div>
          </div>
          <button
            onClick={() => setEditingBudget(!editingBudget)}
            className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-sm active:scale-95 transition"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" /> Chỉnh
          </button>
        </div>

        {editingBudget && (
          <form onSubmit={handleSaveBudget} className="animate-pop space-y-2 border-t border-white/20 pt-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] text-orange-100">Hạn mức tháng (VNĐ)</label>
                <input
                  value={monthlyInput}
                  onChange={(e) => setMonthlyInput(e.target.value)}
                  inputMode="numeric"
                  className="mt-1 w-full rounded-xl bg-white px-3 py-1.5 text-xs text-slate-900 outline-none"
                />
              </div>
              <div>
                <label className="text-[11px] text-orange-100">Cảnh báo (%)</label>
                <input
                  value={thresholdInput}
                  onChange={(e) => setThresholdInput(e.target.value)}
                  inputMode="numeric"
                  className="mt-1 w-full rounded-xl bg-white px-3 py-1.5 text-xs text-slate-900 outline-none"
                />
              </div>
            </div>
            <button
              type="submit"
              className="w-full rounded-xl bg-slate-900 py-2 text-xs font-semibold text-white"
            >
              Lưu hạn mức
            </button>
          </form>
        )}
      </div>

      {/* Category Breakdown */}
      <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-900/5 space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
          Theo danh mục
        </h3>
        <div className="space-y-3">
          {CATEGORIES.map((cat) => {
            const spent = byCategory[cat] || 0;
            const limit = budget.categoryLimits[cat] || 0;
            if (spent === 0 && limit === 0) return null;
            const pct = limit > 0 ? Math.min(100, Math.round((spent / limit) * 100)) : 0;
            const barColor =
              limit > 0 && spent >= limit
                ? 'bg-gradient-to-r from-rose-500 to-red-500'
                : limit > 0 && spent >= limit * 0.85
                  ? 'bg-gradient-to-r from-amber-400 to-orange-500'
                  : 'bg-gradient-to-r from-emerald-400 to-teal-500';

            return (
              <div key={cat} className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="font-medium text-slate-700">{cat}</span>
                  <span className="tabular-nums font-bold text-slate-900">
                    {formatVND(spent, privacyMode)}
                    {limit > 0 ? ` / ${formatVND(limit, privacyMode)}` : ''}
                  </span>
                </div>
                {limit > 0 && (
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div className={`h-full rounded-full transition-all duration-700 ${barColor}`} style={{ width: `${pct}%` }} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Ledger Header */}
      <div className="flex items-center justify-between px-1">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Sổ giao dịch</h3>
        <button
          onClick={() => setShowManual(!showManual)}
          className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-orange-500 to-rose-500 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm shadow-rose-500/25 active:scale-95 transition"
        >
          <Plus className="h-3.5 w-3.5" /> Thêm
        </button>
      </div>

      {showManual && (
        <form
          onSubmit={handleAddManual}
          className="animate-pop rounded-2xl bg-white p-4 shadow-md ring-1 ring-rose-500/20 space-y-3"
        >
          <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1">
            {(['expense', 'income', 'transfer'] as TransactionType[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTxType(t)}
                className={`rounded-lg py-1.5 text-xs font-semibold transition ${
                  txType === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
                }`}
              >
                {t === 'expense' ? 'Chi' : t === 'income' ? 'Thu' : 'Chuyển'}
              </button>
            ))}
          </div>

          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="numeric"
            placeholder="Số tiền (VNĐ)"
            className="w-full rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-900 ring-1 ring-slate-200 outline-none"
          />

          <div className="grid grid-cols-2 gap-2">
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-900 ring-1 ring-slate-200"
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {txType === 'transfer' ? `Từ: ${a.name}` : a.name}
                </option>
              ))}
            </select>

            {txType === 'transfer' ? (
              <select
                value={toAccountId}
                onChange={(e) => setToAccountId(e.target.value)}
                className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-900 ring-1 ring-slate-200"
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    Đến: {a.name}
                  </option>
                ))}
              </select>
            ) : txType === 'expense' ? (
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-900 ring-1 ring-slate-200"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            ) : (
              <div className="flex items-center rounded-xl bg-emerald-50 px-3 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">
                Thu nhập
              </div>
            )}
          </div>

          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ghi chú..."
            className="w-full rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-900 ring-1 ring-slate-200 outline-none"
          />

          <button
            type="submit"
            className="w-full rounded-xl bg-gradient-to-r from-orange-500 to-rose-500 py-2 text-xs font-semibold text-white"
          >
            Lưu giao dịch
          </button>
        </form>
      )}

      {/* Transaction Ledger */}
      <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-900/5">
        {transactions.map((tx) => (
          <div key={tx.id} className="flex items-center justify-between px-4 py-3 transition hover:bg-slate-50/70">
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-semibold text-slate-900">
                {tx.note || tx.category}
              </div>
              <div className="text-[11px] text-slate-400">
                {tx.category} • {tx.date}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`tabular-nums text-[13px] font-bold ${
                  tx.type === 'income'
                    ? 'text-emerald-600'
                    : tx.type === 'transfer'
                      ? 'text-blue-600'
                      : 'text-rose-600'
                }`}
              >
                {tx.type === 'income' ? '+' : tx.type === 'expense' ? '-' : '⇄ '}
                {formatVND(tx.amount, privacyMode)}
              </span>
              <button
                onClick={() => onDeleteTransaction(tx.id)}
                className="p-1 text-slate-300 transition hover:text-rose-500 active:scale-90"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
