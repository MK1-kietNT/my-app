import { useMemo, useState } from 'react';
import { Bell, CheckCircle2, ChevronLeft, ChevronRight, Circle, Plus, Trash2 } from 'lucide-react';
import type { CalendarNote, NoteTag } from '../types';
import { todayISO } from '../lib/format';

interface CalendarNotesTabProps {
  notes: CalendarNote[];
  onAddNote: (note: Omit<CalendarNote, 'id' | 'createdAt'>) => void;
  onToggleDone: (id: string) => void;
  onDeleteNote: (id: string) => void;
}

const TAG_STYLE: Record<NoteTag, { label: string; cls: string }> = {
  schedule: { label: 'Lịch hẹn', cls: 'bg-sky-100 text-sky-700' },
  bill: { label: 'Hóa đơn', cls: 'bg-rose-100 text-rose-700' },
  note: { label: 'Ghi chú', cls: 'bg-violet-100 text-violet-700' },
};

export function CalendarNotesTab({
  notes,
  onAddNote,
  onToggleDone,
  onDeleteNote,
}: CalendarNotesTabProps) {
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [viewMonth, setViewMonth] = useState(() => todayISO().slice(0, 7));
  const [showAdd, setShowAdd] = useState(false);

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [time, setTime] = useState('09:00');
  const [tag, setTag] = useState<NoteTag>('schedule');
  const [remind, setRemind] = useState(true);

  const calendarDays = useMemo(() => {
    const [y, m] = viewMonth.split('-').map(Number);
    const firstDay = new Date(y, m - 1, 1).getDay();
    const offset = firstDay === 0 ? 6 : firstDay - 1;
    const totalDays = new Date(y, m, 0).getDate();

    const cells: Array<string | null> = [];
    for (let i = 0; i < offset; i++) cells.push(null);
    for (let d = 1; d <= totalDays; d++) {
      cells.push(`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
    }
    return cells;
  }, [viewMonth]);

  function shiftMonth(delta: number) {
    const [y, m] = viewMonth.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setViewMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    onAddNote({
      title: title.trim(),
      content: content.trim(),
      date: selectedDate,
      time: time || undefined,
      tag,
      remind,
      done: false,
    });
    setTitle('');
    setContent('');
    setShowAdd(false);
  }

  const dayNotes = notes.filter((n) => n.date === selectedDate);
  const upcomingNotes = notes.filter((n) => !n.done && n.date !== selectedDate);

  return (
    <div className="space-y-4">
      {/* Colorful Month Grid */}
      <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-violet-500/15 space-y-3">
        <div className="flex items-center justify-between">
          <button onClick={() => shiftMonth(-1)} className="rounded-full p-1.5 text-slate-500 hover:bg-violet-50">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-bold text-slate-900">Tháng {viewMonth}</span>
          <button onClick={() => shiftMonth(1)} className="rounded-full p-1.5 text-slate-500 hover:bg-violet-50">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-7 text-center text-[11px] font-semibold text-slate-400">
          {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((d) => (
            <div key={d} className="py-1">
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-xs">
          {calendarDays.map((iso, idx) => {
            if (!iso) return <div key={`empty-${idx}`} />;
            const isSelected = iso === selectedDate;
            const isToday = iso === todayISO();
            const hasPending = notes.some((n) => n.date === iso && !n.done);
            const hasDoneOnly = !hasPending && notes.some((n) => n.date === iso);

            return (
              <button
                key={iso}
                onClick={() => setSelectedDate(iso)}
                className={`relative flex h-9 flex-col items-center justify-center rounded-xl transition active:scale-90 ${
                  isSelected
                    ? 'bg-gradient-to-br from-violet-500 to-purple-600 font-bold text-white shadow-md shadow-violet-500/25'
                    : isToday
                      ? 'bg-violet-50 ring-1 ring-violet-400 font-bold text-violet-700'
                      : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <span className="tabular-nums">{Number(iso.slice(8))}</span>
                {(hasPending || hasDoneOnly) && (
                  <span
                    className={`mt-0.5 h-1.5 w-1.5 rounded-full ${
                      isSelected
                        ? 'bg-white'
                        : hasPending
                          ? 'bg-amber-500'
                          : 'bg-slate-300'
                    }`}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Day Header */}
      <div className="flex items-center justify-between px-1">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
          Ngày {selectedDate} ({dayNotes.length})
        </h3>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-violet-500 to-purple-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm shadow-violet-500/25 active:scale-95 transition"
        >
          <Plus className="h-3.5 w-3.5" /> Thêm
        </button>
      </div>

      {showAdd && (
        <form
          onSubmit={handleCreate}
          className="animate-pop rounded-2xl bg-white p-4 shadow-md ring-1 ring-violet-500/20 space-y-3"
        >
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Tiêu đề (VD: Đóng tiền điện, Họp team...)"
            className="w-full rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-900 ring-1 ring-slate-200 outline-none focus:ring-violet-500"
          />
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={2}
            placeholder="Ghi chú chi tiết (không bắt buộc)"
            className="w-full rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-900 ring-1 ring-slate-200 outline-none focus:ring-violet-500"
          />
          <div className="grid grid-cols-2 gap-2">
            <select
              value={tag}
              onChange={(e) => setTag(e.target.value as NoteTag)}
              className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-900 ring-1 ring-slate-200"
            >
              <option value="schedule">Lịch hẹn</option>
              <option value="bill">Hóa đơn / Trả tiền</option>
              <option value="note">Ghi chú</option>
            </select>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-900 ring-1 ring-slate-200"
            />
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-600">
            <input
              type="checkbox"
              checked={remind}
              onChange={(e) => setRemind(e.target.checked)}
              className="accent-violet-600"
            />
            Bắn thông báo nhắc nhở trên Android đúng giờ
          </label>
          <button
            type="submit"
            className="w-full rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 py-2 text-xs font-semibold text-white"
          >
            Lưu vào lịch
          </button>
        </form>
      )}

      {/* Day Notes */}
      {dayNotes.length === 0 ? (
        <div className="rounded-2xl bg-white p-5 text-center text-xs text-slate-400 shadow-sm ring-1 ring-slate-900/5">
          Ngày này chưa có lịch hay ghi chú nào.
        </div>
      ) : (
        <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-900/5">
          {dayNotes.map((n) => (
            <div
              key={n.id}
              className={`flex items-start justify-between px-4 py-3.5 transition ${n.done ? 'opacity-50' : 'hover:bg-slate-50/70'}`}
            >
              <div className="flex items-start gap-3">
                <button onClick={() => onToggleDone(n.id)} className="mt-0.5 text-slate-400 active:scale-90 transition">
                  {n.done ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <Circle className="h-4 w-4" />}
                </button>
                <div>
                  <div className={`text-[13px] font-semibold ${n.done ? 'line-through text-slate-400' : 'text-slate-900'}`}>
                    {n.title}
                  </div>
                  {n.content && <div className="mt-0.5 text-xs text-slate-500">{n.content}</div>}
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${TAG_STYLE[n.tag].cls}`}>
                      {TAG_STYLE[n.tag].label}
                    </span>
                    {n.time && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600">
                        <Bell className="h-3 w-3" /> {n.time}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <button
                onClick={() => onDeleteNote(n.id)}
                className="p-1 text-slate-300 transition hover:text-rose-500 active:scale-90"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Upcoming Notes */}
      {upcomingNotes.length > 0 && (
        <div className="space-y-2 pt-2">
          <h4 className="px-1 text-xs font-bold uppercase tracking-wider text-slate-500">
            Lịch & Ghi chú ngày khác
          </h4>
          <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-900/5">
            {upcomingNotes.map((n) => (
              <div
                key={n.id}
                onClick={() => setSelectedDate(n.date)}
                className="flex cursor-pointer items-center justify-between px-4 py-3 text-xs transition hover:bg-violet-50/40"
              >
                <div className="truncate font-semibold text-slate-800">{n.title}</div>
                <span className="tabular-nums shrink-0 text-slate-400">
                  {n.date} {n.time || ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
