import { useStore } from '../store/useStore';
import { getHeartRateMonitor } from './heartRate';
import { getWorkoutHrSamples, resetWorkoutHrBuffer } from './watch';
import type { RecoveryKind } from '../utils/workoutTypes';
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
  if (started) resetWorkoutHrBuffer();
  return started;
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
