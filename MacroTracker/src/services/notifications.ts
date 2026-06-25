import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { ReminderSettings } from '../types';

const CHANNEL_ID = 'holymacro-reminders';

// expo-notifications is a native module. If the app binary was built before it
// was added (i.e. the user hasn't rebuilt the dev client / done a new prebuild),
// the native module is absent and any call into it throws. We must never let
// that crash the app — the JS-only features (streak, summary) and the reminders
// UI should still render, with scheduling simply no-op'ing until a rebuild.
// `available` is detected lazily on first use and cached.
let available: boolean | null = null;

function nativeReady(): boolean {
  if (available !== null) return available;
  try {
    // Touching a native-backed enum throws if the module isn't linked.
    available = Platform.OS !== 'web' && !!Notifications.AndroidImportance;
  } catch {
    available = false;
  }
  return available;
}

// Call once at app startup, before the navigation tree renders.
export function configureNotificationHandler() {
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  } catch (e) {
    available = false;
    console.warn('[notifications] native module unavailable — reminders disabled until rebuild');
  }
}

async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'HolyMacro Reminders',
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#10B981',
  });
}

export async function requestNotificationPermissions(): Promise<boolean> {
  if (!nativeReady()) return false;
  try {
    const { status: current } = await Notifications.getPermissionsAsync();
    if (current === 'granted') return true;
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
}

export async function getNotificationPermissionStatus(): Promise<
  'granted' | 'denied' | 'undetermined'
> {
  if (!nativeReady()) return 'denied';
  try {
    const { status } = await Notifications.getPermissionsAsync();
    return status as 'granted' | 'denied' | 'undetermined';
  } catch {
    return 'denied';
  }
}

type ReminderKey = 'breakfast' | 'lunch' | 'dinner' | 'weighIn' | 'evening';

const REMINDER_IDS: Record<ReminderKey, string> = {
  breakfast: 'holymacro-breakfast',
  lunch:     'holymacro-lunch',
  dinner:    'holymacro-dinner',
  weighIn:   'holymacro-weighin',
  evening:   'holymacro-evening',
};

const REMINDER_CONTENT: Record<ReminderKey, { title: string; body: string }> = {
  breakfast: { title: '🥣 Breakfast time!',   body: "Don't forget to log your breakfast." },
  lunch:     { title: '🥗 Lunch check-in!',   body: "How's your nutrition looking today?" },
  dinner:    { title: '🍽️ Dinner reminder!',  body: 'Log your dinner to stay on track.' },
  weighIn:   { title: '⚖️ Daily weigh-in',    body: 'Step on the scale and log your weight in HolyMacro.' },
  evening:   { title: '📊 Daily summary',     body: 'Review your nutrition & streak for the day.' },
};

function parseTime(timeStr: string): { hour: number; minute: number } {
  const [h, m] = timeStr.split(':').map(Number);
  return { hour: Number.isFinite(h) ? h : 8, minute: Number.isFinite(m) ? m : 0 };
}

async function scheduleReminder(key: ReminderKey, timeStr: string) {
  await Notifications.cancelScheduledNotificationAsync(REMINDER_IDS[key]).catch(() => {});
  const { hour, minute } = parseTime(timeStr);
  const content = REMINDER_CONTENT[key];
  await Notifications.scheduleNotificationAsync({
    identifier: REMINDER_IDS[key],
    content: {
      title: content.title,
      body: content.body,
      sound: true,
      ...(Platform.OS === 'android' ? { android: { channelId: CHANNEL_ID } } : {}),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    },
  });
}

async function cancelReminder(key: ReminderKey) {
  await Notifications.cancelScheduledNotificationAsync(REMINDER_IDS[key]).catch(() => {});
}

/**
 * Applies the full reminder settings: cancels disabled reminders,
 * schedules or reschedules enabled ones. No-ops if permission not granted.
 */
export async function applyReminderSettings(settings: ReminderSettings): Promise<void> {
  if (!nativeReady()) return;
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return;
    await ensureAndroidChannel();

    const slots: [ReminderKey, boolean, string][] = [
      ['breakfast', settings.breakfastEnabled, settings.breakfastTime],
      ['lunch',     settings.lunchEnabled,     settings.lunchTime],
      ['dinner',    settings.dinnerEnabled,    settings.dinnerTime],
      ['weighIn',   settings.weighInEnabled,   settings.weighInTime],
      ['evening',   settings.eveningEnabled,   settings.eveningTime],
    ];

    await Promise.all(
      slots.map(([key, enabled, time]) =>
        enabled ? scheduleReminder(key, time) : cancelReminder(key)
      )
    );
  } catch (e) {
    console.warn('[notifications] applyReminderSettings failed:', e);
  }
}

/** Cancel every HolyMacro scheduled notification (e.g. on sign-out). */
export async function cancelAllReminders(): Promise<void> {
  if (!nativeReady()) return;
  try {
    await Promise.all(
      Object.values(REMINDER_IDS).map((id) =>
        Notifications.cancelScheduledNotificationAsync(id).catch(() => {})
      )
    );
  } catch {
    /* native module absent — nothing scheduled to cancel */
  }
}
