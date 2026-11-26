export function formatVND(amount: number, hidden = false): string {
  if (hidden) return '••••••••';
  const sign = amount < 0 ? '-' : '';
  return `${sign}${Math.abs(Math.round(amount)).toLocaleString('vi-VN')}đ`;
}

export function formatCompactVND(amount: number, hidden = false): string {
  if (hidden) return '••••••';
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';
  if (abs >= 1_000_000_000) {
    return `${sign}${(abs / 1_000_000_000).toFixed(2).replace(/\.00$/, '')} tỷ`;
  }
  if (abs >= 1_000_000) {
    return `${sign}${(abs / 1_000_000).toFixed(1).replace(/\.0$/, '')} tr`;
  }
  if (abs >= 1_000) {
    return `${sign}${Math.round(abs / 1_000)}k`;
  }
  return `${sign}${abs}đ`;
}

export function todayISO(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function currentMonthISO(): string {
  return todayISO().slice(0, 7);
}

export function getDaysInMonth(yearMonth = currentMonthISO()): number {
  const [y, m] = yearMonth.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

export function getRemainingDaysInMonth(): number {
  const now = new Date();
  const total = getDaysInMonth();
  return Math.max(1, total - now.getDate() + 1);
}

export function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}
