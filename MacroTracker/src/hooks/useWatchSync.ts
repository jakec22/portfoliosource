import { useEffect } from 'react';
import { useStore, sumMacros } from '../store/useStore';
import { useToday } from './useToday';
import { todayString } from '../utils/date';
import {
  sendWatchContext,
  setWatchPalette,
  setWatchSavedMeals,
  repushWatchContext,
  subscribeWatchAddWater,
  subscribeWatchLogSavedMeal,
} from '../services/watch';
import { watchPalette } from '../utils/watchPalette';
import { resolveTheme } from '../theme';
import type { MealType } from '../types';

// Which meal window a wrist-logged meal lands in.
//
// The watch deliberately doesn't ask: picking from four options on a 198pt
// screen costs more than the choice is worth, and the clock already knows the
// likely answer. The user can move it on the phone, which is where editing a
// log belongs anyway.
function mealForNow(now = new Date()): MealType {
  const hour = now.getHours();
  if (hour < 11) return 'breakfast';
  if (hour < 16) return 'lunch';
  if (hour < 21) return 'dinner';
  return 'snacks';
}

// Mirrors today's calories, macros, and water to the Apple Watch whenever any
// of them change, and applies the two things the watch can now log back:
// water, and a saved meal. No longer one-way — the wrist writes as well as
// reads, over the same retrying transport the workout's set check-offs use.
export function useWatchSync(): void {
  const logs = useStore((s) => s.logs);
  const goals = useStore((s) => s.goals);
  const waterIntake = useStore((s) => s.waterIntake);
  const waterGoal = useStore((s) => s.waterGoal);
  const themeMode = useStore((s) => s.themeMode);
  const showWaterTracker = useStore((s) => s.showWaterTracker);
  const savedMeals = useStore((s) => s.savedMeals);
  const addWater = useStore((s) => s.addWater);
  const addEntry = useStore((s) => s.addEntry);
  // Not todayString() inside the effect: that is read once per run, and the
  // effect only ran when the numbers changed. Nothing re-ran it at midnight,
  // so the watch held yesterday's totals until the next food was logged.
  const today = useToday();

  useEffect(() => {
    const totals = sumMacros(logs[today] ?? []);
    sendWatchContext({
      date: today,
      caloriesConsumed: Math.round(totals.calories),
      calorieGoal: Math.round(goals.calories),
      protein: Math.round(totals.protein),
      proteinGoal: Math.round(goals.protein),
      carbs: Math.round(totals.carbs),
      carbsGoal: Math.round(goals.carbs),
      fat: Math.round(totals.fat),
      fatGoal: Math.round(goals.fat),
      fiber: Math.round(totals.fiber ?? 0),
      fiberGoal: Math.round(goals.fiber),
      water: Math.round(waterIntake[today] ?? 0),
      waterGoal: Math.round(waterGoal),
      showWaterTracker,
      updatedAt: Date.now(),
    });
  }, [today, logs, goals, waterIntake, waterGoal, showWaterTracker]);

  // Pack changes don't touch the nutrition numbers, so the palette pushes on
  // its own trigger rather than riding along with the stats effect.
  useEffect(() => {
    setWatchPalette(watchPalette(resolveTheme(themeMode), themeMode));
  }, [themeMode]);

  // Mirror the saved meals so the watch's Log Meal sheet can list them, with
  // the totals it needs to label each row.
  useEffect(() => {
    setWatchSavedMeals(
      (savedMeals ?? []).map((m) => {
        const t = sumMacros(m.items);
        return {
          id: m.id,
          name: m.name,
          cal: Math.round(t.calories),
          p: Math.round(t.protein),
          c: Math.round(t.carbs),
          f: Math.round(t.fat),
          fb: Math.round(t.fiber ?? 0),
        };
      })
    );
  }, [savedMeals]);

  // Water logged from the wrist. The watch updates itself optimistically and
  // the phone is the source of truth, so this just applies it — the next
  // stats push carries the reconciled total back.
  useEffect(() => {
    return subscribeWatchAddWater((oz) => {
      addWater(todayString(), oz);
    });
  }, [addWater]);

  // A saved meal logged from the wrist. Only the id crossed, so the items are
  // resolved here against the phone's own list; an id the phone doesn't know
  // (a meal deleted since the last push) is dropped rather than guessed at.
  useEffect(() => {
    return subscribeWatchLogSavedMeal((mealId) => {
      const meal = useStore.getState().savedMeals.find((m) => m.id === mealId);
      if (!meal) {
        // Deleted since the last push. The watch has already added this
        // meal's calories to its own display and nothing here is going to
        // change, so without an explicit re-push it would keep them for the
        // rest of the day.
        repushWatchContext();
        return;
      }
      const now = Date.now();
      const date = todayString();
      const window = mealForNow();
      for (const item of meal.items) {
        addEntry({
          id: `${now}-${Math.random()}`,
          food: item.food,
          servings: item.servings,
          meal: window,
          timestamp: now,
          date,
        });
      }
    });
  }, [addEntry]);
}
