import { useState } from 'react';
import { Bell, Download, KeyRound, Upload, X } from 'lucide-react';
import type { AppSettings, AppState } from '../types';
import { requestNotificationPermission } from '../lib/notifications';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  settings: AppSettings;
  fullState: AppState;
  onUpdateSettings: (partial: Partial<AppSettings>) => void;
  onImportData: (json: string) => boolean;
}

export function SettingsModal({
  open,
  onClose,
  settings,
  fullState,
  onUpdateSettings,
  onImportData,
}: SettingsModalProps) {
  const [apiKey, setApiKey] = useState(settings.geminiApiKey);
  const [statusMsg, setStatusMsg] = useState('');

  if (!open) return null;

  function handleSaveKey() {
    onUpdateSettings({ geminiApiKey: apiKey.trim() });
    setStatusMsg('Đã lưu Gemini API Key!');
  }

  async function handleEnableNotifications() {
    const granted = await requestNotificationPermission();
    onUpdateSettings({ notificationsEnabled: granted });
    setStatusMsg(granted ? 'Đã bật thông báo nhắc lịch & cảnh báo!' : 'Chưa được cấp quyền thông báo.');
  }

  function handleExport() {
    const blob = new Blob([JSON.stringify(fullState, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wealthflow-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setStatusMsg('Đã tải file sao lưu JSON.');
  }

  function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const ok = onImportData(String(reader.result || ''));
      setStatusMsg(ok ? 'Khôi phục dữ liệu thành công!' : 'File JSON không hợp lệ.');
    };
    reader.readAsText(file);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 backdrop-blur-sm sm:items-center">
      <div className="w-full max-w-md rounded-t-3xl bg-white p-5 shadow-2xl ring-1 ring-slate-900/10 space-y-4 sm:rounded-3xl">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900">Cài đặt</h2>
          <button onClick={onClose} className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Gemini API Key */}
        <div className="space-y-2 rounded-2xl bg-slate-50 p-3.5 ring-1 ring-slate-200/70">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-800">
            <KeyRound className="h-4 w-4 text-emerald-600" /> Gemini API Key (Miễn phí)
          </div>
          <p className="text-[11px] text-slate-500">
            Lấy key tại <span className="font-medium text-slate-700">aistudio.google.com</span> để mở khóa AI nhập liệu & phân tích chuyên sâu.
          </p>
          <div className="flex gap-2">
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="AIza..."
              className="flex-1 rounded-xl bg-white px-3 py-2 text-xs text-slate-900 ring-1 ring-slate-200 outline-none"
            />
            <button
              onClick={handleSaveKey}
              className="rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white"
            >
              Lưu
            </button>
          </div>
        </div>

        {/* Notifications */}
        <div className="flex items-center justify-between rounded-2xl bg-slate-50 p-3.5 ring-1 ring-slate-200/70">
          <div className="flex items-center gap-2.5">
            <Bell className="h-4 w-4 text-amber-500" />
            <div>
              <div className="text-xs font-semibold text-slate-900">Thông báo Android</div>
              <div className="text-[11px] text-slate-500">Nhắc lịch hẹn & cảnh báo lố tiền</div>
            </div>
          </div>
          <button
            onClick={handleEnableNotifications}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
              settings.notificationsEnabled
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-slate-200 text-slate-700'
            }`}
          >
            {settings.notificationsEnabled ? 'Đang bật' : 'Cấp quyền'}
          </button>
        </div>

        {/* Backup / Restore */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={handleExport}
            className="flex items-center justify-center gap-1.5 rounded-2xl bg-slate-50 py-2.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-200/70"
          >
            <Download className="h-4 w-4 text-emerald-600" /> Sao lưu JSON
          </button>
          <label className="flex cursor-pointer items-center justify-center gap-1.5 rounded-2xl bg-slate-50 py-2.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-200/70">
            <Upload className="h-4 w-4 text-sky-600" /> Khôi phục JSON
            <input type="file" accept="application/json" onChange={handleImportFile} className="hidden" />
          </label>
        </div>

        {statusMsg && <div className="text-center text-xs font-medium text-emerald-600">{statusMsg}</div>}
      </div>
    </div>
  );
}
