import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { ReminderPrefs, ReminderKey, ReminderTime } from '../types';

// Notification copy per reminder. The trigger time comes from the user's saved
// prefs (editable in settings); these defaults are only a fallback.
const COPY: Record<ReminderKey, { title: string; body: string; fallback: ReminderTime }> = {
  breakfast: {
    title: 'Good morning',
    body: 'Log your breakfast to start the day on track.',
    fallback: { hour: 9, minute: 0 },
  },
  lunch: {
    title: 'Lunchtime',
    body: "Don't forget to log your lunch.",
    fallback: { hour: 13, minute: 0 },
  },
  dinner: {
    title: 'Dinner time',
    body: 'Tap to log your dinner before you forget.',
    fallback: { hour: 19, minute: 0 },
  },
  streak: {
    title: 'Keep your streak alive',
    body: 'Log today before the day ends to keep your streak going.',
    fallback: { hour: 20, minute: 30 },
  },
};

/**
 * The one notification in the app that is an alarm rather than a nudge.
 *
 * A fixed identifier, because there is only ever one running session and
 * because the reminder schedule below has to be able to tell it apart from
 * its own.
 */
const RECOVERY_ALERT_ID = 'recovery-target';
const RECOVERY_KIND = 'recoveryTarget';

// Show an alert + badge even when the app is foregrounded.
export function configureNotificationHandler() {
  Notifications.setNotificationHandler({
    handleNotification: async (n) => {
      // Reminders stay silent: they arrive at mealtimes, unasked, and a
      // sound on those is the difference between a helpful app and one that
      // gets its notifications switched off. The recovery alert is the
      // opposite — it only exists because the user set a timer and asked to
      // be told, and it has to carry from a bench or a tub.
      const isAlarm = n.request.content.data?.kind === RECOVERY_KIND;
      return {
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: isAlarm,
        shouldSetBadge: false,
      };
    },
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

/**
 * A separate channel from the reminders, at HIGH importance and with sound.
 *
 * Android channels are the user's controls, not ours: whatever they do to
 * "Reminders" they can leave this alone, which matters when the two are a
 * mealtime nudge and a timer you asked to be woken by. The settings are also
 * fixed at creation — Android ignores changes to an existing channel — so
 * this can never be quietly downgraded by a later build either.
 */
async function ensureRecoveryChannel() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('recovery', {
      name: 'Timers',
      importance: Notifications.AndroidImportance.HIGH,
      // No `sound` key on purpose. On a channel the field is a filename, not
      // a mode: omitting it selects the system default, null means silence,
      // and 'default' would send Android looking for a file of that name and
      // come back with a channel that makes no sound at all.
      vibrationPattern: [0, 400, 250, 400, 250, 400],
    });
  }
}

/**
 * Sound the phone when a sauna or plunge reaches its target.
 *
 * Scheduled with the OS rather than fired from a timer in the app, which is
 * the whole point: a JS interval stops the moment the phone locks or the app
 * goes to the background, and that is exactly where a phone spends a sauna.
 * The buzz the timer screen already plays only lands if you are holding the
 * phone and watching it — this fires whether the app is open, backgrounded,
 * locked or killed.
 *
 * Sound is 'default', so it rides the user's ringer and silent switch rather
 * than overriding them. A sauna is a shared room.
 *
 * Silently does nothing without permission, which leaves the screen's
 * vibration as the alert exactly as before. Asking here is deliberate: it is
 * the first moment in the app where a notification is something the user has
 * actively asked for, rather than something being offered to them.
 */
export async function scheduleRecoveryAlert(
  label: string,
  secondsFromNow: number
): Promise<void> {
  await cancelRecoveryAlert();
  // A target already passed, or a session restored past its end: nothing to
  // schedule, and a non-positive interval is rejected by the trigger anyway.
  if (!(secondsFromNow > 0)) return;
  if (!(await requestNotificationPermission())) return;
  await ensureRecoveryChannel();

  await Notifications.scheduleNotificationAsync({
    identifier: RECOVERY_ALERT_ID,
    content: {
      title: `${label} — time`,
      body: "You've hit your target. Open the app to save the session.",
      sound: 'default',
      data: { kind: RECOVERY_KIND },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: Math.round(secondsFromNow),
      ...(Platform.OS === 'android' ? { channelId: 'recovery' } : {}),
    },
  });
}

/** Drop the pending alert. A no-op once it has fired, or if none was set. */
export async function cancelRecoveryAlert(): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(RECOVERY_ALERT_ID);
  } catch {
    // Nothing scheduled under that id. Not worth distinguishing from success.
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
  // Everything except the recovery alert, where this used to cancel all.
  //
  // That was safe while reminders were the only scheduled thing in the app.
  // It is not any more: this runs on every launch, a sauna survives the app
  // being killed and relaunched, and cancelAll would have taken the timer's
  // alarm down with the reminders — leaving someone sitting in the heat
  // waiting for a sound that had been quietly unscheduled.
  //
  // Enumerated rather than cancelled by a known set of ids, because
  // reminders scheduled by earlier builds carry generated ids that no list
  // here would name, and those have to keep being cleared or they double up.
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const n of scheduled) {
    if (n.identifier === RECOVERY_ALERT_ID) continue;
    await Notifications.cancelScheduledNotificationAsync(n.identifier);
  }

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
