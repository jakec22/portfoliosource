import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { ReminderPrefs, ReminderKey, ReminderTime } from '../types';

// Notification copy per reminder. The trigger time comes from the user's saved
// prefs (editable in settings); these defaults are only a fallback.
const COPY: Record<ReminderKey, { title: string; body: string; fallback: ReminderTime }> = {
  breakfast: {
    title: 'Good morning 🍳',
    body: 'Log your breakfast to start the day on track.',
    fallback: { hour: 9, minute: 0 },
  },
  lunch: {
    title: 'Lunchtime 🥗',
    body: "Don't forget to log your lunch.",
    fallback: { hour: 13, minute: 0 },
  },
  dinner: {
    title: 'Dinner time 🍽️',
    body: 'Tap to log your dinner before you forget.',
    fallback: { hour: 19, minute: 0 },
  },
  streak: {
    title: 'Keep your streak alive 🔥',
    body: 'Log today before the day ends to keep your streak going.',
    fallback: { hour: 20, minute: 30 },
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

  const keys: ReminderKey[] = ['breakfast', 'lunch', 'dinner', 'streak'];
  for (const key of keys) {
    if (!prefs[key]) continue;
    const { title, body, fallback } = COPY[key];
    const { hour, minute } = prefs.times?.[key] ?? fallback;
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
