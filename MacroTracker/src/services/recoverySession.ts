import { useStore } from '../store/useStore';
import { getHeartRateMonitor } from './heartRate';
import { getWorkoutHrSamples, resetWorkoutHrBuffer } from './watch';
import { scheduleRecoveryAlert, cancelRecoveryAlert } from './notifications';
import { recoveryType, type RecoveryKind } from '../utils/workoutTypes';
import type { RecoveryPreset } from '../types';

/**
 * Starting and finishing a sauna or plunge, heart rate included.
 *
 * Both ends live here rather than in the timer screen because either end can
 * happen on the wrist, with the phone in a locker and the screen unmounted —
 * the watch's own start button and its own Save. The screen and the watch
 * bridge call the same two functions so a session begun on one and ended on
 * the other behaves exactly like one done on either alone.
 */

/** Begin a recovery and clear the heart-rate buffer for it. */
export function beginRecovery(kind: RecoveryKind, preset: RecoveryPreset) {
  const started = useStore.getState().startRecovery(kind, preset);
  // Only once the store agreed to start: a refused start (a workout already
  // running) must not wipe that workout's samples.
  if (started) {
    resetWorkoutHrBuffer();
    // Ask the phone for its own read access.
    //
    // The watch asks for its own when it opens a session, but this side needs
    // its own grant to read the window back at the end, and until now the
    // only thing that ever asked was the lifting screen. A user whose first
    // session was a sauna therefore got a silent empty query — queryQuantity-
    // Samples returns nothing rather than failing — and a saved session with
    // no graph and no reason given. A no-op once granted; iOS does not
    // re-prompt.
    void getHeartRateMonitor().requestPermissions();

    // Hand the target to the OS. Fire-and-forget: the timer must start on
    // the tap whatever the notification layer is doing, including while a
    // permission prompt is still open over it.
    void scheduleRecoveryAlert(recoveryType(kind).label, preset.targetSeconds);
  }
  return started;
}

/**
 * Abandon the running recovery without saving it.
 *
 * Here rather than straight onto the store action for the same reason the
 * other two ends are: a session discarded on the wrist and one discarded on
 * the phone have to leave the same state behind, and that now includes a
 * pending alarm nobody wants going off after they have got out.
 */
export function abortRecovery() {
  useStore.getState().cancelRecovery();
  void cancelRecoveryAlert();
}

/**
 * Save the running recovery and attach whatever heart rate was captured.
 *
 * Prefers a batch query of the health store over the samples the watch
 * streamed live, for the same reason the workout path does: the stream only
 * lands while the phone is reachable, and a sauna is precisely where it
 * isn't. The buffer is the fallback, not the source.
 */
/**
 * Record a recovery the watch ran by itself, heart rate included.
 *
 * Only the health store is consulted, never the live buffer: by definition
 * this phone was not listening while the session ran. The watch did hold an
 * HKWorkoutSession the whole time, though, so the window is densely sampled
 * and the batch query is the better source anyway.
 */
export async function logWatchRecovery(
  kind: RecoveryKind,
  startedAt: number,
  heldSeconds: number
): Promise<string> {
  const id = useStore.getState().logWatchRecovery(kind, startedAt, heldSeconds);
  const attach = useStore.getState().attachWorkoutHeartRate;
  try {
    const samples = await getHeartRateMonitor().query(
      startedAt,
      startedAt + Math.max(0, heldSeconds) * 1000
    );
    if (samples.length) attach(id, samples);
  } catch {
    // No health access, or nothing recorded. The session still stands.
  }
  return id;
}

export async function endRecovery(heldSeconds?: number): Promise<string | null> {
  const active = useStore.getState().activeRecovery;
  if (!active) return null;
  // Before the save, not after: the save queries the health store and can
  // take a moment, and a session finished a second early must not be able to
  // lose that race and alarm anyway.
  void cancelRecoveryAlert();
  const id = useStore.getState().finishRecovery(heldSeconds);
  if (!id) return null;
  const attach = useStore.getState().attachWorkoutHeartRate;
  try {
    const queried = await getHeartRateMonitor().query(active.startedAt, Date.now());
    const samples = queried.length ? queried : getWorkoutHrSamples();
    if (samples.length) attach(id, samples);
  } catch {
    const buffered = getWorkoutHrSamples();
    if (buffered.length) attach(id, buffered);
  }
  return id;
}
