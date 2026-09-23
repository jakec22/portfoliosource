import { useEffect } from 'react';
import { useStore, sumMacros } from '../store/useStore';
import { todayString } from '../utils/date';
import { sendWatchContext, setWatchPalette } from '../services/watch';
import { watchPalette } from '../utils/watchPalette';
import { resolveTheme } from '../theme';

// Mirrors today's calories, macros, and water to the Apple Watch whenever any
// of them change. One-way (phone → watch); the watch glance is read-only.
export function useWatchSync(): void {
  const logs = useStore((s) => s.logs);
  const goals = useStore((s) => s.goals);
  const waterIntake = useStore((s) => s.waterIntake);
  const waterGoal = useStore((s) => s.waterGoal);
  const themeMode = useStore((s) => s.themeMode);
  const showWaterTracker = useStore((s) => s.showWaterTracker);

  useEffect(() => {
    const today = todayString();
    const totals = sumMacros(logs[today] ?? []);
    sendWatchContext({
      caloriesConsumed: Math.round(totals.calories),
      calorieGoal: Math.round(goals.calories),
      protein: Math.round(totals.protein),
      proteinGoal: Math.round(goals.protein),
      carbs: Math.round(totals.carbs),
      carbsGoal: Math.round(goals.carbs),
      fat: Math.round(totals.fat),
      fatGoal: Math.round(goals.fat),
      water: Math.round(waterIntake[today] ?? 0),
      waterGoal: Math.round(waterGoal),
      showWaterTracker,
      updatedAt: Date.now(),
    });
  }, [logs, goals, waterIntake, waterGoal, showWaterTracker]);

  // Pack changes don't touch the nutrition numbers, so the palette pushes on
  // its own trigger rather than riding along with the stats effect.
  useEffect(() => {
    setWatchPalette(watchPalette(resolveTheme(themeMode)));
  }, [themeMode]);
}
