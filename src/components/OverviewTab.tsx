import { useState } from 'react';
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  Bell,
  Eye,
  EyeOff,
  Sparkles,
  Trash2,
} from 'lucide-react';
import type { Account, AlertItem, Transaction } from '../types';
import { formatCompactVND, formatVND } from '../lib/format';

interface OverviewTabProps {
  netWorth: number;
  totalAssets: number;
  totalDebt: number;
  privacyMode: boolean;
  onTogglePrivacy: () => void;
  monthSummary: {
    month: string;
    income: number;
    expense: number;
    remainingBudget: number;
    safeDailySpend: number;
    budgetPercent: number;
  };
  monthlyLimit: number;
  alerts: AlertItem[];
  transactions: Transaction[];
  accounts: Account[];
  onDeleteTx: (id: string) => void;
  onRunAIAnalysis: () => Promise<string>;
}

const CAT_BADGE: Record<string, string> = {
  'Ăn uống': 'bg-orange-100 text-orange-600',
  'Di chuyển': 'bg-sky-100 text-sky-600',
  'Mua sắm': 'bg-pink-100 text-pink-600',
  'Hóa đơn': 'bg-rose-100 text-rose-600',
  'Giải trí': 'bg-violet-100 text-violet-600',
  'Sức khỏe': 'bg-emerald-100 text-emerald-600',
  'Học tập': 'bg-indigo-100 text-indigo-600',
  'Thu nhập': 'bg-teal-100 text-teal-700',
  'Chuyển khoản': 'bg-blue-100 text-blue-600',
};

export function OverviewTab({
  netWorth,
  totalAssets,
  totalDebt,
  privacyMode,
  onTogglePrivacy,
  monthSummary,
  monthlyLimit,
  alerts,
  transactions,
  accounts,
  onDeleteTx,
  onRunAIAnalysis,
}: OverviewTabProps) {
  const [aiReport, setAiReport] = useState<string>('');
  const [loadingAI, setLoadingAI] = useState(false);

  async function handleAnalyze() {
    setLoadingAI(true);
    try {
      const res = await onRunAIAnalysis();
      setAiReport(res);
    } catch (err) {
      setAiReport(err instanceof Error ? err.message : 'Lỗi phân tích AI');
    } finally {
      setLoadingAI(false);
    }
  }

  const getAccountName = (id: string) => accounts.find((a) => a.id === id)?.name || 'Ví';

  const progressColor =
    monthSummary.budgetPercent >= 100
      ? 'bg-gradient-to-r from-rose-500 to-red-500'
      : monthSummary.budgetPercent >= 80
        ? 'bg-gradient-to-r from-amber-400 to-orange-500'
        : 'bg-gradient-to-r from-emerald-400 to-teal-500';

  return (
    <div className="space-y-4">
      {/* Vibrant Shimmer Hero Card */}
      <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-emerald-500 via-teal-600 to-cyan-700 p-5 text-white shadow-xl shadow-emerald-600/20">
        {/* Decorative light orbs & shimmer */}
        <div className="pointer-events-none absolute -top-10 -right-10 h-36 w-36 rounded-full bg-white/15 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-12 -left-8 h-32 w-32 rounded-full bg-teal-300/20 blur-xl" />
        <div className="animate-shimmer pointer-events-none absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/15 to-transparent" />

        <div className="relative flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-50/90">
            Tổng tài sản ròng
          </span>
          <button
            onClick={onTogglePrivacy}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-sm active:scale-90 transition"
            aria-label="Ẩn/hiện số tiền"
          >
            {privacyMode ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>

        <div className="tabular-nums relative mt-1.5 text-[33px] font-extrabold tracking-tight text-white">
          {formatVND(netWorth, privacyMode)}
        </div>

        <div className="relative mt-5 grid grid-cols-2 gap-3 border-t border-white/20 pt-3.5">
          <div>
            <div className="text-[11px] text-emerald-50/80">Tổng tài sản</div>
            <div className="tabular-nums mt-0.5 text-sm font-bold text-white">
              {formatCompactVND(totalAssets, privacyMode)}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-emerald-50/80">Nợ / Thẻ tín dụng</div>
            <div className="tabular-nums mt-0.5 text-sm font-bold text-rose-100">
              {formatCompactVND(totalDebt, privacyMode)}
            </div>
          </div>
        </div>
      </div>

      {/* Colorful Bento 2-col Metrics */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-gradient-to-br from-white to-emerald-50/60 p-4 shadow-sm ring-1 ring-emerald-500/15 transition active:scale-[0.98]">
          <div className="text-[11px] font-semibold text-emerald-700">Hôm nay được tiêu</div>
          <div className="tabular-nums mt-1 text-xl font-extrabold text-emerald-600">
            {formatCompactVND(monthSummary.safeDailySpend, privacyMode)}
          </div>
          <div className="mt-2 text-[11px] text-slate-500">
            Còn {formatCompactVND(monthSummary.remainingBudget, privacyMode)} / tháng
          </div>
        </div>

        <div className="rounded-2xl bg-gradient-to-br from-white to-sky-50/60 p-4 shadow-sm ring-1 ring-sky-500/15 transition active:scale-[0.98]">
          <div className="flex items-center justify-between text-[11px] font-semibold text-sky-700">
            <span>Ngân sách</span>
            <span className="tabular-nums rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold text-sky-700">
              {monthSummary.budgetPercent}%
            </span>
          </div>
          <div className="tabular-nums mt-1 text-xl font-extrabold text-slate-900">
            {formatCompactVND(monthSummary.expense, privacyMode)}
          </div>
          <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-full rounded-full transition-all duration-700 ease-out ${progressColor}`}
              style={{ width: `${Math.min(100, monthSummary.budgetPercent)}%` }}
            />
          </div>
          <div className="tabular-nums mt-1 text-[10px] text-slate-400">
            Trần {formatCompactVND(monthlyLimit, privacyMode)}
          </div>
        </div>
      </div>

      {/* Income / Expense Split Strip */}
      <div className="grid grid-cols-2 divide-x divide-slate-100 rounded-2xl bg-white shadow-sm ring-1 ring-slate-900/5">
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
            <ArrowDownLeft className="h-4 w-4" />
          </div>
          <div>
            <div className="text-[10px] font-medium text-slate-500">Thu tháng</div>
            <div className="tabular-nums text-xs font-bold text-emerald-700">
              +{formatCompactVND(monthSummary.income, privacyMode)}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-rose-100 text-rose-600">
            <ArrowUpRight className="h-4 w-4" />
          </div>
          <div>
            <div className="text-[10px] font-medium text-slate-500">Chi tháng</div>
            <div className="tabular-nums text-xs font-bold text-rose-600">
              -{formatCompactVND(monthSummary.expense, privacyMode)}
            </div>
          </div>
        </div>
      </div>

      {/* Animated Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((a) => (
            <div
              key={a.id}
              className={`animate-pop flex items-start gap-3 rounded-2xl px-4 py-3 ring-1 ${
                a.level === 'danger'
                  ? 'bg-gradient-to-r from-rose-50 to-red-50 text-rose-900 ring-rose-200'
                  : a.level === 'warning'
                    ? 'bg-gradient-to-r from-amber-50 to-orange-50 text-amber-900 ring-amber-200'
                    : 'bg-gradient-to-r from-sky-50 to-indigo-50 text-sky-900 ring-sky-200'
              }`}
            >
              {a.level === 'info' ? (
                <Bell className="mt-0.5 h-4 w-4 shrink-0 animate-bounce text-sky-600" />
              ) : (
                <AlertCircle
                  className={`mt-0.5 h-4 w-4 shrink-0 animate-pulse ${
                    a.level === 'danger' ? 'text-rose-600' : 'text-amber-600'
                  }`}
                />
              )}
              <div className="min-w-0">
                <div className="text-xs font-bold">{a.title}</div>
                <div className="text-[11px] opacity-85">{a.message}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Vibrant AI Advisor Card */}
      <div className="rounded-2xl bg-gradient-to-br from-indigo-50 via-white to-violet-50 p-4 shadow-sm ring-1 ring-indigo-200/70 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-sm shadow-indigo-500/25">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-900">Cố vấn tài chính AI</div>
              <div className="text-[11px] text-slate-500">Đánh giá dòng tiền & cảnh báo rò rỉ</div>
            </div>
          </div>
          <button
            onClick={handleAnalyze}
            disabled={loadingAI}
            className="rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm shadow-indigo-500/25 active:scale-95 transition disabled:opacity-50"
          >
            {loadingAI ? 'Đang soi...' : 'Soi ví'}
          </button>
        </div>

        {aiReport && (
          <div className="animate-fade-up whitespace-pre-line rounded-xl bg-white/90 p-3 text-xs leading-relaxed text-slate-700 ring-1 ring-indigo-100">
            {aiReport}
          </div>
        )}
      </div>

      {/* Grouped Recent Transactions with Colorful Badges */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Giao dịch gần đây
          </h2>
          <span className="text-[11px] font-medium text-slate-400">{transactions.length} mục</span>
        </div>

        {transactions.length === 0 ? (
          <div className="rounded-2xl bg-white p-6 text-center text-xs text-slate-400 shadow-sm ring-1 ring-slate-900/5">
            Chưa có giao dịch nào.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-900/5">
            {transactions.slice(0, 8).map((tx) => {
              const badgeCls = CAT_BADGE[tx.category] || 'bg-slate-100 text-slate-600';
              return (
                <div
                  key={tx.id}
                  className="flex items-center justify-between px-4 py-3 transition hover:bg-slate-50/80"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl text-xs font-bold ${badgeCls}`}
                    >
                      {tx.category.slice(0, 1).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-[13px] font-semibold text-slate-900">
                        {tx.note || tx.category}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {getAccountName(tx.accountId)} • {tx.date.slice(5)}
                      </div>
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
                      onClick={() => onDeleteTx(tx.id)}
                      className="p-1 text-slate-300 transition hover:text-rose-500 active:scale-90"
                      aria-label="Xóa giao dịch"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
