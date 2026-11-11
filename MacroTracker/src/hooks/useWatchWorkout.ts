import { useEffect } from 'react';
import { useStore } from '../store/useStore';
import {
  setWatchWorkoutPlan,
  setWatchTemplates,
  restoreWatchWorkoutState,
  subscribeWatchSetToggle,
  subscribeWatchSetEdit,
  subscribeWatchWorkoutFinish,
  subscribeWatchStartWorkout,
  subscribeWatchPlanRequest,
  subscribeWatchHeartRate,
  subscribeWatchStartRecovery,
  subscribeWatchRecoveryFinish,
  setWatchRecoveryPresets,
  addWorkoutHrSample,
  getWorkoutHrSamples,
  resetWorkoutHrBuffer,
} from '../services/watch';
import { getHeartRateMonitor } from '../services/heartRate';
import { navigateToWorkoutSummary } from '../services/navigation';
import {
  abortRecovery,
  beginRecovery,
  endRecovery,
  logWatchRecovery,
} from '../services/recoverySession';
import {
  DEFAULT_WORKOUT_HK,
  RECOVERY_TYPES,
  type RecoveryKind,
} from '../utils/workoutTypes';

// Mirrors the active workout's exercises + sets to the watch so it can show
// and check off them. Re-pushes whenever the workout changes; clears when
// there's no active workout. Also applies set check-offs coming back from the
// watch, buffers the heart rate the watch streams, and handles the watch's
// Complete Workout button. Lives at the tab-navigator level (always mounted),
// so a watch-driven finish still works when the phone isn't on the workout
// screen (e.g. the user backed out to the resume banner).
export function useWatchWorkout(): void {
  const activeWorkout = useStore((s) => s.activeWorkout);
  const activeRecovery = useStore((s) => s.activeRecovery);
  const recoveryPresets = useStore((s) => s.recoveryPresets);
  const workoutTemplates = useStore((s) => s.workoutTemplates);
  const setWorkoutSetCompleted = useStore((s) => s.setWorkoutSetCompleted);
  const updateWorkoutSet = useStore((s) => s.updateWorkoutSet);
  const completeAllWorkoutSets = useStore((s) => s.completeAllWorkoutSets);
  const startWorkout = useStore((s) => s.startWorkout);
  const finishWorkout = useStore((s) => s.finishWorkout);
  const attachWorkoutHeartRate = useStore((s) => s.attachWorkoutHeartRate);

  const workoutId = activeWorkout?.id;
  const startedAt = activeWorkout?.startedAt;
  // A sauna or plunge streams heart rate on exactly the same channel, and is
  // in fact the case that depends on it most: the phone is usually in a
  // locker, so the live stream is often all there is until the batch query at
  // the end. Buffering keys on whichever session is running.
  const recoveryId = activeRecovery?.id;
  const captureId = workoutId ?? recoveryId;

  // Buffer the heart-rate samples the watch streams into a module-level store,
  // so they can be attached to the saved session even if the finish arrives
  // from the watch while no screen is mounted. The buffer is reset at the
  // start of each workout here; a recovery resets it in beginRecovery, which
  // is the only path that starts one.
  useEffect(() => {
    if (!captureId) return;
    if (captureId === workoutId) resetWorkoutHrBuffer();
    return subscribeWatchHeartRate((bpm, timestamp) => {
      addWorkoutHrSample({ bpm, timestamp });
    });
  }, [captureId, workoutId]);

  // Mirror the remembered sauna / plunge targets so the watch's start screen
  // can offer them with the same numbers the phone would use.
  useEffect(() => {
    setWatchRecoveryPresets(
      RECOVERY_TYPES.map((r) => ({
        k: r.kind,
        name: r.label,
        t: recoveryPresets[r.kind]?.targetSeconds ?? r.defaultTargetSeconds,
        m: recoveryPresets[r.kind]?.mode ?? r.defaultMode,
      }))
    );
  }, [recoveryPresets]);

  // Start a sauna or plunge the watch kicked off. The store refuses if
  // anything else is running, and beginRecovery clears the heart-rate buffer.
  useEffect(() => {
    return subscribeWatchStartRecovery((kind) => {
      const type = RECOVERY_TYPES.find((r) => r.kind === kind);
      if (!type) return;
      const state = useStore.getState();
      if (state.activeWorkout || state.activeRecovery) return;
      const preset = state.recoveryPresets[kind as RecoveryKind];
      beginRecovery(kind as RecoveryKind, {
        targetSeconds: preset?.targetSeconds ?? type.defaultTargetSeconds,
        mode: preset?.mode ?? type.defaultMode,
      });
    });
  }, []);

  // Save a recovery finished on the wrist. The watch sends its own elapsed,
  // which is the honest number — it is the side that was actually there.
  useEffect(() => {
    return subscribeWatchRecoveryFinish(({ kind, startedAt, heldSeconds, save }) => {
      const state = useStore.getState();
      if (state.activeRecovery) {
        if (save) {
          // Same as the workout path: the recap is shown whether the finish
          // came from this phone or from the wrist.
          void endRecovery(heldSeconds).then((id) => {
            if (id) navigateToWorkoutSummary(id);
          });
        } else {
          abortRecovery();
        }
        return;
      }
      // A session this phone never heard start, because the start was queued
      // and arrived stale. Build it from the finish, which carries the whole
      // thing. Below ten seconds is a mis-tap, the same threshold the phone's
      // own stop uses.
      if (!save || heldSeconds < 10) return;
      const type = RECOVERY_TYPES.find((r) => r.kind === kind);
      if (!type) return;
      void logWatchRecovery(type.kind, startedAt, heldSeconds).then((id) => {
        if (id) navigateToWorkoutSummary(id);
      });
    });
  }, []);

  // Re-send the context when the watch says it's in a workout with no plan.
  useEffect(() => subscribeWatchPlanRequest(), []);

  // Apply set check-offs from the watch to the phone's active workout.
  useEffect(() => {
    return subscribeWatchSetToggle((exerciseId, setId, completed) => {
      setWorkoutSetCompleted(exerciseId, setId, completed);
    });
  }, [setWorkoutSetCompleted]);

  // Apply weight/reps/duration edits made in the watch's set editor.
  useEffect(() => {
    return subscribeWatchSetEdit((exerciseId, setId, weight, reps, duration) => {
      updateWorkoutSet(exerciseId, setId, { weight, reps, durationSeconds: duration });
    });
  }, [updateWorkoutSet]);

  // Mirror the user's saved templates so the watch's Start Workout screen can
  // list them.
  useEffect(() => {
    setWatchTemplates(
      (workoutTemplates ?? []).map((t) => ({
        id: t.id,
        name: t.name,
        at: t.activityType ?? DEFAULT_WORKOUT_HK,
        n: t.exercises.length,
      }))
    );
  }, [workoutTemplates]);

  // Start a workout when the watch's template picker asks. Read fresh state so a
  // stale closure doesn't miss a just-added template; ignore if one's running.
  useEffect(() => {
    return subscribeWatchStartWorkout((templateId) => {
      const state = useStore.getState();
      // A running sauna owns the wrist's session too, so it blocks a lift the
      // same way another lift would.
      if (state.activeWorkout || state.activeRecovery) return;
      const template = templateId
        ? state.workoutTemplates.find((t) => t.id === templateId)
        : undefined;
      startWorkout(template, template?.activityType);
    });
  }, [startWorkout]);

  // Finish the workout when the watch's Complete Workout button is tapped.
  // Mirror the phone Finish button: end the session, attach the captured heart
  // rate (so the graph shows on the history page), and pop the workout overview
  // on the phone.
  useEffect(() => {
    return subscribeWatchWorkoutFinish(async (completeAll) => {
      const id = workoutId;
      const start = startedAt ?? Date.now();
      // The watch prompt offered to check off remaining sets.
      if (completeAll) completeAllWorkoutSets();
      finishWorkout();
      if (!id) return;
      try {
        // Prefer a dense HealthKit batch query; fall back to the samples the
        // watch streamed live (the buffer) when HealthKit has nothing.
        const queried = await getHeartRateMonitor().query(start, Date.now());
        const samples = queried.length ? queried : getWorkoutHrSamples();
        if (samples.length) attachWorkoutHeartRate(id, samples);
      } catch {
        const buffered = getWorkoutHrSamples();
        if (buffered.length) attachWorkoutHeartRate(id, buffered);
      }
      navigateToWorkoutSummary(id);
    });
  }, [workoutId, startedAt, completeAllWorkoutSets, finishWorkout, attachWorkoutHeartRate]);

  useEffect(() => {
    if (!activeWorkout) {
      setWatchWorkoutPlan([]);
      return;
    }
    // Re-assert the active workout to the watch first. This covers a phone
    // cold-start / reload (which resets the in-memory workout state), so the
    // plan push below carries workoutActive:true and never tells the watch to
    // end a workout that's still going.
    restoreWatchWorkoutState(activeWorkout.id, activeWorkout.startedAt);
    setWatchWorkoutPlan(
      activeWorkout.exercises.map((e) => ({
        id: e.id,
        name: e.name,
        mode: e.mode ?? 'reps',
        sets: e.sets.map((s) => ({
          id: s.id,
          w: s.weight, // real value (may be fractional, e.g. 2.5) so watch edits round-trip
          r: Math.round(s.reps),
          d: Math.round(s.durationSeconds ?? 0),
          c: s.completed,
        })),
      }))
    );
  }, [activeWorkout]);
}
