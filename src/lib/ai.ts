import type { Account, AppState, CalendarNote, TransactionType } from '../types';
import { formatVND, todayISO } from './format';

export interface ParsedQuickResult {
  transactions: Array<{
    type: TransactionType;
    amount: number;
    category: string;
    note: string;
    accountNameHint: string;
    toAccountNameHint?: string;
    date: string;
  }>;
  notes: Array<{
    title: string;
    content: string;
    date: string;
    time?: string;
    tag: 'schedule' | 'note' | 'bill';
    remind: boolean;
  }>;
  usedAI: boolean;
}

const EXPENSE_CATEGORIES = [
  'Ăn uống',
  'Di chuyển',
  'Mua sắm',
  'Hóa đơn',
  'Giải trí',
  'Sức khỏe',
  'Học tập',
  'Khác',
];

function guessCategory(text: string): string {
  const t = text.toLowerCase();
  if (/(ăn|uống|cơm|phở|bún|trà sữa|cf|cafe|cà phê|nhậu|siêu thị|đồ ăn|bánh)/.test(t)) return 'Ăn uống';
  if (/(xăng|grab|be|xanh sm|taxi|gửi xe|vé xe|đổ xăng|đi lại)/.test(t)) return 'Di chuyển';
  if (/(điện|nước|internet|wifi|mạng|4g|tiền nhà|thuê nhà|bill)/.test(t)) return 'Hóa đơn';
  if (/(thuốc|khám|bệnh viện|gym|thể thao|bác sĩ)/.test(t)) return 'Sức khỏe';
  if (/(sách|khóa học|học|ielts|udemy)/.test(t)) return 'Học tập';
  if (/(phim|game|netflix|spotify|du lịch|chơi)/.test(t)) return 'Giải trí';
  if (/(mua|áo|quần|giày|shopee|lazada|tiki|đồ)/.test(t)) return 'Mua sắm';
  return 'Khác';
}

function parseVietnameseAmount(raw: string): number | null {
  const m = raw.toLowerCase().match(/(\d+(?:[.,]\d+)?)\s*(tr|triệu|trieu|m|k|nghin|nghìn|đ|d|vnd)?\b/);
  if (!m) return null;
  const num = parseFloat(m[1].replace(',', '.'));
  const unit = m[2] || '';
  if (/(tr|triệu|trieu|m)/.test(unit)) return Math.round(num * 1_000_000);
  if (/(k|nghin|nghìn)/.test(unit)) return Math.round(num * 1_000);
  if (num < 1000 && !unit) return Math.round(num * 1_000);
  return Math.round(num);
}

export function offlineParseQuickInput(input: string, accounts: Account[]): ParsedQuickResult {
  const segments = input
    .split(/[,;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const result: ParsedQuickResult = {
    transactions: [],
    notes: [],
    usedAI: false,
  };

  const today = todayISO();
  const tomorrowDate = new Date();
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrow = tomorrowDate.toISOString().slice(0, 10);

  for (const seg of segments) {
    const lower = seg.toLowerCase();
    const isSchedule = /(nhắc|lịch|họp|hẹn|mai|ngày mai|lúc \d+h|\d{1,2}:\d{2}|note|ghi chú)/.test(lower);
    const amount = parseVietnameseAmount(seg);

    if (amount && !/(lúc \d+h)/.test(lower.replace(/(\d+(?:[.,]\d+)?)\s*(k|tr|triệu|m)/g, ''))) {
      const isIncome = /(lương|thưởng|thu|nhận|về|bán|hoàn tiền)/.test(lower);
      const isTransfer = /(chuyển|rút|nạp)/.test(lower) && /(sang|qua|vào)/.test(lower);

      const matchedAcc = accounts.find((a) => lower.includes(a.name.toLowerCase()));
      result.transactions.push({
        type: isTransfer ? 'transfer' : isIncome ? 'income' : 'expense',
        amount,
        category: isIncome ? 'Thu nhập' : isTransfer ? 'Chuyển khoản' : guessCategory(seg),
        note: seg,
        accountNameHint: matchedAcc?.name || accounts[0]?.name || 'Tiền mặt',
        date: lower.includes('hôm qua')
          ? new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)
          : today,
      });
    } else if (isSchedule || !amount) {
      const timeMatch = lower.match(/(\d{1,2})\s*(?:h|:)\s*(\d{2})?/);
      let time: string | undefined;
      if (timeMatch) {
        const hh = String(Math.min(23, Number(timeMatch[1]))).padStart(2, '0');
        const mm = String(Math.min(59, Number(timeMatch[2] || '0'))).padStart(2, '0');
        time = `${hh}:${mm}`;
      }
      result.notes.push({
        title: seg,
        content: '',
        date: lower.includes('mai') ? tomorrow : today,
        time,
        tag: /(tiền|đóng|bill|trả|nợ)/.test(lower) ? 'bill' : time ? 'schedule' : 'note',
        remind: Boolean(time),
      });
    }
  }

  return result;
}

let cachedWorkingModel: string | null = null;

async function discoverAvailableModels(apiKey: string): Promise<string[]> {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey.trim())}`
    );
    if (!res.ok) return [];
    const data = await res.json();
    const list: Array<{ name: string; supportedGenerationMethods?: string[] }> = data?.models || [];
    const valid = list
      .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
      .map((m) => m.name.replace(/^models\//, ''))
      .filter((name) => name.includes('gemini'));

    // Prioritize flash models first, then pro
    return valid.sort((a, b) => {
      const aFlash = a.includes('flash') ? 0 : 1;
      const bFlash = b.includes('flash') ? 0 : 1;
      return aFlash - bFlash;
    });
  } catch {
    return [];
  }
}

async function tryModel(
  apiKey: string,
  model: string,
  prompt: string,
  jsonMode: boolean,
  temperature: number
): Promise<{ ok: true; text: string } | { ok: false; status: number; message: string }> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(
      apiKey.trim()
    )}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          ...(jsonMode ? { responseMimeType: 'application/json' } : {}),
          temperature,
        },
      }),
    }
  );

  if (!res.ok) {
    const errJson = await res.json().catch(() => null);
    return {
      ok: false,
      status: res.status,
      message: errJson?.error?.message || `HTTP ${res.status}`,
    };
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) return { ok: false, status: 200, message: 'Không có nội dung trả về' };
  return { ok: true, text };
}

async function callGemini(apiKey: string, prompt: string, jsonMode = false, temperature = 0.7): Promise<string> {
  const initialModels = cachedWorkingModel
    ? [cachedWorkingModel]
    : ['gemini-2.5-flash', 'gemini-2.0-flash'];

  let lastError = 'Lỗi kết nối Gemini API';

  for (const model of initialModels) {
    const attempt = await tryModel(apiKey, model, prompt, jsonMode, temperature);
    if (attempt.ok) {
      cachedWorkingModel = model;
      return attempt.text;
    }
    lastError = `${model}: ${attempt.message}`;
    if (attempt.status === 400 || attempt.status === 401 || attempt.status === 403) {
      throw new Error(`Không gọi được Gemini (${lastError})`);
    }
  }

  // Fallback: dynamically query ListModels for this exact API key
  const discovered = await discoverAvailableModels(apiKey);
  for (const model of discovered) {
    if (initialModels.includes(model)) continue;
    const attempt = await tryModel(apiKey, model, prompt, jsonMode, temperature);
    if (attempt.ok) {
      cachedWorkingModel = model;
      return attempt.text;
    }
    lastError = `${model}: ${attempt.message}`;
  }

  throw new Error(`Không gọi được Gemini (${lastError})`);
}

export async function parseQuickInputWithAI(
  input: string,
  accounts: Account[],
  apiKey: string
): Promise<ParsedQuickResult> {
  if (!apiKey.trim()) {
    return offlineParseQuickInput(input, accounts);
  }

  const today = todayISO();
  const accountNames = accounts.map((a) => `${a.name} (${a.type})`).join(', ');

  const prompt = `Bạn là trợ lý phân tích câu nhập nhanh tài chính & lịch cá nhân tiếng Việt.
Hôm nay là ${today}.
Danh sách tài khoản/ví của người dùng: ${accountNames}.
Danh mục chi tiêu hợp lệ: ${EXPENSE_CATEGORIES.join(', ')}.

Hãy phân tích câu sau thành JSON thuần (không markdown, không giải thích):
"${input}"

Schema JSON:
{
  "transactions": [
    {
      "type": "expense" | "income" | "transfer",
      "amount": number,
      "category": string,
      "note": string,
      "accountNameHint": string,
      "toAccountNameHint": string,
      "date": "YYYY-MM-DD"
    }
  ],
  "notes": [
    {
      "title": string,
      "content": string,
      "date": "YYYY-MM-DD",
      "time": "HH:mm",
      "tag": "schedule" | "note" | "bill",
      "remind": boolean
    }
  ]
}`;

  try {
    const text = await callGemini(apiKey, prompt, true, 0.1);
    const parsed = JSON.parse(text);
    return {
      transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [],
      notes: Array.isArray(parsed.notes) ? parsed.notes : [],
      usedAI: true,
    };
  } catch {
    return offlineParseQuickInput(input, accounts);
  }
}

export async function analyzeFinancesWithAI(state: AppState): Promise<string> {
  const apiKey = state.settings.geminiApiKey.trim();
  const month = todayISO().slice(0, 7);
  const monthTx = state.transactions.filter((t) => t.date.startsWith(month));

  const totalExpense = monthTx
    .filter((t) => t.type === 'expense')
    .reduce((s, t) => s + t.amount, 0);
  const totalIncome = monthTx
    .filter((t) => t.type === 'income')
    .reduce((s, t) => s + t.amount, 0);

  const byCat: Record<string, number> = {};
  for (const t of monthTx) {
    if (t.type === 'expense') {
      byCat[t.category] = (byCat[t.category] || 0) + t.amount;
    }
  }

  const netWorth = state.accounts.reduce(
    (s, a) => (a.type === 'debt' ? s - a.balance : s + a.balance),
    0
  );

  const upcomingNotes: CalendarNote[] = state.notes.filter((n) => !n.done).slice(0, 5);

  if (!apiKey) {
    const topCat = Object.entries(byCat).sort((a, b) => b[1] - a[1])[0];
    const ratio = state.budget.monthlyLimit > 0 ? Math.round((totalExpense / state.budget.monthlyLimit) * 100) : 0;
    return [
      `📊 **Tóm tắt nhanh (Chế độ Offline — chưa gắn Gemini API Key):**`,
      `• Tài sản ròng hiện tại: **${formatVND(netWorth)}**`,
      `• Tháng ${month}: Thu **${formatVND(totalIncome)}** | Chi **${formatVND(totalExpense)}** (${ratio}% ngân sách).`,
      topCat
        ? `• Danh mục ngốn tiền nhất: **${topCat[0]}** (${formatVND(topCat[1])}).`
        : `• Chưa có khoản chi nào trong tháng này.`,
      upcomingNotes.length > 0
        ? `• Bạn đang có **${upcomingNotes.length} ghi chú/lịch** chưa hoàn thành.`
        : `• Lịch & ghi chú đang trống.`,
      `\n💡 *Mẹo: Vào tab Cài đặt dán Gemini API Key miễn phí để AI phân tích sâu & nhập liệu tự nhiên thông minh hơn!*`,
    ].join('\n');
  }

  const summaryPrompt = `Bạn là cố vấn tài chính cá nhân thông minh, nói chuyện thẳng thắn, thực tế bằng tiếng Việt.
Dữ liệu hiện tại (${todayISO()}):
- Tổng tài sản ròng: ${formatVND(netWorth)}
- Chi tiết tài khoản: ${state.accounts.map((a) => `${a.name} (${a.type}): ${formatVND(a.balance)}`).join('; ')}
- Tháng ${month}: Thu ${formatVND(totalIncome)}, Chi ${formatVND(totalExpense)}, Ngân sách đặt ra ${formatVND(state.budget.monthlyLimit)}
- Chi theo danh mục: ${Object.entries(byCat)
    .map(([k, v]) => `${k}: ${formatVND(v)}`)
    .join(', ') || 'Chưa có'}
- Lịch / Hóa đơn sắp tới: ${upcomingNotes.map((n) => `${n.date} ${n.time || ''}: ${n.title}`).join('; ') || 'Không có'}

Hãy trả lời ngắn gọn trong 4-5 gạch đầu dòng:
1. Đánh giá sức khỏe tài sản & tốc độ tiêu tiền tháng này.
2. Cảnh báo rủi ro (nếu sắp lố ngân sách, nợ cao, hoặc tập trung quá nhiều vào 1 khoản).
3. Gợi ý 1-2 hành động cụ thể tuần này để tối ưu tiền bạc.`;

  return await callGemini(apiKey, summaryPrompt, false, 0.6);
}

export interface ChatResponse {
  reply: string;
  newMemories: string[];
}

export async function chatWithPersonalAI(
  userMessage: string,
  state: AppState
): Promise<ChatResponse> {
  const apiKey = state.settings.geminiApiKey.trim();
  const today = todayISO();
  const month = today.slice(0, 7);

  const netWorth = state.accounts.reduce(
    (s, a) => (a.type === 'debt' ? s - a.balance : s + a.balance),
    0
  );
  const monthTx = state.transactions.filter((t) => t.date.startsWith(month));
  const monthExpense = monthTx
    .filter((t) => t.type === 'expense')
    .reduce((s, t) => s + t.amount, 0);
  const monthIncome = monthTx
    .filter((t) => t.type === 'income')
    .reduce((s, t) => s + t.amount, 0);

  if (!apiKey) {
    const dueCount = state.notes.filter((n) => !n.done && n.date <= today).length;
    return {
      reply: `Hiện bạn chưa gắn Gemini API Key nên mình trả lời nhanh từ dữ liệu máy:\n• Tài sản ròng: ${formatVND(
        netWorth
      )}\n• Tháng ${month}: Thu ${formatVND(monthIncome)}, Chi ${formatVND(
        monthExpense
      )}\n• Việc/lịch hôm nay: ${dueCount} mục.\n\nVào ⚙️ Cài đặt dán Gemini API Key miễn phí để trò chuyện tự nhiên & ghi nhớ thói quen nhé!`,
      newMemories: [],
    };
  }

  const recentTxText = state.transactions
    .slice(0, 15)
    .map((t) => `[${t.date}] ${t.type}: ${formatVND(t.amount)} (${t.category}) - ${t.note}`)
    .join('\n');

  const notesText = state.notes
    .filter((n) => !n.done)
    .slice(0, 10)
    .map((n) => `[${n.date} ${n.time || ''}] (${n.tag}) ${n.title}${n.content ? `: ${n.content}` : ''}`)
    .join('\n');

  const memoriesText = state.memories.length
    ? state.memories.map((m) => `- ${m.fact}`).join('\n')
    : 'Chưa có ghi nhớ nào.';

  const historyText = state.chatMessages
    .slice(-10)
    .map((m) => `${m.role === 'user' ? 'Người dùng' : 'Trợ lý'}: ${m.text}`)
    .join('\n');

  const systemPrompt = `Bạn là người bạn đồng hành và trợ lý AI cá nhân cực kỳ tâm lý, hài hước, hiểu biết rộng, nói tiếng Việt tự nhiên (xưng "mình", gọi "bạn"). Bạn có thể trò chuyện, tâm sự mọi chủ đề trên trời dưới biển (cuộc sống, công việc, tình cảm, ý tưởng, giải trí...) — chỉ nhắc đến dữ liệu tài chính hay lịch hẹn bên dưới khi người dùng hỏi hoặc thật sự liên quan, không gượng ép. Trả lời tự nhiên, vừa phải để nghe bằng giọng nói cũng mượt.
Hôm nay là ${today}.

[BỘ NHỚ DÀI HẠN VỀ THÓI QUEN & SỞ THÍCH CỦA NGƯỜI DÙNG]
${memoriesText}

[DỮ LIỆU TÀI CHÍNH HIỆN TẠI]
- Tài sản ròng: ${formatVND(netWorth)}
- Các ví: ${state.accounts.map((a) => `${a.name}: ${formatVND(a.balance)}`).join(', ')}
- Tháng ${month}: Thu ${formatVND(monthIncome)}, Chi ${formatVND(monthExpense)}, Ngân sách ${formatVND(state.budget.monthlyLimit)}
- 15 giao dịch gần nhất:
${recentTxText || 'Chưa có'}

[LỊCH & GHI CHÚ CHƯA XONG]
${notesText || 'Trống'}

[LỊCH SỬ TRÒ CHUYỆN GẦN ĐÂY]
${historyText}

Người dùng vừa nói: "${userMessage}"

Hãy trả về JSON thuần (không markdown):
{
  "reply": "Câu trả lời tự nhiên, ngắn gọn, có thể dựa vào bộ nhớ thói quen và dữ liệu tài chính/lịch ở trên.",
  "newMemories": ["Mỗi phần tử là 1 thói quen, sở thích, mục tiêu, hoặc thông tin cá nhân mới mà người dùng vừa tiết lộ (nếu có). Nếu không có gì mới thì để mảng rỗng []"]
}`;

  const rawText = await callGemini(apiKey, systemPrompt, true, 0.7);

  try {
    const parsed = JSON.parse(rawText);
    return {
      reply: typeof parsed.reply === 'string' ? parsed.reply : rawText,
      newMemories: Array.isArray(parsed.newMemories)
        ? parsed.newMemories.filter((x: unknown): x is string => typeof x === 'string')
        : [],
    };
  } catch {
    return { reply: rawText, newMemories: [] };
  }
}
