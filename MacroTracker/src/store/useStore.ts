import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ActiveRecovery,
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
import { evaluateGoalsUpdate } from '../utils/adaptiveGoals';
import { formatDate, todayString } from '../utils/date';
import { prefillFromLastPerformance } from '../utils/exerciseHistory';
import { RECOVERY_HK, recoveryType } from '../utils/workoutTypes';
import {
  pushEntry,
  deleteEntryRemote,
  pushSettings,
  pushWorkout,
  deleteWorkoutRemote,
  settingsSnapshot,
} from '../services/sync';
import { startWatchWorkout, startWatchRecovery, endWatchWorkout } from '../services/watch';
import { downsampleHeartRate } from '../services/heartRate';

/**
 * How much day-by-day history stays on the device.
 *
 * Eighteen months covers every comparison the app actually makes — the
 * furthest back anything reads is the 12-week training calendar — and leaves
 * room to scroll well past that in History. It is not a deletion: completed
 * days are already in Supabase, and this only trims what every single write
 * has to re-serialize locally.
 */
const KEEP_DAYS = 548;

/**
 * Drop `logs` and `waterIntake` entries older than KEEP_DAYS.
 *
 * Both are keyed by YYYY-MM-DD, which sorts lexicographically, so the cutoff
 * is a string comparison. Returns only the keys that changed, or an empty
 * object when nothing is over the line — so a rehydrate on a young account
 * does no work and allocates nothing.
 */
function prunedDayRecords(state: {
  logs?: Record<string, unknown>;
  waterIntake?: Record<string, unknown>;
}): { logs?: Record<string, unknown>; waterIntake?: Record<string, unknown> } {
  const cutoff = formatDate(new Date(Date.now() - KEEP_DAYS * 86400000));
  const out: { logs?: Record<string, unknown>; waterIntake?: Record<string, unknown> } = {};
  for (const key of ['logs', 'waterIntake'] as const) {
    const map = state[key];
    if (!map) continue;
    const dates = Object.keys(map);
    const stale = dates.filter((d) => d < cutoff);
    if (stale.length === 0) continue;
    const kept: Record<string, unknown> = {};
    for (const d of dates) if (d >= cutoff) kept[d] = map[d];
    out[key] = kept;
  }
  return out;
}

// Exported so Home can tell "never set any goals" apart from "set them by
// hand in the Calculator" — the nudge must not tell the second user that
// their own numbers are not theirs.
export const DEFAULT_GOALS: DailyGoals = {
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
        void pushSettings(settingsSnapshot(get()));
      };

      return {
      goals: DEFAULT_GOALS,
      logs: {},
      waterIntake: {},
      waterGoal: 64, // default ~8 cups
      // Sessions per week the consistency rings fill toward. 4 is what both
      // rings were hardcoded to before this was settable, so an existing
      // user's ring does not move when they update.
      weeklyWorkoutGoal: 4,
      goalsPromptDismissed: false,
      recoveryPresets: {},
      waterIncrement: 8, // fl oz per droplet tap
      showWaterTracker: true,
      themeMode: 'editorial',
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
      goalsAutoUpdate: true,
      goalsBasisWeightLbs: undefined,
      goalsUpdateNotice: undefined,
      profile: undefined,
      recentFoods: [],
      favoriteFoods: [],
      customFoods: [],
      customExercises: [],
      savedMeals: [],
      workoutTemplates: [],
      activeWorkout: null,
      activeRecovery: null,
      workoutHistory: [],

      // Typing goals in by hand is a deliberate override, so it clears the
      // basis weight — that's what marks goals as no longer wizard-managed and
      // stops a later weigh-in from silently replacing them.
      setGoals: (goals) => {
        set({ goals, goalsBasisWeightLbs: undefined, goalsUpdateNotice: undefined });
        syncSettings();
      },

      // Goals computed from the profile (wizard run, or an automatic rebuild).
      applyGoalPlan: (goals, basisWeightLbs) => {
        set({
          goals,
          goalsBasisWeightLbs: Math.round(basisWeightLbs * 10) / 10,
          // The wizard logs a weigh-in before applying its plan, which can
          // raise an automatic-update notice moments before these goals land.
          // Applying a plan explicitly supersedes it.
          goalsUpdateNotice: undefined,
        });
        syncSettings();
      },

      setGoalsAutoUpdate: (enabled) => {
        set({ goalsAutoUpdate: enabled });
        syncSettings();
      },

      dismissGoalsUpdateNotice: () => set({ goalsUpdateNotice: undefined }),

      // No syncSettings(): see the note on goalsPromptDismissed in AppState.
      dismissGoalsPrompt: () => set({ goalsPromptDismissed: true }),

      setRecoveryPreset: (kind, preset) => {
        set((state) => ({
          recoveryPresets: { ...state.recoveryPresets, [kind]: preset },
        }));
        syncSettings();
      },

      /**
       * Begin a sauna or plunge.
       *
       * Deliberately kept out of activeWorkout. A recovery session has no
       * sets to check off, and borrowing that slot would mean a sauna and a
       * lift could not both be in progress — which is wrong, since the
       * ordinary case is one straight after the other.
       *
       * The watch session, though, is shared: only one HKWorkoutSession can
       * run on a wrist at a time, so startWatchWorkout is the same call a
       * lift makes, carrying RECOVERY_HK as the activity type. That session
       * is what makes heart rate worth having here — off-workout the watch
       * samples every few minutes, which over a three-minute plunge is one
       * reading if you are lucky.
       */
      startRecovery: (kind, preset) => {
        // One HKWorkoutSession per wrist: starting this would silently take
        // the watch away from whatever is already running.
        const state0 = get();
        if (state0.activeWorkout || state0.activeRecovery) return null;
        const now = Date.now();
        const recovery: ActiveRecovery = {
          id: `r-${now}-${Math.random()}`,
          kind,
          targetSeconds: preset.targetSeconds,
          mode: preset.mode,
          startedAt: now,
        };
        set((state) => ({
          activeRecovery: recovery,
          recoveryPresets: { ...state.recoveryPresets, [kind]: preset },
        }));
        syncSettings();
        startWatchRecovery(recovery.id, kind, preset.targetSeconds, preset.mode);
        return recovery;
      },

      /**
       * Record a recovery the watch ran on its own.
       *
       * The counterpart to finishRecovery, for the session this phone never
       * saw begin: its start was queued while the phone was unreachable and
       * dropped on arrival for being stale, which is what happens to any
       * sauna longer than the command TTL. The watch's finish carries
       * everything needed, so the session is built from that rather than
       * lost. Idempotent on the start timestamp, since transferUserInfo can
       * deliver the same payload twice.
       */
      logWatchRecovery: (kind, startedAt, heldSeconds) => {
        const existing = get().workoutHistory.find(
          (w) => w.startedAt === startedAt && w.activityType === RECOVERY_HK
        );
        if (existing) return existing.id;
        const session: WorkoutSession = {
          id: `r-${startedAt}-${Math.random()}`,
          name: recoveryType(kind).label,
          activityType: RECOVERY_HK,
          date: formatDate(new Date(startedAt)),
          startedAt,
          completedAt: startedAt + Math.max(0, Math.round(heldSeconds)) * 1000,
          exercises: [],
        };
        set((state) => ({
          workoutHistory: [session, ...state.workoutHistory].slice(0, 100),
        }));
        void pushWorkout(session);
        return session.id;
      },

      cancelRecovery: () => {
        if (!get().activeRecovery) return;
        endWatchWorkout();
        set({ activeRecovery: null });
      },

      /**
       * Save the running recovery as a finished session.
       *
       * Dated from startedAt rather than today, so a plunge begun before
       * midnight lands on the day it was begun. The held time is what was
       * really done — the caller passes the elapsed it was displaying, and
       * the target never stands in for it.
       */
      finishRecovery: (heldSeconds) => {
        const active = get().activeRecovery;
        if (!active) return null;
        endWatchWorkout();
        const held =
          heldSeconds != null ? heldSeconds : (Date.now() - active.startedAt) / 1000;
        const session: WorkoutSession = {
          id: active.id,
          name: recoveryType(active.kind).label,
          activityType: RECOVERY_HK,
          date: formatDate(new Date(active.startedAt)),
          startedAt: active.startedAt,
          completedAt: active.startedAt + Math.max(0, Math.round(held)) * 1000,
          exercises: [],
        };
        set((state) => ({
          activeRecovery: null,
          workoutHistory: [session, ...state.workoutHistory].slice(0, 100),
        }));
        void pushWorkout(session);
        return session.id;
      },

      // Remembers a name typed at the rack so the picker has it next time.
      // Case-insensitive, because "hack squat" and "Hack Squat" are the same
      // machine and two entries would be worse than none.
      addCustomExercise: (name: string) => {
        const trimmed = name.trim();
        if (!trimmed) return;
        const key = trimmed.toLowerCase();
        set((state) => {
          if (state.customExercises.some((n) => n.toLowerCase() === key)) return state;
          return { customExercises: [...state.customExercises, trimmed].sort() };
        });
        syncSettings();
      },

      removeCustomExercise: (name: string) => {
        const key = name.trim().toLowerCase();
        set((state) => ({
          customExercises: state.customExercises.filter((n) => n.toLowerCase() !== key),
        }));
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

      setWeeklyWorkoutGoal: (n) => {
        // Clamped to the same 1–14 the Supabase check constraint enforces, so
        // the app can never write a row the database will reject — and never
        // a zero, which the ring would divide by.
        set({ weeklyWorkoutGoal: Math.max(1, Math.min(14, Math.round(n))) });
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
          const next: Partial<AppState> = {
            bodyWeightLog: log,
            bodyWeightLbs: Math.round(log[0].lbs),
          };

          // Goals track body weight: rebuild them when the smoothed weight has
          // drifted far enough from what the current targets were built on.
          // Returns null for hand-set goals, auto-update off, or small drift.
          const update = evaluateGoalsUpdate({
            profile: state.profile,
            goals: state.goals,
            bodyWeightLog: log,
            goalsAutoUpdate: state.goalsAutoUpdate,
            goalsBasisWeightLbs: state.goalsBasisWeightLbs,
          });
          if (update) {
            next.goals = update.plan.goals;
            next.goalsBasisWeightLbs = update.toWeightLbs;
            next.goalsUpdateNotice = {
              at: Date.now(),
              fromWeightLbs: update.fromWeightLbs,
              toWeightLbs: update.toWeightLbs,
              previousCalories: update.previousGoals.calories,
              previousProtein: update.previousGoals.protein,
              calories: update.plan.goals.calories,
              protein: update.plan.goals.protein,
            };
            // Keep the profile's stored weight in step, so a later wizard run
            // pre-fills with reality rather than the weight from signup.
            if (state.profile) {
              next.profile = { ...state.profile, weightLbs: update.toWeightLbs };
            }
          }
          return next as Partial<AppState>;
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

      restoreSavedMeal: (meal) => {
        set((state) => ({ savedMeals: [meal, ...state.savedMeals] }));
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

      restoreTemplate: (tpl) => {
        set((state) => ({ workoutTemplates: [tpl, ...state.workoutTemplates] }));
        syncSettings();
      },

      startWorkout: (template, activityType) => {
        const now = Date.now();
        // Seed each exercise from the last time it was performed (progressive
        // overload by default); the template's planned sets are the fallback.
        const history = get().workoutHistory;
        const session: WorkoutSession = {
          id: `w-${now}-${Math.random()}`,
          name: template?.name ?? 'Quick Workout',
          templateId: template?.id,
          activityType,
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
        // Kick off the matching workout on the watch so it captures heart rate,
        // using the chosen activity type so Apple Health categorizes it right.
        startWatchWorkout(session.id, activityType);
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

      // Puts back a workout the user has just deleted, so the delete can be
      // offered without a confirmation. Re-sorted rather than unshifted: the
      // undone workout belongs where its date puts it, not at the top.
      restoreWorkout: (w) => {
        set((state) => ({
          workoutHistory: [w, ...state.workoutHistory]
            .sort((a, b) => (a.date === b.date ? b.startedAt - a.startedAt : a.date < b.date ? 1 : -1))
            .slice(0, 100),
        }));
        void pushWorkout(w);
      },

      attachWorkoutHeartRate: (id, samples) => {
        // Store a downsampled series — dense raw HR (thousands of points per
        // workout) bloats the persisted store and slows cold-start.
        const trimmed = downsampleHeartRate(samples);
        set((state) => ({
          workoutHistory: state.workoutHistory.map((w) =>
            w.id === id ? { ...w, heartRateSamples: trimmed } : w
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

      updateHistoryWorkoutSet: (sessionId, exerciseId, setId, patch) => {
        let edited: WorkoutSession | undefined;
        set((state) => {
          const workoutHistory = state.workoutHistory.map((w) => {
            if (w.id !== sessionId) return w;
            edited = {
              ...w,
              exercises: w.exercises.map((e) =>
                e.id !== exerciseId
                  ? e
                  : { ...e, sets: e.sets.map((s) => (s.id === setId ? { ...s, ...patch } : s)) }
              ),
            };
            return edited;
          });
          // Nothing matched: leave the slice identity alone so subscribers
          // don't re-render over a no-op.
          return edited ? { workoutHistory } : {};
        });
        // Upsert, so the correction reaches the other devices that already
        // pulled the typo down.
        if (edited) void pushWorkout(edited);
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

      // Set a set's completed state to an absolute value (used by the watch so
      // repeated deliveries are idempotent — no toggle loops). Mirrors
      // toggleWorkoutSet's rest-trigger behavior.
      setWorkoutSetCompleted: (exerciseId, setId, completed) => {
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
                    becameComplete = completed && !s.completed;
                    return { ...s, completed };
                  }),
                }
          );
          const patch: Partial<AppState> = {
            activeWorkout: { ...state.activeWorkout, exercises },
          };
          if (becameComplete && state.autoRestTimer) {
            patch.restTrigger = state.restTrigger + 1;
          }
          return patch;
        });
      },

      // Mark every set in the active workout complete. Used when finishing a
      // workout with sets still unchecked (the user opts to complete them).
      // Doesn't touch the rest timer — the workout is ending.
      completeAllWorkoutSets: () => {
        set((state) => {
          if (!state.activeWorkout) return {};
          const exercises = state.activeWorkout.exercises.map((e) => ({
            ...e,
            sets: e.sets.map((s) => (s.completed ? s : { ...s, completed: true })),
          }));
          return { activeWorkout: { ...state.activeWorkout, exercises } };
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
          weeklyWorkoutGoal: 4,
          goalsPromptDismissed: false,
          recoveryPresets: {},
          logs: {},
          waterIntake: {},
          waterGoal: 64,
          waterIncrement: 8,
          showWaterTracker: true,
          themeMode: 'editorial',
          autoRestTimer: true,
          defaultRestSeconds: 120,
          restTrigger: 0,
          bodyWeightLbs: undefined,
          bodyWeightLog: [],
          profile: undefined,
          goalsAutoUpdate: true,
          goalsBasisWeightLbs: undefined,
          goalsUpdateNotice: undefined,
          recentFoods: [],
          favoriteFoods: [],
          customFoods: [],
      customExercises: [],
          savedMeals: [],
          workoutTemplates: [],
          activeWorkout: null,
          activeRecovery: null,
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
      version: 13,
      /**
       * Prune on every cold start, not only at the v13 migration.
       *
       * A migration runs once; eighteen months after it, the store would be
       * back where it started. This is the same shallow merge persist does by
       * default, with the cutoff applied on the way through — so the pruning
       * happens before the store is ever read, and costs nothing once an
       * account is inside the window.
       */
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<AppState>;
        return { ...current, ...p, ...prunedDayRecords(p) } as AppState;
      },
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
        // v7 downsamples heart-rate samples stored on past workouts. Early
        // builds kept the full dense stream (thousands of points each), which
        // bloated the persisted store and slowed cold-start. Shrink them once.
        if (version < 7 && state && Array.isArray(state.workoutHistory)) {
          state = {
            ...state,
            workoutHistory: state.workoutHistory.map((w: any) =>
              Array.isArray(w?.heartRateSamples) && w.heartRateSamples.length > 200
                ? { ...w, heartRateSamples: downsampleHeartRate(w.heartRateSamples) }
                : w
            ),
          };
        }
        // v8 replaced the light/dark/system appearance toggle with selectable
        // theme packs (editorial/sportTech) — full visual
        // identities rather than a brightness setting. Map the old value to
        // the closest pack: a prior dark preference lands on the one dark
        // pack; light/system land on the calmer, general-purpose default.
        if (version < 8 && state) {
          const old = state.themeMode;
          state = {
            ...state,
            themeMode: old === 'dark' ? 'sportTech' : 'editorial',
          };
        }
        // v9 removed the Classic pack — Executive is now the app's one
        // original/default look. Anyone who had Classic selected lands there.
        if (version < 9 && state?.themeMode === 'classic') {
          state = { ...state, themeMode: 'editorial' };
        }
        // v10 made goals follow body weight. Existing users who ran the wizard
        // have a profile but no recorded basis weight, so seed it from the
        // profile's weight — otherwise their first weigh-in would look like an
        // infinite drift and immediately rewrite their targets.
        if (version < 10 && state) {
          state = {
            ...state,
            goalsAutoUpdate: state.goalsAutoUpdate ?? true,
            goalsBasisWeightLbs:
              state.goalsBasisWeightLbs ?? state.profile?.weightLbs ?? undefined,
            goalsUpdateNotice: undefined,
          };
        }
        // v11 retired the Wellness pack and turned Executive dark. Anyone on
        // Wellness lands on Executive, the same way Classic's users did at v9.
        if (version < 11 && state?.themeMode === 'warmWellness') {
          state = { ...state, themeMode: 'editorial' };
        }
        // v12 added the saved-exercise list. Anyone upgrading has no array at
        // all, and the picker maps over it on every render.
        if (version < 12 && state && !Array.isArray(state.customExercises)) {
          state = { ...state, customExercises: [] };
        }
        // v13 shrinks what the store carries, measured rather than guessed.
        //
        // zustand/persist stringifies the whole store on every state change —
        // every water tap, every food entry — and at two years of daily use
        // that was 2.4 MB and ~13 ms of main-thread work per mutation on a
        // desktop CPU, so several times that on a phone. Two things dominated
        // it: heart-rate samples at 39% and food logs at 58%.
        //
        // Both are handled here. The samples are re-downsampled to the new,
        // lower cap; the logs are pruned to the window below. Together they
        // roughly halve the write cost at every horizon tested.
        if (version < 13 && state) {
          if (Array.isArray(state.workoutHistory)) {
            state = {
              ...state,
              workoutHistory: state.workoutHistory.map((w: any) =>
                Array.isArray(w?.heartRateSamples)
                  ? { ...w, heartRateSamples: downsampleHeartRate(w.heartRateSamples) }
                  : w
              ),
            };
          }
          state = { ...state, ...prunedDayRecords(state) };
        }
        return state;
      },
    }
  )
);
