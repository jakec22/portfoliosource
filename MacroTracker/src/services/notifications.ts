import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { ReminderPrefs } from '../types';

// Default times for each daily reminder (24h local time). Times are fixed in
// v1; the per-reminder on/off toggles live in settings. Customizable times are
// a natural follow-up.
const SCHEDULE: Record<
  keyof Omit<ReminderPrefs, 'enabled'>,
  { hour: number; minute: number; title: string; body: string }
> = {
  breakfast: {
    hour: 9,
    minute: 0,
    title: 'Good morning 🍳',
    body: 'Log your breakfast to start the day on track.',
  },
  lunch: {
    hour: 13,
    minute: 0,
    title: 'Lunchtime 🥗',
    body: "Don't forget to log your lunch.",
  },
  dinner: {
    hour: 19,
    minute: 0,
    title: 'Dinner time 🍽️',
    body: 'Tap to log your dinner before you forget.',
  },
  streak: {
    hour: 20,
    minute: 30,
    title: 'Keep your streak alive 🔥',
    body: 'Log today before the day ends to keep your streak going.',
  },
};

// Show an alert + badge even when the app is foregrounded.
export function configureNotificationHandler() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

async function ensureAndroidChannel() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('reminders', {
      name: 'Reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
}

/** Ask for notification permission. Returns true if granted. */
export async function requestNotificationPermission(): Promise<boolean> {
  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;
  if (status !== 'granted') {
    const req = await Notifications.requestPermissionsAsync();
    status = req.status;
  }
  return status === 'granted';
}

/**
 * Reconcile scheduled notifications with the user's preferences. Cancels every
 * existing reminder and reschedules the enabled ones as repeating daily
 * triggers. Safe to call on launch and after any settings change.
 */
export async function applyReminderSchedule(prefs: ReminderPrefs): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (!prefs.enabled) return;

  await ensureAndroidChannel();

  const keys = ['breakfast', 'lunch', 'dinner', 'streak'] as const;
  for (const key of keys) {
    if (!prefs[key]) continue;
    const { hour, minute, title, body } = SCHEDULE[key];
    await Notifications.scheduleNotificationAsync({
      content: { title, body },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
        ...(Platform.OS === 'android' ? { channelId: 'reminders' } : {}),
      },
    });
  }
}
