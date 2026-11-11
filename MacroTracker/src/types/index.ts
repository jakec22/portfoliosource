import type { RecoveryKind, TimerMode } from '../utils/workoutTypes';
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snacks';

// Which visual theme pack is active. Named `ThemeMode` for historical reasons
// (this field is synced to the cloud under the `theme_mode` column) — it used
// to hold 'light' | 'dark' | 'system'; it now holds a theme pack id. Each pack
// is a complete, fixed look (not a light/dark variant of one palette).
export type ThemeMode = 'editorial' | 'sportTech';

export interface ReminderTime {
  hour: number; // 0-23
  minute: number; // 0-59
}

export type ReminderKey = 'breakfast' | 'lunch' | 'dinner' | 'streak';

export interface ReminderPrefs {
  enabled: boolean; // master switch for daily reminders
  breakfast: boolean;
  lunch: boolean;
  dinner: boolean;
  streak: boolean; // evening "keep your streak" nudge
  times: Record<ReminderKey, ReminderTime>; // per-reminder trigger time
}

// How a logged amount is expressed. 'serving' = multiples of the food's
// base serving_size; the rest are absolute mass/volume amounts.
export type ServingUnit = 'serving' | 'g' | 'oz' | 'ml' | 'fl oz';

export interface MacroNutrients {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  sugar?: number;
}

export interface Food {
  id: string;
  name: string;
  brand?: string;
  serving_size: number;
  serving_unit: string;
  macros: MacroNutrients;
}

export interface FoodEntry {
  id: string;
  food: Food;
  servings: number; // multiplier applied to food.macros
  amount?: number; // amount entered in `unit` (for display)
  unit?: ServingUnit; // unit the amount was entered in (for display)
  meal: MealType;
  timestamp: number;
  date: string; // YYYY-MM-DD
}

export interface DailyGoals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}


// ----- Workouts / Exercise -----

// The role a set plays in an exercise. 'normal' is a regular working set;
// the rest are tags the user can apply per set.
export type SetType = 'normal' | 'warmup' | 'failure' | 'dropset';

// How an exercise's sets are measured. 'reps' is the default (weight × reps);
// 'time' tracks a held/elapsed duration (planks, carries, cardio intervals).
// Weight stays optional in both modes (e.g. weighted plank, farmer's carry).
export type ExerciseMode = 'reps' | 'time';

// A single performed set: weight plus either reps or a held duration, with a
// done checkbox. Which of reps/durationSeconds is used depends on the parent
// exercise's mode.
export interface WorkoutSet {
  id: string;
  weight: number; // lbs
  reps: number;
  durationSeconds?: number; // used when the exercise mode is 'time'
  completed: boolean;
  type?: SetType; // undefined === 'normal'
}

// An exercise within an active/logged workout, holding its performed sets.
export interface WorkoutExercise {
  id: string;
  name: string;
  mode?: ExerciseMode; // undefined === 'reps'
  sets: WorkoutSet[];
}

// A single planned set inside a template — like a WorkoutSet but with no
// completed flag (it hasn't been performed yet).
export interface TemplateSet {
  id: string;
  weight: number; // lbs, 0 if unspecified
  reps: number;
  durationSeconds?: number; // used when the exercise mode is 'time'
  type?: SetType; // undefined === 'normal'
}

// A reusable plan the user builds once and can start workouts from. Each
// exercise now holds individually-defined sets (type / weight / reps).
export interface TemplateExercise {
  id: string;
  name: string;
  mode?: ExerciseMode; // undefined === 'reps'
  sets: TemplateSet[];
}

export interface WorkoutTemplate {
  id: string;
  name: string;
  exercises: TemplateExercise[];
  createdAt: number;
  activityType?: number; // HKWorkoutActivityType raw value; undefined === Strength
}

// A single heart-rate reading captured during a workout.
export interface HeartRateSample {
  timestamp: number; // ms epoch
  bpm: number;
}

// A workout session — in progress (activeWorkout) or finished (history).
/** What the recovery timer was last set to for one kind of session. */
export interface RecoveryPreset {
  targetSeconds: number;
  mode: TimerMode;
}

/**
 * A sauna or plunge that is running right now.
 *
 * This lives in the store rather than in the timer screen's state because
 * three things outside that screen need it: the watch, which runs the
 * HKWorkoutSession that makes continuous heart rate possible; the heart-rate
 * buffer, which has to start clean and keep filling while the screen is
 * unmounted; and the user's own phone, which may well be in a locker for the
 * next fifteen minutes. Its `id` is minted at the start, not at the save, so
 * the heart-rate samples have something to attach to.
 */
export interface ActiveRecovery {
  id: string;
  kind: RecoveryKind;
  targetSeconds: number;
  mode: TimerMode;
  startedAt: number;
}

export interface WorkoutSession {
  id: string;
  name: string;
  templateId?: string;
  /**
   * HKWorkoutActivityType raw value; undefined === Strength, matching the
   * rule WorkoutTemplate has always used. 3000 ("other") marks a recovery
   * session — sauna or cold plunge — which isRecoverySession() reads to keep
   * them out of the training numbers.
   */
  activityType?: number;
  date: string; // YYYY-MM-DD
  startedAt: number;
  completedAt?: number;
  exercises: WorkoutExercise[];
  heartRateSamples?: HeartRateSample[]; // captured over the session, set on finish
}

// A single dated body-weight reading. Users can log as often as they like;
// multiple readings on one day are allowed (disambiguated by loggedAt).
export interface BodyWeightEntry {
  date: string; // YYYY-MM-DD
  lbs: number;
  loggedAt: number; // ms epoch
}

// A saved meal — a named collection of foods the user wants to re-log quickly.
export interface SavedMeal {
  id: string;
  name: string;
  items: Array<{ food: Food; servings: number }>;
  createdAt: number;
}

// The inputs the Goal Wizard collects, persisted so re-running it pre-fills the
// user's last answers. `heightCm`/`weightLbs` are stored canonically; `units`
// only controls how they're displayed/edited.
export interface UserProfile {
  sex: 'male' | 'female';
  age: number;
  heightCm: number;
  weightLbs: number;
  units: 'imperial' | 'metric';
  activityIdx: number;
  goalType: 'lose' | 'maintain' | 'gain';
  rateLbPerWeek: number; // 0 for maintain
  updatedAt: number;
}

// Summary of an automatic goal rebuild, shown once on Home.
export interface GoalsUpdateNotice {
  at: number;
  fromWeightLbs: number;
  toWeightLbs: number;
  previousCalories: number;
  previousProtein: number;
  calories: number;
  protein: number;
}

export interface AppState {
  goals: DailyGoals;
  logs: Record<string, FoodEntry[]>; // date -> entries
  waterIntake: Record<string, number>; // date -> fluid ounces
  waterGoal: number; // daily target in fluid ounces
  /**
   * Sessions per week the consistency rings on Home and Exercise fill
   * toward. Set in the goal wizard beside calories and macros, clamped to
   * 1–14, and cloud-synced (see migration 0004).
   *
   * It is a commitment, not an input to any calculation: it does not touch
   * TDEE, and training more than planned does not raise the calorie goal.
   */
  weeklyWorkoutGoal: number;
  /**
   * Whether the "your targets are still the defaults" card on Home has been
   * waved away. Deliberately NOT cloud-synced: it is device UI state, not
   * user data, and syncing it would cost a fifth Supabase migration for one
   * boolean. The card's real off-switch is running the wizard, which sets
   * `profile` — and that does sync, so it clears the card everywhere.
   */
  goalsPromptDismissed: boolean;
  /** Last timer settings per recovery type, so each remembers its own. */
  recoveryPresets: Partial<Record<RecoveryKind, RecoveryPreset>>;
  /**
   * Minutes of heat or cold a week, per kind. Missing or 0 means no target,
   * which is the default and stays the default.
   *
   * Off rather than a shipped number on purpose. The weekly workout goal can
   * default to 4 because the wizard asks for it and nearly everyone training
   * has some answer; nobody is asked for this, most users never log a sauna
   * at all, and a target they did not choose would turn a summary into a
   * verdict. Separate per kind because heat and cold are aimed at apart.
   */
  recoveryGoals: Partial<Record<RecoveryKind, number>>;
  waterIncrement: number; // fl oz added per water droplet tap
  showWaterTracker: boolean;
  themeMode: ThemeMode; // active theme pack (editorial/sportTech)
  autoRestTimer: boolean; // auto-start rest timer when a set is completed
  notificationPrefs: ReminderPrefs; // local daily reminder settings (device-only)
  defaultRestSeconds: number; // user's default rest length (configured in Profile)
  restTrigger: number; // bumped to signal the rest timer to auto-start
  bodyWeightLbs?: number; // most recent body weight, used for the TDEE calc
  bodyWeightLog: BodyWeightEntry[]; // dated weight history, newest first
  profile?: UserProfile; // saved Goal Wizard inputs, used to pre-fill on re-run
  // Goals follow body weight when they came from the wizard. Typing goals in
  // by hand turns this off, so a weigh-in can't overwrite deliberate numbers.
  goalsAutoUpdate: boolean;
  // Body weight the current goals were computed from; undefined for hand-set
  // goals, which is what marks them as not wizard-managed.
  goalsBasisWeightLbs?: number;
  // Set when goals were rebuilt automatically, so Home can explain the change.
  // Cleared on dismiss.
  goalsUpdateNotice?: GoalsUpdateNotice;
  recentFoods: Food[]; // most-recently scanned/logged foods, newest first
  favoriteFoods: Food[]; // user-starred foods, shown above recents
  customFoods: Food[];
  /**
   * Exercise names typed by hand and kept for the picker.
   *
   * Synced, as of migration 0003_custom_exercises.sql. It was local-only until
   * that column existed, because pushSettings maps explicit columns and sends
   * the whole row at once: one unknown column fails the entire upsert, taking
   * goals, templates and water with it. Run the migration before any build
   * carrying this field.
   */
  customExercises: string[];
  savedMeals: SavedMeal[]; // named meal templates for quick re-logging
  workoutTemplates: WorkoutTemplate[];
  activeWorkout: WorkoutSession | null;
  activeRecovery: ActiveRecovery | null;
  workoutHistory: WorkoutSession[]; // completed sessions, newest first
  setGoals: (goals: DailyGoals) => void;
  // Applies goals derived from the wizard (or an automatic rebuild) and
  // records the weight they were built on, keeping auto-update active.
  applyGoalPlan: (goals: DailyGoals, basisWeightLbs: number) => void;
  setGoalsAutoUpdate: (enabled: boolean) => void;
  dismissGoalsUpdateNotice: () => void;
  addEntry: (entry: FoodEntry) => void;
  addRecentFood: (food: Food) => void;
  removeEntry: (date: string, entryId: string) => void;
  toggleFavoriteFood: (food: Food) => void;
  addCustomFood: (food: Food) => void;
  deleteCustomFood: (id: string) => void;
  saveMeal: (meal: SavedMeal) => void;
  addCustomExercise: (name: string) => void;
  removeCustomExercise: (name: string) => void;
  deleteSavedMeal: (id: string) => void;
  restoreSavedMeal: (meal: SavedMeal) => void;
  copyMealFromDate: (fromDate: string, toDate: string, meal: MealType) => number;
  updateEntry: (date: string, entryId: string, patch: { servings: number; amount?: number; unit?: ServingUnit }) => void;
  addWater: (date: string, oz: number) => void;
  setWater: (date: string, oz: number) => void;
  setWaterGoal: (oz: number) => void;
  setWeeklyWorkoutGoal: (n: number) => void;
  /** Minutes a week for one recovery kind. 0 turns the target off. */
  setRecoveryGoal: (kind: RecoveryKind, minutes: number) => void;
  dismissGoalsPrompt: () => void;
  setRecoveryPreset: (kind: RecoveryKind, preset: RecoveryPreset) => void;
  /**
   * Begin a sauna or plunge, remember the target as the preset, and ask the
   * watch for a session so heart rate is sampled continuously rather than
   * every few minutes. Returns the record, whose id the caller needs to
   * attach heart rate to afterwards — or null when a workout or another
   * recovery is already running, since a wrist holds one HKWorkoutSession.
   */
  startRecovery: (kind: RecoveryKind, preset: RecoveryPreset) => ActiveRecovery | null;
  /** Abandon the running recovery without saving it. */
  cancelRecovery: () => void;
  /**
   * Record a recovery the watch ran start to finish on its own, for when its
   * start never reached this phone. Returns the saved session's id, or the
   * existing one if this finish has already been delivered.
   */
  logWatchRecovery: (
    kind: RecoveryKind,
    startedAt: number,
    heldSeconds: number
  ) => string;
  /**
   * Save the running recovery as a session. `heldSeconds` is what the user
   * actually held; omitted, it is measured from the start. Returns the saved
   * session's id, or null if nothing was running.
   */
  finishRecovery: (heldSeconds?: number) => string | null;
  setWaterIncrement: (oz: number) => void;
  setShowWaterTracker: (show: boolean) => void;
  setThemeMode: (mode: ThemeMode) => void;
  setAutoRestTimer: (on: boolean) => void;
  setNotificationPrefs: (prefs: ReminderPrefs) => void;
  setDefaultRestSeconds: (seconds: number) => void;
  setBodyWeight: (lbs: number) => void;
  setProfile: (profile: UserProfile) => void;
  logBodyWeight: (lbs: number, date?: string) => void;
  deleteBodyWeightEntry: (loggedAt: number) => void;
  /** Put back a weigh-in just deleted, so the ✕ is recoverable. */
  restoreBodyWeightEntry: (entry: BodyWeightEntry) => void;
  getEntriesForDate: (date: string) => FoodEntry[];
  getTotalsForDate: (date: string) => MacroNutrients;
  getMealTotals: (date: string, meal: MealType) => MacroNutrients;
  // Workout templates
  saveTemplate: (template: WorkoutTemplate) => void;
  deleteTemplate: (id: string) => void;
  restoreTemplate: (tpl: WorkoutTemplate) => void;
  // Active workout lifecycle
  startWorkout: (template?: WorkoutTemplate, activityType?: number) => void;
  cancelWorkout: () => void;
  finishWorkout: () => void;
  attachWorkoutHeartRate: (id: string, samples: HeartRateSample[]) => void;
  deleteWorkout: (id: string) => void;
  restoreWorkout: (w: WorkoutSession) => void;
  addWorkoutExercise: (name: string) => void;
  removeWorkoutExercise: (exerciseId: string) => void;
  addWorkoutSet: (exerciseId: string) => void;
  updateWorkoutSet: (
    exerciseId: string,
    setId: string,
    patch: Partial<Pick<WorkoutSet, 'weight' | 'reps' | 'durationSeconds' | 'type'>>
  ) => void;
  /**
   * Correct a set in an already-finished workout.
   *
   * Everything downstream — session volume, the "vs last time" comparison,
   * PR detection, the progress charts, the training split and body map — is
   * derived from workoutHistory on read, so a mistyped weight isn't a cosmetic
   * blemish on one session: it silently skews every one of those until it's
   * fixed, and a fat-fingered 1850 can plant a permanent fake PR.
   */
  updateHistoryWorkoutSet: (
    sessionId: string,
    exerciseId: string,
    setId: string,
    patch: Partial<Pick<WorkoutSet, 'weight' | 'reps' | 'durationSeconds'>>
  ) => void;
  setExerciseMode: (exerciseId: string, mode: ExerciseMode) => void;
  toggleWorkoutSet: (exerciseId: string, setId: string) => void;
  setWorkoutSetCompleted: (exerciseId: string, setId: string, completed: boolean) => void;
  /** Mark every set in the active workout as completed (used when finishing). */
  completeAllWorkoutSets: () => void;
  removeWorkoutSet: (exerciseId: string, setId: string) => void;
  reorderWorkoutExercise: (exerciseId: string, direction: 'up' | 'down') => void;
  clearLocalData: () => void;
}
