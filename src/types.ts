export type AccountType =
  | 'cash'
  | 'bank'
  | 'ewallet'
  | 'savings'
  | 'investment'
  | 'debt';

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  balance: number;
  color: string;
}

export type TransactionType = 'expense' | 'income' | 'transfer';

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  category: string;
  note: string;
  accountId: string;
  toAccountId?: string;
  date: string; // YYYY-MM-DD
  createdAt: number;
}

export interface BudgetConfig {
  monthlyLimit: number;
  alertThresholdPercent: number; // e.g., 80
  categoryLimits: Record<string, number>;
}

export type NoteTag = 'schedule' | 'note' | 'bill';

export interface CalendarNote {
  id: string;
  title: string;
  content: string;
  date: string; // YYYY-MM-DD
  time?: string; // HH:mm
  remind: boolean;
  done: boolean;
  tag: NoteTag;
  createdAt: number;
}

export interface AppSettings {
  geminiApiKey: string;
  privacyMode: boolean;
  notificationsEnabled: boolean;
  voiceReplyEnabled: boolean;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  createdAt: number;
}

export interface UserMemoryItem {
  id: string;
  fact: string;
  createdAt: number;
}

export interface AlertItem {
  id: string;
  level: 'danger' | 'warning' | 'info';
  title: string;
  message: string;
}

export interface AppState {
  accounts: Account[];
  transactions: Transaction[];
  budget: BudgetConfig;
  notes: CalendarNote[];
  settings: AppSettings;
  chatMessages: ChatMessage[];
  memories: UserMemoryItem[];
}
