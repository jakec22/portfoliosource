import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from '../store/useStore';
import { ThemeMode, ReminderKey, ReminderTime } from '../types';
import { displayDate } from '../utils/date';
import { supabase } from '../services/supabase';
import { signOut, deleteAccount } from '../services/auth';
import { requestNotificationPermission } from '../services/notifications';
import { useTheme } from '../theme/useTheme';
import { editorialTheme, sportTechTheme, warmWellnessTheme } from '../theme';
import type { Theme } from '../theme';

const THEME_PACKS: { key: ThemeMode; name: string; blurb: string; theme: Theme }[] = [
  { key: 'editorial', name: 'Executive', blurb: 'Warm neutrals, serif numerals — the app’s original, refined look.', theme: editorialTheme },
  { key: 'sportTech', name: 'Modern', blurb: 'Dark with neon accents — bold and energetic.', theme: sportTechTheme },
  { key: 'warmWellness', name: 'Wellness', blurb: 'Cream, terracotta & sage — soft and human.', theme: warmWellnessTheme },
];

// mm:ss for the rest-time stepper (e.g. 120 -> "2:00", 90 -> "1:30").
function formatRest(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatTime({ hour, minute }: ReminderTime): string {
  const period = hour < 12 ? 'AM' : 'PM';
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}:${String(minute).padStart(2, '0')} ${period}`;
}

// Shift a time by a number of minutes, wrapping around midnight.
function shiftTime({ hour, minute }: ReminderTime, deltaMin: number): ReminderTime {
  let total = (hour * 60 + minute + deltaMin) % (24 * 60);
  if (total < 0) total += 24 * 60;
  return { hour: Math.floor(total / 60), minute: total % 60 };
}

const REMINDER_ROWS: { key: ReminderKey; label: string }[] = [
  { key: 'breakfast', label: 'Breakfast' },
  { key: 'lunch', label: 'Lunch' },
  { key: 'dinner', label: 'Dinner' },
  { key: 'streak', label: 'Streak reminder' },
];

// The five editable daily goals, in display order. A table rather than five
// hand-written rows so the label, unit and theme token for each live in one
// place.
const GOAL_FIELDS = [
  { field: 'calories', label: 'Calories', unit: 'kcal', tone: 'primary' },
  { field: 'protein', label: 'Protein', unit: 'g', tone: 'macroProtein' },
  { field: 'carbs', label: 'Carbs', unit: 'g', tone: 'macroCarbs' },
  { field: 'fat', label: 'Fat', unit: 'g', tone: 'macroFat' },
  { field: 'fiber', label: 'Fiber', unit: 'g', tone: 'macroFiber' },
] as const;

type GoalKey = (typeof GOAL_FIELDS)[number]['field'];

// Protein / carbs / fat, as percentages of calories. Three common starting
// points rather than a free slider — the previous version let you dial any
// ratio, which mostly meant dialling past the one you wanted.
const MACRO_SPLITS = [
  { name: 'Balanced', protein: 30, carbs: 40, fat: 30 },
  { name: 'High protein', protein: 40, carbs: 30, fat: 30 },
  { name: 'Low carb', protein: 35, carbs: 25, fat: 40 },
] as const;

// One editable daily-goal row.
//
// Declared here rather than inside CalculatorScreen. A component defined in a
// render body is a new function identity on every render, so React sees a
// different element type, unmounts the old subtree and mounts a fresh one —
// which for a TextInput means it loses focus and the keyboard closes. Typing a
// digit sets state, which re-renders, which replaced this component: the
// keyboard shut after every single keystroke.
const GoalField = React.memo(function GoalField({
  field,
  label,
  unit,
  color,
  value,
  pct,
  onChange,
  styles,
}: {
  field: GoalKey;
  label: string;
  unit: string;
  color: string;
  value: string;
  /** Share of the macro calories, for the three that have one. */
  pct: number | null;
  onChange: (field: GoalKey, value: string) => void;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={styles.goalRow}>
      <View style={[styles.goalDot, { backgroundColor: color }]} />
      <Text style={styles.goalLabel}>{label}</Text>
      <Text style={styles.goalPct}>{pct == null ? '' : `${pct}%`}</Text>
      <View style={styles.goalInputWrap}>
        <TextInput
          style={styles.goalInput}
          value={value}
          onChangeText={(v) => onChange(field, v)}
          keyboardType="number-pad"
          selectTextOnFocus
        />
        <Text style={styles.goalUnit}>{unit}</Text>
      </View>
    </View>
  );
});

export function CalculatorScreen({ navigation }: { navigation?: any }) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const goals = useStore((s) => s.goals);
  const setGoals = useStore((s) => s.setGoals);
  const themeMode = useStore((s) => s.themeMode);
  const setThemeMode = useStore((s) => s.setThemeMode);
  const profile = useStore((s) => s.profile);
  const setBodyWeight = useStore((s) => s.setBodyWeight);
  const bodyWeightLog = useStore((s) => s.bodyWeightLog);
  const logBodyWeight = useStore((s) => s.logBodyWeight);
  const deleteBodyWeightEntry = useStore((s) => s.deleteBodyWeightEntry);
  const waterGoal = useStore((s) => s.waterGoal);
  const setWaterGoal = useStore((s) => s.setWaterGoal);
  const waterIncrement = useStore((s) => s.waterIncrement);
  const setWaterIncrement = useStore((s) => s.setWaterIncrement);
  const showWaterTracker = useStore((s) => s.showWaterTracker);
  const setShowWaterTracker = useStore((s) => s.setShowWaterTracker);
  const autoRestTimer = useStore((s) => s.autoRestTimer);
  const setAutoRestTimer = useStore((s) => s.setAutoRestTimer);
  const notificationPrefs = useStore((s) => s.notificationPrefs);
  const setNotificationPrefs = useStore((s) => s.setNotificationPrefs);
  const defaultRestSeconds = useStore((s) => s.defaultRestSeconds);
  const setDefaultRestSeconds = useStore((s) => s.setDefaultRestSeconds);
  const clearLocalData = useStore((s) => s.clearLocalData);

  const [busy, setBusy] = useState(false);

  // --- Goals editing ---
  // Stable across renders, so memoising GoalField is worth something: an
  // inline arrow here would be a new prop every keystroke and defeat it.
  const handleGoalChange = useCallback((field: GoalKey, value: string) => {
    setForm((f) => ({ ...f, [field]: value }));
  }, []);

  const [form, setForm] = useState({
    calories: String(goals.calories),
    protein: String(goals.protein),
    carbs: String(goals.carbs),
    fat: String(goals.fat),
    fiber: String(goals.fiber),
  });

  useEffect(() => {
    setForm({
      calories: String(goals.calories),
      protein: String(goals.protein),
      carbs: String(goals.carbs),
      fat: String(goals.fat),
      fiber: String(goals.fiber),
    });
  }, [goals]);

  // --- Account ---
  const [email, setEmail] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  // --- Body weight log ---
  const [weightInput, setWeightInput] = useState('');
  const latestWeight = bodyWeightLog[0]?.lbs;

  function handleLogWeight() {
    const lbs = parseFloat(weightInput);
    if (isNaN(lbs) || lbs < 30 || lbs > 1000) {
      Alert.alert('Enter a weight', 'Type your body weight in pounds (e.g. 175).');
      return;
    }
    logBodyWeight(lbs);
    setWeightInput('');
  }

  function handleSaveGoals() {
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

  async function toggleReminders(on: boolean) {
    if (on) {
      const granted = await requestNotificationPermission();
      if (!granted) {
        Alert.alert(
          'Notifications are off',
          'To get reminders, enable notifications for Holy Macro in your device Settings.'
        );
        return;
      }
    }
    setNotificationPrefs({ ...notificationPrefs, enabled: on });
  }

  function setReminder(key: ReminderKey, on: boolean) {
    setNotificationPrefs({ ...notificationPrefs, [key]: on });
  }

  function adjustReminderTime(key: ReminderKey, deltaMin: number) {
    setNotificationPrefs({
      ...notificationPrefs,
      times: {
        ...notificationPrefs.times,
        [key]: shiftTime(notificationPrefs.times[key], deltaMin),
      },
    });
  }

  function handleSignOut() {
    Alert.alert('Sign Out', 'Your data stays synced to the cloud.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => signOut() },
    ]);
  }

  function handleDeleteAccount() {
    Alert.alert(
      'Delete Account',
      'This permanently erases your account and all your data — food logs, workouts, goals, and settings. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete My Account',
          style: 'destructive',
          onPress: performDelete,
        },
      ]
    );
  }

  async function performDelete() {
    setBusy(true);
    try {
      clearLocalData();
      const { error } = await deleteAccount();
      if (error) {
        Alert.alert('Error', `Could not delete account: ${error.message}`);
      }
    } finally {
      setBusy(false);
    }
  }

  const macroCals = {
    protein: parseInt(form.protein || '0') * 4,
    carbs: parseInt(form.carbs || '0') * 4,
    fat: parseInt(form.fat || '0') * 9,
  };
  const totalCalsFromMacros = macroCals.protein + macroCals.carbs + macroCals.fat;

  // Each macro's share of the macro calories, not of the calorie goal — so the
  // three always read as a split totalling 100 even while the grams are being
  // edited. Whether that adds up to the calorie target is the separate
  // question the reconciliation row below answers.
  const macroPct: Partial<Record<GoalKey, number>> =
    totalCalsFromMacros > 0
      ? {
          protein: Math.round((macroCals.protein / totalCalsFromMacros) * 100),
          carbs: Math.round((macroCals.carbs / totalCalsFromMacros) * 100),
          fat: Math.round((macroCals.fat / totalCalsFromMacros) * 100),
        }
      : {};

  // Fill the three macro fields from a named split and the current calorie
  // goal. One-way, and only on a tap: the old version of this was a pair of
  // draggable sliders that were a second editable copy of the same numbers,
  // fought the ScrollView for the gesture, and silently rebalanced the two
  // macros you weren't touching.
  function applySplit(p: number, cb: number, f: number) {
    const cal = parseInt(form.calories || '0');
    if (cal <= 0) {
      Alert.alert('Set a calorie goal first', 'The split is calculated from it.');
      return;
    }
    setForm((prev) => ({
      ...prev,
      protein: String(Math.round((cal * p) / 100 / 4)),
      carbs: String(Math.round((cal * cb) / 100 / 4)),
      fat: String(Math.round((cal * f) / 100 / 9)),
    }));
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.pageTitle}>Profile</Text>
        <Text style={styles.subtitle}>Your goals, body weight, and app settings</Text>

        {/* Goal Wizard CTA */}
        {navigation && (
          <TouchableOpacity
            style={styles.wizardCta}
            onPress={() => navigation.navigate('GoalWizard')}
            activeOpacity={0.85}
          >
            <Text style={styles.wizardIcon}>🎯</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.wizardTitle}>
                {profile ? 'Update my plan' : 'Set up my goals'}
              </Text>
              <Text style={styles.wizardSub}>
                {profile
                  ? 'Re-run the guided wizard to recalculate your targets'
                  : 'Answer a few questions to calculate your calories & macros'}
              </Text>
            </View>
            <Text style={styles.wizardArrow}>›</Text>
          </TouchableOpacity>
        )}

        {/* Body Weight log */}
        <View style={styles.weightSectionHeader}>
          <Text style={styles.sectionTitle}>Body Weight</Text>
          {navigation && (
            <TouchableOpacity onPress={() => navigation.navigate('KeyInsights')}>
              <Text style={styles.trendsLink}>View trends ›</Text>
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.card}>
          <View style={styles.weightTopRow}>
            <View>
              <Text style={styles.weightCurrentLabel}>Current</Text>
              <Text style={styles.weightCurrentValue}>
                {latestWeight != null ? `${latestWeight} lb` : '—'}
              </Text>
            </View>
            <View style={styles.weightInputRow}>
              <TextInput
                style={styles.weightInput}
                value={weightInput}
                onChangeText={setWeightInput}
                keyboardType="decimal-pad"
                placeholder="175"
                placeholderTextColor={c.textFaint}
                returnKeyType="done"
                onSubmitEditing={handleLogWeight}
              />
              <Text style={styles.weightUnit}>lbs</Text>
              <TouchableOpacity style={styles.weightLogBtn} onPress={handleLogWeight}>
                <Text style={styles.weightLogBtnText}>Log</Text>
              </TouchableOpacity>
            </View>
          </View>

          {bodyWeightLog.length > 0 && (
            <View style={styles.weightList}>
              {bodyWeightLog.slice(0, 6).map((e) => (
                <View key={e.loggedAt} style={styles.weightRow}>
                  <Text style={styles.weightRowDate}>{displayDate(e.date)}</Text>
                  <Text style={styles.weightRowValue}>{e.lbs} lb</Text>
                  <TouchableOpacity
                    onPress={() => deleteBodyWeightEntry(e.loggedAt)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Text style={styles.weightRowDelete}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
          <Text style={[styles.settingHint, { marginTop: 12 }]}>
            Log as often or as little as you like — defaults to today's date.
          </Text>
        </View>

        {/* Daily Goals (editable) */}
        <Text style={styles.sectionTitle}>Daily Goals</Text>
        <View style={styles.card}>
          {GOAL_FIELDS.map(({ field, label, unit, tone }) => (
            <GoalField
              key={field}
              field={field}
              label={label}
              unit={unit}
              color={c[tone]}
              value={form[field]}
              pct={macroPct[field] ?? null}
              onChange={handleGoalChange}
              styles={styles}
            />
          ))}

          <Text style={styles.splitHint}>
            Set a split and the grams fill in from your calorie goal.
          </Text>
          <View style={styles.splitRow}>
            {MACRO_SPLITS.map(({ name, protein, carbs, fat }) => (
              <TouchableOpacity
                key={name}
                style={styles.splitChip}
                onPress={() => applySplit(protein, carbs, fat)}
                activeOpacity={0.7}
              >
                <Text style={styles.splitChipName}>{name}</Text>
                <Text style={styles.splitChipRatio}>
                  {protein}/{carbs}/{fat}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.calCalc}>
            <Text style={styles.calCalcLabel}>Calories from macros:</Text>
            <Text
              style={[
                styles.calCalcValue,
                Math.abs(totalCalsFromMacros - parseInt(form.calories || '0')) > 50 &&
                  styles.calCalcMismatch,
              ]}
            >
              {totalCalsFromMacros} kcal
            </Text>
          </View>

          <TouchableOpacity style={styles.saveBtn} onPress={handleSaveGoals}>
            <Text style={styles.saveBtnText}>Save Goals</Text>
          </TouchableOpacity>
        </View>

        {/* Workout Settings */}
        <Text style={styles.sectionTitle}>Workout Settings</Text>
        <View style={styles.card}>
          <View style={styles.waterToggleRow}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={styles.waterToggleLabel}>Auto-start rest timer</Text>
              <Text style={styles.settingHint}>
                Starts the rest countdown automatically when you check off a set.
              </Text>
            </View>
            <Switch
              value={autoRestTimer}
              onValueChange={setAutoRestTimer}
              trackColor={{ false: c.border, true: c.primarySoft }}
              thumbColor={autoRestTimer ? c.primary : c.textFaint}
            />
          </View>

          <View style={[styles.hydrationRow, { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: c.border }]}>
            <TouchableOpacity
              style={styles.hydrationBtn}
              onPress={() => setDefaultRestSeconds(defaultRestSeconds - 15)}
            >
              <Text style={styles.hydrationBtnText}>−</Text>
            </TouchableOpacity>
            <View style={styles.hydrationCenter}>
              <Text style={styles.hydrationLabel}>Default Rest Time</Text>
              <Text style={styles.hydrationValue}>{formatRest(defaultRestSeconds)}</Text>
            </View>
            <TouchableOpacity
              style={styles.hydrationBtn}
              onPress={() => setDefaultRestSeconds(defaultRestSeconds + 15)}
            >
              <Text style={styles.hydrationBtnText}>+</Text>
            </TouchableOpacity>
          </View>
          <Text style={[styles.settingHint, { marginTop: 8 }]}>
            Used for the rest countdown during a workout. Adjust in 15-second steps
            (you can still tap +30s or Skip mid-workout).
          </Text>
        </View>

        {/* Reminders */}
        <Text style={styles.sectionTitle}>Reminders</Text>
        <View style={styles.card}>
          <View style={styles.waterToggleRow}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={styles.waterToggleLabel}>Daily Reminders</Text>
              <Text style={styles.settingHint}>
                Gentle nudges to log your meals and keep your streak alive.
              </Text>
            </View>
            <Switch
              value={notificationPrefs.enabled}
              onValueChange={toggleReminders}
              trackColor={{ false: c.border, true: c.primarySoft }}
              thumbColor={notificationPrefs.enabled ? c.primary : c.textFaint}
            />
          </View>

          {notificationPrefs.enabled &&
            REMINDER_ROWS.map(({ key, label }) => (
              <View
                key={key}
                style={{
                  marginTop: 12,
                  paddingTop: 12,
                  borderTopWidth: 1,
                  borderTopColor: c.border,
                }}
              >
                <View style={styles.waterToggleRow}>
                  <Text style={styles.waterToggleLabel}>{label}</Text>
                  <Switch
                    value={notificationPrefs[key]}
                    onValueChange={(v) => setReminder(key, v)}
                    trackColor={{ false: c.border, true: c.primarySoft }}
                    thumbColor={notificationPrefs[key] ? c.primary : c.textFaint}
                  />
                </View>

                {notificationPrefs[key] && (
                  <View style={[styles.hydrationRow, { marginTop: 12 }]}>
                    <TouchableOpacity
                      style={styles.hydrationBtn}
                      onPress={() => adjustReminderTime(key, -15)}
                    >
                      <Text style={styles.hydrationBtnText}>−</Text>
                    </TouchableOpacity>
                    <View style={styles.hydrationCenter}>
                      <Text style={styles.hydrationLabel}>Reminder time</Text>
                      <Text style={styles.hydrationValue}>
                        {formatTime(notificationPrefs.times[key])}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.hydrationBtn}
                      onPress={() => adjustReminderTime(key, 15)}
                    >
                      <Text style={styles.hydrationBtnText}>+</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ))}
        </View>

        {/* Hydration Settings */}
        <Text style={styles.sectionTitle}>Hydration Settings</Text>
        <View style={styles.card}>
          <View style={styles.waterToggleRow}>
            <Text style={styles.waterToggleLabel}>Show Water Tracker</Text>
            <Switch
              value={showWaterTracker}
              onValueChange={setShowWaterTracker}
              trackColor={{ false: c.border, true: c.primarySoft }}
              thumbColor={showWaterTracker ? c.primary : c.textFaint}
            />
          </View>
          <View style={[styles.hydrationRow, { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: c.border }]}>
            <TouchableOpacity
              style={styles.hydrationBtn}
              onPress={() => setWaterGoal(waterGoal - waterIncrement)}
            >
              <Text style={styles.hydrationBtnText}>−</Text>
            </TouchableOpacity>
            <View style={styles.hydrationCenter}>
              <Text style={styles.hydrationLabel}>Daily Goal</Text>
              <Text style={styles.hydrationValue}>{waterGoal} fl oz</Text>
            </View>
            <TouchableOpacity
              style={styles.hydrationBtn}
              onPress={() => setWaterGoal(waterGoal + waterIncrement)}
            >
              <Text style={styles.hydrationBtnText}>+</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.hydrationRow, { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: c.border }]}>
            <TouchableOpacity
              style={styles.hydrationBtn}
              onPress={() => setWaterIncrement(waterIncrement - 1)}
            >
              <Text style={styles.hydrationBtnText}>−</Text>
            </TouchableOpacity>
            <View style={styles.hydrationCenter}>
              <Text style={styles.hydrationLabel}>Per Droplet</Text>
              <Text style={styles.hydrationValue}>{waterIncrement} fl oz</Text>
            </View>
            <TouchableOpacity
              style={styles.hydrationBtn}
              onPress={() => setWaterIncrement(waterIncrement + 1)}
            >
              <Text style={styles.hydrationBtnText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Appearance */}
        <Text style={styles.sectionTitle}>Appearance</Text>
        <View style={styles.card}>
          <Text style={styles.waterToggleLabel}>Theme</Text>
          <Text style={[styles.settingHint, { marginBottom: 12 }]}>
            Pick a look — each is a complete visual style, not just a color.
          </Text>
          {THEME_PACKS.map((p) => {
            const active = themeMode === p.key;
            return (
              <TouchableOpacity
                key={p.key}
                style={[styles.themeCard, active && styles.themeCardActive]}
                onPress={() => setThemeMode(p.key)}
                activeOpacity={0.85}
              >
                <View style={[styles.themeSwatch, { backgroundColor: p.theme.bg, borderColor: p.theme.border }]}>
                  <View style={[styles.themeSwatchDot, { backgroundColor: p.theme.primary }]} />
                  <View style={[styles.themeSwatchDot, { backgroundColor: p.theme.macroProtein }]} />
                  <View style={[styles.themeSwatchDot, { backgroundColor: p.theme.macroCarbs }]} />
                  <View style={[styles.themeSwatchDot, { backgroundColor: p.theme.macroFat }]} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.themeName}>{p.name}</Text>
                  <Text style={styles.themeBlurb}>{p.blurb}</Text>
                </View>
                {active && <Text style={styles.themeCheck}>✓</Text>}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Account */}
        <Text style={styles.sectionTitle}>Account</Text>
        <View style={styles.card}>
          {email && (
            <View style={styles.accountRow}>
              <Text style={styles.accountLabel}>Signed in as</Text>
              <Text style={styles.accountEmail}>{email}</Text>
            </View>
          )}
          <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.deleteAccountBtn}
            onPress={handleDeleteAccount}
            disabled={busy}
            activeOpacity={0.6}
          >
            <Text style={styles.deleteAccountText}>
              {busy ? 'Deleting…' : 'Delete Account'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (c: Theme) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg },
  content: { padding: 16, paddingBottom: 48 },
  pageTitle: { fontSize: 28, fontWeight: '800', color: c.text, marginBottom: 4 },
  subtitle: { fontSize: 14, color: c.textFaint, marginBottom: 20 },
  sectionTitle: {
    fontSize: 13, fontWeight: '700', color: c.textFaint,
    textTransform: 'uppercase', letterSpacing: 0.8,
    marginTop: 8, marginBottom: 10,
  },
  card: {
    backgroundColor: c.card, borderRadius: 20, padding: 20,
    marginBottom: 16,
    shadowColor: c.shadow, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  // Wizard CTA
  wizardCta: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.primarySoft,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: `${c.primary}66`,
    padding: 18,
    marginBottom: 24,
    gap: 14,
  },
  wizardIcon: { fontSize: 28 },
  wizardTitle: { fontSize: 16, fontWeight: '800', color: c.scheme === 'dark' ? c.primary : c.primaryDark },
  wizardSub: { fontSize: 13, color: c.scheme === 'dark' ? c.textMuted : c.primaryDark, marginTop: 2, lineHeight: 18 },
  wizardArrow: { fontSize: 24, color: c.primary, fontWeight: '700' },
  // Goals editing
  goalRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: c.border,
  },
  goalDot: { width: 10, height: 10, borderRadius: 5, marginRight: 12 },
  goalLabel: { flex: 1, fontSize: 16, color: c.gray700, fontWeight: '500' },
  goalInputWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  goalInput: {
    width: 80, height: 40, borderWidth: 1.5, borderColor: c.border,
    borderRadius: 10, textAlign: 'center',
    fontSize: 16, fontWeight: '600', color: c.text,
    backgroundColor: c.input,
  },
  // Fixed width and right-aligned so the gram fields stay in a column whether
  // or not a row has a percentage.
  goalPct: {
    width: 40, textAlign: 'right', marginRight: 10,
    fontSize: 13, fontWeight: '600', color: c.textFaint,
    fontVariant: ['tabular-nums'],
  },
  goalUnit: { fontSize: 13, color: c.textFaint, width: 32 },
  splitRow: { flexDirection: 'row', gap: 8, marginTop: 16 },
  splitChip: {
    flex: 1, alignItems: 'center',
    backgroundColor: c.cardMuted, borderRadius: 10,
    paddingVertical: 9, paddingHorizontal: 4,
  },
  splitChipName: { fontSize: 11.5, fontWeight: '700', color: c.text },
  splitChipRatio: {
    fontSize: 10, color: c.textFaint, marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  splitHint: { fontSize: 12, color: c.textFaint, marginTop: 14 },
  calCalc: {
    flexDirection: 'row', justifyContent: 'space-between',
    marginTop: 16, paddingTop: 16,
    borderTopWidth: 1, borderTopColor: c.border,
  },
  calCalcLabel: { fontSize: 13, color: c.textMuted },
  calCalcValue: { fontSize: 13, fontWeight: '700', color: c.primary },
  calCalcMismatch: { color: c.warning },
  saveBtn: {
    backgroundColor: c.primary, borderRadius: 14,
    paddingVertical: 14, alignItems: 'center', marginTop: 20,
  },
  saveBtnText: { color: c.onPrimary, fontSize: 16, fontWeight: '700' },
  // Body weight log
  weightSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  trendsLink: { fontSize: 13, fontWeight: '700', color: c.primary, marginBottom: 10 },
  weightTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  weightCurrentLabel: { fontSize: 12, color: c.textFaint },
  weightCurrentValue: { fontSize: 26, fontWeight: '800', color: c.text, marginTop: 2 },
  weightInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  weightInput: {
    width: 76,
    height: 44,
    borderWidth: 1.5,
    borderColor: c.border,
    borderRadius: 12,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
    color: c.text,
    backgroundColor: c.input,
  },
  weightUnit: { fontSize: 14, color: c.textFaint, fontWeight: '500' },
  weightLogBtn: {
    backgroundColor: c.primary,
    borderRadius: 12,
    paddingHorizontal: 18,
    height: 44,
    justifyContent: 'center',
  },
  weightLogBtnText: { color: c.onPrimary, fontSize: 15, fontWeight: '700' },
  weightList: {
    marginTop: 16,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: c.border,
  },
  weightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  weightRowDate: { flex: 1, fontSize: 14, color: c.gray700 },
  weightRowValue: { fontSize: 15, fontWeight: '700', color: c.text, marginRight: 16 },
  weightRowDelete: { fontSize: 14, color: c.textFaint, fontWeight: '700' },
  // Hydration
  waterToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  waterToggleLabel: { fontSize: 15, fontWeight: '600', color: c.gray700 },
  settingHint: { fontSize: 12, color: c.textFaint, marginTop: 3, lineHeight: 16 },
  hydrationRow: { flexDirection: 'row', alignItems: 'center' },
  hydrationBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: c.infoSoft,
    alignItems: 'center', justifyContent: 'center',
  },
  hydrationBtnText: { fontSize: 24, fontWeight: '600', color: c.info, lineHeight: 28 },
  hydrationCenter: { flex: 1, alignItems: 'center' },
  hydrationLabel: { fontSize: 11, color: c.textFaint },
  hydrationValue: { fontSize: 18, fontWeight: '700', color: c.text },
  // Appearance
  themeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'transparent',
    marginBottom: 8,
  },
  themeCardActive: {
    borderColor: c.primary,
    backgroundColor: c.cardMuted,
  },
  themeSwatch: {
    width: 52,
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    padding: 6,
  },
  themeSwatchDot: { width: 12, height: 12, borderRadius: 6 },
  themeName: { fontSize: 15, fontWeight: '700', color: c.text },
  themeBlurb: { fontSize: 12, color: c.textMuted, marginTop: 2, lineHeight: 16 },
  themeCheck: { fontSize: 18, fontWeight: '800', color: c.primary },
  // Account
  accountRow: { marginBottom: 16 },
  accountLabel: { fontSize: 12, color: c.textFaint, marginBottom: 2 },
  accountEmail: { fontSize: 15, fontWeight: '600', color: c.text },
  signOutBtn: {
    borderRadius: 14, paddingVertical: 14, alignItems: 'center',
    borderWidth: 1.5, borderColor: c.dangerSoft, backgroundColor: c.dangerSoft,
  },
  signOutText: { color: c.danger, fontSize: 16, fontWeight: '700' },
  deleteAccountBtn: { paddingVertical: 12, alignItems: 'center', marginTop: 4 },
  deleteAccountText: { color: c.textFaint, fontSize: 13, fontWeight: '500' },
});
