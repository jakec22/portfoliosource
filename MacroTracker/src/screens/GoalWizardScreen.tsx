import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from '../store/useStore';
import { todayString } from '../utils/date';
import { KeyboardDoneAccessory, DONE_ACCESSORY_ID } from '../components/KeyboardDoneAccessory';
import {
  ACTIVITY_LEVELS,
  GOAL_META,
  GoalType,
  RATE_OPTIONS,
  Sex,
  Units,
  buildPlan,
  computeTdee,
  describePlan,
  imperialHeightToCm,
  imperialToKg,
} from '../utils/tdee';

interface Props {
  navigation: any;
}

// The wizard steps in order. The "pace" step is dropped when the goal is
// "maintain" (there's no deficit/surplus to choose).
type StepKey = 'goal' | 'basics' | 'body' | 'activity' | 'pace' | 'review';

export function GoalWizardScreen({ navigation }: Props) {
  const profile = useStore((s) => s.profile);
  const bodyWeightLog = useStore((s) => s.bodyWeightLog);
  const bodyWeightLbs = useStore((s) => s.bodyWeightLbs);
  const setProfile = useStore((s) => s.setProfile);
  const setGoals = useStore((s) => s.setGoals);
  const setBodyWeight = useStore((s) => s.setBodyWeight);
  const logBodyWeight = useStore((s) => s.logBodyWeight);

  // Seed every field from a previously-saved profile, falling back to the most
  // recent logged weight so a returning user barely has to type.
  const seedWeightLbs = profile?.weightLbs ?? bodyWeightLog[0]?.lbs ?? bodyWeightLbs;

  const [goalType, setGoalType] = useState<GoalType>(profile?.goalType ?? 'lose');
  const [sex, setSex] = useState<Sex>(profile?.sex ?? 'male');
  const [units, setUnits] = useState<Units>(profile?.units ?? 'imperial');
  const [age, setAge] = useState(profile ? String(profile.age) : '');
  const [activityIdx, setActivityIdx] = useState(profile?.activityIdx ?? 1);
  const [rateLbPerWeek, setRateLbPerWeek] = useState(
    profile?.rateLbPerWeek ?? RATE_OPTIONS[profile?.goalType ?? 'lose'][0]
  );

  // Weight + height kept as the user-facing strings for the active unit system.
  const [weightLbs, setWeightLbs] = useState(
    seedWeightLbs != null && (profile?.units ?? 'imperial') === 'imperial'
      ? String(Math.round(seedWeightLbs))
      : ''
  );
  const [weightKg, setWeightKg] = useState(
    seedWeightLbs != null && profile?.units === 'metric'
      ? String(Math.round(seedWeightLbs / 2.2046))
      : ''
  );
  const initFt = profile ? Math.floor(profile.heightCm / 2.54 / 12) : null;
  const initIn = profile ? Math.round((profile.heightCm / 2.54) % 12) : null;
  const [heightFt, setHeightFt] = useState(initFt != null ? String(initFt) : '');
  const [heightIn, setHeightIn] = useState(initIn != null ? String(initIn) : '');
  const [heightCm, setHeightCm] = useState(
    profile?.units === 'metric' ? String(Math.round(profile.heightCm)) : ''
  );

  // Which steps are visible depends on the goal (maintain has no pace step).
  const steps: StepKey[] = useMemo(() => {
    const base: StepKey[] = ['goal', 'basics', 'body', 'activity'];
    if (goalType !== 'maintain') base.push('pace');
    base.push('review');
    return base;
  }, [goalType]);

  const [stepIdx, setStepIdx] = useState(0);
  const step = steps[Math.min(stepIdx, steps.length - 1)];

  // --- Canonical numeric values from the current inputs ---
  function currentWeightKg(): number {
    return units === 'imperial' ? imperialToKg(parseFloat(weightLbs)) : parseFloat(weightKg);
  }
  function currentHeightCm(): number {
    return units === 'imperial'
      ? imperialHeightToCm(parseInt(heightFt) || 0, parseFloat(heightIn) || 0)
      : parseFloat(heightCm);
  }

  const tdee = useMemo(() => {
    const wKg = currentWeightKg();
    const hCm = currentHeightCm();
    return computeTdee(sex, parseInt(age), wKg, hCm, ACTIVITY_LEVELS[activityIdx].multiplier);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sex, age, weightLbs, weightKg, heightFt, heightIn, heightCm, units, activityIdx]);

  const plan = useMemo(() => {
    if (tdee == null) return null;
    const rate = goalType === 'maintain' ? 0 : rateLbPerWeek;
    return buildPlan(tdee, currentWeightKg(), goalType, rate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tdee, goalType, rateLbPerWeek, weightLbs, weightKg, units]);

  // --- Per-step validation gates the Next button ---
  function canAdvance(): boolean {
    switch (step) {
      case 'goal':
        return true;
      case 'basics': {
        const a = parseInt(age);
        return !!a && a >= 10 && a <= 100;
      }
      case 'body':
        return currentWeightKg() >= 30 && currentWeightKg() <= 300 &&
          currentHeightCm() >= 100 && currentHeightCm() <= 250;
      case 'activity':
        return true;
      case 'pace':
        return true;
      case 'review':
        return plan != null;
      default:
        return false;
    }
  }

  function handleNext() {
    if (!canAdvance()) {
      Alert.alert('Check your entry', 'Please enter a valid value to continue.');
      return;
    }
    if (step === 'review') {
      handleFinish();
      return;
    }
    setStepIdx((i) => Math.min(i + 1, steps.length - 1));
  }

  function handleBack() {
    if (stepIdx === 0) {
      navigation.goBack();
      return;
    }
    setStepIdx((i) => Math.max(0, i - 1));
  }

  // When the goal changes, reset the pace to that goal's first valid option so
  // we never carry a 1.5 lb/week cut into a gain plan.
  function handleSelectGoal(g: GoalType) {
    setGoalType(g);
    setRateLbPerWeek(RATE_OPTIONS[g][0]);
  }

  function handleFinish() {
    if (!plan || tdee == null) {
      Alert.alert('Almost there', 'Please complete the earlier steps first.');
      return;
    }
    const wLbs = Math.round(currentWeightKg() * 2.2046);
    const rate = goalType === 'maintain' ? 0 : rateLbPerWeek;

    setProfile({
      sex,
      age: parseInt(age),
      heightCm: Math.round(currentHeightCm()),
      weightLbs: wLbs,
      units,
      activityIdx,
      goalType,
      rateLbPerWeek: rate,
      updatedAt: Date.now(),
    });

    // Keep the body weight fresh for the hydration calc; add a dated log entry
    // too if the user hasn't weighed in today, so it shows up in trends.
    const hasToday = bodyWeightLog.some((e) => e.date === todayString());
    if (hasToday) setBodyWeight(wLbs);
    else logBodyWeight(wLbs);

    setGoals(plan.goals);

    Alert.alert(
      'Goals set! 🎯',
      `Your ${GOAL_META[goalType].label.toLowerCase()} plan is ready — ${plan.goals.calories} kcal/day.`,
      [{ text: 'Done', onPress: () => navigation.goBack() }]
    );
  }

  const isReview = step === 'review';
  const nextLabel = isReview ? 'Apply Goals' : 'Continue';

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* Header: progress + close */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={styles.close}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.stepCount}>
          Step {stepIdx + 1} of {steps.length}
        </Text>
        <View style={{ width: 20 }} />
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${((stepIdx + 1) / steps.length) * 100}%` as any }]} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {step === 'goal' && (
            <>
              <Text style={styles.title}>What's your goal?</Text>
              <Text style={styles.subtitle}>We'll tailor your calories and macros to match.</Text>
              {(['lose', 'maintain', 'gain'] as GoalType[]).map((g) => {
                const m = GOAL_META[g];
                const active = goalType === g;
                return (
                  <TouchableOpacity
                    key={g}
                    style={[styles.bigCard, active && { borderColor: m.color, backgroundColor: '#F9FAFB' }]}
                    onPress={() => handleSelectGoal(g)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.bigCardEmoji}>{m.emoji}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.bigCardLabel, active && { color: m.color }]}>{m.label}</Text>
                      <Text style={styles.bigCardBlurb}>{m.blurb}</Text>
                    </View>
                    <View style={[styles.radio, active && { borderColor: m.color }]}>
                      {active && <View style={[styles.radioDot, { backgroundColor: m.color }]} />}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </>
          )}

          {step === 'basics' && (
            <>
              <Text style={styles.title}>A bit about you</Text>
              <Text style={styles.subtitle}>Used to estimate your metabolism.</Text>

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

              <Text style={[styles.fieldLabel, { marginTop: 24 }]}>Age</Text>
              <View style={styles.inputRow}>
                <TextInput
                  style={[styles.input, { width: 110 }]}
                  placeholder="30"
                  placeholderTextColor="#9CA3AF"
                  value={age}
                  onChangeText={setAge}
                  keyboardType="number-pad"
                  inputAccessoryViewID={DONE_ACCESSORY_ID}
                  autoFocus
                />
                <Text style={styles.inputUnit}>years</Text>
              </View>
            </>
          )}

          {step === 'body' && (
            <>
              <Text style={styles.title}>Your measurements</Text>
              <Text style={styles.subtitle}>Height and current weight.</Text>

              <View style={styles.toggleRow}>
                {(['imperial', 'metric'] as Units[]).map((u) => (
                  <TouchableOpacity
                    key={u}
                    style={[styles.toggleBtn, units === u && styles.toggleBtnActive]}
                    onPress={() => setUnits(u)}
                  >
                    <Text style={[styles.toggleBtnText, units === u && styles.toggleBtnTextActive]}>
                      {u === 'imperial' ? 'lbs / ft' : 'kg / cm'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.fieldLabel, { marginTop: 8 }]}>Weight</Text>
              {units === 'imperial' ? (
                <View style={styles.inputRow}>
                  <TextInput
                    style={[styles.input, { width: 110 }]}
                    placeholder="160"
                    placeholderTextColor="#9CA3AF"
                    value={weightLbs}
                    onChangeText={setWeightLbs}
                    keyboardType="decimal-pad"
                    inputAccessoryViewID={DONE_ACCESSORY_ID}
                  />
                  <Text style={styles.inputUnit}>lbs</Text>
                </View>
              ) : (
                <View style={styles.inputRow}>
                  <TextInput
                    style={[styles.input, { width: 110 }]}
                    placeholder="73"
                    placeholderTextColor="#9CA3AF"
                    value={weightKg}
                    onChangeText={setWeightKg}
                    keyboardType="decimal-pad"
                    inputAccessoryViewID={DONE_ACCESSORY_ID}
                  />
                  <Text style={styles.inputUnit}>kg</Text>
                </View>
              )}

              <Text style={[styles.fieldLabel, { marginTop: 24 }]}>Height</Text>
              {units === 'imperial' ? (
                <View style={styles.inputRow}>
                  <TextInput
                    style={[styles.input, { width: 80 }]}
                    placeholder="5"
                    placeholderTextColor="#9CA3AF"
                    value={heightFt}
                    onChangeText={setHeightFt}
                    keyboardType="number-pad"
                    inputAccessoryViewID={DONE_ACCESSORY_ID}
                  />
                  <Text style={styles.inputUnit}>ft</Text>
                  <TextInput
                    style={[styles.input, { width: 80, marginLeft: 12 }]}
                    placeholder="10"
                    placeholderTextColor="#9CA3AF"
                    value={heightIn}
                    onChangeText={setHeightIn}
                    keyboardType="decimal-pad"
                    inputAccessoryViewID={DONE_ACCESSORY_ID}
                  />
                  <Text style={styles.inputUnit}>in</Text>
                </View>
              ) : (
                <View style={styles.inputRow}>
                  <TextInput
                    style={[styles.input, { width: 110 }]}
                    placeholder="178"
                    placeholderTextColor="#9CA3AF"
                    value={heightCm}
                    onChangeText={setHeightCm}
                    keyboardType="decimal-pad"
                    inputAccessoryViewID={DONE_ACCESSORY_ID}
                  />
                  <Text style={styles.inputUnit}>cm</Text>
                </View>
              )}
            </>
          )}

          {step === 'activity' && (
            <>
              <Text style={styles.title}>How active are you?</Text>
              <Text style={styles.subtitle}>Counting everyday movement and exercise.</Text>
              {ACTIVITY_LEVELS.map((a, i) => {
                const active = i === activityIdx;
                return (
                  <TouchableOpacity
                    key={a.label}
                    style={[styles.optRow, active && styles.optRowActive]}
                    onPress={() => setActivityIdx(i)}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.radio, active && { borderColor: '#10B981' }]}>
                      {active && <View style={[styles.radioDot, { backgroundColor: '#10B981' }]} />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.optLabel, active && { color: '#065F46' }]}>{a.label}</Text>
                      <Text style={styles.optDesc}>{a.description}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </>
          )}

          {step === 'pace' && (
            <>
              <Text style={styles.title}>
                {goalType === 'lose' ? 'How fast to lose?' : 'How fast to gain?'}
              </Text>
              <Text style={styles.subtitle}>
                {goalType === 'lose'
                  ? 'A steady deficit is easier to sustain.'
                  : 'A smaller surplus means leaner gains.'}
              </Text>
              {RATE_OPTIONS[goalType].map((rate) => {
                const active = rate === rateLbPerWeek;
                const delta = Math.round(rate * 500);
                const sign = goalType === 'lose' ? '−' : '+';
                const lbLabel = rate === 1 ? '1 lb' : `${rate} lb`;
                return (
                  <TouchableOpacity
                    key={rate}
                    style={[styles.optRow, active && styles.optRowActive]}
                    onPress={() => setRateLbPerWeek(rate)}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.radio, active && { borderColor: '#10B981' }]}>
                      {active && <View style={[styles.radioDot, { backgroundColor: '#10B981' }]} />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.optLabel, active && { color: '#065F46' }]}>
                        {lbLabel} / week
                      </Text>
                      <Text style={styles.optDesc}>
                        {sign}{delta} kcal/day vs. maintenance
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </>
          )}

          {step === 'review' && plan && (
            <>
              <Text style={styles.title}>Your plan</Text>
              <Text style={styles.subtitle}>Based on the Mifflin-St Jeor equation.</Text>

              <View style={[styles.reviewCard, { borderTopColor: GOAL_META[goalType].color }]}>
                <View style={styles.reviewHead}>
                  <View>
                    <Text style={styles.reviewEmoji}>{GOAL_META[goalType].emoji}</Text>
                    <Text style={[styles.reviewGoal, { color: GOAL_META[goalType].color }]}>
                      {GOAL_META[goalType].label}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[styles.reviewCals, { color: GOAL_META[goalType].color }]}>
                      {plan.goals.calories}
                    </Text>
                    <Text style={styles.reviewCalsUnit}>kcal/day</Text>
                  </View>
                </View>

                <Text style={styles.reviewDelta}>{describePlan(plan)}</Text>

                <View style={styles.tdeeRow}>
                  <Text style={styles.tdeeLabel}>Maintenance (TDEE)</Text>
                  <Text style={styles.tdeeValue}>{plan.tdee} kcal</Text>
                </View>

                <View style={styles.macroGrid}>
                  {[
                    { label: 'Protein', g: plan.goals.protein, kcal: plan.goals.protein * 4, color: '#3B82F6' },
                    { label: 'Carbs', g: plan.goals.carbs, kcal: plan.goals.carbs * 4, color: '#F59E0B' },
                    { label: 'Fat', g: plan.goals.fat, kcal: plan.goals.fat * 9, color: '#EF4444' },
                    { label: 'Fiber', g: plan.goals.fiber, kcal: null, color: '#8B5CF6' },
                  ].map((m) => (
                    <View key={m.label} style={styles.macroCell}>
                      <Text style={[styles.macroG, { color: m.color }]}>{m.g}g</Text>
                      <Text style={styles.macroLabel}>{m.label}</Text>
                      {m.kcal != null && (
                        <Text style={styles.macroPct}>
                          {Math.round((m.kcal / plan.goals.calories) * 100)}%
                        </Text>
                      )}
                    </View>
                  ))}
                </View>
              </View>

              <Text style={styles.disclaimer}>
                These are estimates — adjust based on real-world progress. You can
                fine-tune any number on the Goals screen.
              </Text>
            </>
          )}
        </ScrollView>

        {/* Footer nav */}
        <View style={styles.footer}>
          <TouchableOpacity style={styles.backBtn} onPress={handleBack} activeOpacity={0.7}>
            <Text style={styles.backBtnText}>{stepIdx === 0 ? 'Cancel' : 'Back'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.nextBtn, !canAdvance() && styles.nextBtnDisabled]}
            onPress={handleNext}
            activeOpacity={0.85}
            disabled={!canAdvance()}
          >
            <Text style={styles.nextBtnText}>{nextLabel}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <KeyboardDoneAccessory />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  close: { fontSize: 20, color: '#9CA3AF', fontWeight: '600', width: 20 },
  stepCount: { fontSize: 13, fontWeight: '700', color: '#9CA3AF' },
  progressTrack: {
    height: 4,
    backgroundColor: '#F3F4F6',
    marginHorizontal: 20,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: { height: 4, backgroundColor: '#10B981', borderRadius: 2 },
  content: { padding: 24, paddingBottom: 24 },
  title: { fontSize: 26, fontWeight: '800', color: '#111827', marginBottom: 6 },
  subtitle: { fontSize: 15, color: '#6B7280', marginBottom: 24, lineHeight: 21 },
  // Goal cards
  bigCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    padding: 18,
    marginBottom: 14,
    gap: 14,
  },
  bigCardEmoji: { fontSize: 32 },
  bigCardLabel: { fontSize: 18, fontWeight: '800', color: '#111827' },
  bigCardBlurb: { fontSize: 13, color: '#9CA3AF', marginTop: 2 },
  // Radio
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: { width: 12, height: 12, borderRadius: 6 },
  // Fields
  fieldLabel: { fontSize: 14, fontWeight: '700', color: '#374151', marginBottom: 10 },
  segRow: { flexDirection: 'row', gap: 12 },
  segBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
  },
  segBtnActive: { borderColor: '#10B981', backgroundColor: '#ECFDF5' },
  segBtnText: { fontSize: 15, fontWeight: '600', color: '#6B7280' },
  segBtnTextActive: { color: '#10B981' },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  input: {
    height: 52,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    paddingHorizontal: 16,
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    backgroundColor: '#FAFAFA',
  },
  inputUnit: { fontSize: 15, color: '#9CA3AF', fontWeight: '500' },
  toggleRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#fff',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
  },
  toggleBtnActive: { borderColor: '#10B981', backgroundColor: '#ECFDF5' },
  toggleBtnText: { fontSize: 14, fontWeight: '600', color: '#6B7280' },
  toggleBtnTextActive: { color: '#10B981' },
  // Option rows (activity / pace)
  optRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    padding: 16,
    marginBottom: 12,
    gap: 14,
  },
  optRowActive: { borderColor: '#10B981', backgroundColor: '#F0FDF4' },
  optLabel: { fontSize: 16, fontWeight: '700', color: '#374151' },
  optDesc: { fontSize: 13, color: '#9CA3AF', marginTop: 2 },
  // Review
  reviewCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 22,
    borderTopWidth: 4,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
  },
  reviewHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  reviewEmoji: { fontSize: 28, marginBottom: 4 },
  reviewGoal: { fontSize: 20, fontWeight: '800' },
  reviewCals: { fontSize: 40, fontWeight: '800', lineHeight: 44 },
  reviewCalsUnit: { fontSize: 12, color: '#9CA3AF' },
  reviewDelta: { fontSize: 13, color: '#6B7280', marginTop: 10 },
  tdeeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  tdeeLabel: { fontSize: 14, color: '#6B7280' },
  tdeeValue: { fontSize: 14, fontWeight: '700', color: '#111827' },
  macroGrid: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  macroCell: { flex: 1, alignItems: 'center' },
  macroG: { fontSize: 18, fontWeight: '800' },
  macroLabel: { fontSize: 11, color: '#9CA3AF', marginTop: 3 },
  macroPct: { fontSize: 11, color: '#6B7280', fontWeight: '600', marginTop: 1 },
  disclaimer: { fontSize: 12, color: '#9CA3AF', textAlign: 'center', marginTop: 20, lineHeight: 17 },
  // Footer
  footer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  backBtn: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnText: { fontSize: 16, fontWeight: '700', color: '#6B7280' },
  nextBtn: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  nextBtnDisabled: { backgroundColor: '#D1D5DB', shadowOpacity: 0 },
  nextBtnText: { fontSize: 17, fontWeight: '700', color: '#fff' },
});
