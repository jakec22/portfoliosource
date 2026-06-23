import React, { useState, useEffect } from 'react';
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
import { DailyGoals } from '../types';
import { supabase } from '../services/supabase';
import { signOut } from '../services/auth';

type Sex = 'male' | 'female';
type Units = 'imperial' | 'metric';

const ACTIVITY_LEVELS = [
  { label: 'Not Active', description: 'Desk job, little exercise', multiplier: 1.2 },
  { label: 'Light', description: '1–3 workouts/week', multiplier: 1.375 },
  { label: 'Moderate', description: '3–5 workouts/week', multiplier: 1.55 },
  { label: 'Active', description: '6–7 workouts/week', multiplier: 1.725 },
  { label: 'Very Active', description: 'Physical job + daily exercise', multiplier: 1.9 },
];

interface MacroResult {
  label: string;
  emoji: string;
  color: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  proteinPct: number;
  carbsPct: number;
  fatPct: number;
  delta: string;
}

function calcMacros(
  tdee: number,
  calorieDelta: number,
  proteinPct: number,
  carbsPct: number,
  fatPct: number,
  fiber: number,
  label: string,
  emoji: string,
  color: string,
  delta: string,
): MacroResult {
  const calories = Math.round(tdee + calorieDelta);
  return {
    label,
    emoji,
    color,
    calories,
    protein: Math.round((calories * proteinPct) / 4),
    carbs: Math.round((calories * carbsPct) / 4),
    fat: Math.round((calories * fatPct) / 9),
    fiber,
    proteinPct: Math.round(proteinPct * 100),
    carbsPct: Math.round(carbsPct * 100),
    fatPct: Math.round(fatPct * 100),
    delta,
  };
}

function computeResults(
  sex: Sex,
  ageStr: string,
  weightKg: number,
  heightCm: number,
  activityMultiplier: number,
): MacroResult[] | null {
  const age = parseInt(ageStr);
  if (!age || isNaN(age) || age < 10 || age > 100) return null;
  if (weightKg < 30 || weightKg > 300) return null;
  if (heightCm < 100 || heightCm > 250) return null;

  // Mifflin-St Jeor BMR
  const bmr =
    sex === 'male'
      ? 10 * weightKg + 6.25 * heightCm - 5 * age + 5
      : 10 * weightKg + 6.25 * heightCm - 5 * age - 161;

  const tdee = Math.round(bmr * activityMultiplier);
  const fiber = Math.round(weightKg * 0.4); // ~0.4 g/kg, ~14g/1000kcal

  return [
    calcMacros(tdee, -500, 0.40, 0.30, 0.30, fiber, 'Weight Loss', '📉', '#3B82F6', '−500 kcal/day · ~0.5 lb/week'),
    calcMacros(tdee,    0, 0.30, 0.40, 0.30, fiber, 'Maintenance', '⚖️', '#10B981', 'TDEE — maintain current weight'),
    calcMacros(tdee, +350, 0.30, 0.45, 0.25, fiber, 'Muscle Gain',  '📈', '#F59E0B', '+350 kcal/day · lean bulk'),
  ];
}

export function CalculatorScreen() {
  const goals = useStore((s) => s.goals);
  const setGoals = useStore((s) => s.setGoals);
  const setBodyWeight = useStore((s) => s.setBodyWeight);
  const waterGoal = useStore((s) => s.waterGoal);
  const setWaterGoal = useStore((s) => s.setWaterGoal);
  const waterIncrement = useStore((s) => s.waterIncrement);
  const setWaterIncrement = useStore((s) => s.setWaterIncrement);
  const showWaterTracker = useStore((s) => s.showWaterTracker);
  const setShowWaterTracker = useStore((s) => s.setShowWaterTracker);

  // --- Goals editing ---
  const [form, setForm] = useState({
    calories: String(goals.calories),
    protein: String(goals.protein),
    carbs: String(goals.carbs),
    fat: String(goals.fat),
    fiber: String(goals.fiber),
  });

  // Keep the editable fields in sync when goals change elsewhere
  // (e.g. applying a calculator result below).
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

  // --- Calculator ---
  const [units, setUnits] = useState<Units>('imperial');
  const [sex, setSex] = useState<Sex>('male');
  const [age, setAge] = useState('');
  const [weightLbs, setWeightLbs] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [heightFt, setHeightFt] = useState('');
  const [heightIn, setHeightIn] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [activityIdx, setActivityIdx] = useState(1);
  const [results, setResults] = useState<MacroResult[] | null>(null);

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

  function handleCalculate() {
    let wKg: number;
    let hCm: number;

    if (units === 'imperial') {
      wKg = parseFloat(weightLbs) / 2.2046;
      const ft = parseInt(heightFt) || 0;
      const inches = parseFloat(heightIn) || 0;
      hCm = (ft * 12 + inches) * 2.54;
    } else {
      wKg = parseFloat(weightKg);
      hCm = parseFloat(heightCm);
    }

    const r = computeResults(sex, age, wKg, hCm, ACTIVITY_LEVELS[activityIdx].multiplier);
    if (!r) {
      Alert.alert('Check your inputs', 'Please enter valid age, height, and weight.');
      return;
    }
    // Persist body weight for the hydration calc.
    if (wKg > 0) {
      setBodyWeight(wKg * 2.2046);
    }
    setResults(r);
  }

  function handleApply(r: MacroResult) {
    const next: DailyGoals = {
      calories: r.calories,
      protein: r.protein,
      carbs: r.carbs,
      fat: r.fat,
      fiber: r.fiber,
    };
    setGoals(next);
    Alert.alert('Goals Updated', `${r.label} goals (${r.calories} kcal) applied!`);
  }

  function handleSignOut() {
    Alert.alert('Sign Out', 'Your data stays synced to the cloud.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => signOut() },
    ]);
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
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.pageTitle}>Goals</Text>
        <Text style={styles.subtitle}>Set your daily targets, or calculate them below</Text>

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
          {[
            { label: 'Protein', cals: parseInt(form.protein || '0') * 4, color: '#3B82F6' },
            { label: 'Carbs', cals: parseInt(form.carbs || '0') * 4, color: '#F59E0B' },
            { label: 'Fat', cals: parseInt(form.fat || '0') * 9, color: '#EF4444' },
          ].map(({ label, cals, color }) => {
            const pct = totalCalsFromMacros
              ? Math.round((cals / totalCalsFromMacros) * 100)
              : 0;
            return (
              <View key={label} style={styles.distRow}>
                <Text style={[styles.distLabel, { color }]}>{label}</Text>
                <View style={styles.distBarTrack}>
                  <View
                    style={[
                      styles.distBarFill,
                      { width: `${pct}%` as any, backgroundColor: color },
                    ]}
                  />
                </View>
                <Text style={styles.distPct}>{pct}%</Text>
              </View>
            );
          })}
        </View>

        {/* ===== Calculator ===== */}
        <Text style={styles.sectionTitle}>Calorie Calculator</Text>

        {/* Units toggle */}
        <View style={styles.toggleRow}>
          {(['imperial', 'metric'] as Units[]).map((u) => (
            <TouchableOpacity
              key={u}
              style={[styles.toggleBtn, units === u && styles.toggleBtnActive]}
              onPress={() => setUnits(u)}
            >
              <Text style={[styles.toggleBtnText, units === u && styles.toggleBtnTextActive]}>
                {u === 'imperial' ? 'Imperial (lbs / ft)' : 'Metric (kg / cm)'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Sex / Age / Weight / Height */}
        <View style={styles.card}>
          <Text style={styles.fieldLabel}>Sex</Text>
          <View style={styles.segRow}>
            {(['male', 'female'] as Sex[]).map((s) => (
              <TouchableOpacity
                key={s}
                style={[styles.segBtn, sex === s && styles.segBtnActive]}
                onPress={() => setSex(s)}
              >
                <Text style={[styles.segBtnText, sex === s && styles.segBtnTextActive]}>
                  {s === 'male' ? '♂ Male' : '♀ Female'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Age</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={[styles.input, { width: 100 }]}
              placeholder="30"
              placeholderTextColor="#9CA3AF"
              value={age}
              onChangeText={setAge}
              keyboardType="number-pad"
            />
            <Text style={styles.inputUnit}>years</Text>
          </View>

          <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Weight</Text>
          {units === 'imperial' ? (
            <View style={styles.inputRow}>
              <TextInput
                style={[styles.input, { width: 100 }]}
                placeholder="160"
                placeholderTextColor="#9CA3AF"
                value={weightLbs}
                onChangeText={setWeightLbs}
                keyboardType="decimal-pad"
              />
              <Text style={styles.inputUnit}>lbs</Text>
            </View>
          ) : (
            <View style={styles.inputRow}>
              <TextInput
                style={[styles.input, { width: 100 }]}
                placeholder="72"
                placeholderTextColor="#9CA3AF"
                value={weightKg}
                onChangeText={setWeightKg}
                keyboardType="decimal-pad"
              />
              <Text style={styles.inputUnit}>kg</Text>
            </View>
          )}

          <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Height</Text>
          {units === 'imperial' ? (
            <View style={styles.inputRow}>
              <TextInput
                style={[styles.input, { width: 80 }]}
                placeholder="5"
                placeholderTextColor="#9CA3AF"
                value={heightFt}
                onChangeText={setHeightFt}
                keyboardType="number-pad"
              />
              <Text style={styles.inputUnit}>ft</Text>
              <TextInput
                style={[styles.input, { width: 80, marginLeft: 12 }]}
                placeholder="10"
                placeholderTextColor="#9CA3AF"
                value={heightIn}
                onChangeText={setHeightIn}
                keyboardType="decimal-pad"
              />
              <Text style={styles.inputUnit}>in</Text>
            </View>
          ) : (
            <View style={styles.inputRow}>
              <TextInput
                style={[styles.input, { width: 100 }]}
                placeholder="178"
                placeholderTextColor="#9CA3AF"
                value={heightCm}
                onChangeText={setHeightCm}
                keyboardType="decimal-pad"
              />
              <Text style={styles.inputUnit}>cm</Text>
            </View>
          )}
        </View>

        {/* Activity level */}
        <Text style={styles.sectionTitle}>Activity Level</Text>
        <View style={styles.card}>
          {ACTIVITY_LEVELS.map((a, i) => (
            <TouchableOpacity
              key={a.label}
              style={[styles.activityRow, i === activityIdx && styles.activityRowActive]}
              onPress={() => setActivityIdx(i)}
              activeOpacity={0.7}
            >
              <View style={[styles.activityDot, i === activityIdx && styles.activityDotActive]} />
              <View style={styles.activityText}>
                <Text style={[styles.activityLabel, i === activityIdx && styles.activityLabelActive]}>
                  {a.label}
                </Text>
                <Text style={styles.activityDesc}>{a.description}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Calculate button */}
        <TouchableOpacity style={styles.calcBtn} onPress={handleCalculate} activeOpacity={0.85}>
          <Text style={styles.calcBtnText}>Calculate</Text>
        </TouchableOpacity>

        {/* Results */}
        {results && (
          <>
            <Text style={styles.sectionTitle}>Your Results</Text>
            {results.map((r) => (
              <ResultCard key={r.label} result={r} onApply={() => handleApply(r)} />
            ))}
            <Text style={styles.disclaimer}>
              Based on Mifflin-St Jeor equation. Results are estimates — adjust based on real-world progress.
            </Text>
          </>
        )}

        {/* Hydration Settings */}
        <Text style={styles.sectionTitle}>Hydration Settings</Text>
        <View style={styles.card}>
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Show Water Tracker</Text>
            <Switch
              value={showWaterTracker}
              onValueChange={setShowWaterTracker}
              trackColor={{ false: '#E5E7EB', true: '#6EE7B7' }}
              thumbColor={showWaterTracker ? '#10B981' : '#9CA3AF'}
            />
          </View>
          <View style={[styles.hydrationRow, { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F3F4F6' }]}>
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

          <View style={[styles.hydrationRow, { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F3F4F6' }]}>
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
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function MacroBar({ pct, color }: { pct: number; color: string }) {
  return (
    <View style={barStyles.track}>
      <View style={[barStyles.fill, { width: `${pct}%` as any, backgroundColor: color }]} />
    </View>
  );
}

function ResultCard({ result: r, onApply }: { result: MacroResult; onApply: () => void }) {
  return (
    <View style={[cardStyles.container, { borderTopColor: r.color }]}>
      <View style={cardStyles.header}>
        <View>
          <Text style={cardStyles.emoji}>{r.emoji}</Text>
          <Text style={[cardStyles.label, { color: r.color }]}>{r.label}</Text>
        </View>
        <View style={cardStyles.calorieBox}>
          <Text style={[cardStyles.calorieValue, { color: r.color }]}>{r.calories}</Text>
          <Text style={cardStyles.calorieUnit}>kcal/day</Text>
        </View>
      </View>

      <Text style={cardStyles.delta}>{r.delta}</Text>

      <View style={cardStyles.macroGrid}>
        {[
          { label: 'Protein', g: r.protein, pct: r.proteinPct, color: '#3B82F6' },
          { label: 'Carbs', g: r.carbs, pct: r.carbsPct, color: '#F59E0B' },
          { label: 'Fat', g: r.fat, pct: r.fatPct, color: '#EF4444' },
          { label: 'Fiber', g: r.fiber, pct: null, color: '#8B5CF6' },
        ].map(({ label, g, pct, color }) => (
          <View key={label} style={cardStyles.macroCell}>
            <Text style={[cardStyles.macroG, { color }]}>{g}g</Text>
            {pct !== null && <MacroBar pct={pct} color={color} />}
            <Text style={cardStyles.macroLabel}>{label}</Text>
            {pct !== null && <Text style={cardStyles.macroPct}>{pct}%</Text>}
          </View>
        ))}
      </View>

      <TouchableOpacity style={[cardStyles.applyBtn, { backgroundColor: r.color }]} onPress={onApply}>
        <Text style={cardStyles.applyBtnText}>Apply These Goals</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },
  content: { padding: 16, paddingBottom: 48 },
  pageTitle: { fontSize: 28, fontWeight: '800', color: '#111827', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#9CA3AF', marginBottom: 20 },
  sectionTitle: {
    fontSize: 13, fontWeight: '700', color: '#9CA3AF',
    textTransform: 'uppercase', letterSpacing: 0.8,
    marginTop: 8, marginBottom: 10,
  },
  toggleRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  toggleBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 12,
    backgroundColor: '#fff', alignItems: 'center',
    borderWidth: 1.5, borderColor: '#E5E7EB',
  },
  toggleBtnActive: { borderColor: '#10B981', backgroundColor: '#ECFDF5' },
  toggleBtnText: { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  toggleBtnTextActive: { color: '#10B981' },
  card: {
    backgroundColor: '#fff', borderRadius: 20, padding: 20,
    marginBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  // Goals editing
  goalRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#F9FAFB',
  },
  goalDot: { width: 10, height: 10, borderRadius: 5, marginRight: 12 },
  goalLabel: { flex: 1, fontSize: 16, color: '#374151', fontWeight: '500' },
  goalInputWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  goalInput: {
    width: 80, height: 40, borderWidth: 1.5, borderColor: '#E5E7EB',
    borderRadius: 10, textAlign: 'center',
    fontSize: 16, fontWeight: '600', color: '#111827',
  },
  goalUnit: { fontSize: 13, color: '#9CA3AF', width: 32 },
  calCalc: {
    flexDirection: 'row', justifyContent: 'space-between',
    marginTop: 16, paddingTop: 16,
    borderTopWidth: 1, borderTopColor: '#F3F4F6',
  },
  calCalcLabel: { fontSize: 13, color: '#6B7280' },
  calCalcValue: { fontSize: 13, fontWeight: '700', color: '#10B981' },
  calCalcMismatch: { color: '#F59E0B' },
  saveBtn: {
    backgroundColor: '#10B981', borderRadius: 14,
    paddingVertical: 14, alignItems: 'center', marginTop: 20,
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  // Macro distribution
  distRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 12 },
  distLabel: { width: 56, fontSize: 13, fontWeight: '600' },
  distBarTrack: { flex: 1, height: 8, backgroundColor: '#F3F4F6', borderRadius: 4, overflow: 'hidden' },
  distBarFill: { height: 8, borderRadius: 4 },
  distPct: { width: 36, textAlign: 'right', fontSize: 13, fontWeight: '600', color: '#6B7280' },
  // Calculator inputs
  fieldLabel: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 8 },
  segRow: { flexDirection: 'row', gap: 10 },
  segBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 12,
    backgroundColor: '#F9FAFB', alignItems: 'center',
    borderWidth: 1.5, borderColor: '#E5E7EB',
  },
  segBtnActive: { borderColor: '#10B981', backgroundColor: '#ECFDF5' },
  segBtnText: { fontSize: 14, fontWeight: '600', color: '#6B7280' },
  segBtnTextActive: { color: '#10B981' },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: {
    height: 44, borderWidth: 1.5, borderColor: '#E5E7EB',
    borderRadius: 12, paddingHorizontal: 14,
    fontSize: 16, fontWeight: '600', color: '#111827',
    backgroundColor: '#FAFAFA',
  },
  inputUnit: { fontSize: 14, color: '#9CA3AF', fontWeight: '500' },
  activityRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#F9FAFB',
  },
  activityRowActive: { backgroundColor: '#F0FDF4', marginHorizontal: -20, paddingHorizontal: 20 },
  activityDot: {
    width: 16, height: 16, borderRadius: 8,
    borderWidth: 2, borderColor: '#D1D5DB', marginRight: 12,
  },
  activityDotActive: { borderColor: '#10B981', backgroundColor: '#10B981' },
  activityText: { flex: 1 },
  activityLabel: { fontSize: 14, fontWeight: '600', color: '#374151' },
  activityLabelActive: { color: '#065F46' },
  activityDesc: { fontSize: 12, color: '#9CA3AF', marginTop: 1 },
  calcBtn: {
    backgroundColor: '#10B981', borderRadius: 16, paddingVertical: 16,
    alignItems: 'center', marginVertical: 4,
    shadowColor: '#10B981', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8,
  },
  calcBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  disclaimer: {
    fontSize: 11, color: '#9CA3AF', textAlign: 'center',
    marginTop: 8, lineHeight: 16,
  },
  // Hydration
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  toggleLabel: { fontSize: 15, fontWeight: '600', color: '#374151' },
  hydrationRow: { flexDirection: 'row', alignItems: 'center' },
  hydrationBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#EFF6FF',
    alignItems: 'center', justifyContent: 'center',
  },
  hydrationBtnText: { fontSize: 24, fontWeight: '600', color: '#3B82F6', lineHeight: 28 },
  hydrationCenter: { flex: 1, alignItems: 'center' },
  hydrationLabel: { fontSize: 11, color: '#9CA3AF' },
  hydrationValue: { fontSize: 18, fontWeight: '700', color: '#111827' },
  // Account
  accountRow: { marginBottom: 16 },
  accountLabel: { fontSize: 12, color: '#9CA3AF', marginBottom: 2 },
  accountEmail: { fontSize: 15, fontWeight: '600', color: '#111827' },
  signOutBtn: {
    borderRadius: 14, paddingVertical: 14, alignItems: 'center',
    borderWidth: 1.5, borderColor: '#FEE2E2', backgroundColor: '#FEF2F2',
  },
  signOutText: { color: '#EF4444', fontSize: 16, fontWeight: '700' },
});

const barStyles = StyleSheet.create({
  track: { height: 4, backgroundColor: '#F3F4F6', borderRadius: 2, marginVertical: 4, overflow: 'hidden' },
  fill: { height: 4, borderRadius: 2 },
});

const cardStyles = StyleSheet.create({
  container: {
    backgroundColor: '#fff', borderRadius: 20, padding: 20, marginBottom: 16,
    borderTopWidth: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 8, elevation: 3,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  emoji: { fontSize: 24, marginBottom: 2 },
  label: { fontSize: 18, fontWeight: '800' },
  calorieBox: { alignItems: 'flex-end' },
  calorieValue: { fontSize: 36, fontWeight: '800', lineHeight: 40 },
  calorieUnit: { fontSize: 12, color: '#9CA3AF' },
  delta: { fontSize: 12, color: '#6B7280', marginBottom: 16 },
  macroGrid: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  macroCell: { flex: 1, alignItems: 'center' },
  macroG: { fontSize: 15, fontWeight: '700' },
  macroLabel: { fontSize: 10, color: '#9CA3AF', marginTop: 2 },
  macroPct: { fontSize: 10, color: '#6B7280', fontWeight: '600' },
  applyBtn: { borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  applyBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
