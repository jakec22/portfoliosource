export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snacks';

// Appearance preference: explicit light/dark, or follow the OS setting.
export type ThemeMode = 'light' | 'dark' | 'system';

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

export interface DailyLog {
  date: string;
  entries: FoodEntry[];
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
export interface WorkoutSession {
  id: string;
  name: string;
  templateId?: string;
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

export interface AppState {
  goals: DailyGoals;
  logs: Record<string, FoodEntry[]>; // date -> entries
  waterIntake: Record<string, number>; // date -> fluid ounces
  waterGoal: number; // daily target in fluid ounces
  waterIncrement: number; // fl oz added per water droplet tap
  showWaterTracker: boolean;
  themeMode: ThemeMode; // appearance preference (light/dark/system)
  autoRestTimer: boolean; // auto-start rest timer when a set is completed
  notificationPrefs: ReminderPrefs; // local daily reminder settings (device-only)
  defaultRestSeconds: number; // user's default rest length (configured in Profile)
  restTrigger: number; // bumped to signal the rest timer to auto-start
  bodyWeightLbs?: number; // most recent body weight, used for the TDEE calc
  bodyWeightLog: BodyWeightEntry[]; // dated weight history, newest first
  profile?: UserProfile; // saved Goal Wizard inputs, used to pre-fill on re-run
  recentFoods: Food[]; // most-recently scanned/logged foods, newest first
  favoriteFoods: Food[]; // user-starred foods, shown above recents
  customFoods: Food[]; // user-created foods with custom macros
  savedMeals: SavedMeal[]; // named meal templates for quick re-logging
  workoutTemplates: WorkoutTemplate[];
  activeWorkout: WorkoutSession | null;
  workoutHistory: WorkoutSession[]; // completed sessions, newest first
  setGoals: (goals: DailyGoals) => void;
  addEntry: (entry: FoodEntry) => void;
  addRecentFood: (food: Food) => void;
  removeEntry: (date: string, entryId: string) => void;
  toggleFavoriteFood: (food: Food) => void;
  addCustomFood: (food: Food) => void;
  deleteCustomFood: (id: string) => void;
  saveMeal: (meal: SavedMeal) => void;
  deleteSavedMeal: (id: string) => void;
  copyMealFromDate: (fromDate: string, toDate: string, meal: MealType) => number;
  updateEntry: (date: string, entryId: string, patch: { servings: number; amount?: number; unit?: ServingUnit }) => void;
  addWater: (date: string, oz: number) => void;
  setWater: (date: string, oz: number) => void;
  setWaterGoal: (oz: number) => void;
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
  getEntriesForDate: (date: string) => FoodEntry[];
  getTotalsForDate: (date: string) => MacroNutrients;
  getMealTotals: (date: string, meal: MealType) => MacroNutrients;
  // Workout templates
  saveTemplate: (template: WorkoutTemplate) => void;
  deleteTemplate: (id: string) => void;
  // Active workout lifecycle
  startWorkout: (template?: WorkoutTemplate, activityType?: number) => void;
  cancelWorkout: () => void;
  finishWorkout: () => void;
  attachWorkoutHeartRate: (id: string, samples: HeartRateSample[]) => void;
  deleteWorkout: (id: string) => void;
  addWorkoutExercise: (name: string) => void;
  removeWorkoutExercise: (exerciseId: string) => void;
  addWorkoutSet: (exerciseId: string) => void;
  updateWorkoutSet: (
    exerciseId: string,
    setId: string,
    patch: Partial<Pick<WorkoutSet, 'weight' | 'reps' | 'durationSeconds' | 'type'>>
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
