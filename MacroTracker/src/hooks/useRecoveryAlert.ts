import { useEffect } from 'react';
import { AppState } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useStore } from '../store/useStore';
import { cancelRecoveryAlert } from '../services/notifications';

/**
 * The Stop button the alarm cannot have.
 *
 * The target alert is a short series of notifications rather than one, since
 * iOS plays a notification's sound once and there is no ring-until-dismissed
 * outside the Clock app. That buys an alarm that keeps going — and creates
 * the obligation to stop it, because a plunge counts *up* and staying past
 * the target is the normal thing to do, not a reason to be alarmed at for
 * two minutes.
 *
 * Ending the session already clears the whole series (see endRecovery and
 * abortRecovery). This covers the other way a user says "I've got it":
 * opening the app, or tapping the notification, without ending anything.
 *
 * Only past the target. Before it, becoming active is just someone glancing
 * at their phone, and cancelling then would throw away the alarm entirely —
 * which is the one failure this whole feature exists to prevent.
 */
export function useRecoveryAlert() {
  useEffect(() => {
    const seen = () => {
      const active = useStore.getState().activeRecovery;
      if (!active) return;
      const targetMs = active.startedAt + active.targetSeconds * 1000;
      if (Date.now() >= targetMs) void cancelRecoveryAlert();
    };

    seen();
    const app = AppState.addEventListener('change', (s) => {
      if (s === 'active') seen();
    });
    // Tapping the alert brings the app forward, which fires the line above
    // too — but not if the app was already foregrounded, which is exactly
    // the case where someone is watching the timer run past its target.
    const tap = Notifications.addNotificationResponseReceivedListener(seen);

    return () => {
      app.remove();
      tap.remove();
    };
  }, []);
}
