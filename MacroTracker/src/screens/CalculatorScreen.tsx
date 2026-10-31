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
import { radius, space, type } from '../theme/tokens';
import { Icon } from '../components/Icon';

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
            <Icon name="goal" size="lg" color={c.scheme === 'dark' ? c.primary : c.primaryDark} />
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
            <Icon name="forward" size="md" color={c.primary} />
          </TouchableOpacity>
        )}

        {/* Body Weight log */}
        <View style={styles.weightSectionHeader}>
          <Text style={styles.sectionTitle}>Body Weight</Text>
          {navigation && (
            <TouchableOpacity onPress={() => navigation.navigate('KeyInsights')}>
              <View style={styles.trendsLinkRow}>
              <Text style={styles.trendsLink}>View trends</Text>
              <Icon name="forward" size="xs" color={c.primary} />
            </View>
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
                    <Icon name="close" size="sm" color={c.textFaint} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
          <Text style={[styles.settingHint, { marginTop: space.md }]}>
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
            <View style={{ flex: 1, paddingRight: space.md }}>
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

          <View style={[styles.hydrationRow, { marginTop: space.md, paddingTop: space.md, borderTopWidth: 1, borderTopColor: c.border }]}>
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
          <Text style={[styles.settingHint, { marginTop: space.sm }]}>
            Used for the rest countdown during a workout. Adjust in 15-second steps
            (you can still tap +30s or Skip mid-workout).
          </Text>
        </View>

        {/* Reminders */}
        <Text style={styles.sectionTitle}>Reminders</Text>
        <View style={styles.card}>
          <View style={styles.waterToggleRow}>
            <View style={{ flex: 1, paddingRight: space.md }}>
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
                  marginTop: space.md,
                  paddingTop: space.md,
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
                  <View style={[styles.hydrationRow, { marginTop: space.md }]}>
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
          <View style={[styles.hydrationRow, { marginTop: space.md, paddingTop: space.md, borderTopWidth: 1, borderTopColor: c.border }]}>
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

          <View style={[styles.hydrationRow, { marginTop: space.md, paddingTop: space.md, borderTopWidth: 1, borderTopColor: c.border }]}>
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
          <Text style={[styles.settingHint, { marginBottom: space.md }]}>
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
                {active && <Icon name="check" size="sm" color={c.primary} />}
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
  content: { padding: space.lg, paddingBottom: space.xxxl },
  pageTitle: { ...type.title(c), color: c.text, marginBottom: space.xs },
  subtitle: { ...type.body(c), color: c.textFaint, marginBottom: space.lg },
  sectionTitle: {
    ...type.overline(c),
    color: c.textFaint,
    marginTop: space.sm, marginBottom: space.sm,
  },
  card: {
    backgroundColor: c.card, borderRadius: radius.card, padding: space.xl,
    marginBottom: space.lg,
    shadowColor: c.shadow, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  // Wizard CTA
  wizardCta: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.primarySoft,
    borderRadius: radius.card,
    borderWidth: 1.5,
    borderColor: `${c.primary}66`,
    padding: space.lg,
    marginBottom: space.xl,
    gap: space.md,
  },
  wizardTitle: { ...type.bodyStrong(c), color: c.scheme === 'dark' ? c.primary : c.primaryDark },
  wizardSub: { ...type.caption(c), color: c.scheme === 'dark' ? c.textMuted : c.primaryDark, marginTop: space.xxs },
  // Goals editing
  goalRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: space.md,
    borderBottomWidth: 1, borderBottomColor: c.border,
  },
  goalDot: { width: 10, height: 10, borderRadius: radius.pill, marginRight: space.md },
  goalLabel: { ...type.body(c), flex: 1, color: c.gray700 },
  goalInputWrap: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  goalInput: {
    ...type.body(c),
    fontFamily: c.fontBodySemi,
    width: 80, height: 40, borderWidth: 1.5, borderColor: c.border,
    borderRadius: radius.control, textAlign: 'center',
    color: c.text,
    backgroundColor: c.input,
  },
  // Fixed width and right-aligned so the gram fields stay in a column whether
  // or not a row has a percentage.
  goalPct: {
    ...type.captionStrong(c),
    width: 40, textAlign: 'right', marginRight: space.sm,
    color: c.textFaint,
    fontVariant: ['tabular-nums'],
  },
  goalUnit: { ...type.caption(c), color: c.textFaint, width: 32 },
  splitRow: { flexDirection: 'row', gap: space.sm, marginTop: space.lg },
  splitChip: {
    flex: 1, alignItems: 'center',
    backgroundColor: c.cardMuted, borderRadius: radius.control,
    paddingVertical: space.sm, paddingHorizontal: space.xs,
  },
  splitChipName: { ...type.captionStrong(c), color: c.text },
  splitChipRatio: {
    ...type.micro(c),
    color: c.textFaint, marginTop: space.xxs,
    fontVariant: ['tabular-nums'],
  },
  splitHint: { ...type.caption(c), color: c.textFaint, marginTop: space.md },
  calCalc: {
    flexDirection: 'row', justifyContent: 'space-between',
    marginTop: space.lg, paddingTop: space.lg,
    borderTopWidth: 1, borderTopColor: c.border,
  },
  calCalcLabel: { ...type.caption(c), color: c.textMuted },
  calCalcValue: { ...type.captionStrong(c), color: c.primary },
  calCalcMismatch: { color: c.warning },
  saveBtn: {
    backgroundColor: c.primary, borderRadius: radius.control,
    paddingVertical: space.lg, alignItems: 'center', marginTop: space.lg,
  },
  saveBtnText: { ...type.bodyStrong(c), color: c.onPrimary },
  // Body weight log
  weightSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  trendsLinkRow: { flexDirection: 'row', alignItems: 'center', gap: space.xxs },
  trendsLink: { ...type.captionStrong(c), color: c.primary, marginBottom: space.sm },
  weightTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  weightCurrentLabel: { ...type.caption(c), color: c.textFaint },
  weightCurrentValue: { ...type.title(c), color: c.text, marginTop: space.xxs },
  weightInputRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  weightInput: {
    ...type.body(c),
    fontFamily: c.fontBodySemi,
    width: 76,
    height: 44,
    borderWidth: 1.5,
    borderColor: c.border,
    borderRadius: radius.control,
    textAlign: 'center',
    color: c.text,
    backgroundColor: c.input,
  },
  weightUnit: { ...type.body(c), color: c.textFaint },
  weightLogBtn: {
    backgroundColor: c.primary,
    borderRadius: radius.control,
    paddingHorizontal: space.lg,
    height: 44,
    justifyContent: 'center',
  },
  weightLogBtnText: { ...type.bodyStrong(c), color: c.onPrimary },
  weightList: {
    marginTop: space.lg,
    paddingTop: space.xs,
    borderTopWidth: 1,
    borderTopColor: c.border,
  },
  weightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: space.md,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  weightRowDate: { ...type.body(c), flex: 1, color: c.gray700 },
  weightRowValue: { ...type.bodyStrong(c), color: c.text, marginRight: space.lg },
  // Hydration
  waterToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: space.xs,
  },
  waterToggleLabel: { ...type.body(c), fontFamily: c.fontBodySemi, color: c.gray700 },
  settingHint: { ...type.caption(c), color: c.textFaint, marginTop: space.xxs },
  hydrationRow: { flexDirection: 'row', alignItems: 'center' },
  hydrationBtn: {
    width: 40, height: 40, borderRadius: radius.pill,
    backgroundColor: c.infoSoft,
    alignItems: 'center', justifyContent: 'center',
  },
  hydrationBtnText: { ...type.title(c), color: c.info },
  hydrationCenter: { flex: 1, alignItems: 'center' },
  hydrationLabel: { ...type.micro(c), color: c.textFaint },
  hydrationValue: { ...type.subhead(c), color: c.text },
  // Appearance
  themeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.card,
    borderWidth: 1.5,
    borderColor: 'transparent',
    marginBottom: space.sm,
  },
  themeCardActive: {
    borderColor: c.primary,
    backgroundColor: c.cardMuted,
  },
  themeSwatch: {
    width: 52,
    height: 52,
    borderRadius: radius.control,
    borderWidth: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
    padding: space.sm,
  },
  themeSwatchDot: { width: 12, height: 12, borderRadius: radius.pill },
  themeName: { ...type.bodyStrong(c), color: c.text },
  themeBlurb: { ...type.caption(c), color: c.textMuted, marginTop: space.xxs },
  // Account
  accountRow: { marginBottom: space.lg },
  accountLabel: { ...type.caption(c), color: c.textFaint, marginBottom: space.xxs },
  accountEmail: { ...type.body(c), fontFamily: c.fontBodySemi, color: c.text },
  signOutBtn: {
    borderRadius: radius.control, paddingVertical: space.lg, alignItems: 'center',
    borderWidth: 1.5, borderColor: c.dangerSoft, backgroundColor: c.dangerSoft,
  },
  signOutText: { ...type.bodyStrong(c), color: c.danger },
  deleteAccountBtn: { paddingVertical: space.md, alignItems: 'center', marginTop: space.xs },
  deleteAccountText: { ...type.caption(c), color: c.textFaint },
});
