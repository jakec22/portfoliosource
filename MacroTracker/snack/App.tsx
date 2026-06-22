// MacroTracker — single-file build for Expo Snack (snack.expo.dev)
// Paste this entire file into App.js / App.tsx on Snack.
// Snack will auto-detect and add the required packages.

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  TextInput,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snacks';

interface MacroNutrients {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  sugar?: number;
}

interface Food {
  id: string;
  name: string;
  brand?: string;
  serving_size: number;
  serving_unit: string;
  macros: MacroNutrients;
}

interface FoodEntry {
  id: string;
  food: Food;
  servings: number;
  meal: MealType;
  timestamp: number;
  date: string;
}

interface DailyGoals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}

interface AppState {
  goals: DailyGoals;
  logs: Record<string, FoodEntry[]>;
  waterIntake: Record<string, number>;
  setGoals: (goals: DailyGoals) => void;
  addEntry: (entry: FoodEntry) => void;
  removeEntry: (date: string, entryId: string) => void;
  updateEntry: (date: string, entryId: string, servings: number) => void;
  addWater: (date: string, ml: number) => void;
  getEntriesForDate: (date: string) => FoodEntry[];
  getTotalsForDate: (date: string) => MacroNutrients;
  getMealTotals: (date: string, meal: MealType) => MacroNutrients;
}

/* ------------------------------------------------------------------ */
/* Date utils                                                          */
/* ------------------------------------------------------------------ */

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function todayString(): string {
  return formatDate(new Date());
}

function parseDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function displayDate(dateStr: string): string {
  const today = todayString();
  const yesterday = formatDate(new Date(Date.now() - 86400000));
  if (dateStr === today) return 'Today';
  if (dateStr === yesterday) return 'Yesterday';
  const d = parseDate(dateStr);
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function getPastDays(n: number): string[] {
  const days: string[] = [];
  for (let i = 0; i < n; i++) {
    days.push(formatDate(new Date(Date.now() - i * 86400000)));
  }
  return days;
}

/* ------------------------------------------------------------------ */
/* Food database                                                       */
/* ------------------------------------------------------------------ */

const COMMON_FOODS: Food[] = [
  { id: 'chicken-breast', name: 'Chicken Breast', brand: 'Generic', serving_size: 100, serving_unit: 'g', macros: { calories: 165, protein: 31, carbs: 0, fat: 3.6, fiber: 0 } },
  { id: 'brown-rice', name: 'Brown Rice (cooked)', brand: 'Generic', serving_size: 100, serving_unit: 'g', macros: { calories: 123, protein: 2.7, carbs: 25.6, fat: 0.9, fiber: 1.8 } },
  { id: 'broccoli', name: 'Broccoli (raw)', brand: 'Generic', serving_size: 100, serving_unit: 'g', macros: { calories: 34, protein: 2.8, carbs: 6.6, fat: 0.4, fiber: 2.6 } },
  { id: 'whole-egg', name: 'Whole Egg', brand: 'Generic', serving_size: 50, serving_unit: 'g', macros: { calories: 72, protein: 6.3, carbs: 0.4, fat: 4.8, fiber: 0 } },
  { id: 'oats', name: 'Rolled Oats (dry)', brand: 'Generic', serving_size: 40, serving_unit: 'g', macros: { calories: 148, protein: 5.4, carbs: 25.2, fat: 2.7, fiber: 4 } },
  { id: 'banana', name: 'Banana', brand: 'Generic', serving_size: 118, serving_unit: 'g', macros: { calories: 105, protein: 1.3, carbs: 27, fat: 0.4, fiber: 3.1, sugar: 14.4 } },
  { id: 'greek-yogurt', name: 'Greek Yogurt (plain)', brand: 'Generic', serving_size: 170, serving_unit: 'g', macros: { calories: 100, protein: 17, carbs: 6, fat: 0.7, fiber: 0 } },
  { id: 'almonds', name: 'Almonds', brand: 'Generic', serving_size: 28, serving_unit: 'g', macros: { calories: 164, protein: 6, carbs: 6.1, fat: 14.2, fiber: 3.5 } },
  { id: 'salmon', name: 'Salmon (cooked)', brand: 'Generic', serving_size: 100, serving_unit: 'g', macros: { calories: 206, protein: 28.8, carbs: 0, fat: 9.7, fiber: 0 } },
  { id: 'sweet-potato', name: 'Sweet Potato (baked)', brand: 'Generic', serving_size: 100, serving_unit: 'g', macros: { calories: 90, protein: 2, carbs: 20.7, fat: 0.1, fiber: 3.3, sugar: 6.5 } },
  { id: 'ground-beef-lean', name: 'Ground Beef (95% lean)', brand: 'Generic', serving_size: 100, serving_unit: 'g', macros: { calories: 152, protein: 21, carbs: 0, fat: 7.5, fiber: 0 } },
  { id: 'white-rice', name: 'White Rice (cooked)', brand: 'Generic', serving_size: 100, serving_unit: 'g', macros: { calories: 130, protein: 2.7, carbs: 28.6, fat: 0.3, fiber: 0.4 } },
  { id: 'avocado', name: 'Avocado', brand: 'Generic', serving_size: 100, serving_unit: 'g', macros: { calories: 160, protein: 2, carbs: 8.5, fat: 14.7, fiber: 6.7 } },
  { id: 'cottage-cheese', name: 'Cottage Cheese (2%)', brand: 'Generic', serving_size: 113, serving_unit: 'g', macros: { calories: 90, protein: 12, carbs: 5, fat: 2.5, fiber: 0 } },
  { id: 'tuna-canned', name: 'Tuna (canned in water)', brand: 'Generic', serving_size: 85, serving_unit: 'g', macros: { calories: 100, protein: 22, carbs: 0, fat: 0.5, fiber: 0 } },
  { id: 'whole-milk', name: 'Whole Milk', brand: 'Generic', serving_size: 244, serving_unit: 'ml', macros: { calories: 149, protein: 8, carbs: 11.7, fat: 8, fiber: 0, sugar: 12.3 } },
  { id: 'apple', name: 'Apple', brand: 'Generic', serving_size: 182, serving_unit: 'g', macros: { calories: 95, protein: 0.5, carbs: 25, fat: 0.3, fiber: 4.4, sugar: 19 } },
  { id: 'bread-whole-wheat', name: 'Whole Wheat Bread', brand: 'Generic', serving_size: 28, serving_unit: 'g', macros: { calories: 70, protein: 4, carbs: 12, fat: 1, fiber: 2 } },
  { id: 'peanut-butter', name: 'Peanut Butter', brand: 'Generic', serving_size: 32, serving_unit: 'g', macros: { calories: 190, protein: 8, carbs: 6, fat: 16, fiber: 2, sugar: 3 } },
  { id: 'protein-powder', name: 'Whey Protein Powder', brand: 'Generic', serving_size: 30, serving_unit: 'g', macros: { calories: 120, protein: 24, carbs: 3, fat: 2, fiber: 0 } },
  { id: 'spinach', name: 'Spinach (raw)', brand: 'Generic', serving_size: 30, serving_unit: 'g', macros: { calories: 7, protein: 0.9, carbs: 1.1, fat: 0.1, fiber: 0.7 } },
  { id: 'olive-oil', name: 'Olive Oil', brand: 'Generic', serving_size: 14, serving_unit: 'g', macros: { calories: 119, protein: 0, carbs: 0, fat: 13.5, fiber: 0 } },
  { id: 'blueberries', name: 'Blueberries', brand: 'Generic', serving_size: 148, serving_unit: 'g', macros: { calories: 84, protein: 1.1, carbs: 21.4, fat: 0.5, fiber: 3.6, sugar: 14.7 } },
  { id: 'quinoa', name: 'Quinoa (cooked)', brand: 'Generic', serving_size: 100, serving_unit: 'g', macros: { calories: 120, protein: 4.4, carbs: 21.3, fat: 1.9, fiber: 2.8 } },
  { id: 'turkey-breast', name: 'Turkey Breast', brand: 'Generic', serving_size: 85, serving_unit: 'g', macros: { calories: 90, protein: 20, carbs: 0, fat: 0.5, fiber: 0 } },
];

function searchFoods(query: string): Food[] {
  const q = query.toLowerCase().trim();
  if (!q) return COMMON_FOODS;
  return COMMON_FOODS.filter(
    (f) =>
      f.name.toLowerCase().includes(q) ||
      (f.brand && f.brand.toLowerCase().includes(q))
  );
}

/* ------------------------------------------------------------------ */
/* Store                                                               */
/* ------------------------------------------------------------------ */

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

function sumMacros(entries: FoodEntry[]): MacroNutrients {
  return entries.reduce(
    (acc, entry) => {
      const { macros } = entry.food;
      const s = entry.servings;
      return {
        calories: acc.calories + macros.calories * s,
        protein: acc.protein + macros.protein * s,
        carbs: acc.carbs + macros.carbs * s,
        fat: acc.fat + macros.fat * s,
        fiber: (acc.fiber ?? 0) + (macros.fiber ?? 0) * s,
      };
    },
    { ...ZERO_MACROS }
  );
}

const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      goals: DEFAULT_GOALS,
      logs: {},
      waterIntake: {},
      setGoals: (goals) => set({ goals }),
      addEntry: (entry) =>
        set((state) => {
          const existing = state.logs[entry.date] ?? [];
          return { logs: { ...state.logs, [entry.date]: [...existing, entry] } };
        }),
      removeEntry: (date, entryId) =>
        set((state) => {
          const existing = state.logs[date] ?? [];
          return {
            logs: {
              ...state.logs,
              [date]: existing.filter((e) => e.id !== entryId),
            },
          };
        }),
      updateEntry: (date, entryId, servings) =>
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
        }),
      addWater: (date, ml) =>
        set((state) => ({
          waterIntake: {
            ...state.waterIntake,
            [date]: (state.waterIntake[date] ?? 0) + ml,
          },
        })),
      getEntriesForDate: (date) => get().logs[date] ?? [],
      getTotalsForDate: (date) => sumMacros(get().logs[date] ?? []),
      getMealTotals: (date, meal) =>
        sumMacros((get().logs[date] ?? []).filter((e) => e.meal === meal)),
    }),
    {
      name: 'macro-tracker-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

/* ------------------------------------------------------------------ */
/* Components                                                          */
/* ------------------------------------------------------------------ */

function MacroRing({
  current,
  goal,
  label,
  color,
  unit = 'g',
  size = 80,
  strokeWidth = 8,
}: {
  current: number;
  goal: number;
  label: string;
  color: string;
  unit?: string;
  size?: number;
  strokeWidth?: number;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(current / goal, 1);
  const strokeDashoffset = circumference * (1 - progress);
  const over = current > goal;

  return (
    <View style={[ringStyles.container, { width: size, height: size + 30 }]}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Circle cx={size / 2} cy={size / 2} r={radius} stroke="#E5E7EB" strokeWidth={strokeWidth} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={over ? '#EF4444' : color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          rotation="-90"
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <View style={[ringStyles.center, { width: size, height: size, top: 0 }]}>
        <Text style={[ringStyles.value, { color: over ? '#EF4444' : '#111827' }]}>
          {Math.round(current)}
        </Text>
        <Text style={ringStyles.unit}>{unit}</Text>
      </View>
      <Text style={ringStyles.label}>{label}</Text>
      <Text style={ringStyles.goal}>/ {goal}{unit}</Text>
    </View>
  );
}

const ringStyles = StyleSheet.create({
  container: { alignItems: 'center', position: 'relative' },
  center: { position: 'absolute', justifyContent: 'center', alignItems: 'center' },
  value: { fontSize: 16, fontWeight: '700', lineHeight: 18 },
  unit: { fontSize: 10, color: '#6B7280', lineHeight: 12 },
  label: { fontSize: 12, fontWeight: '600', color: '#374151', marginTop: 4 },
  goal: { fontSize: 10, color: '#9CA3AF' },
});

function CalorieSummary({
  consumed,
  goal,
  size = 160,
}: {
  consumed: number;
  goal: number;
  size?: number;
}) {
  const strokeWidth = 14;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(consumed / goal, 1);
  const offset = circumference * (1 - progress);
  const remaining = goal - consumed;
  const over = consumed > goal;

  return (
    <View style={calStyles.wrapper}>
      <View style={[calStyles.container, { width: size, height: size }]}>
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <Circle cx={size / 2} cy={size / 2} r={radius} stroke="#F3F4F6" strokeWidth={strokeWidth} fill="none" />
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={over ? '#EF4444' : '#10B981'}
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            rotation="-90"
            origin={`${size / 2}, ${size / 2}`}
          />
        </Svg>
        <View style={[calStyles.center, { width: size, height: size }]}>
          <Text style={[calStyles.consumedValue, over && calStyles.overValue]}>
            {Math.round(consumed)}
          </Text>
          <Text style={calStyles.consumedLabel}>consumed</Text>
          <View style={calStyles.divider} />
          <Text style={[calStyles.remainingValue, over && calStyles.overValue]}>
            {Math.abs(Math.round(remaining))}
          </Text>
          <Text style={calStyles.remainingLabel}>{over ? 'over' : 'remaining'}</Text>
        </View>
      </View>
      <View style={calStyles.stats}>
        <View style={calStyles.stat}>
          <Text style={calStyles.statValue}>{goal}</Text>
          <Text style={calStyles.statLabel}>Goal</Text>
        </View>
        <Text style={calStyles.minus}>−</Text>
        <View style={calStyles.stat}>
          <Text style={calStyles.statValue}>{Math.round(consumed)}</Text>
          <Text style={calStyles.statLabel}>Food</Text>
        </View>
        <Text style={calStyles.equals}>=</Text>
        <View style={calStyles.stat}>
          <Text style={[calStyles.statValue, over && calStyles.overValue]}>
            {Math.abs(Math.round(remaining))}
          </Text>
          <Text style={calStyles.statLabel}>{over ? 'Over' : 'Left'}</Text>
        </View>
      </View>
    </View>
  );
}

const calStyles = StyleSheet.create({
  wrapper: { alignItems: 'center' },
  container: { position: 'relative', alignItems: 'center', justifyContent: 'center' },
  center: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  consumedValue: { fontSize: 32, fontWeight: '800', color: '#111827', lineHeight: 36 },
  consumedLabel: { fontSize: 12, color: '#9CA3AF', marginBottom: 4 },
  divider: { width: 40, height: 1, backgroundColor: '#E5E7EB', marginVertical: 6 },
  remainingValue: { fontSize: 20, fontWeight: '700', color: '#10B981', lineHeight: 24 },
  remainingLabel: { fontSize: 11, color: '#9CA3AF' },
  overValue: { color: '#EF4444' },
  stats: { flexDirection: 'row', alignItems: 'center', marginTop: 16, gap: 12 },
  stat: { alignItems: 'center' },
  statValue: { fontSize: 16, fontWeight: '700', color: '#111827' },
  statLabel: { fontSize: 11, color: '#9CA3AF' },
  minus: { fontSize: 18, color: '#D1D5DB', fontWeight: '300' },
  equals: { fontSize: 18, color: '#D1D5DB', fontWeight: '300' },
});

const MEAL_LABELS: Record<MealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snacks: 'Snacks',
};

const MEAL_ICONS: Record<MealType, string> = {
  breakfast: '🌅',
  lunch: '☀️',
  dinner: '🌙',
  snacks: '🍎',
};

function MealSection({
  meal,
  date,
  onAddFood,
}: {
  meal: MealType;
  date: string;
  onAddFood: (meal: MealType) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const entries = useStore((s) => s.getEntriesForDate(date)).filter(
    (e) => e.meal === meal
  );
  const removeEntry = useStore((s) => s.removeEntry);

  const total = entries.reduce(
    (acc, e) => acc + e.food.macros.calories * e.servings,
    0
  );

  function handleDelete(entry: FoodEntry) {
    Alert.alert('Remove Food', `Remove ${entry.food.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => removeEntry(date, entry.id) },
    ]);
  }

  return (
    <View style={mealStyles.container}>
      <TouchableOpacity style={mealStyles.header} onPress={() => setExpanded((v) => !v)} activeOpacity={0.7}>
        <View style={mealStyles.headerLeft}>
          <Text style={mealStyles.icon}>{MEAL_ICONS[meal]}</Text>
          <Text style={mealStyles.mealName}>{MEAL_LABELS[meal]}</Text>
        </View>
        <View style={mealStyles.headerRight}>
          <Text style={mealStyles.mealCals}>{Math.round(total)} kcal</Text>
          <Text style={mealStyles.chevron}>{expanded ? '▲' : '▼'}</Text>
        </View>
      </TouchableOpacity>

      {expanded && (
        <View style={mealStyles.body}>
          {entries.length === 0 ? (
            <Text style={mealStyles.empty}>No foods logged yet</Text>
          ) : (
            entries.map((entry) => (
              <TouchableOpacity
                key={entry.id}
                style={mealStyles.entryRow}
                onLongPress={() => handleDelete(entry)}
                activeOpacity={0.7}
              >
                <View style={mealStyles.entryLeft}>
                  <Text style={mealStyles.entryName}>{entry.food.name}</Text>
                  <Text style={mealStyles.entryDetail}>
                    {entry.servings} × {entry.food.serving_size}
                    {entry.food.serving_unit}
                  </Text>
                </View>
                <View style={mealStyles.entryMacros}>
                  <Text style={mealStyles.entryCals}>
                    {Math.round(entry.food.macros.calories * entry.servings)} kcal
                  </Text>
                  <Text style={mealStyles.entryMacroDetail}>
                    P:{Math.round(entry.food.macros.protein * entry.servings)}g{'  '}
                    C:{Math.round(entry.food.macros.carbs * entry.servings)}g{'  '}
                    F:{Math.round(entry.food.macros.fat * entry.servings)}g
                  </Text>
                </View>
              </TouchableOpacity>
            ))
          )}
          <TouchableOpacity style={mealStyles.addButton} onPress={() => onAddFood(meal)} activeOpacity={0.7}>
            <Text style={mealStyles.addButtonText}>+ Add Food</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const mealStyles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  icon: { fontSize: 18 },
  mealName: { fontSize: 16, fontWeight: '600', color: '#111827' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  mealCals: { fontSize: 14, color: '#6B7280', fontWeight: '500' },
  chevron: { fontSize: 10, color: '#9CA3AF' },
  body: { borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  empty: { textAlign: 'center', color: '#9CA3AF', fontSize: 13, paddingVertical: 12 },
  entryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F9FAFB' },
  entryLeft: { flex: 1 },
  entryName: { fontSize: 14, fontWeight: '500', color: '#1F2937' },
  entryDetail: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  entryMacros: { alignItems: 'flex-end' },
  entryCals: { fontSize: 14, fontWeight: '600', color: '#111827' },
  entryMacroDetail: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  addButton: { paddingVertical: 12, alignItems: 'center' },
  addButtonText: { fontSize: 14, fontWeight: '600', color: '#10B981' },
});

/* ------------------------------------------------------------------ */
/* Home Screen                                                         */
/* ------------------------------------------------------------------ */

function HomeScreen({ navigation }: any) {
  const [selectedDate, setSelectedDate] = useState(todayString());
  const goals = useStore((s) => s.goals);
  const getTotals = useStore((s) => s.getTotalsForDate);
  const waterIntake = useStore((s) => s.waterIntake);
  const addWater = useStore((s) => s.addWater);

  const totals = getTotals(selectedDate);
  const water = waterIntake[selectedDate] ?? 0;

  function goDay(offset: number) {
    const current = new Date(selectedDate + 'T12:00:00');
    current.setDate(current.getDate() + offset);
    const newDate = formatDate(current);
    if (newDate <= todayString()) setSelectedDate(newDate);
  }

  function handleAddFood(meal: MealType) {
    navigation.navigate('LogFood', { meal, date: selectedDate });
  }

  const isToday = selectedDate === todayString();

  return (
    <SafeAreaView style={homeStyles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#F9FAFB" />
      <ScrollView style={homeStyles.scroll} contentContainerStyle={homeStyles.content}>
        <View style={homeStyles.dateNav}>
          <TouchableOpacity onPress={() => goDay(-1)} style={homeStyles.navBtn}>
            <Text style={homeStyles.navArrow}>‹</Text>
          </TouchableOpacity>
          <Text style={homeStyles.dateLabel}>{displayDate(selectedDate)}</Text>
          <TouchableOpacity
            onPress={() => goDay(1)}
            style={[homeStyles.navBtn, isToday && homeStyles.navBtnDisabled]}
            disabled={isToday}
          >
            <Text style={[homeStyles.navArrow, isToday && homeStyles.navArrowDisabled]}>›</Text>
          </TouchableOpacity>
        </View>

        <View style={homeStyles.card}>
          <Text style={homeStyles.cardTitle}>Calories</Text>
          <CalorieSummary consumed={totals.calories} goal={goals.calories} />
        </View>

        <View style={homeStyles.card}>
          <Text style={homeStyles.cardTitle}>Macros</Text>
          <View style={homeStyles.macroRow}>
            <MacroRing current={totals.protein} goal={goals.protein} label="Protein" color="#3B82F6" />
            <MacroRing current={totals.carbs} goal={goals.carbs} label="Carbs" color="#F59E0B" />
            <MacroRing current={totals.fat} goal={goals.fat} label="Fat" color="#EF4444" />
            <MacroRing current={totals.fiber ?? 0} goal={goals.fiber} label="Fiber" color="#8B5CF6" />
          </View>
        </View>

        <View style={homeStyles.card}>
          <View style={homeStyles.waterHeader}>
            <Text style={homeStyles.cardTitle}>💧 Water</Text>
            <Text style={homeStyles.waterAmount}>{(water / 1000).toFixed(1)}L</Text>
          </View>
          <View style={homeStyles.waterDots}>
            {[250, 250, 250, 250, 250, 250, 250, 250].map((ml, i) => (
              <TouchableOpacity
                key={i}
                onPress={() => addWater(selectedDate, ml)}
                style={[homeStyles.waterDot, water >= ml * (i + 1) && homeStyles.waterDotFilled]}
              >
                <Text style={homeStyles.waterDotText}>💧</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={homeStyles.waterGoal}>Goal: 2L · tap to add 250ml</Text>
        </View>

        <View style={homeStyles.mealsHeader}>
          <Text style={homeStyles.mealsTitle}>Food Log</Text>
        </View>
        {(['breakfast', 'lunch', 'dinner', 'snacks'] as MealType[]).map((meal) => (
          <MealSection key={meal} meal={meal} date={selectedDate} onAddFood={handleAddFood} />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const homeStyles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 32 },
  dateNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 16, gap: 20 },
  navBtn: { padding: 8 },
  navBtnDisabled: { opacity: 0.3 },
  navArrow: { fontSize: 28, color: '#374151', fontWeight: '300' },
  navArrowDisabled: { color: '#D1D5DB' },
  dateLabel: { fontSize: 20, fontWeight: '700', color: '#111827', minWidth: 120, textAlign: 'center' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#374151', marginBottom: 16 },
  macroRow: { flexDirection: 'row', justifyContent: 'space-around' },
  waterHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  waterAmount: { fontSize: 18, fontWeight: '700', color: '#3B82F6' },
  waterDots: { flexDirection: 'row', gap: 6, marginBottom: 8 },
  waterDot: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center', opacity: 0.3 },
  waterDotFilled: { opacity: 1, backgroundColor: '#DBEAFE' },
  waterDotText: { fontSize: 18 },
  waterGoal: { fontSize: 12, color: '#9CA3AF', textAlign: 'center' },
  mealsHeader: { marginBottom: 8 },
  mealsTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
});

/* ------------------------------------------------------------------ */
/* Log Food Screen                                                     */
/* ------------------------------------------------------------------ */

function LogFoodScreen({ route, navigation }: any) {
  const { meal, date } = route.params;
  const [query, setQuery] = useState('');
  const [selectedFood, setSelectedFood] = useState<Food | null>(null);
  const [servings, setServings] = useState('1');
  const addEntry = useStore((s) => s.addEntry);

  const results = useMemo(() => searchFoods(query), [query]);

  function handleSelectFood(food: Food) {
    setSelectedFood(food);
    setServings('1');
  }

  function handleAdd() {
    if (!selectedFood) return;
    const s = parseFloat(servings);
    if (isNaN(s) || s <= 0) {
      Alert.alert('Invalid servings', 'Please enter a valid number of servings.');
      return;
    }
    addEntry({
      id: `${Date.now()}-${Math.random()}`,
      food: selectedFood,
      servings: s,
      meal,
      timestamp: Date.now(),
      date,
    });
    navigation.goBack();
  }

  const preview = selectedFood
    ? {
        calories: Math.round(selectedFood.macros.calories * (parseFloat(servings) || 0)),
        protein: Math.round(selectedFood.macros.protein * (parseFloat(servings) || 0)),
        carbs: Math.round(selectedFood.macros.carbs * (parseFloat(servings) || 0)),
        fat: Math.round(selectedFood.macros.fat * (parseFloat(servings) || 0)),
      }
    : null;

  return (
    <SafeAreaView style={logStyles.safe}>
      <KeyboardAvoidingView style={logStyles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={logStyles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={logStyles.backBtn}>
            <Text style={logStyles.backText}>‹ Back</Text>
          </TouchableOpacity>
          <Text style={logStyles.title}>Add to {MEAL_LABELS[meal as MealType]}</Text>
          <View style={{ width: 60 }} />
        </View>

        <View style={logStyles.searchBar}>
          <Text style={logStyles.searchIcon}>🔍</Text>
          <TextInput
            style={logStyles.searchInput}
            placeholder="Search foods..."
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            clearButtonMode="while-editing"
            placeholderTextColor="#9CA3AF"
          />
        </View>

        <FlatList
          data={results}
          keyExtractor={(f) => f.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={logStyles.listContent}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[logStyles.foodItem, selectedFood?.id === item.id && logStyles.foodItemSelected]}
              onPress={() => handleSelectFood(item)}
              activeOpacity={0.7}
            >
              <View style={logStyles.foodItemLeft}>
                <Text style={logStyles.foodName}>{item.name}</Text>
                {item.brand && <Text style={logStyles.foodBrand}>{item.brand}</Text>}
                <Text style={logStyles.foodServing}>per {item.serving_size}{item.serving_unit}</Text>
              </View>
              <View style={logStyles.foodItemRight}>
                <Text style={logStyles.foodCals}>{item.macros.calories} kcal</Text>
                <Text style={logStyles.foodMacro}>P {item.macros.protein}g</Text>
                <Text style={logStyles.foodMacro}>C {item.macros.carbs}g</Text>
                <Text style={logStyles.foodMacro}>F {item.macros.fat}g</Text>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={logStyles.empty}>
              <Text style={logStyles.emptyText}>No foods found</Text>
              <Text style={logStyles.emptySubtext}>Try a different search term</Text>
            </View>
          }
        />

        {selectedFood && (
          <View style={logStyles.addPanel}>
            <View style={logStyles.addPanelHeader}>
              <Text style={logStyles.selectedName} numberOfLines={1}>{selectedFood.name}</Text>
            </View>

            {preview && (
              <View style={logStyles.previewRow}>
                <View style={logStyles.previewItem}>
                  <Text style={logStyles.previewValue}>{preview.calories}</Text>
                  <Text style={logStyles.previewLabel}>kcal</Text>
                </View>
                <View style={logStyles.previewItem}>
                  <Text style={[logStyles.previewValue, { color: '#3B82F6' }]}>{preview.protein}g</Text>
                  <Text style={logStyles.previewLabel}>protein</Text>
                </View>
                <View style={logStyles.previewItem}>
                  <Text style={[logStyles.previewValue, { color: '#F59E0B' }]}>{preview.carbs}g</Text>
                  <Text style={logStyles.previewLabel}>carbs</Text>
                </View>
                <View style={logStyles.previewItem}>
                  <Text style={[logStyles.previewValue, { color: '#EF4444' }]}>{preview.fat}g</Text>
                  <Text style={logStyles.previewLabel}>fat</Text>
                </View>
              </View>
            )}

            <View style={logStyles.servingsRow}>
              <Text style={logStyles.servingsLabel}>
                Servings ({selectedFood.serving_size}{selectedFood.serving_unit} each):
              </Text>
              <View style={logStyles.servingsControl}>
                <TouchableOpacity
                  style={logStyles.servingsBtn}
                  onPress={() => {
                    const v = Math.max(0.5, (parseFloat(servings) || 1) - 0.5);
                    setServings(v.toString());
                  }}
                >
                  <Text style={logStyles.servingsBtnText}>−</Text>
                </TouchableOpacity>
                <TextInput
                  style={logStyles.servingsInput}
                  value={servings}
                  onChangeText={setServings}
                  keyboardType="decimal-pad"
                  selectTextOnFocus
                />
                <TouchableOpacity
                  style={logStyles.servingsBtn}
                  onPress={() => {
                    const v = (parseFloat(servings) || 1) + 0.5;
                    setServings(v.toString());
                  }}
                >
                  <Text style={logStyles.servingsBtnText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity style={logStyles.addBtn} onPress={handleAdd}>
              <Text style={logStyles.addBtnText}>Add to {MEAL_LABELS[meal as MealType]}</Text>
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const logStyles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  backBtn: { padding: 4, width: 60 },
  backText: { fontSize: 16, color: '#10B981', fontWeight: '600' },
  title: { fontSize: 17, fontWeight: '700', color: '#111827' },
  searchBar: { flexDirection: 'row', alignItems: 'center', margin: 12, paddingHorizontal: 14, backgroundColor: '#fff', borderRadius: 14, height: 46, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  searchIcon: { fontSize: 16, marginRight: 8 },
  searchInput: { flex: 1, fontSize: 16, color: '#111827' },
  listContent: { paddingHorizontal: 12, paddingBottom: 8 },
  foodItem: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3, elevation: 1 },
  foodItemSelected: { borderWidth: 2, borderColor: '#10B981' },
  foodItemLeft: { flex: 1 },
  foodName: { fontSize: 15, fontWeight: '600', color: '#111827' },
  foodBrand: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  foodServing: { fontSize: 12, color: '#6B7280', marginTop: 4 },
  foodItemRight: { alignItems: 'flex-end', gap: 2 },
  foodCals: { fontSize: 15, fontWeight: '700', color: '#111827' },
  foodMacro: { fontSize: 11, color: '#9CA3AF' },
  empty: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { fontSize: 16, color: '#6B7280', fontWeight: '600' },
  emptySubtext: { fontSize: 13, color: '#9CA3AF', marginTop: 4 },
  addPanel: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 8 },
  addPanelHeader: { marginBottom: 12 },
  selectedName: { fontSize: 16, fontWeight: '700', color: '#111827' },
  previewRow: { flexDirection: 'row', justifyContent: 'space-around', backgroundColor: '#F9FAFB', borderRadius: 12, padding: 12, marginBottom: 16 },
  previewItem: { alignItems: 'center' },
  previewValue: { fontSize: 18, fontWeight: '700', color: '#111827' },
  previewLabel: { fontSize: 11, color: '#9CA3AF' },
  servingsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  servingsLabel: { fontSize: 13, color: '#6B7280', flex: 1 },
  servingsControl: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  servingsBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  servingsBtnText: { fontSize: 20, fontWeight: '300', color: '#374151' },
  servingsInput: { width: 60, height: 36, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, textAlign: 'center', fontSize: 16, fontWeight: '600', color: '#111827' },
  addBtn: { backgroundColor: '#10B981', borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  addBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});

/* ------------------------------------------------------------------ */
/* History Screen                                                      */
/* ------------------------------------------------------------------ */

function HistoryScreen() {
  const getTotals = useStore((s) => s.getTotalsForDate);
  const goals = useStore((s) => s.goals);
  const days = getPastDays(14);

  function MacroBar({ value, goal, color }: { value: number; goal: number; color: string }) {
    const pct = Math.min(value / goal, 1);
    return (
      <View style={histBarStyles.track}>
        <View style={[histBarStyles.fill, { width: `${pct * 100}%` as any, backgroundColor: color }]} />
      </View>
    );
  }

  return (
    <SafeAreaView style={histStyles.safe}>
      <ScrollView contentContainerStyle={histStyles.content}>
        <Text style={histStyles.pageTitle}>History</Text>
        <Text style={histStyles.subtitle}>Past 14 days</Text>

        {days.map((date) => {
          const totals = getTotals(date);
          const hasData = totals.calories > 0;
          const calPct = Math.round((totals.calories / goals.calories) * 100);

          return (
            <View key={date} style={histStyles.dayCard}>
              <View style={histStyles.dayHeader}>
                <Text style={histStyles.dayLabel}>{displayDate(date)}</Text>
                {hasData ? (
                  <Text style={[histStyles.dayCalories, totals.calories > goals.calories && histStyles.overGoal]}>
                    {Math.round(totals.calories)} / {goals.calories} kcal
                  </Text>
                ) : (
                  <Text style={histStyles.noData}>No data</Text>
                )}
              </View>

              {hasData && (
                <>
                  <View style={histStyles.calorieBarTrack}>
                    <View
                      style={[
                        histStyles.calorieBarFill,
                        {
                          width: `${Math.min(calPct, 100)}%` as any,
                          backgroundColor: totals.calories > goals.calories ? '#EF4444' : '#10B981',
                        },
                      ]}
                    />
                  </View>

                  <View style={histStyles.macroGrid}>
                    <View style={histStyles.macroCell}>
                      <Text style={[histStyles.macroValue, { color: '#3B82F6' }]}>{Math.round(totals.protein)}g</Text>
                      <MacroBar value={totals.protein} goal={goals.protein} color="#3B82F6" />
                      <Text style={histStyles.macroLabel}>Protein</Text>
                    </View>
                    <View style={histStyles.macroCell}>
                      <Text style={[histStyles.macroValue, { color: '#F59E0B' }]}>{Math.round(totals.carbs)}g</Text>
                      <MacroBar value={totals.carbs} goal={goals.carbs} color="#F59E0B" />
                      <Text style={histStyles.macroLabel}>Carbs</Text>
                    </View>
                    <View style={histStyles.macroCell}>
                      <Text style={[histStyles.macroValue, { color: '#EF4444' }]}>{Math.round(totals.fat)}g</Text>
                      <MacroBar value={totals.fat} goal={goals.fat} color="#EF4444" />
                      <Text style={histStyles.macroLabel}>Fat</Text>
                    </View>
                    <View style={histStyles.macroCell}>
                      <Text style={[histStyles.macroValue, { color: '#8B5CF6' }]}>{Math.round(totals.fiber ?? 0)}g</Text>
                      <MacroBar value={totals.fiber ?? 0} goal={goals.fiber} color="#8B5CF6" />
                      <Text style={histStyles.macroLabel}>Fiber</Text>
                    </View>
                  </View>
                </>
              )}
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const histBarStyles = StyleSheet.create({
  track: { height: 4, backgroundColor: '#F3F4F6', borderRadius: 2, marginTop: 4, overflow: 'hidden' },
  fill: { height: 4, borderRadius: 2 },
});

const histStyles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },
  content: { padding: 16, paddingBottom: 32 },
  pageTitle: { fontSize: 28, fontWeight: '800', color: '#111827', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#9CA3AF', marginBottom: 20 },
  dayCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  dayHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  dayLabel: { fontSize: 15, fontWeight: '700', color: '#111827' },
  dayCalories: { fontSize: 14, fontWeight: '600', color: '#10B981' },
  overGoal: { color: '#EF4444' },
  noData: { fontSize: 13, color: '#D1D5DB', fontStyle: 'italic' },
  calorieBarTrack: { height: 6, backgroundColor: '#F3F4F6', borderRadius: 3, marginBottom: 12, overflow: 'hidden' },
  calorieBarFill: { height: 6, borderRadius: 3 },
  macroGrid: { flexDirection: 'row', gap: 12 },
  macroCell: { flex: 1, alignItems: 'center' },
  macroValue: { fontSize: 13, fontWeight: '700' },
  macroLabel: { fontSize: 10, color: '#9CA3AF', marginTop: 4 },
});

/* ------------------------------------------------------------------ */
/* Settings Screen                                                     */
/* ------------------------------------------------------------------ */

type Preset = { label: string; description: string; goals: DailyGoals };

const PRESETS: Preset[] = [
  { label: 'Weight Loss', description: '1500 kcal · High protein', goals: { calories: 1500, protein: 150, carbs: 130, fat: 50, fiber: 30 } },
  { label: 'Maintenance', description: '2000 kcal · Balanced', goals: { calories: 2000, protein: 150, carbs: 200, fat: 67, fiber: 30 } },
  { label: 'Muscle Gain', description: '2500 kcal · High protein & carbs', goals: { calories: 2500, protein: 200, carbs: 280, fat: 70, fiber: 35 } },
  { label: 'Keto', description: '1800 kcal · Low carb, high fat', goals: { calories: 1800, protein: 140, carbs: 30, fat: 140, fiber: 20 } },
];

function SettingsScreen() {
  const goals = useStore((s) => s.goals);
  const setGoals = useStore((s) => s.setGoals);

  const [form, setForm] = useState({
    calories: String(goals.calories),
    protein: String(goals.protein),
    carbs: String(goals.carbs),
    fat: String(goals.fat),
    fiber: String(goals.fiber),
  });

  function handleSave() {
    const parsed = {
      calories: parseInt(form.calories),
      protein: parseInt(form.protein),
      carbs: parseInt(form.carbs),
      fat: parseInt(form.fat),
      fiber: parseInt(form.fiber),
    };
    if (Object.values(parsed).some((v) => isNaN(v) || v <= 0)) {
      Alert.alert('Invalid values', 'All fields must be positive numbers.');
      return;
    }
    setGoals(parsed);
    Alert.alert('Saved', 'Your goals have been updated!');
  }

  function applyPreset(preset: Preset) {
    setForm({
      calories: String(preset.goals.calories),
      protein: String(preset.goals.protein),
      carbs: String(preset.goals.carbs),
      fat: String(preset.goals.fat),
      fiber: String(preset.goals.fiber),
    });
  }

  function GoalField({
    label,
    field,
    unit,
    color,
  }: {
    label: string;
    field: keyof typeof form;
    unit: string;
    color: string;
  }) {
    return (
      <View style={setStyles.fieldRow}>
        <View style={[setStyles.fieldDot, { backgroundColor: color }]} />
        <Text style={setStyles.fieldLabel}>{label}</Text>
        <View style={setStyles.fieldInputWrap}>
          <TextInput
            style={setStyles.fieldInput}
            value={form[field]}
            onChangeText={(v) => setForm((f) => ({ ...f, [field]: v }))}
            keyboardType="number-pad"
            selectTextOnFocus
          />
          <Text style={setStyles.fieldUnit}>{unit}</Text>
        </View>
      </View>
    );
  }

  const totalCalsFromMacros =
    parseInt(form.protein || '0') * 4 +
    parseInt(form.carbs || '0') * 4 +
    parseInt(form.fat || '0') * 9;

  return (
    <SafeAreaView style={setStyles.safe}>
      <ScrollView contentContainerStyle={setStyles.content}>
        <Text style={setStyles.pageTitle}>Goals</Text>
        <Text style={setStyles.subtitle}>Customize your daily targets</Text>

        <Text style={setStyles.sectionTitle}>Quick Presets</Text>
        <View style={setStyles.presetsGrid}>
          {PRESETS.map((preset) => (
            <TouchableOpacity key={preset.label} style={setStyles.presetCard} onPress={() => applyPreset(preset)} activeOpacity={0.7}>
              <Text style={setStyles.presetLabel}>{preset.label}</Text>
              <Text style={setStyles.presetDesc}>{preset.description}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={setStyles.sectionTitle}>Custom Goals</Text>
        <View style={setStyles.card}>
          <GoalField label="Calories" field="calories" unit="kcal" color="#10B981" />
          <GoalField label="Protein" field="protein" unit="g" color="#3B82F6" />
          <GoalField label="Carbs" field="carbs" unit="g" color="#F59E0B" />
          <GoalField label="Fat" field="fat" unit="g" color="#EF4444" />
          <GoalField label="Fiber" field="fiber" unit="g" color="#8B5CF6" />

          <View style={setStyles.calCalc}>
            <Text style={setStyles.calCalcLabel}>Calories from macros:</Text>
            <Text
              style={[
                setStyles.calCalcValue,
                Math.abs(totalCalsFromMacros - parseInt(form.calories || '0')) > 50 && setStyles.calCalcMismatch,
              ]}
            >
              {totalCalsFromMacros} kcal
            </Text>
          </View>

          <TouchableOpacity style={setStyles.saveBtn} onPress={handleSave}>
            <Text style={setStyles.saveBtnText}>Save Goals</Text>
          </TouchableOpacity>
        </View>

        <Text style={setStyles.sectionTitle}>Macro Distribution</Text>
        <View style={setStyles.card}>
          {[
            { label: 'Protein', cals: parseInt(form.protein || '0') * 4, color: '#3B82F6' },
            { label: 'Carbs', cals: parseInt(form.carbs || '0') * 4, color: '#F59E0B' },
            { label: 'Fat', cals: parseInt(form.fat || '0') * 9, color: '#EF4444' },
          ].map(({ label, cals, color }) => {
            const pct = totalCalsFromMacros ? Math.round((cals / totalCalsFromMacros) * 100) : 0;
            return (
              <View key={label} style={setStyles.distRow}>
                <Text style={[setStyles.distLabel, { color }]}>{label}</Text>
                <View style={setStyles.distBarTrack}>
                  <View style={[setStyles.distBarFill, { width: `${pct}%` as any, backgroundColor: color }]} />
                </View>
                <Text style={setStyles.distPct}>{pct}%</Text>
              </View>
            );
          })}
        </View>

        <Text style={setStyles.hint}>
          Tip: 1g protein = 4 kcal · 1g carbs = 4 kcal · 1g fat = 9 kcal
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const setStyles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },
  content: { padding: 16, paddingBottom: 48 },
  pageTitle: { fontSize: 28, fontWeight: '800', color: '#111827', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#9CA3AF', marginBottom: 24 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10, marginTop: 8 },
  presetsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  presetCard: { width: '47%', backgroundColor: '#fff', borderRadius: 14, padding: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  presetLabel: { fontSize: 14, fontWeight: '700', color: '#111827', marginBottom: 4 },
  presetDesc: { fontSize: 12, color: '#6B7280' },
  card: { backgroundColor: '#fff', borderRadius: 20, padding: 20, marginBottom: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  fieldRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F9FAFB' },
  fieldDot: { width: 10, height: 10, borderRadius: 5, marginRight: 12 },
  fieldLabel: { flex: 1, fontSize: 16, color: '#374151', fontWeight: '500' },
  fieldInputWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  fieldInput: { width: 80, height: 40, borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 10, textAlign: 'center', fontSize: 16, fontWeight: '600', color: '#111827' },
  fieldUnit: { fontSize: 13, color: '#9CA3AF', width: 32 },
  calCalc: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  calCalcLabel: { fontSize: 13, color: '#6B7280' },
  calCalcValue: { fontSize: 13, fontWeight: '700', color: '#10B981' },
  calCalcMismatch: { color: '#F59E0B' },
  saveBtn: { backgroundColor: '#10B981', borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 20 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  distRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 12 },
  distLabel: { width: 56, fontSize: 13, fontWeight: '600' },
  distBarTrack: { flex: 1, height: 8, backgroundColor: '#F3F4F6', borderRadius: 4, overflow: 'hidden' },
  distBarFill: { height: 8, borderRadius: 4 },
  distPct: { width: 36, textAlign: 'right', fontSize: 13, fontWeight: '600', color: '#6B7280' },
  hint: { fontSize: 12, color: '#9CA3AF', textAlign: 'center', lineHeight: 18 },
});

/* ------------------------------------------------------------------ */
/* Navigation / App                                                    */
/* ------------------------------------------------------------------ */

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

function HomeStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="LogFood" component={LogFoodScreen} options={{ presentation: 'modal' }} />
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <NavigationContainer>
        <Tab.Navigator
          screenOptions={({ route }) => ({
            headerShown: false,
            tabBarActiveTintColor: '#10B981',
            tabBarInactiveTintColor: '#9CA3AF',
            tabBarStyle: { backgroundColor: '#fff', borderTopColor: '#F3F4F6', paddingBottom: 8, paddingTop: 6, height: 60 },
            tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
            tabBarIcon: ({ focused }: { focused: boolean }) => {
              const icons: Record<string, string> = { Today: '🏠', History: '📊', Goals: '⚙️' };
              return <Text style={{ fontSize: focused ? 24 : 20 }}>{icons[route.name] ?? '📋'}</Text>;
            },
          })}
        >
          <Tab.Screen name="Today" component={HomeStack} />
          <Tab.Screen name="History" component={HistoryScreen} />
          <Tab.Screen name="Goals" component={SettingsScreen} />
        </Tab.Navigator>
      </NavigationContainer>
    </GestureHandlerRootView>
  );
}
