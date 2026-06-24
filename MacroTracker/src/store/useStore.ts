import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  AppState,
  DailyGoals,
  FoodEntry,
  MacroNutrients,
  MealType,
  WorkoutSession,
  WorkoutTemplate,
} from '../types';
import { todayString } from '../utils/date';
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
      showWaterTracker: true,
      autoRestTimer: true,
      restDurationSeconds: 90,
      restTrigger: 0,
      bodyWeightLbs: undefined,
      recentFoods: [],
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
        set({ waterIncrement: Math.min(40, Math.max(1, Math.round(oz))) });
        syncSettings();
      },

      setShowWaterTracker: (show) => {
        set({ showWaterTracker: show });
      },

      setAutoRestTimer: (on) => {
        set({ autoRestTimer: on });
      },

      setRestDuration: (seconds) => {
        set({ restDurationSeconds: Math.max(5, Math.round(seconds)) });
      },

      setBodyWeight: (lbs) => {
        set({ bodyWeightLbs: Math.round(lbs) });
        syncSettings();
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
      },

      deleteTemplate: (id) => {
        set((state) => ({
          workoutTemplates: state.workoutTemplates.filter((t) => t.id !== id),
        }));
      },

      startWorkout: (template) => {
        const now = Date.now();
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
            return {
              id: `we-${now}-${i}-${Math.random()}`,
              name: te.name,
              sets: planned.map((ts, si) => ({
                id: `ws-${now}-${i}-${si}-${Math.random()}`,
                weight: ts.weight,
                reps: ts.reps,
                type: ts.type,
                completed: false,
              })),
            };
          }),
        };
        set({ activeWorkout: session });
      },

      cancelWorkout: () => set({ activeWorkout: null }),

      finishWorkout: () => {
        set((state) => {
          if (!state.activeWorkout) return {};
          const finished: WorkoutSession = {
            ...state.activeWorkout,
            completedAt: Date.now(),
          };
          return {
            activeWorkout: null,
            workoutHistory: [finished, ...state.workoutHistory].slice(0, 100),
          };
        });
      },

      addWorkoutExercise: (name) => {
        set((state) => {
          if (!state.activeWorkout) return {};
          const now = Date.now();
          const exercise = {
            id: `we-${now}-${Math.random()}`,
            name: name.trim() || 'Exercise',
            sets: [
              { id: `ws-${now}-${Math.random()}`, weight: 0, reps: 0, completed: false },
            ],
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
      version: 2,
      // v1 switched water from milliliters to fluid ounces; reset stored
      // water so old ml values aren't misread as oz. Food logs/goals kept.
      // v2 moved template exercises from target{Sets,Reps,Weight} scalars to
      // an explicit per-set list; expand the old scalars into a sets array.
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
        return state;
      },
    }
  )
);
