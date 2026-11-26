import { useEffect, useRef, useState } from 'react';
import {
  Brain,
  Mic,
  MicOff,
  Plus,
  Send,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import type { ChatMessage, UserMemoryItem } from '../types';

interface ChatTabProps {
  messages: ChatMessage[];
  memories: UserMemoryItem[];
  voiceReplyEnabled: boolean;
  hasApiKey: boolean;
  onSendMessage: (text: string) => Promise<string>;
  onToggleVoiceReply: () => void;
  onClearChat: () => void;
  onAddMemory: (fact: string) => void;
  onDeleteMemory: (id: string) => void;
  onOpenSettings: () => void;
}

const QUICK_PROMPTS = [
  'Tháng này mình tiêu gì nhiều nhất?',
  'Hôm nay mình có lịch gì cần làm?',
  'Nhớ giúp mình: mình hay uống cà phê sáng',
];

export function ChatTab({
  messages,
  memories,
  voiceReplyEnabled,
  hasApiKey,
  onSendMessage,
  onToggleVoiceReply,
  onClearChat,
  onAddMemory,
  onDeleteMemory,
  onOpenSettings,
}: ChatTabProps) {
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [listening, setListening] = useState(false);
  const [showMemories, setShowMemories] = useState(false);
  const [newMemory, setNewMemory] = useState('');

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const recognitionRef = useRef<{ stop: () => void } | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  function speakText(text: string) {
    try {
      if (!('speechSynthesis' in window)) return;
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text.replace(/[*#•]/g, ''));
      utter.lang = 'vi-VN';
      utter.rate = 1.05;
      window.speechSynthesis.speak(utter);
    } catch {
      // Ignore TTS errors on unsupported devices
    }
  }

  async function submitText(text: string, fromVoice = false) {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setInput('');
    setSending(true);
    try {
      const reply = await onSendMessage(trimmed);
      if (voiceReplyEnabled || fromVoice) {
        speakText(reply);
      }
    } finally {
      setSending(false);
    }
  }

  function handleVoiceChat() {
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
        onresult: ((e: { results: ArrayLike<{ isFinal?: boolean } & ArrayLike<{ transcript: string }>> }) => void) | null;
        onerror: (() => void) | null;
        onend: (() => void) | null;
        start: () => void;
        stop: () => void;
      };
      webkitSpeechRecognition?: new () => {
        lang: string;
        interimResults: boolean;
        continuous: boolean;
        onresult: ((e: { results: ArrayLike<{ isFinal?: boolean } & ArrayLike<{ transcript: string }>> }) => void) | null;
        onerror: (() => void) | null;
        onend: (() => void) | null;
        start: () => void;
        stop: () => void;
      };
    };

    const SpeechRec = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (!SpeechRec) {
      alert('Trình duyệt chưa hỗ trợ Voice Chat trực tiếp. Bạn có thể dùng nút mic trên bàn phím điện thoại!');
      return;
    }

    const rec = new SpeechRec();
    rec.lang = 'vi-VN';
    rec.interimResults = true;
    rec.continuous = false;

    let latestTranscript = '';

    rec.onresult = (event) => {
      let transcript = '';
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      latestTranscript = transcript.trim();
      setInput(latestTranscript);
    };

    rec.onerror = () => {
      setListening(false);
    };

    rec.onend = () => {
      setListening(false);
      if (latestTranscript) {
        void submitText(latestTranscript, true);
      }
    };

    recognitionRef.current = rec;
    setListening(true);
    rec.start();
  }

  function handleAddMemorySubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!newMemory.trim()) return;
    onAddMemory(newMemory.trim());
    setNewMemory('');
  }

  return (
    <div className="flex flex-col space-y-3">
      {/* Top Chat Controls */}
      <div className="flex items-center justify-between rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-3 text-white shadow-md shadow-indigo-500/20">
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setShowMemories(!showMemories)}
            className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold backdrop-blur-sm active:scale-95 transition"
          >
            <Brain className="h-3.5 w-3.5" /> Bộ nhớ ({memories.length})
          </button>
          {!hasApiKey && (
            <button
              onClick={onOpenSettings}
              className="rounded-full bg-amber-400/90 px-2.5 py-1 text-[10px] font-bold text-slate-950"
            >
              Gắn Key AI
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => {
              if (voiceReplyEnabled && 'speechSynthesis' in window) {
                window.speechSynthesis.cancel();
              }
              onToggleVoiceReply();
            }}
            className={`rounded-full p-2 transition active:scale-90 ${
              voiceReplyEnabled ? 'bg-white text-indigo-600' : 'bg-white/15 text-white'
            }`}
            title={voiceReplyEnabled ? 'Đang bật đọc giọng nói' : 'Đang tắt đọc giọng nói'}
          >
            {voiceReplyEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </button>
          <button
            onClick={onClearChat}
            className="rounded-full bg-white/15 p-2 text-white transition active:scale-90"
            title="Xóa đoạn chat"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Memory Drawer */}
      {showMemories && (
        <div className="animate-pop rounded-2xl bg-white p-4 shadow-md ring-1 ring-indigo-500/20 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-900">
              Những gì AI đã nhớ về bạn
            </span>
            <button onClick={() => setShowMemories(false)} className="text-slate-400">
              <X className="h-4 w-4" />
            </button>
          </div>

          <form onSubmit={handleAddMemorySubmit} className="flex gap-2">
            <input
              value={newMemory}
              onChange={(e) => setNewMemory(e.target.value)}
              placeholder="Thêm thói quen/mục tiêu (VD: Tiết kiệm 5tr/tháng)"
              className="flex-1 rounded-xl bg-slate-50 px-3 py-1.5 text-xs text-slate-900 ring-1 ring-slate-200 outline-none"
            />
            <button
              type="submit"
              className="rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </form>

          {memories.length === 0 ? (
            <p className="text-[11px] text-slate-400">
              Chưa có ghi nhớ nào. Khi bạn trò chuyện, AI sẽ tự động lưu các thói quen của bạn vào đây!
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {memories.map((m) => (
                <span
                  key={m.id}
                  className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-medium text-indigo-800 ring-1 ring-indigo-200/70"
                >
                  {m.fact}
                  <button
                    onClick={() => onDeleteMemory(m.id)}
                    className="text-indigo-400 hover:text-rose-500"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Messages Area */}
      <div className="space-y-3 min-h-[320px] max-h-[52vh] overflow-y-auto pr-1 no-scrollbar">
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          return (
            <div
              key={msg.id}
              className={`animate-fade-up flex ${isUser ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed shadow-sm ${
                  isUser
                    ? 'bg-gradient-to-br from-indigo-600 to-violet-600 text-white rounded-br-sm'
                    : 'bg-white text-slate-800 ring-1 ring-slate-900/5 rounded-bl-sm'
                }`}
              >
                <div className="whitespace-pre-line">{msg.text}</div>
                {!isUser && (
                  <button
                    onClick={() => speakText(msg.text)}
                    className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-semibold text-indigo-600 opacity-80 hover:opacity-100"
                  >
                    <Volume2 className="h-3 w-3" /> Nghe
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {sending && (
          <div className="flex justify-start">
            <div className="rounded-2xl bg-white px-4 py-2.5 text-xs text-slate-400 ring-1 ring-slate-900/5">
              Đang suy nghĩ...
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Quick Prompt Chips */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
        {QUICK_PROMPTS.map((q) => (
          <button
            key={q}
            onClick={() => void submitText(q)}
            className="shrink-0 rounded-full bg-white px-3 py-1.5 text-[11px] font-medium text-slate-600 ring-1 ring-slate-900/8 transition hover:bg-indigo-50 hover:text-indigo-700 active:scale-95"
          >
            {q}
          </button>
        ))}
      </div>

      {/* Voice + Text Chat Input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submitText(input);
        }}
        className="flex items-center gap-2"
      >
        <button
          type="button"
          onClick={handleVoiceChat}
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl shadow-sm transition active:scale-90 ${
            listening
              ? 'animate-pulse bg-rose-500 text-white shadow-rose-500/30'
              : 'bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-indigo-500/25'
          }`}
          title="Nhấn để nói chuyện (Voice Chat)"
        >
          {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        </button>

        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={listening ? 'Đang nghe bạn nói...' : 'Hỏi hoặc tâm sự với trợ lý AI...'}
          className="flex-1 rounded-2xl bg-white px-3.5 py-2.5 text-[13px] text-slate-900 placeholder:text-slate-400 shadow-sm ring-1 ring-slate-900/8 outline-none focus:ring-2 focus:ring-indigo-500/50"
        />

        <button
          type="submit"
          disabled={sending || !input.trim()}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-sm transition active:scale-90 disabled:bg-slate-200 disabled:text-slate-400"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
