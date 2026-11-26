import { useState } from 'react';
import { Pencil, Plus, Trash2, Wallet } from 'lucide-react';
import type { Account, AccountType } from '../types';
import { formatCompactVND, formatVND } from '../lib/format';

interface AssetsTabProps {
  accounts: Account[];
  totalAssets: number;
  totalDebt: number;
  privacyMode: boolean;
  onAddAccount: (acc: Omit<Account, 'id'>) => void;
  onUpdateBalance: (id: string, balance: number) => void;
  onDeleteAccount: (id: string) => void;
}

const TYPE_LABELS: Record<AccountType, string> = {
  cash: 'Tiền mặt',
  bank: 'Ngân hàng',
  ewallet: 'Ví điện tử',
  savings: 'Tiết kiệm',
  investment: 'Đầu tư / Vàng',
  debt: 'Nợ / Thẻ tín dụng',
};

const TYPE_COLORS: Record<AccountType, string> = {
  cash: '#10b981',
  bank: '#3b82f6',
  ewallet: '#ec4899',
  savings: '#f59e0b',
  investment: '#8b5cf6',
  debt: '#ef4444',
};

export function AssetsTab({
  accounts,
  totalAssets,
  totalDebt,
  privacyMode,
  onAddAccount,
  onUpdateBalance,
  onDeleteAccount,
}: AssetsTabProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('bank');
  const [balance, setBalance] = useState('');

  function handleSaveBalance(id: string) {
    const val = Number(editValue.replace(/[^\d]/g, ''));
    if (!Number.isNaN(val)) {
      onUpdateBalance(id, val);
    }
    setEditingId(null);
  }

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    onAddAccount({
      name: name.trim(),
      type,
      balance: Number(balance.replace(/[^\d]/g, '')) || 0,
      color: TYPE_COLORS[type],
    });
    setName('');
    setBalance('');
    setShowAdd(false);
  }

  return (
    <div className="space-y-4">
      {/* Allocation Summary */}
      <div className="rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 p-5 text-white shadow-lg shadow-blue-600/20 space-y-3">
        <div className="flex items-end justify-between">
          <div>
            <div className="text-[11px] font-medium text-blue-100">Tổng tài sản dương</div>
            <div className="tabular-nums mt-0.5 text-2xl font-extrabold text-white">
              {formatVND(totalAssets, privacyMode)}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[11px] text-blue-100/80">Nợ</div>
            <div className="tabular-nums text-sm font-bold text-rose-200">
              {formatCompactVND(totalDebt, privacyMode)}
            </div>
          </div>
        </div>

        <div className="flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full bg-white/20">
          {accounts
            .filter((a) => a.type !== 'debt' && a.balance > 0)
            .map((acc) => {
              const pct = totalAssets > 0 ? (acc.balance / totalAssets) * 100 : 0;
              return (
                <div
                  key={acc.id}
                  className="transition-all duration-500"
                  style={{ width: `${pct}%`, backgroundColor: acc.color }}
                  title={`${acc.name}: ${Math.round(pct)}%`}
                />
              );
            })}
        </div>

        <div className="flex flex-wrap gap-x-3 gap-y-1 pt-0.5">
          {accounts
            .filter((a) => a.type !== 'debt')
            .map((acc) => (
              <span key={acc.id} className="inline-flex items-center gap-1.5 text-[11px] text-blue-50">
                <span className="h-2 w-2 rounded-full ring-1 ring-white/50" style={{ backgroundColor: acc.color }} />
                {acc.name}
              </span>
            ))}
        </div>
      </div>

      {/* Header + Add */}
      <div className="flex items-center justify-between px-1">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
          Tài khoản & Nguồn tiền
        </h2>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm shadow-blue-500/25 active:scale-95 transition"
        >
          <Plus className="h-3.5 w-3.5" /> Thêm
        </button>
      </div>

      {showAdd && (
        <form
          onSubmit={handleCreate}
          className="animate-pop rounded-2xl bg-white p-4 shadow-md ring-1 ring-blue-500/20 space-y-3"
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Tên ví / tài sản (VD: Techcombank, Vàng SJC...)"
            className="w-full rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-900 ring-1 ring-slate-200 outline-none focus:ring-blue-500"
          />
          <div className="grid grid-cols-2 gap-2">
            <select
              value={type}
              onChange={(e) => setType(e.target.value as AccountType)}
              className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-900 ring-1 ring-slate-200 outline-none"
            >
              {Object.entries(TYPE_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
            <input
              value={balance}
              onChange={(e) => setBalance(e.target.value)}
              inputMode="numeric"
              placeholder="Số dư (VNĐ)"
              className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-900 ring-1 ring-slate-200 outline-none focus:ring-blue-500"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowAdd(false)}
              className="rounded-xl px-3 py-1.5 text-xs text-slate-500"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="rounded-xl bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white"
            >
              Lưu
            </button>
          </div>
        </form>
      )}

      {/* Grouped Account List */}
      <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-900/5">
        {accounts.map((acc) => {
          const isEditing = editingId === acc.id;
          return (
            <div key={acc.id} className="flex items-center justify-between px-4 py-3.5 transition hover:bg-slate-50/70">
              <div className="flex items-center gap-3">
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-2xl"
                  style={{ backgroundColor: `${acc.color}18`, color: acc.color }}
                >
                  <Wallet className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-[13px] font-bold text-slate-900">{acc.name}</div>
                  <div className="text-[11px] text-slate-400">{TYPE_LABELS[acc.type]}</div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {isEditing ? (
                  <div className="flex items-center gap-1">
                    <input
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      inputMode="numeric"
                      autoFocus
                      className="w-28 rounded-lg bg-slate-50 px-2 py-1 text-right text-xs text-slate-900 ring-1 ring-blue-500 outline-none"
                    />
                    <button
                      onClick={() => handleSaveBalance(acc.id)}
                      className="rounded-lg bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white"
                    >
                      OK
                    </button>
                  </div>
                ) : (
                  <>
                    <span
                      className={`tabular-nums text-[13px] font-bold ${
                        acc.type === 'debt' ? 'text-rose-600' : 'text-slate-900'
                      }`}
                    >
                      {acc.type === 'debt' ? '-' : ''}
                      {formatVND(acc.balance, privacyMode)}
                    </span>
                    <button
                      onClick={() => {
                        setEditingId(acc.id);
                        setEditValue(String(acc.balance));
                      }}
                      className="p-1.5 text-slate-400 transition hover:text-blue-600 active:scale-90"
                      aria-label="Sửa số dư"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => onDeleteAccount(acc.id)}
                      className="p-1.5 text-slate-300 transition hover:text-rose-500 active:scale-90"
                      aria-label="Xóa tài khoản"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
