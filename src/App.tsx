import { useRef, useState } from 'react';
import {
  ArrowUp,
  Bot,
  CalendarDays,
  CloudSun,
  Home,
  Mic,
  MicOff,
  PieChart,
  Settings,
  Sparkles,
  Wallet,
} from 'lucide-react';
import { useAppStore } from './store/useAppStore';
import { analyzeFinancesWithAI, chatWithPersonalAI, parseQuickInputWithAI } from './lib/ai';
import { OverviewTab } from './components/OverviewTab';
import { AssetsTab } from './components/AssetsTab';
import { BudgetTab } from './components/BudgetTab';
import { CalendarNotesTab } from './components/CalendarNotesTab';
import { ChatTab } from './components/ChatTab';
import { SettingsModal } from './components/SettingsModal';
import { WeatherCard } from './components/WeatherCard';

type Tab = 'overview' | 'assets' | 'budget' | 'calendar' | 'weather' | 'chat';

const TAB_ACTIVE_STYLE: Record<Tab, string> = {
  overview: 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/25',
  assets: 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-md shadow-blue-500/25',
  budget: 'bg-gradient-to-r from-orange-500 to-rose-500 text-white shadow-md shadow-rose-500/25',
  calendar: 'bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-md shadow-violet-500/25',
  weather: 'bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-md shadow-sky-500/25',
  chat: 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-500/25',
};

export function App() {
  const store = useAppStore();
  const [tab, setTab] = useState<Tab>('overview');
  const [quickText, setQuickText] = useState('');
  const [parsing, setParsing] = useState(false);
  const [listening, setListening] = useState(false);
  const [toast, setToast] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const recognitionRef = useRef<{ stop: () => void } | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 3200);
  }

  function handleToggleVoice() {
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }

    const win = window as unknown as {
      SpeechRecognition?: new () => {
        lang: string;
        interimResults: boolean;
        continuous: boolean;
        onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
        onerror: (() => void) | null;
        onend: (() => void) | null;
        start: () => void;
        stop: () => void;
      };
      webkitSpeechRecognition?: new () => {
        lang: string;
        interimResults: boolean;
        continuous: boolean;
        onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
        onerror: (() => void) | null;
        onend: (() => void) | null;
        start: () => void;
        stop: () => void;
      };
    };

    const SpeechRec = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (!SpeechRec) {
      showToast('Trình duyệt chưa hỗ trợ mic trực tiếp — bạn dùng nút mic trên bàn phím điện thoại nhé!');
      return;
    }

    const rec = new SpeechRec();
    rec.lang = 'vi-VN';
    rec.interimResults = true;
    rec.continuous = false;

    rec.onresult = (event) => {
      let transcript = '';
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      setQuickText(transcript.trim());
    };

    rec.onerror = () => {
      setListening(false);
      showToast('Không thu được giọng nói. Kiểm tra quyền Micro nhé!');
    };

    rec.onend = () => {
      setListening(false);
    };

    recognitionRef.current = rec;
    setListening(true);
    rec.start();
  }

  async function handleQuickSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!quickText.trim() || parsing) return;
    setParsing(true);
    try {
      const parsed = await parseQuickInputWithAI(
        quickText,
        store.state.accounts,
        store.state.settings.geminiApiKey
      );

      for (const tx of parsed.transactions) {
        const matchedAcc =
          store.state.accounts.find((a) =>
            a.name.toLowerCase().includes(tx.accountNameHint.toLowerCase())
          ) || store.state.accounts[0];

        const matchedTo = tx.toAccountNameHint
          ? store.state.accounts.find((a) =>
              a.name.toLowerCase().includes(tx.toAccountNameHint!.toLowerCase())
            )
          : undefined;

        if (matchedAcc) {
          store.addTransaction({
            type: tx.type,
            amount: tx.amount,
            category: tx.category,
            note: tx.note,
            accountId: matchedAcc.id,
            toAccountId: matchedTo?.id,
            date: tx.date,
          });
        }
      }

      for (const n of parsed.notes) {
        store.addNote({
          title: n.title,
          content: n.content,
          date: n.date,
          time: n.time,
          tag: n.tag,
          remind: n.remind,
          done: false,
        });
      }

      const countTx = parsed.transactions.length;
      const countNotes = parsed.notes.length;
      if (countTx + countNotes === 0) {
        showToast('Chưa nhận diện được — thử ghi rõ số tiền hoặc giờ.');
      } else {
        showToast(`Đã ghi ${countTx} giao dịch, ${countNotes} lịch/note`);
        setQuickText('');
      }
    } finally {
      setParsing(false);
    }
  }

  return (
    <div className="relative mx-auto min-h-screen max-w-md overflow-x-hidden bg-[#F4F6FB] text-slate-900">
      {/* Ambient Soft Color Blobs */}
      <div className="pointer-events-none fixed inset-x-0 top-0 mx-auto max-w-md overflow-hidden">
        <div className="animate-float -top-16 -left-16 absolute h-56 w-56 rounded-full bg-emerald-300/30 blur-3xl" />
        <div className="animate-float -top-10 -right-12 absolute h-52 w-52 rounded-full bg-sky-300/30 blur-3xl [animation-delay:1.5s]" />
      </div>

      {/* Sticky Light Header */}
      <header className="sticky top-0 z-30 bg-[#F4F6FB]/80 px-4 pt-4 pb-3 backdrop-blur-xl">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-sm font-black text-white shadow-md shadow-emerald-500/25">
              W
            </div>
            <div>
              <span className="text-base font-bold tracking-tight text-slate-900">WealthFlow</span>
              <div className="text-[11px] font-medium text-slate-500">Chi tiêu • Tài sản • Lịch</div>
            </div>
          </div>
          <button
            onClick={() => setSettingsOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-slate-600 shadow-sm ring-1 ring-slate-900/5 active:scale-90 transition"
            aria-label="Cài đặt"
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>

        {/* Colorful Quick Input Bar */}
        <form onSubmit={handleQuickSubmit} className="relative flex items-center gap-1.5">
          <div className="relative flex-1 flex items-center">
            <Sparkles className="pointer-events-none absolute left-3.5 h-4 w-4 text-emerald-500" />
            <input
              value={quickText}
              onChange={(e) => setQuickText(e.target.value)}
              placeholder={listening ? 'Đang nghe bạn nói...' : 'Nói hoặc gõ: cf 45k momo, mai 9h họp...'}
              className="w-full rounded-2xl bg-white py-2.5 pr-11 pl-9 text-[13px] text-slate-900 placeholder:text-slate-400 shadow-sm ring-1 ring-slate-900/8 outline-none transition focus:ring-2 focus:ring-emerald-500/50"
            />
            <button
              type="submit"
              disabled={parsing || !quickText.trim()}
              className="absolute right-1.5 flex h-7 w-7 items-center justify-center rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-sm transition active:scale-90 disabled:from-slate-200 disabled:to-slate-200 disabled:text-slate-400 disabled:shadow-none"
              aria-label="Gửi"
            >
              <ArrowUp className="h-4 w-4 stroke-[2.5]" />
            </button>
          </div>
          <button
            type="button"
            onClick={handleToggleVoice}
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl shadow-sm transition active:scale-90 ${
              listening
                ? 'animate-pulse bg-rose-500 text-white shadow-rose-500/30'
                : 'bg-white text-slate-600 ring-1 ring-slate-900/8 hover:text-emerald-600'
            }`}
            aria-label="Nhập bằng giọng nói"
          >
            {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </button>
        </form>

        {toast && (
          <div className="animate-pop mt-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-3 py-2 text-center text-xs font-semibold text-white shadow-md shadow-emerald-500/20">
            {toast}
          </div>
        )}
      </header>

      {/* Main Content with Tab Entrance Animation */}
      <main key={tab} className="animate-fade-up relative z-10 px-4 pt-2 pb-28">
        {tab === 'overview' && (
          <OverviewTab
            netWorth={store.netWorth}
            totalAssets={store.totalAssets}
            totalDebt={store.totalDebt}
            privacyMode={store.state.settings.privacyMode}
            onTogglePrivacy={() =>
              store.updateSettings({ privacyMode: !store.state.settings.privacyMode })
            }
            monthSummary={store.monthSummary}
            monthlyLimit={store.state.budget.monthlyLimit}
            alerts={store.alerts}
            transactions={store.state.transactions}
            accounts={store.state.accounts}
            onDeleteTx={store.deleteTransaction}
            onRunAIAnalysis={() => analyzeFinancesWithAI(store.state)}
          />
        )}

        {tab === 'assets' && (
          <AssetsTab
            accounts={store.state.accounts}
            totalAssets={store.totalAssets}
            totalDebt={store.totalDebt}
            privacyMode={store.state.settings.privacyMode}
            onAddAccount={store.addAccount}
            onUpdateBalance={store.updateAccountBalance}
            onDeleteAccount={store.deleteAccount}
          />
        )}

        {tab === 'budget' && (
          <BudgetTab
            budget={store.state.budget}
            byCategory={store.monthSummary.byCategory}
            transactions={store.state.transactions}
            accounts={store.state.accounts}
            privacyMode={store.state.settings.privacyMode}
            onUpdateBudget={store.updateBudget}
            onAddTransaction={store.addTransaction}
            onDeleteTransaction={store.deleteTransaction}
          />
        )}

        {tab === 'calendar' && (
          <CalendarNotesTab
            notes={store.state.notes}
            onAddNote={store.addNote}
            onToggleDone={store.toggleNoteDone}
            onDeleteNote={store.deleteNote}
          />
        )}

        {tab === 'weather' && <WeatherCard defaultExpanded />}

        {tab === 'chat' && (
          <ChatTab
            messages={store.state.chatMessages}
            memories={store.state.memories}
            voiceReplyEnabled={store.state.settings.voiceReplyEnabled}
            hasApiKey={Boolean(store.state.settings.geminiApiKey.trim())}
            onToggleVoiceReply={() =>
              store.updateSettings({
                voiceReplyEnabled: !store.state.settings.voiceReplyEnabled,
              })
            }
            onClearChat={store.clearChat}
            onAddMemory={(fact) => store.addMemories([fact])}
            onDeleteMemory={store.deleteMemory}
            onOpenSettings={() => setSettingsOpen(true)}
            onSendMessage={async (text) => {
              store.addChatMessage('user', text);
              try {
                const res = await chatWithPersonalAI(text, store.state);
                store.addChatMessage('assistant', res.reply);
                if (res.newMemories.length > 0) {
                  store.addMemories(res.newMemories);
                  showToast(`🧠 Đã ghi nhớ ${res.newMemories.length} thói quen mới!`);
                }
                return res.reply;
              } catch (err) {
                const msg = err instanceof Error ? err.message : 'Lỗi kết nối AI.';
                store.addChatMessage('assistant', msg);
                return msg;
              }
            }}
          />
        )}
      </main>

      {/* Colorful Floating Bottom Nav */}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center px-3">
        <nav className="pointer-events-auto flex w-full max-w-[400px] items-center justify-around gap-1 rounded-full bg-white/95 p-1.5 shadow-xl shadow-slate-900/10 ring-1 ring-slate-900/8 backdrop-blur-xl">
          {[
            { id: 'overview' as Tab, label: 'Tổng quan', icon: Home },
            { id: 'assets' as Tab, label: 'Tài sản', icon: Wallet },
            { id: 'budget' as Tab, label: 'Chi tiêu', icon: PieChart },
            { id: 'calendar' as Tab, label: 'Lịch', icon: CalendarDays },
            { id: 'weather' as Tab, label: 'Thời tiết', icon: CloudSun },
            { id: 'chat' as Tab, label: 'AI Chat', icon: Bot },
          ].map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setTab(item.id)}
                className={`flex flex-1 flex-col items-center gap-0.5 rounded-full py-1.5 text-[9.5px] font-semibold transition-all duration-200 active:scale-95 ${
                  active ? TAB_ACTIVE_STYLE[item.id] : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={store.state.settings}
        fullState={store.state}
        onUpdateSettings={store.updateSettings}
        onImportData={store.importData}
      />
    </div>
  );
}

export default App;
