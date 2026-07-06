import { useEffect } from 'react';
import { useStore } from '../store/useStore';
import {
  setWatchWorkoutPlan,
  restoreWatchWorkoutState,
  subscribeWatchSetToggle,
  subscribeWatchWorkoutFinish,
  subscribeWatchHeartRate,
  addWorkoutHrSample,
  getWorkoutHrSamples,
  resetWorkoutHrBuffer,
} from '../services/watch';
import { getHeartRateMonitor } from '../services/heartRate';
import { navigateToWorkoutSummary } from '../services/navigation';

// Mirrors the active workout's exercises + sets to the watch so it can show
// and check off them. Re-pushes whenever the workout changes; clears when
// there's no active workout. Also applies set check-offs coming back from the
// watch, buffers the heart rate the watch streams, and handles the watch's
// Complete Workout button. Lives at the tab-navigator level (always mounted),
// so a watch-driven finish still works when the phone isn't on the workout
// screen (e.g. the user backed out to the resume banner).
export function useWatchWorkout(): void {
  const activeWorkout = useStore((s) => s.activeWorkout);
  const setWorkoutSetCompleted = useStore((s) => s.setWorkoutSetCompleted);
  const completeAllWorkoutSets = useStore((s) => s.completeAllWorkoutSets);
  const finishWorkout = useStore((s) => s.finishWorkout);
  const attachWorkoutHeartRate = useStore((s) => s.attachWorkoutHeartRate);

  const workoutId = activeWorkout?.id;
  const startedAt = activeWorkout?.startedAt;

  // Buffer the heart-rate samples the watch streams during the workout into a
  // module-level store, so they can be attached to the saved session even if
  // the finish arrives from the watch while the ActiveWorkout screen isn't
  // mounted. Reset the buffer at the start of each workout.
  useEffect(() => {
    if (!workoutId) return;
    resetWorkoutHrBuffer();
    return subscribeWatchHeartRate((bpm, timestamp) => {
      addWorkoutHrSample({ bpm, timestamp });
    });
  }, [workoutId]);

  // Apply set check-offs from the watch to the phone's active workout.
  useEffect(() => {
    return subscribeWatchSetToggle((exerciseId, setId, completed) => {
      setWorkoutSetCompleted(exerciseId, setId, completed);
    });
  }, [setWorkoutSetCompleted]);

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
          w: Math.round(s.weight),
          r: Math.round(s.reps),
          d: Math.round(s.durationSeconds ?? 0),
          c: s.completed,
        })),
      }))
    );
  }, [activeWorkout]);
}
