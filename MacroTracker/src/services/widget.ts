import { Platform } from 'react-native';
import { ExtensionStorage } from '@bacons/apple-targets';
import { resolveTheme } from '../theme';
import type { ThemeMode } from '../types';

// Shared App Group container the home screen widget reads from. Must match
// app.json's ios.entitlements and targets/widget/expo-target.config.js.
const APP_GROUP = 'group.com.jacobclover.macrotracker';
const STORAGE_KEY = 'macroWidget';

// The widget decodes this with JSONDecoder, so the keys and value types have to
// line up exactly with MacroPayload in targets/widget/index.swift.
//
// Flat on purpose: ExtensionStorage.set() is typed for
// Record<string, string | number>, so the macros aren't nested as an array.
export interface WidgetPayload extends Record<string, string | number> {
  date: string;

  caloriesConsumed: number;
  calorieGoal: number;

  proteinCurrent: number;
  proteinGoal: number;
  proteinColor: string;

  carbsCurrent: number;
  carbsGoal: number;
  carbsColor: string;

  fatCurrent: number;
  fatGoal: number;
  fatColor: string;

  fiberCurrent: number;
  fiberGoal: number;
  fiberColor: string;

  textColor: string;
  mutedColor: string;
  trackColor: string;
  cardColor: string;
  accentColor: string;
  dangerColor: string;
}

export interface WidgetTotals {
  date: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}

export interface WidgetGoals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}

// Push today's numbers to the widget. The widget can't call useTheme(), so the
// selected pack is resolved here and the concrete hex values travel with the
// payload — that keeps the widget in step with the app's theme without
// duplicating the palette in Swift.
export function updateMacroWidget(
  totals: WidgetTotals,
  goals: WidgetGoals,
  themeMode: ThemeMode
): void {
  if (Platform.OS !== 'ios') return;
  const c = resolveTheme(themeMode);

  const payload: WidgetPayload = {
    date: totals.date,

    caloriesConsumed: Math.round(totals.calories),
    calorieGoal: Math.round(goals.calories),

    proteinCurrent: Math.round(totals.protein),
    proteinGoal: Math.round(goals.protein),
    proteinColor: c.macroProtein,

    carbsCurrent: Math.round(totals.carbs),
    carbsGoal: Math.round(goals.carbs),
    carbsColor: c.macroCarbs,

    fatCurrent: Math.round(totals.fat),
    fatGoal: Math.round(goals.fat),
    fatColor: c.macroFat,

    fiberCurrent: Math.round(totals.fiber),
    fiberGoal: Math.round(goals.fiber),
    fiberColor: c.macroFiber,

    textColor: c.text,
    mutedColor: c.textFaint,
    trackColor: c.borderStrong,
    cardColor: c.card,
    accentColor: c.primary,
    dangerColor: c.danger,
  };

  try {
    new ExtensionStorage(APP_GROUP).set(STORAGE_KEY, payload);
    ExtensionStorage.reloadWidget();
  } catch {
    // No App Group / native module unavailable (Expo Go, or a build predating
    // the widget target). The widget simply keeps its last values.
  }
}
