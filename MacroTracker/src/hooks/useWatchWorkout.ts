import { useEffect } from 'react';
import { useStore } from '../store/useStore';
import { setWatchWorkoutPlan } from '../services/watch';

// Mirrors the active workout's exercises + sets to the watch so it can show
// (and check off) them. Re-pushes whenever the workout changes; clears when
// there's no active workout.
export function useWatchWorkout(): void {
  const activeWorkout = useStore((s) => s.activeWorkout);

  useEffect(() => {
    if (!activeWorkout) {
      setWatchWorkoutPlan([]);
      return;
    }
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
