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
 * Fixed identifiers, because there is only ever one running session and
 * because the reminder schedule below has to be able to tell these apart
 * from its own.
 *
 * There are several of them because a notification is not an alarm. iOS
 * plays a notification's sound once and then stops — there is no "ring
 * until dismissed" for anything but the Clock app, which holds entitlements
 * no third-party app is given. So the ring is faked the only way it can be:
 * a short series, each one a fresh notification, with the rest cancelled the
 * moment the user shows up (see cancelRecoveryAlert and useRecoveryAlert).
 *
 * One a minute, matching the wrist. The watch plays its target pulses and
 * then a single tap for each minute you stay in past the target; the phone
 * was repeating every 30 seconds, so a session run with both devices
 * alerted twice as often from the pocket as from the arm, and the two read
 * as two different timers disagreeing rather than one being echoed.
 *
 * A minute is also about right on its own. The sound is a half-second ding
 * rather than a ringtone, so one of them is genuinely easy to sleep
 * through and the repeats are what make the alert carry — but by the time
 * four have gone unanswered, more is nagging rather than alerting.
 *
 * These two numbers are the first to turn down if it still does.
 */
const RECOVERY_ALERT_IDS = [0, 1, 2, 3].map((i) => `recovery-target-${i}`);
const RECOVERY_REPEAT_GAP = 60;
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

  const at = Math.round(secondsFromNow);
  for (const [i, identifier] of RECOVERY_ALERT_IDS.entries()) {
    await Notifications.scheduleNotificationAsync({
      identifier,
      content: {
        title: `${label} — time`,
        body: "You've hit your target. Open the app to save the session.",
        // The standard ding, which on iOS also brings the standard alert
        // haptic — the two are one thing there, with no API to ask for the
        // buzz without the sound or to change either.
        //
        // 'defaultRingtone' was tried and dropped. It is louder, but a
        // ringtone takes its volume and behaviour from the ringer rather
        // than from notification settings, so it lands somewhere between
        // what the user configured for calls and what they configured for
        // alerts, and obeys neither. A short ding that behaves exactly like
        // every other notification on the phone is the more predictable
        // thing to be woken by; the repeats below are what make it carry.
        sound: 'default',
        // Breaks through Focus and Do Not Disturb, and keeps the alert on
        // the lock screen rather than letting it summarise. This needs the
        // com.apple.developer.usernotifications.time-sensitive entitlement,
        // which is in app.json — free to claim, no request to Apple. Without
        // it iOS quietly downgrades this to 'active' rather than failing.
        interruptionLevel: 'timeSensitive',
        data: { kind: RECOVERY_KIND },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: at + i * RECOVERY_REPEAT_GAP,
        ...(Platform.OS === 'android' ? { channelId: 'recovery' } : {}),
      },
    });
  }
}

/**
 * Drop every pending alert in the series.
 *
 * Called when the session ends, and also the moment the user opens the app
 * after the target — which is this alarm's version of hitting Stop. Ones
 * that have already fired are not cancellable and do not need to be; this
 * only silences what has not rung yet.
 */
export async function cancelRecoveryAlert(): Promise<void> {
  for (const identifier of RECOVERY_ALERT_IDS) {
    try {
      await Notifications.cancelScheduledNotificationAsync(identifier);
    } catch {
      // Nothing scheduled under that id. Not worth distinguishing.
    }
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
    if (RECOVERY_ALERT_IDS.includes(n.identifier)) continue;
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
