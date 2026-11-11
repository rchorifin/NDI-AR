import { SystemNotificationItem } from '../types';

type NotificationListener = (notification: SystemNotificationItem) => void;
const listeners: Set<NotificationListener> = new Set();

const NOTIFICATIONS_STORAGE_KEY = 'ndi_autorec_system_notifs_v1';

export function getStoredNotifications(): SystemNotificationItem[] {
  try {
    const raw = localStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveStoredNotifications(items: SystemNotificationItem[]): void {
  try {
    localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(items.slice(0, 50)));
  } catch (e) {
    console.error('Failed to save notifications', e);
  }
}

export function subscribeNotifications(callback: NotificationListener): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

// Synthesize pleasant broadcast studio chime via Web Audio API
export function playNotificationChime(type: 'recording' | 'success' | 'alert' | 'info' = 'info'): void {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    if (type === 'recording') {
      // 2-tone recording start cue (B5 -> E6)
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sine';
      osc2.type = 'sine';
      osc1.frequency.setValueAtTime(880, ctx.currentTime);
      osc2.frequency.setValueAtTime(1318.5, ctx.currentTime + 0.12);

      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(ctx.currentTime);
      osc1.stop(ctx.currentTime + 0.12);
      osc2.start(ctx.currentTime + 0.12);
      osc2.stop(ctx.currentTime + 0.35);
    } else if (type === 'success') {
      // Major triad success chime (C5 -> E5 -> G5)
      [523.25, 659.25, 783.99].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.1, ctx.currentTime + i * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.08 + 0.25);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + i * 0.08);
        osc.stop(ctx.currentTime + i * 0.08 + 0.25);
      });
    } else if (type === 'alert') {
      // Warning double pip
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(600, ctx.currentTime);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.2);
    }
  } catch {
    // Ignore audio autoplay restrictions
  }
}

export async function requestSystemNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied';
  }
  try {
    return await Notification.requestPermission();
  } catch {
    return 'denied';
  }
}

export function isSystemNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function getSystemNotificationPermission(): NotificationPermission {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied';
  }
  return Notification.permission;
}

export function sendSystemNotification(params: {
  title: string;
  message: string;
  type?: 'info' | 'success' | 'warning' | 'error' | 'recording';
  sound?: boolean;
}): SystemNotificationItem {
  const { title, message, type = 'info', sound = true } = params;
  const id = `notif_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const item: SystemNotificationItem = {
    id,
    title,
    message,
    type,
    timestamp: new Date().toISOString(),
    read: false,
  };

  // Play audio cue
  if (sound) {
    if (type === 'recording') playNotificationChime('recording');
    else if (type === 'success') playNotificationChime('success');
    else if (type === 'warning' || type === 'error') playNotificationChime('alert');
  }

  // Trigger real OS system notification if permitted
  if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(title, {
        body: message,
        icon: '/icon.svg',
        tag: `ndi-record-${type}`,
        badge: '/icon.svg',
      });
    } catch (err) {
      console.warn('Native notification failed:', err);
    }
  }

  // Save to stored notification drawer
  const current = getStoredNotifications();
  const updated = [item, ...current].slice(0, 50);
  saveStoredNotifications(updated);

  // Notify active UI listeners
  listeners.forEach((listener) => {
    try {
      listener(item);
    } catch (e) {
      console.error(e);
    }
  });

  return item;
}
