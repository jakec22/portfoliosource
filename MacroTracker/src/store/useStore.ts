import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, DailyGoals, FoodEntry, MacroNutrients, MealType } from '../types';
import {
  pushEntry,
  deleteEntryRemote,
  pushSettings,
  type SettingsSnapshot,
} from '../services/sync';

const DEFAULT_GOALS: DailyGoals = {
  calories: 2000,
  protein: 150,
  carbs: 200,
  fat: 67,
  fiber: 30,
};

const ZERO_MACROS: MacroNutrients = {
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
  fiber: 0,
};

export function sumMacros(entries: FoodEntry[]): MacroNutrients {
  return entries.reduce((acc, entry) => {
    const { macros } = entry.food;
    const s = entry.servings;
    return {
      calories: acc.calories + macros.calories * s,
      protein: acc.protein + macros.protein * s,
      carbs: acc.carbs + macros.carbs * s,
      fat: acc.fat + macros.fat * s,
      fiber: (acc.fiber ?? 0) + (macros.fiber ?? 0) * s,
    };
  }, { ...ZERO_MACROS });
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => {
      // Snapshot of the cloud-synced "settings" fields, pushed after any
      // change to one of them. Fire-and-forget; no-op until a user is signed in.
      const syncSettings = () => {
        const s = get();
        const snap: SettingsSnapshot = {
          goals: s.goals,
          waterGoal: s.waterGoal,
          waterIncrement: s.waterIncrement,
          bodyWeightLbs: s.bodyWeightLbs,
          recentFoods: s.recentFoods,
          waterIntake: s.waterIntake,
        };
        void pushSettings(snap);
      };

      return {
      goals: DEFAULT_GOALS,
      logs: {},
      waterIntake: {},
      waterGoal: 64, // default ~8 cups
      waterIncrement: 8, // fl oz per droplet tap
      bodyWeightLbs: undefined,
      recentFoods: [],

      setGoals: (goals) => {
        set({ goals });
        syncSettings();
      },

      addRecentFood: (food) => {
        set((state) => ({
          recentFoods: [
            food,
            ...state.recentFoods.filter((f) => f.id !== food.id),
          ].slice(0, 20),
        }));
        syncSettings();
      },

      addEntry: (entry) => {
        set((state) => {
          const existing = state.logs[entry.date] ?? [];
          return {
            logs: { ...state.logs, [entry.date]: [...existing, entry] },
            recentFoods: [
              entry.food,
              ...state.recentFoods.filter((f) => f.id !== entry.food.id),
            ].slice(0, 20),
          };
        });
        void pushEntry(entry);
        syncSettings(); // recentFoods changed too
      },

      removeEntry: (date, entryId) => {
        set((state) => {
          const existing = state.logs[date] ?? [];
          return {
            logs: {
              ...state.logs,
              [date]: existing.filter((e) => e.id !== entryId),
            },
          };
        });
        void deleteEntryRemote(entryId);
      },

      updateEntry: (date, entryId, servings) => {
        set((state) => {
          const existing = state.logs[date] ?? [];
          return {
            logs: {
              ...state.logs,
              [date]: existing.map((e) =>
                e.id === entryId ? { ...e, servings } : e
              ),
            },
          };
        });
        const updated = (get().logs[date] ?? []).find((e) => e.id === entryId);
        if (updated) void pushEntry(updated);
      },

      addWater: (date, oz) => {
        set((state) => ({
          waterIntake: {
            ...state.waterIntake,
            [date]: Math.max(0, (state.waterIntake[date] ?? 0) + oz),
          },
        }));
        syncSettings();
      },

      setWater: (date, oz) => {
        set((state) => ({
          waterIntake: {
            ...state.waterIntake,
            [date]: Math.max(0, Math.round(oz)),
          },
        }));
        syncSettings();
      },

      setWaterGoal: (oz) => {
        set({ waterGoal: Math.max(8, Math.round(oz)) });
        syncSettings();
      },

      setWaterIncrement: (oz) => {
        set({ waterIncrement: Math.min(32, Math.max(1, Math.round(oz))) });
        syncSettings();
      },

      setBodyWeight: (lbs) => {
        set({ bodyWeightLbs: Math.round(lbs) });
        syncSettings();
      },

      getEntriesForDate: (date) => get().logs[date] ?? [],

      getTotalsForDate: (date) => {
        const entries = get().logs[date] ?? [];
        return sumMacros(entries);
      },

      getMealTotals: (date, meal) => {
        const entries = (get().logs[date] ?? []).filter((e) => e.meal === meal);
        return sumMacros(entries);
      },
      };
    },
    {
      name: 'macro-tracker-storage',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
      // v1 switched water from milliliters to fluid ounces; reset stored
      // water so old ml values aren't misread as oz. Food logs/goals kept.
      migrate: (persisted: any, version) => {
        if (version < 1 && persisted) {
          return { ...persisted, waterIntake: {}, waterGoal: 64 };
        }
        return persisted;
      },
    }
  )
);
