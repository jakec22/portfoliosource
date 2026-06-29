import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  Switch,
  PanResponder,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from '../store/useStore';
import { DailyGoals, ThemeMode } from '../types';
import { displayDate } from '../utils/date';
import { supabase } from '../services/supabase';
import { signOut, deleteAccount } from '../services/auth';
import { requestNotificationPermission } from '../services/notifications';
import { useTheme } from '../theme/useTheme';
import type { Theme } from '../theme';

// mm:ss for the rest-time stepper (e.g. 120 -> "2:00", 90 -> "1:30").
function formatRest(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

type MacroKey = 'protein' | 'carbs' | 'fat';
type MacroPct = Record<MacroKey, number>;

// Integer protein/carbs/fat percentages (by calories) derived from the goal
// grams, always summing to 100.
function pctFromGoals(g: DailyGoals): MacroPct {
  const p = g.protein * 4;
  const c = g.carbs * 4;
  const f = g.fat * 9;
  const total = p + c + f;
  if (total <= 0) return { protein: 30, carbs: 40, fat: 30 };
  const protein = Math.round((p / total) * 100);
  const carbs = Math.round((c / total) * 100);
  const fat = Math.max(0, 100 - protein - carbs);
  return { protein, carbs, fat };
}

// Set one macro to `value` and redistribute the remainder across the other two
// in proportion to their previous split, so the three always total exactly 100.
function rebalance(prev: MacroPct, macro: MacroKey, value: number): MacroPct {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  const others = (['protein', 'carbs', 'fat'] as MacroKey[]).filter((k) => k !== macro);
  const remaining = 100 - v;
  const otherSum = prev[others[0]] + prev[others[1]];
  const next: MacroPct = { ...prev, [macro]: v };
  if (otherSum <= 0) {
    next[others[0]] = Math.floor(remaining / 2);
    next[others[1]] = remaining - next[others[0]];
  } else {
    next[others[0]] = Math.round((remaining * prev[others[0]]) / otherSum);
    next[others[1]] = remaining - next[others[0]];
  }
  return next;
}

// A draggable percentage slider built on PanResponder (no native dependency).
function MacroSlider({
  value,
  color,
  onChange,
}: {
  value: number;
  color: string;
  onChange: (v: number) => void;
}) {
  const c = useTheme();
  const sliderStyles = useMemo(() => makeSliderStyles(c), [c]);
  const viewRef = useRef<View>(null);
  const widthRef = useRef(0);
  const pageXRef = useRef(0);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (_, gs) => emit(gs.x0),
      onPanResponderMove: (_, gs) => emit(gs.moveX),
    })
  ).current;

  function emit(pageX: number) {
    const w = widthRef.current;
    const ox = pageXRef.current;
    if (w <= 0) return;
    const x = Math.max(0, Math.min(w, pageX - ox));
    onChangeRef.current(Math.round((x / w) * 100));
  }

  return (
    <View
      ref={viewRef}
      style={sliderStyles.touch}
      onLayout={() => {
        viewRef.current?.measure((_x, _y, w, _h, px) => {
          widthRef.current = w;
          pageXRef.current = px;
        });
      }}
      {...responder.panHandlers}
    >
      <View style={sliderStyles.track}>
        <View
          style={[sliderStyles.fill, { width: `${value}%` as any, backgroundColor: color }]}
        />
      </View>
      <View style={[sliderStyles.thumb, { left: `${value}%` as any, borderColor: color }]} />
    </View>
  );
}

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
  const [form, setForm] = useState({
    calories: String(goals.calories),
    protein: String(goals.protein),
    carbs: String(goals.carbs),
    fat: String(goals.fat),
    fiber: String(goals.fiber),
  });

  const [macroPct, setMacroPct] = useState<MacroPct>(() => pctFromGoals(goals));

  useEffect(() => {
    setForm({
      calories: String(goals.calories),
      protein: String(goals.protein),
      carbs: String(goals.carbs),
      fat: String(goals.fat),
      fiber: String(goals.fiber),
    });
    setMacroPct(pctFromGoals(goals));
  }, [goals]);

  function handleMacroPct(macro: MacroKey, value: number) {
    const next = rebalance(macroPct, macro, value);
    setMacroPct(next);
    const cal = parseInt(form.calories || '0');
    if (cal > 0) {
      setForm((f) => ({
        ...f,
        protein: String(Math.round((cal * next.protein) / 100 / 4)),
        carbs: String(Math.round((cal * next.carbs) / 100 / 4)),
        fat: String(Math.round((cal * next.fat) / 100 / 9)),
      }));
    }
  }

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

  function setReminder(
    key: 'breakfast' | 'lunch' | 'dinner' | 'streak',
    on: boolean
  ) {
    setNotificationPrefs({ ...notificationPrefs, [key]: on });
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
      <View style={styles.goalRow}>
        <View style={[styles.goalDot, { backgroundColor: color }]} />
        <Text style={styles.goalLabel}>{label}</Text>
        <View style={styles.goalInputWrap}>
          <TextInput
            style={styles.goalInput}
            value={form[field]}
            onChangeText={(v) => setForm((f) => ({ ...f, [field]: v }))}
            keyboardType="number-pad"
            selectTextOnFocus
          />
          <Text style={styles.goalUnit}>{unit}</Text>
        </View>
      </View>
    );
  }

  const totalCalsFromMacros =
    parseInt(form.protein || '0') * 4 +
    parseInt(form.carbs || '0') * 4 +
    parseInt(form.fat || '0') * 9;

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
            <TouchableOpacity onPress={() => navigation.navigate('Analytics')}>
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
          <GoalField label="Calories" field="calories" unit="kcal" color="#10B981" />
          <GoalField label="Protein" field="protein" unit="g" color="#3B82F6" />
          <GoalField label="Carbs" field="carbs" unit="g" color="#F59E0B" />
          <GoalField label="Fat" field="fat" unit="g" color="#EF4444" />
          <GoalField label="Fiber" field="fiber" unit="g" color="#8B5CF6" />

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

        {/* Macro distribution */}
        <Text style={styles.sectionTitle}>Macro Distribution</Text>
        <View style={styles.card}>
          <Text style={styles.distHint}>
            Drag to adjust your macro ratio — the three always total 100%. Grams
            update from your calorie goal.
          </Text>
          {([
            { key: 'protein', label: 'Protein', color: '#3B82F6' },
            { key: 'carbs', label: 'Carbs', color: '#F59E0B' },
            { key: 'fat', label: 'Fat', color: '#EF4444' },
          ] as { key: MacroKey; label: string; color: string }[]).map(
            ({ key, label, color }) => (
              <View key={key} style={styles.sliderRow}>
                <View style={styles.sliderHead}>
                  <Text style={[styles.distLabel, { color }]}>{label}</Text>
                  <Text style={styles.sliderReadout}>
                    {macroPct[key]}% · {form[key] || '0'}g
                  </Text>
                </View>
                <MacroSlider
                  value={macroPct[key]}
                  color={color}
                  onChange={(v) => handleMacroPct(key, v)}
                />
              </View>
            )
          )}
          <View style={styles.distTotalRow}>
            <Text style={styles.distTotalLabel}>Total</Text>
            <Text style={styles.distTotalValue}>
              {macroPct.protein + macroPct.carbs + macroPct.fat}%
            </Text>
          </View>
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
              trackColor={{ false: c.border, true: '#6EE7B7' }}
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
              trackColor={{ false: c.border, true: '#6EE7B7' }}
              thumbColor={notificationPrefs.enabled ? c.primary : c.textFaint}
            />
          </View>

          {notificationPrefs.enabled &&
            ([
              { key: 'breakfast', label: 'Breakfast', time: '9:00 AM' },
              { key: 'lunch', label: 'Lunch', time: '1:00 PM' },
              { key: 'dinner', label: 'Dinner', time: '7:00 PM' },
              { key: 'streak', label: 'Streak reminder', time: '8:30 PM' },
            ] as const).map(({ key, label, time }) => (
              <View
                key={key}
                style={[
                  styles.waterToggleRow,
                  { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: c.border },
                ]}
              >
                <View style={{ flex: 1, paddingRight: 12 }}>
                  <Text style={styles.waterToggleLabel}>{label}</Text>
                  <Text style={styles.settingHint}>{time}</Text>
                </View>
                <Switch
                  value={notificationPrefs[key]}
                  onValueChange={(v) => setReminder(key, v)}
                  trackColor={{ false: c.border, true: '#6EE7B7' }}
                  thumbColor={notificationPrefs[key] ? c.primary : c.textFaint}
                />
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
              trackColor={{ false: c.border, true: '#6EE7B7' }}
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
            Choose a light or dark look, or follow your device setting.
          </Text>
          <View style={styles.segmented}>
            {([
              { key: 'light', label: '☀️  Light' },
              { key: 'dark', label: '🌙  Dark' },
              { key: 'system', label: '⚙️  System' },
            ] as { key: ThemeMode; label: string }[]).map(({ key, label }) => {
              const active = themeMode === key;
              return (
                <TouchableOpacity
                  key={key}
                  style={[styles.segment, active && styles.segmentActive]}
                  onPress={() => setThemeMode(key)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
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
    borderColor: c.scheme === 'dark' ? 'rgba(16,185,129,0.4)' : '#A7F3D0',
    padding: 18,
    marginBottom: 24,
    gap: 14,
  },
  wizardIcon: { fontSize: 28 },
  wizardTitle: { fontSize: 16, fontWeight: '800', color: c.scheme === 'dark' ? c.primary : '#065F46' },
  wizardSub: { fontSize: 13, color: c.scheme === 'dark' ? c.textMuted : '#059669', marginTop: 2, lineHeight: 18 },
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
  goalUnit: { fontSize: 13, color: c.textFaint, width: 32 },
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
  // Macro distribution
  distLabel: { fontSize: 14, fontWeight: '700' },
  distHint: { fontSize: 12, color: c.textFaint, lineHeight: 17, marginBottom: 8 },
  sliderRow: { paddingVertical: 6 },
  sliderHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sliderReadout: { fontSize: 13, fontWeight: '600', color: c.textMuted },
  distTotalRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    marginTop: 12, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: c.border,
  },
  distTotalLabel: { fontSize: 13, color: c.textMuted, fontWeight: '600' },
  distTotalValue: { fontSize: 13, fontWeight: '800', color: c.primary },
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
  segmented: {
    flexDirection: 'row',
    backgroundColor: c.cardMuted,
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  segment: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentActive: {
    backgroundColor: c.card,
    shadowColor: c.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    elevation: 2,
  },
  segmentText: { fontSize: 13, fontWeight: '600', color: c.textMuted },
  segmentTextActive: { color: c.primary, fontWeight: '700' },
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

const makeSliderStyles = (c: Theme) => StyleSheet.create({
  touch: { height: 36, justifyContent: 'center', marginTop: 4 },
  track: { height: 8, borderRadius: 4, backgroundColor: c.cardMuted, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4 },
  thumb: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderRadius: 11,
    marginLeft: -11,
    backgroundColor: c.card,
    borderWidth: 3,
    shadowColor: c.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
});
