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
  KeyboardAvoidingView,
  Platform,
  Modal,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from '../store/useStore';
import { ThemeMode, ReminderKey, ReminderTime, type BodyWeightEntry } from '../types';
import {
  weightSummary,
  WEIGHT_WINDOW_DAYS,
  WEIGHT_SMOOTHING_DAYS,
} from '../utils/analytics';
import { WeightSparkline } from '../components/WeightSparkline';
import { useSheetAnimation } from '../hooks/useSheetAnimation';
import { useSnackbar } from '../store/useSnackbar';
import { displayDate } from '../utils/date';
import { supabase } from '../services/supabase';
import { signOut, deleteAccount } from '../services/auth';
import { requestNotificationPermission } from '../services/notifications';
import { useTheme } from '../theme/useTheme';
import { editorialTheme, sportTechTheme } from '../theme';
import type { Theme } from '../theme';
import { radius, space, type } from '../theme/tokens';
import { Icon } from '../components/Icon';
import { RECOVERY_TYPES } from '../utils/workoutTypes';
import {
  KCAL_PER_GRAM,
  gramsForSplit,
  macroCalories,
  rebalanceMacros,
  type MacroKey,
} from '../utils/tdee';
import { planForWeight, smoothedWeight } from '../utils/adaptiveGoals';
import { GoalSource, type GoalSourceMode } from '../components/GoalSource';
import { MacroSlider } from '../components/MacroSlider';

const THEME_PACKS: { key: ThemeMode; name: string; blurb: string; theme: Theme }[] = [
  { key: 'editorial', name: 'Executive', blurb: 'Warm neutrals, serif numerals — the app’s original, refined look.', theme: editorialTheme },
  { key: 'sportTech', name: 'Modern', blurb: 'Dark with neon accents — bold and energetic.', theme: sportTechTheme },
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
  onSlide,
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
  /** Given for the three macros, which carry a slider. */
  onSlide?: (field: GoalKey, percent: number) => void;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={styles.goalBlock}>
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
      {onSlide && pct != null && (
        <MacroSlider
          percent={pct}
          color={color}
          onChange={(percent) => onSlide(field, percent)}
          accessibilityLabel={`${label} share of calories`}
        />
      )}
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
  const goalsBasisWeightLbs = useStore((s) => s.goalsBasisWeightLbs);
  const applyGoalPlan = useStore((s) => s.applyGoalPlan);
  const logBodyWeight = useStore((s) => s.logBodyWeight);
  const deleteBodyWeightEntry = useStore((s) => s.deleteBodyWeightEntry);
  const restoreBodyWeightEntry = useStore((s) => s.restoreBodyWeightEntry);
  const showSnackbar = useSnackbar((s) => s.show);
  const sheetAnimation = useSheetAnimation();
  const weeklyWorkoutGoal = useStore((s) => s.weeklyWorkoutGoal);
  const setWeeklyWorkoutGoal = useStore((s) => s.setWeeklyWorkoutGoal);
  const recoveryGoals = useStore((s) => s.recoveryGoals);
  const setRecoveryGoal = useStore((s) => s.setRecoveryGoal);
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
  const [showWeightLog, setShowWeightLog] = useState(false);
  const weight = useMemo(() => weightSummary(bodyWeightLog), [bodyWeightLog]);

  function handleDeleteWeight(entry: BodyWeightEntry) {
    deleteBodyWeightEntry(entry.loggedAt);
    showSnackbar(`Deleted ${entry.lbs} lb`, {
      label: 'Undo',
      onPress: () => restoreBodyWeightEntry(entry),
    });
  }

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
    // Nothing changed, so nothing is written. setGoals clears
    // goalsBasisWeightLbs — that is how hand-editing switches the automatic
    // rebuild off — which meant opening this screen and tapping Save with
    // no edits silently ended a user's adaptive goals for good, with
    // nothing on screen having changed to explain it.
    if (!formIsDirty) {
      Alert.alert('Saved', 'Your goals have been updated!');
      return;
    }
    setGoals(parsed);
    Alert.alert('Saved', 'Your goals have been updated!');
  }

  /**
   * Rebuild the targets from the profile at the current weight.
   *
   * The same arithmetic the wizard's last step runs and the same the
   * automatic rebuild runs, against the smoothed weight rather than a
   * single reading, for the reason smoothedWeight exists. Before this, the
   * only way back to computed goals was re-running the whole wizard, which
   * is what made it feel like a second editor for the same numbers.
   */
  function handleRecalculate() {
    if (!profile) return;
    const basis = smoothedWeight(bodyWeightLog) ?? profile.weightLbs;
    const plan = planForWeight(profile, basis);
    if (!plan) {
      Alert.alert(
        'Could not recalculate',
        'Your profile is missing something the calculation needs. Re-run the goal wizard to fix it.'
      );
      return;
    }
    applyGoalPlan(plan.goals, basis);
    Alert.alert(
      'Goals recalculated',
      `Rebuilt from your profile at ${basis} lb. They will keep updating as you weigh in.`
    );
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
      {
        text: 'Sign Out',
        style: 'destructive',
        // Wipe this device's copy on the way out.
        //
        // Without it the next account to sign in here inherits the last
        // one's data: hydrate looks for entries the cloud does not have,
        // finds the previous user's, and uploads them under the new user's
        // id. Two people sharing a phone — or one person and a test account
        // — ended up with each other's meals, and there was no way to take
        // them back out.
        //
        // Safe because signing out is only offered to a signed-in account,
        // whose data is already in the cloud and comes back on next sign-in.
        onPress: async () => {
          await signOut();
          clearLocalData();
        },
      },
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
      // Server first, device second.
      //
      // Clearing local state before the call meant a failed delete — expired
      // session, no signal — left the user signed in looking at an empty app
      // while their cloud data was still there, and the next thing that
      // touched settings (a water tap, a theme switch) pushed that emptiness
      // over their real row. Nothing to recover from at that point.
      //
      // On success deleteAccount signs out, which clears the sync user, so the
      // reset below can't be pushed anywhere either.
      const { error } = await deleteAccount();
      if (error) {
        Alert.alert('Error', `Could not delete account: ${error.message}`);
        return;
      }
      clearLocalData();
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
  // Signed: positive means the macros come to more than the calorie goal.
  // Only meaningful once there is a goal to be measured against — with the
  // field empty the gap is the macro total, and the row would announce that
  // you are two thousand calories over a target you have not set.
  // Whether the fields still hold exactly what is stored. Drives the
  // banner, so it flips the moment a digit is typed rather than waiting for
  // Save — the point is to show the consequence while it is being caused.
  const formIsDirty =
    form.calories !== String(goals.calories) ||
    form.protein !== String(goals.protein) ||
    form.carbs !== String(goals.carbs) ||
    form.fat !== String(goals.fat) ||
    form.fiber !== String(goals.fiber);

  // Computed only while the stored goals were built from the profile AND
  // the fields still match them. An unsaved edit is already hand-set as far
  // as the user is concerned, whatever the store still says.
  const goalSource: GoalSourceMode = !profile
    ? 'none'
    : goalsBasisWeightLbs != null && !formIsDirty
      ? 'computed'
      : 'hand';

  const calorieTarget = parseInt(form.calories || '0');
  const hasCalorieGoal = calorieTarget > 0;
  const rawCalorieGap = hasCalorieGoal ? totalCalsFromMacros - calorieTarget : 0;
  // Below one gram of the finest macro — protein and carbs at 4 kcal — a gap
  // cannot be closed by moving any single gram, so it is an artefact of
  // whole-gram targets rather than a disagreement. Reporting "1 kcal under
  // your calorie goal" after every slider drag is false precision; the
  // rebalance leaves at most 2, measured.
  const calorieGap = Math.abs(rawCalorieGap) < KCAL_PER_GRAM.carbs ? 0 : rawCalorieGap;

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
    const macros = gramsForSplit(cal, { protein: p / 100, carbs: cb / 100, fat: f / 100 });
    // The calorie goal comes back out of the grams rather than staying as
    // typed. Three macros rounded to whole grams almost never add back up to
    // the number they came from — a 1,210 goal split 30/40/30 lands on 1,208
    // — and the only way to close that from the grams side is to move six of
    // them to correct two calories, which leaves a split that no longer
    // reads as the one that was tapped. A few calories off a goal that was
    // itself an estimate is the cheaper of the two inaccuracies, and it is
    // the one that leaves every figure on this screen agreeing.
    setForm((prev) => ({
      ...prev,
      calories: String(macroCalories(macros)),
      protein: String(macros.protein),
      carbs: String(macros.carbs),
      fat: String(macros.fat),
    }));
  }

  /**
   * A macro slider moved. Convert the share back into grams, take the
   * difference out of the other two, and write all three.
   *
   * The budget is the calorie goal rather than the current macro total, so
   * repeated drags cannot walk away from it — each one is computed from the
   * same fixed number rather than from the result of the last.
   *
   * Only the drag rebalances. Typing a gram value does not, and that
   * asymmetry is deliberate: dragging a share is a statement about the
   * split, where moving one part has to move another and you watch it
   * happen; typing 180 into the protein box is a statement about protein,
   * and silently rewriting two numbers you did not touch is what made the
   * old version feel broken. The reconciliation row below is the typed
   * path's answer.
   */
  function handleSlide(field: GoalKey, percent: number) {
    const budget = parseInt(form.calories || '0');
    if (budget <= 0) return;
    const macro = field as MacroKey;
    const current = {
      protein: parseInt(form.protein || '0'),
      carbs: parseInt(form.carbs || '0'),
      fat: parseInt(form.fat || '0'),
    };
    const perGram = macro === 'fat' ? 9 : 4;
    const grams = (percent / 100) * budget / perGram;
    const next = rebalanceMacros(budget, current, macro, grams);
    setForm((prev) => ({
      ...prev,
      protein: String(next.protein),
      carbs: String(next.carbs),
      fat: String(next.fat),
    }));
  }

  /**
   * Close the gap after the macros have been edited by hand.
   *
   * Same rule as the split chips, and the answer to a row that used to
   * report a mismatch without offering any way out of it. Only the calorie
   * goal moves: the grams are what was deliberately typed, and the gap here
   * is whatever the user made it rather than a rounding artefact — someone
   * who has just set protein to 200 means 200, not 196.
   */
  function matchCaloriesToMacros() {
    setForm((prev) => ({ ...prev, calories: String(totalCalsFromMacros) }));
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      {/* The only input screen that had none. The macro fields sit well down
          a long scroll, so on a short phone the keyboard covered the field
          being typed into — you could see the goal change but not the number
          you were changing it to. Android resizes the window itself. */}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
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
            {/* The seven-day mean leads, not today's reading.
                A single weigh-in is mostly water, food timing and when you
                stepped on the scale; comparing it to yesterday's is the one
                thing this card used to invite and the one thing that tells
                you nothing. The mean is also the figure the adaptive goals
                already rebuild against, so the number on screen is now the
                number the app is acting on. Today's reading stays, small,
                as confirmation the tap landed. */}
            <View>
              <Text style={styles.weightCurrentLabel}>
                {weight ? `${WEIGHT_SMOOTHING_DAYS}-day average` : 'Current'}
              </Text>
              <Text style={styles.weightCurrentValue}>
                {weight ? `${weight.average} lb` : '—'}
              </Text>
              {weight && (
                <Text style={styles.weightLatest}>Today {weight.current} lb</Text>
              )}
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

          {weight ? (
            <>
              <View style={styles.weightTrendRow}>
                <Text style={styles.weightWindow}>
                  {weight.readings > 1 ? `Last ${WEIGHT_WINDOW_DAYS} days` : 'First reading'}
                </Text>
                {weight.readings > 1 && (
                  <View
                    style={[
                      styles.weightDelta,
                      { backgroundColor: weight.deltaLbs <= 0 ? c.primarySoft : c.dangerSoft },
                    ]}
                  >
                    <Text
                      style={[
                        styles.weightDeltaText,
                        { color: weight.deltaLbs <= 0 ? c.primaryDark : c.danger },
                      ]}
                    >
                      {weight.deltaLbs === 0
                        ? 'Holding steady'
                        : `${weight.deltaLbs < 0 ? '↓' : '↑'} ${Math.abs(weight.deltaLbs).toFixed(1)} lb`}
                    </Text>
                  </View>
                )}
              </View>
              {/* One reading over a thirty-day axis is a lone dot pinned to
                  the right of an empty box, which reads as no data rather
                  than as a start. Say what is missing instead. */}
              {weight.readings > 1 ? (
                <WeightSparkline summary={weight} days={WEIGHT_WINDOW_DAYS} />
              ) : (
                <Text style={styles.weightEmptyTrend}>
                  Log again to start the trend — it averages your last{' '}
                  {WEIGHT_SMOOTHING_DAYS} days, so day-to-day swings stop mattering.
                </Text>
              )}
              <View style={styles.weightFoot}>
                <Text style={styles.weightFootCount}>
                  {weight.readings} reading{weight.readings === 1 ? '' : 's'}
                </Text>
                <TouchableOpacity
                  onPress={() => setShowWeightLog(true)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="See all weigh-ins"
                >
                  <Text style={styles.weightFootLink}>See all</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <Text style={[styles.settingHint, { marginTop: space.md }]}>
              Log as often or as little as you like — defaults to today's date.
            </Text>
          )}
        </View>

        {/* Daily Goals (editable) */}
        <Text style={styles.sectionTitle}>Daily Goals</Text>
        <View style={styles.card}>
          <GoalSource
            mode={goalSource}
            basisWeightLbs={goalsBasisWeightLbs}
            onRecalculate={handleRecalculate}
            onRunWizard={() => navigation?.navigate('GoalWizard')}
          />
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
              onSlide={field === 'calories' || field === 'fiber' ? undefined : handleSlide}
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

          {/* The reconciliation row.
              It used to state the macro total and go quiet, turning amber
              past 50 kcal of disagreement and saying nothing at all below
              that — so a goal three calories out looked settled, and one
              sixty out was flagged with no way to act on it. It now names
              the gap in both cases and offers the one tap that closes it.

              Grams never move here. They are what was typed; the calorie
              goal is the estimate. */}
          <View style={styles.calCalc}>
            <Text style={styles.calCalcLabel}>Calories from macros:</Text>
            <Text style={[styles.calCalcValue, calorieGap !== 0 && styles.calCalcMismatch]}>
              {totalCalsFromMacros.toLocaleString()} kcal
            </Text>
          </View>
          {calorieGap !== 0 && totalCalsFromMacros > 0 && (
            <TouchableOpacity
              style={styles.calFixRow}
              onPress={matchCaloriesToMacros}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={`Set the calorie goal to ${totalCalsFromMacros}`}
            >
              <Text style={styles.calFixText}>
                {Math.abs(calorieGap).toLocaleString()} kcal{' '}
                {calorieGap > 0 ? 'over' : 'under'} your calorie goal
              </Text>
              <Text style={styles.calFixAction}>Match goal</Text>
            </TouchableOpacity>
          )}

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
              hitSlop={2}
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
              hitSlop={2}
              onPress={() => setDefaultRestSeconds(defaultRestSeconds + 15)}
            >
              <Text style={styles.hydrationBtnText}>+</Text>
            </TouchableOpacity>
          </View>
          <Text style={[styles.settingHint, { marginTop: space.sm }]}>
            Used for the rest countdown during a workout. Adjust in 15-second steps
            (you can still tap +30s or Skip mid-workout).
          </Text>

          {/* Also asked by the goal wizard. Here as well because changing one
              number should not mean re-running a six-step flow — and because
              the wizard is reached from a button on this screen that nothing
              obliges anyone to press. */}
          <View style={[styles.hydrationRow, { marginTop: space.md, paddingTop: space.md, borderTopWidth: 1, borderTopColor: c.border }]}>
            <TouchableOpacity
              style={styles.hydrationBtn}
              hitSlop={2}
              onPress={() => setWeeklyWorkoutGoal(weeklyWorkoutGoal - 1)}
            >
              <Text style={styles.hydrationBtnText}>−</Text>
            </TouchableOpacity>
            <View style={styles.hydrationCenter}>
              <Text style={styles.hydrationLabel}>Weekly Workout Goal</Text>
              <Text style={styles.hydrationValue}>
                {weeklyWorkoutGoal} {weeklyWorkoutGoal === 1 ? 'day' : 'days'}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.hydrationBtn}
              hitSlop={2}
              onPress={() => setWeeklyWorkoutGoal(weeklyWorkoutGoal + 1)}
            >
              <Text style={styles.hydrationBtnText}>+</Text>
            </TouchableOpacity>
          </View>
          <Text style={[styles.settingHint, { marginTop: space.sm }]}>
            Sessions a week the consistency ring on Home fills toward. It does not
            affect your calorie or macro targets.
          </Text>

          {/* Heat and cold, in minutes rather than sessions — the time is
              the dose, and three five-minute saunas are near enough one
              fifteen that counting visits would measure the wrong thing.

              Both start at zero, meaning no target, and nothing nudges
              anyone off zero. Most people who use this app will never log a
              sauna; a shipped number would hand all of them a goal they are
              failing at. Stepping to zero is also how a target is removed,
              which is why the stepper allows it where the workout goal
              above does not.

              One tap is five minutes of heat and one minute of cold — see
              goalStepMinutes, which lives on the recovery type because the
              two scales are an order of magnitude apart. The clamp in
              setRecoveryGoal catches the step below zero, so stepping down
              from the first notch lands on no target rather than a negative
              one. */}
          {RECOVERY_TYPES.map((t) => {
            const minutes = recoveryGoals[t.kind] ?? 0;
            return (
              <View
                key={t.kind}
                style={[
                  styles.hydrationRow,
                  { marginTop: space.md, paddingTop: space.md, borderTopWidth: 1, borderTopColor: c.border },
                ]}
              >
                <TouchableOpacity
                  style={styles.hydrationBtn}
                  hitSlop={2}
                  onPress={() => setRecoveryGoal(t.kind, minutes - t.goalStepMinutes)}
                  accessibilityRole="button"
                  accessibilityLabel={`Decrease weekly ${t.label.toLowerCase()} goal`}
                >
                  <Text style={styles.hydrationBtnText}>−</Text>
                </TouchableOpacity>
                <View style={styles.hydrationCenter}>
                  <Text style={styles.hydrationLabel}>Weekly {t.label}</Text>
                  <Text style={styles.hydrationValue}>
                    {minutes === 0 ? 'No target' : `${minutes} min`}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.hydrationBtn}
                  hitSlop={2}
                  onPress={() => setRecoveryGoal(t.kind, minutes + t.goalStepMinutes)}
                  accessibilityRole="button"
                  accessibilityLabel={`Increase weekly ${t.label.toLowerCase()} goal`}
                >
                  <Text style={styles.hydrationBtnText}>+</Text>
                </TouchableOpacity>
              </View>
            );
          })}
          <Text style={[styles.settingHint, { marginTop: space.sm }]}>
            Minutes of heat or cold a week, drawn as a line across the Recovery
            chart on the Workouts tab. Leave at no target to just see the trend.
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
                      hitSlop={2}
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
                      hitSlop={2}
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
              hitSlop={2}
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
              hitSlop={2}
              onPress={() => setWaterGoal(waterGoal + waterIncrement)}
            >
              <Text style={styles.hydrationBtnText}>+</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.hydrationRow, { marginTop: space.md, paddingTop: space.md, borderTopWidth: 1, borderTopColor: c.border }]}>
            <TouchableOpacity
              style={styles.hydrationBtn}
              hitSlop={2}
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
              hitSlop={2}
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
      </KeyboardAvoidingView>

      {/* Every reading, which the card no longer lists. Corrections are rare
          and the trend is what the card is for, so the full log lives one tap
          away rather than taking six rows on a screen it shares with goals,
          reminders and account settings. */}
      <Modal
        visible={showWeightLog}
        transparent
        animationType={sheetAnimation}
        onRequestClose={() => setShowWeightLog(false)}
      >
        <TouchableOpacity
          style={styles.weightSheetBackdrop}
          activeOpacity={1}
          onPress={() => setShowWeightLog(false)}
          accessibilityLabel="Dismiss"
        />
        <View style={styles.weightSheet}>
          <View style={styles.weightSheetHead}>
            <Text style={styles.weightSheetTitle}>Weigh-ins</Text>
            <TouchableOpacity
              onPress={() => setShowWeightLog(false)}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Text style={styles.weightSheetDone}>Done</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            data={bodyWeightLog}
            keyExtractor={(e: BodyWeightEntry) => String(e.loggedAt)}
            renderItem={({ item }: { item: BodyWeightEntry }) => (
              <View style={styles.weightRow}>
                <Text style={styles.weightRowDate}>{displayDate(item.date)}</Text>
                <Text style={styles.weightRowValue}>{item.lbs} lb</Text>
                <TouchableOpacity
                  onPress={() => handleDeleteWeight(item)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  accessibilityRole="button"
                  accessibilityLabel={`Delete weigh-in from ${displayDate(item.date)}`}
                >
                  <Icon name="close" size="sm" color={c.textFaint} />
                </TouchableOpacity>
              </View>
            )}
          />
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const makeStyles = (c: Theme) => StyleSheet.create({
  flex: { flex: 1 },
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
  // Wraps the row and its slider. The rule moved here from goalRow: with a
  // slider under the numbers it was drawing a line between a macro and its
  // own control, separating the two halves of one thing.
  goalBlock: {
    paddingBottom: space.sm,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  goalRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: space.md,
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
  calFixRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    gap: space.md, marginTop: space.sm, paddingVertical: space.xs,
  },
  calFixText: { ...type.caption(c), color: c.textFaint, flex: 1 },
  calFixAction: { ...type.captionStrong(c), color: c.primary },
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
  weightLatest: { ...type.caption(c), color: c.textFaint, marginTop: space.xxs },
  weightTrendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: space.lg,
    marginBottom: space.xs,
  },
  weightWindow: { ...type.caption(c), color: c.textFaint },
  weightEmptyTrend: {
    ...type.caption(c),
    fontFamily: c.fontBody,
    color: c.textMuted,
    lineHeight: 18,
    marginBottom: space.xs,
  },
  weightDelta: {
    borderRadius: radius.control,
    paddingHorizontal: space.sm,
    paddingVertical: space.xxs,
  },
  weightDeltaText: { ...type.captionStrong(c) },
  weightFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: space.sm,
  },
  weightFootCount: { ...type.caption(c), color: c.textFaint },
  weightFootLink: { ...type.captionStrong(c), color: c.primary },

  weightSheetBackdrop: { flex: 1, backgroundColor: c.overlay },
  weightSheet: {
    maxHeight: '70%',
    backgroundColor: c.card,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    paddingHorizontal: space.lg,
    paddingBottom: space.xxl,
  },
  weightSheetHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: space.lg,
  },
  weightSheetTitle: { ...type.heading(c), color: c.text },
  weightSheetDone: { ...type.bodyStrong(c), color: c.primary },

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
