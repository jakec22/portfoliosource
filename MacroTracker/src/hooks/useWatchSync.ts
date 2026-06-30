import { useEffect } from 'react';
import { useStore, sumMacros } from '../store/useStore';
import { todayString } from '../utils/date';
import { sendWatchContext } from '../services/watch';

// Mirrors today's calories, macros, and water to the Apple Watch whenever any
// of them change. One-way (phone → watch); the watch glance is read-only.
export function useWatchSync(): void {
  const logs = useStore((s) => s.logs);
  const goals = useStore((s) => s.goals);
  const waterIntake = useStore((s) => s.waterIntake);
  const waterGoal = useStore((s) => s.waterGoal);

  useEffect(() => {
    const today = todayString();
    const totals = sumMacros(logs[today] ?? []);
    sendWatchContext({
      caloriesConsumed: Math.round(totals.calories),
      calorieGoal: Math.round(goals.calories),
      protein: Math.round(totals.protein),
      carbs: Math.round(totals.carbs),
      fat: Math.round(totals.fat),
      water: Math.round(waterIntake[today] ?? 0),
      waterGoal: Math.round(waterGoal),
      updatedAt: Date.now(),
    });
  }, [logs, goals, waterIntake, waterGoal]);
}
