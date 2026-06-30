import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  AppState,
  DailyGoals,
  Food,
  FoodEntry,
  MacroNutrients,
  MealType,
  SavedMeal,
  UserProfile,
  WorkoutSession,
  WorkoutTemplate,
} from '../types';
import { todayString } from '../utils/date';
import { prefillFromLastPerformance } from '../utils/exerciseHistory';
import {
  pushEntry,
  deleteEntryRemote,
  pushSettings,
  pushWorkout,
  deleteWorkoutRemote,
  type SettingsSnapshot,
} from '../services/sync';
import { startWatchWorkout, endWatchWorkout } from '../services/watch';

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
          showWaterTracker: s.showWaterTracker,
          themeMode: s.themeMode,
          autoRestTimer: s.autoRestTimer,
          defaultRestSeconds: s.defaultRestSeconds,
          bodyWeightLbs: s.bodyWeightLbs,
          bodyWeightLog: s.bodyWeightLog,
          profile: s.profile,
          recentFoods: s.recentFoods,
          favoriteFoods: s.favoriteFoods,
          customFoods: s.customFoods,
          savedMeals: s.savedMeals,
          waterIntake: s.waterIntake,
          workoutTemplates: s.workoutTemplates,
        };
        void pushSettings(snap);
      };

      return {
      goals: DEFAULT_GOALS,
      logs: {},
      waterIntake: {},
      waterGoal: 64, // default ~8 cups
      waterIncrement: 8, // fl oz per droplet tap
      showWaterTracker: true,
      themeMode: 'system',
      autoRestTimer: true,
      notificationPrefs: {
        enabled: false,
        breakfast: true,
        lunch: true,
        dinner: true,
        streak: true,
        times: {
          breakfast: { hour: 9, minute: 0 },
          lunch: { hour: 13, minute: 0 },
          dinner: { hour: 19, minute: 0 },
          streak: { hour: 20, minute: 30 },
        },
      },
      defaultRestSeconds: 120,
      restTrigger: 0,
      bodyWeightLbs: undefined,
      bodyWeightLog: [],
      profile: undefined,
      recentFoods: [],
      favoriteFoods: [],
      customFoods: [],
      savedMeals: [],
      workoutTemplates: [],
      activeWorkout: null,
      workoutHistory: [],

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

      updateEntry: (date, entryId, patch) => {
        set((state) => {
          const existing = state.logs[date] ?? [];
          return {
            logs: {
              ...state.logs,
              [date]: existing.map((e) =>
                e.id === entryId ? { ...e, ...patch } : e
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
        set({ waterIncrement: Math.min(40, Math.max(1, Math.round(oz))) });
        syncSettings();
      },

      setShowWaterTracker: (show) => {
        set({ showWaterTracker: show });
        syncSettings();
      },

      setThemeMode: (mode) => {
        set({ themeMode: mode });
        syncSettings();
      },

      setAutoRestTimer: (on) => {
        set({ autoRestTimer: on });
        syncSettings();
      },

      // Reminder prefs are device-local (not part of the cloud settings
      // snapshot), so this intentionally does not call syncSettings.
      setNotificationPrefs: (prefs) => {
        set({ notificationPrefs: prefs });
      },

      setDefaultRestSeconds: (seconds) => {
        set({ defaultRestSeconds: Math.min(600, Math.max(15, Math.round(seconds))) });
        syncSettings();
      },

      setBodyWeight: (lbs) => {
        set({ bodyWeightLbs: Math.round(lbs) });
        syncSettings();
      },

      setProfile: (profile) => {
        set({ profile });
        syncSettings();
      },

      logBodyWeight: (lbs, date) => {
        const entry = {
          date: date ?? todayString(),
          lbs: Math.round(lbs * 10) / 10, // keep one decimal
          loggedAt: Date.now(),
        };
        set((state) => {
          const log = [entry, ...state.bodyWeightLog]
            .sort((a, b) =>
              a.date === b.date ? b.loggedAt - a.loggedAt : a.date < b.date ? 1 : -1
            )
            .slice(0, 1000);
          // Keep the scalar "current weight" in step with the latest reading.
          return { bodyWeightLog: log, bodyWeightLbs: Math.round(log[0].lbs) };
        });
        syncSettings();
      },

      deleteBodyWeightEntry: (loggedAt) => {
        set((state) => {
          const log = state.bodyWeightLog.filter((e) => e.loggedAt !== loggedAt);
          return {
            bodyWeightLog: log,
            bodyWeightLbs: log.length ? Math.round(log[0].lbs) : state.bodyWeightLbs,
          };
        });
        syncSettings();
      },

      // ----- Nutrition shortcuts -----

      toggleFavoriteFood: (food: Food) => {
        set((state) => {
          const isFav = state.favoriteFoods.some((f) => f.id === food.id);
          return {
            favoriteFoods: isFav
              ? state.favoriteFoods.filter((f) => f.id !== food.id)
              : [food, ...state.favoriteFoods],
          };
        });
        syncSettings();
      },

      addCustomFood: (food: Food) => {
        set((state) => ({ customFoods: [food, ...state.customFoods] }));
        syncSettings();
      },

      deleteCustomFood: (id: string) => {
        set((state) => ({
          customFoods: state.customFoods.filter((f) => f.id !== id),
          favoriteFoods: state.favoriteFoods.filter((f) => f.id !== id),
        }));
        syncSettings();
      },

      saveMeal: (meal: SavedMeal) => {
        set((state) => ({ savedMeals: [meal, ...state.savedMeals] }));
        syncSettings();
      },

      deleteSavedMeal: (id: string) => {
        set((state) => ({ savedMeals: state.savedMeals.filter((m) => m.id !== id) }));
        syncSettings();
      },

      copyMealFromDate: (fromDate: string, toDate: string, meal: MealType): number => {
        const fromEntries = (get().logs[fromDate] ?? []).filter((e) => e.meal === meal);
        if (fromEntries.length === 0) return 0;
        const now = Date.now();
        const newEntries: FoodEntry[] = fromEntries.map((e) => ({
          ...e,
          id: `${now}-${Math.random()}`,
          date: toDate,
          timestamp: now,
        }));
        set((state) => ({
          logs: {
            ...state.logs,
            [toDate]: [...(state.logs[toDate] ?? []), ...newEntries],
          },
        }));
        for (const entry of newEntries) void pushEntry(entry);
        return newEntries.length;
      },

      // ----- Workouts -----

      saveTemplate: (template) => {
        set((state) => {
          const exists = state.workoutTemplates.some((t) => t.id === template.id);
          return {
            workoutTemplates: exists
              ? state.workoutTemplates.map((t) => (t.id === template.id ? template : t))
              : [...state.workoutTemplates, template],
          };
        });
        syncSettings(); // templates ride along in the settings snapshot
      },

      deleteTemplate: (id) => {
        set((state) => ({
          workoutTemplates: state.workoutTemplates.filter((t) => t.id !== id),
        }));
        syncSettings();
      },

      startWorkout: (template) => {
        const now = Date.now();
        // Seed each exercise from the last time it was performed (progressive
        // overload by default); the template's planned sets are the fallback.
        const history = get().workoutHistory;
        const session: WorkoutSession = {
          id: `w-${now}-${Math.random()}`,
          name: template?.name ?? 'Quick Workout',
          templateId: template?.id,
          date: todayString(),
          startedAt: now,
          exercises: (template?.exercises ?? []).map((te, i) => {
            const planned = te.sets.length
              ? te.sets
              : [{ weight: 0, reps: 0, type: undefined }];
            const prefilled = prefillFromLastPerformance(history, te.name, planned);
            return {
              id: `we-${now}-${i}-${Math.random()}`,
              name: te.name,
              mode: te.mode,
              sets: prefilled.map((ts, si) => ({
                id: `ws-${now}-${i}-${si}-${Math.random()}`,
                weight: ts.weight,
                reps: ts.reps,
                durationSeconds: ts.durationSeconds,
                type: ts.type,
                completed: false,
              })),
            };
          }),
        };
        set({ activeWorkout: session });
        // Kick off the matching workout on the watch so it captures heart rate.
        startWatchWorkout(session.id);
      },

      cancelWorkout: () => {
        endWatchWorkout();
        set({ activeWorkout: null });
      },

      deleteWorkout: (id) => {
        set((state) => ({
          workoutHistory: state.workoutHistory.filter((w) => w.id !== id),
        }));
        void deleteWorkoutRemote(id);
      },

      attachWorkoutHeartRate: (id, samples) => {
        set((state) => ({
          workoutHistory: state.workoutHistory.map((w) =>
            w.id === id ? { ...w, heartRateSamples: samples } : w
          ),
        }));
        const updated = get().workoutHistory.find((w) => w.id === id);
        if (updated) void pushWorkout(updated);
      },

      finishWorkout: () => {
        const active = get().activeWorkout;
        if (!active) return;
        endWatchWorkout();
        const finished: WorkoutSession = { ...active, completedAt: Date.now() };
        set((state) => ({
          activeWorkout: null,
          workoutHistory: [finished, ...state.workoutHistory].slice(0, 100),
        }));
        void pushWorkout(finished);
      },

      addWorkoutExercise: (name) => {
        set((state) => {
          if (!state.activeWorkout) return {};
          const now = Date.now();
          const cleanName = name.trim() || 'Exercise';
          // Pre-fill from the last time this exercise was done, recreating its
          // full set list when there's history to draw on.
          const prefilled = prefillFromLastPerformance(state.workoutHistory, cleanName, [
            { weight: 0, reps: 0 },
          ]);
          const exercise = {
            id: `we-${now}-${Math.random()}`,
            name: cleanName,
            sets: prefilled.map((ts, si) => ({
              id: `ws-${now}-${si}-${Math.random()}`,
              weight: ts.weight,
              reps: ts.reps,
              durationSeconds: ts.durationSeconds,
              type: ts.type,
              completed: false,
            })),
          };
          return {
            activeWorkout: {
              ...state.activeWorkout,
              exercises: [...state.activeWorkout.exercises, exercise],
            },
          };
        });
      },

      removeWorkoutExercise: (exerciseId) => {
        set((state) => {
          if (!state.activeWorkout) return {};
          return {
            activeWorkout: {
              ...state.activeWorkout,
              exercises: state.activeWorkout.exercises.filter((e) => e.id !== exerciseId),
            },
          };
        });
      },

      addWorkoutSet: (exerciseId) => {
        set((state) => {
          if (!state.activeWorkout) return {};
          return {
            activeWorkout: {
              ...state.activeWorkout,
              exercises: state.activeWorkout.exercises.map((e) => {
                if (e.id !== exerciseId) return e;
                // New set inherits the previous set's weight/reps as a sensible default.
                const last = e.sets[e.sets.length - 1];
                return {
                  ...e,
                  sets: [
                    ...e.sets,
                    {
                      id: `ws-${Date.now()}-${Math.random()}`,
                      weight: last?.weight ?? 0,
                      reps: last?.reps ?? 0,
                      durationSeconds: last?.durationSeconds,
                      completed: false,
                    },
                  ],
                };
              }),
            },
          };
        });
      },

      updateWorkoutSet: (exerciseId, setId, patch) => {
        set((state) => {
          if (!state.activeWorkout) return {};
          return {
            activeWorkout: {
              ...state.activeWorkout,
              exercises: state.activeWorkout.exercises.map((e) =>
                e.id !== exerciseId
                  ? e
                  : {
                      ...e,
                      sets: e.sets.map((s) => (s.id === setId ? { ...s, ...patch } : s)),
                    }
              ),
            },
          };
        });
      },

      setExerciseMode: (exerciseId, mode) => {
        set((state) => {
          if (!state.activeWorkout) return {};
          return {
            activeWorkout: {
              ...state.activeWorkout,
              exercises: state.activeWorkout.exercises.map((e) =>
                e.id === exerciseId ? { ...e, mode } : e
              ),
            },
          };
        });
      },

      toggleWorkoutSet: (exerciseId, setId) => {
        set((state) => {
          if (!state.activeWorkout) return {};
          let becameComplete = false;
          const exercises = state.activeWorkout.exercises.map((e) =>
            e.id !== exerciseId
              ? e
              : {
                  ...e,
                  sets: e.sets.map((s) => {
                    if (s.id !== setId) return s;
                    becameComplete = !s.completed; // toggling on, not off
                    return { ...s, completed: !s.completed };
                  }),
                }
          );
          const patch: Partial<AppState> = {
            activeWorkout: { ...state.activeWorkout, exercises },
          };
          // Signal the rest timer to auto-start only when checking a set ON.
          if (becameComplete && state.autoRestTimer) {
            patch.restTrigger = state.restTrigger + 1;
          }
          return patch;
        });
      },

      removeWorkoutSet: (exerciseId, setId) => {
        set((state) => {
          if (!state.activeWorkout) return {};
          return {
            activeWorkout: {
              ...state.activeWorkout,
              exercises: state.activeWorkout.exercises.map((e) =>
                e.id !== exerciseId
                  ? e
                  : { ...e, sets: e.sets.filter((s) => s.id !== setId) }
              ),
            },
          };
        });
      },

      reorderWorkoutExercise: (exerciseId, direction) => {
        set((state) => {
          if (!state.activeWorkout) return {};
          const exs = state.activeWorkout.exercises;
          const idx = exs.findIndex((e) => e.id === exerciseId);
          if (idx === -1) return {};
          const swap = direction === 'up' ? idx - 1 : idx + 1;
          if (swap < 0 || swap >= exs.length) return {};
          const next = [...exs];
          [next[idx], next[swap]] = [next[swap], next[idx]];
          return { activeWorkout: { ...state.activeWorkout, exercises: next } };
        });
      },

      clearLocalData: () => {
        set({
          goals: DEFAULT_GOALS,
          logs: {},
          waterIntake: {},
          waterGoal: 64,
          waterIncrement: 8,
          showWaterTracker: true,
          themeMode: 'system',
          autoRestTimer: true,
          defaultRestSeconds: 120,
          restTrigger: 0,
          bodyWeightLbs: undefined,
          bodyWeightLog: [],
          profile: undefined,
          recentFoods: [],
          favoriteFoods: [],
          customFoods: [],
          savedMeals: [],
          workoutTemplates: [],
          activeWorkout: null,
          workoutHistory: [],
        });
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
      version: 6,
      // v1 switched water from milliliters to fluid ounces; reset stored
      // water so old ml values aren't misread as oz. Food logs/goals kept.
      // v2 moved template exercises from target{Sets,Reps,Weight} scalars to
      // an explicit per-set list; expand the old scalars into a sets array.
      // v3 introduced a dated body-weight log; seed it from the old single
      // bodyWeightLbs scalar so existing weight isn't lost.
      migrate: (persisted: any, version) => {
        let state = persisted;
        if (version < 1 && state) {
          state = { ...state, waterIntake: {}, waterGoal: 64 };
        }
        if (version < 2 && state && Array.isArray(state.workoutTemplates)) {
          state = {
            ...state,
            workoutTemplates: state.workoutTemplates.map((t: any) => ({
              ...t,
              exercises: (t.exercises ?? []).map((e: any) => {
                if (Array.isArray(e.sets)) return e; // already migrated
                const count = Math.max(1, e.targetSets ?? 1);
                const sets = Array.from({ length: count }).map((_, i) => ({
                  id: `ts-${t.id}-${e.id}-${i}`,
                  weight: e.targetWeight ?? 0,
                  reps: e.targetReps ?? 0,
                }));
                const { targetSets, targetReps, targetWeight, ...rest } = e;
                return { ...rest, sets };
              }),
            })),
          };
        }
        if (version < 3 && state && !Array.isArray(state.bodyWeightLog)) {
          state = {
            ...state,
            bodyWeightLog:
              typeof state.bodyWeightLbs === 'number'
                ? [{ date: todayString(), lbs: state.bodyWeightLbs, loggedAt: Date.now() }]
                : [],
          };
        }
        if (version < 4 && state) {
          state = {
            ...state,
            favoriteFoods: state.favoriteFoods ?? [],
            customFoods: state.customFoods ?? [],
            savedMeals: state.savedMeals ?? [],
          };
        }
        // v5 added an appearance preference; default existing users to
        // following the OS setting.
        if (version < 5 && state && state.themeMode == null) {
          state = { ...state, themeMode: 'system' };
        }
        // v6 made reminder times user-editable. Backfill default times for
        // anyone who saved the first version of notificationPrefs (booleans
        // only, no times), so reads of prefs.times never hit undefined.
        if (version < 6 && state?.notificationPrefs && !state.notificationPrefs.times) {
          state = {
            ...state,
            notificationPrefs: {
              ...state.notificationPrefs,
              times: {
                breakfast: { hour: 9, minute: 0 },
                lunch: { hour: 13, minute: 0 },
                dinner: { hour: 19, minute: 0 },
                streak: { hour: 20, minute: 30 },
              },
            },
          };
        }
        return state;
      },
    }
  )
);
