import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import type { CalendarNote } from '../types';

function hashToInt(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % 2_000_000_000;
}

export async function requestNotificationPermission(): Promise<boolean> {
  try {
    if (Capacitor.isNativePlatform()) {
      const perm = await LocalNotifications.requestPermissions();
      return perm.display === 'granted';
    }
    if ('Notification' in window) {
      if (Notification.permission === 'granted') return true;
      const res = await Notification.requestPermission();
      return res === 'granted';
    }
  } catch {
    return false;
  }
  return false;
}

export async function scheduleNoteReminder(note: CalendarNote): Promise<void> {
  if (!note.remind || note.done) return;
  const timeStr = note.time || '08:30';
  const target = new Date(`${note.date}T${timeStr}:00`);
  if (Number.isNaN(target.getTime()) || target.getTime() <= Date.now()) return;

  try {
    if (Capacitor.isNativePlatform()) {
      const id = hashToInt(note.id);
      await LocalNotifications.schedule({
        notifications: [
          {
            id,
            title: note.tag === 'bill' ? `💸 Nhắc thanh toán: ${note.title}` : `📅 Nhắc lịch: ${note.title}`,
            body: note.content || `Lúc ${timeStr} ngày ${note.date}`,
            schedule: { at: target },
            sound: undefined,
            smallIcon: 'ic_stat_icon_config_sample',
          },
        ],
      });
    }
  } catch {
    // Ignore on web/unsupported environments
  }
}

export async function cancelNoteReminder(noteId: string): Promise<void> {
  try {
    if (Capacitor.isNativePlatform()) {
      await LocalNotifications.cancel({
        notifications: [{ id: hashToInt(noteId) }],
      });
    }
  } catch {
    // Ignore
  }
}

export async function sendImmediateAlert(title: string, body: string): Promise<void> {
  try {
    if (Capacitor.isNativePlatform()) {
      await LocalNotifications.schedule({
        notifications: [
          {
            id: Math.floor(Math.random() * 1_000_000),
            title,
            body,
            schedule: { at: new Date(Date.now() + 500) },
          },
        ],
      });
      return;
    }
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body });
    }
  } catch {
    // Ignore
  }
}
