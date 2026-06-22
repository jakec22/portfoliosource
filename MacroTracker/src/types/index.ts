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

export interface AppState {
  goals: DailyGoals;
  logs: Record<string, FoodEntry[]>; // date -> entries
  waterIntake: Record<string, number>; // date -> fluid ounces
  waterGoal: number; // daily target in fluid ounces
  waterIncrement: number; // fl oz added per water droplet tap
  bodyWeightLbs?: number; // last known body weight, used for hydration calc
  recentFoods: Food[]; // most-recently scanned/logged foods, newest first
  setGoals: (goals: DailyGoals) => void;
  addEntry: (entry: FoodEntry) => void;
  addRecentFood: (food: Food) => void;
  removeEntry: (date: string, entryId: string) => void;
  updateEntry: (date: string, entryId: string, servings: number) => void;
  addWater: (date: string, oz: number) => void;
  setWater: (date: string, oz: number) => void;
  setWaterGoal: (oz: number) => void;
  setWaterIncrement: (oz: number) => void;
  setBodyWeight: (lbs: number) => void;
  getEntriesForDate: (date: string) => FoodEntry[];
  getTotalsForDate: (date: string) => MacroNutrients;
  getMealTotals: (date: string, meal: MealType) => MacroNutrients;
}
