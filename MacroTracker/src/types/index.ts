export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snacks';

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

// A single performed set: a weight × reps pair with a done checkbox.
export interface WorkoutSet {
  id: string;
  weight: number; // lbs
  reps: number;
  completed: boolean;
  type?: SetType; // undefined === 'normal'
}

// An exercise within an active/logged workout, holding its performed sets.
export interface WorkoutExercise {
  id: string;
  name: string;
  sets: WorkoutSet[];
}

// A single planned set inside a template — like a WorkoutSet but with no
// completed flag (it hasn't been performed yet).
export interface TemplateSet {
  id: string;
  weight: number; // lbs, 0 if unspecified
  reps: number;
  type?: SetType; // undefined === 'normal'
}

// A reusable plan the user builds once and can start workouts from. Each
// exercise now holds individually-defined sets (type / weight / reps).
export interface TemplateExercise {
  id: string;
  name: string;
  sets: TemplateSet[];
}

export interface WorkoutTemplate {
  id: string;
  name: string;
  exercises: TemplateExercise[];
  createdAt: number;
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
}

export interface AppState {
  goals: DailyGoals;
  logs: Record<string, FoodEntry[]>; // date -> entries
  waterIntake: Record<string, number>; // date -> fluid ounces
  waterGoal: number; // daily target in fluid ounces
  waterIncrement: number; // fl oz added per water droplet tap
  showWaterTracker: boolean;
  autoRestTimer: boolean; // auto-start rest timer when a set is completed
  restDurationSeconds: number; // default/last-used rest length
  restTrigger: number; // bumped to signal the rest timer to auto-start
  bodyWeightLbs?: number; // last known body weight, used for hydration calc
  recentFoods: Food[]; // most-recently scanned/logged foods, newest first
  workoutTemplates: WorkoutTemplate[];
  activeWorkout: WorkoutSession | null;
  workoutHistory: WorkoutSession[]; // completed sessions, newest first
  setGoals: (goals: DailyGoals) => void;
  addEntry: (entry: FoodEntry) => void;
  addRecentFood: (food: Food) => void;
  removeEntry: (date: string, entryId: string) => void;
  updateEntry: (date: string, entryId: string, servings: number) => void;
  addWater: (date: string, oz: number) => void;
  setWater: (date: string, oz: number) => void;
  setWaterGoal: (oz: number) => void;
  setWaterIncrement: (oz: number) => void;
  setShowWaterTracker: (show: boolean) => void;
  setAutoRestTimer: (on: boolean) => void;
  setRestDuration: (seconds: number) => void;
  setBodyWeight: (lbs: number) => void;
  getEntriesForDate: (date: string) => FoodEntry[];
  getTotalsForDate: (date: string) => MacroNutrients;
  getMealTotals: (date: string, meal: MealType) => MacroNutrients;
  // Workout templates
  saveTemplate: (template: WorkoutTemplate) => void;
  deleteTemplate: (id: string) => void;
  // Active workout lifecycle
  startWorkout: (template?: WorkoutTemplate) => void;
  cancelWorkout: () => void;
  finishWorkout: () => void;
  addWorkoutExercise: (name: string) => void;
  removeWorkoutExercise: (exerciseId: string) => void;
  addWorkoutSet: (exerciseId: string) => void;
  updateWorkoutSet: (
    exerciseId: string,
    setId: string,
    patch: Partial<Pick<WorkoutSet, 'weight' | 'reps' | 'type'>>
  ) => void;
  toggleWorkoutSet: (exerciseId: string, setId: string) => void;
  removeWorkoutSet: (exerciseId: string, setId: string) => void;
  reorderWorkoutExercise: (exerciseId: string, direction: 'up' | 'down') => void;
}
