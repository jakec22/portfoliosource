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
import { useTheme } from '../theme/useTheme';
import type { Theme } from '../theme';
import { radius, space, type } from '../theme/tokens';
import { Icon } from '../components/Icon';

interface Props {
  navigation: any;
}

// The wizard steps in order. The "pace" step is dropped when the goal is
// "maintain" (there's no deficit/surplus to choose).
type StepKey = 'goal' | 'basics' | 'body' | 'activity' | 'training' | 'pace' | 'review';

// Training frequency the consistency ring fills toward. Stops at 6 because a
// seventh is a target nobody should be encouraged to set in a wizard; the
// store accepts up to 14 for anyone who means it.
const WEEKLY_WORKOUT_OPTIONS = [
  { n: 2, description: 'Keeping a habit going' },
  { n: 3, description: 'A full-body split, or easing in' },
  { n: 4, description: 'Upper/lower twice over' },
  { n: 5, description: 'A push/pull/legs rotation' },
  { n: 6, description: 'Training most days' },
] as const;

// Lose/Maintain/Gain accent — mirrors the app's own down/steady/up semantics
// (info/primary/warning) rather than a fixed palette, so it follows theme.
function goalColor(c: Theme, type: GoalType): string {
  if (type === 'lose') return c.info;
  if (type === 'gain') return c.warning;
  return c.primary;
}

export function GoalWizardScreen({ navigation }: Props) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const profile = useStore((s) => s.profile);
  const bodyWeightLog = useStore((s) => s.bodyWeightLog);
  const bodyWeightLbs = useStore((s) => s.bodyWeightLbs);
  const setProfile = useStore((s) => s.setProfile);
  const storedWeeklyWorkoutGoal = useStore((s) => s.weeklyWorkoutGoal);
  const setWeeklyWorkoutGoal = useStore((s) => s.setWeeklyWorkoutGoal);
  // Seeded from the stored value so re-running the wizard shows what you
  // already chose rather than resetting you to the default.
  const [weeklyWorkouts, setWeeklyWorkouts] = useState(storedWeeklyWorkoutGoal);
  const applyGoalPlan = useStore((s) => s.applyGoalPlan);
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
    // 'training' sits after 'activity' because both are about movement, but
    // it is deliberately its own screen: activity feeds TDEE, this does not,
    // and sharing a screen would imply otherwise.
    const base: StepKey[] = ['goal', 'basics', 'body', 'activity', 'training'];
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
      case 'training':
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

    // Records the weight these targets were built on, so later weigh-ins
    // can tell how far the user has drifted from them.
    applyGoalPlan(plan.goals, wLbs);

    // Deliberately not part of plan.goals: this is a commitment, not an
    // input to the Mifflin-St Jeor maths above. Training more than planned
    // does not raise the calorie target, and the wizard should not imply it
    // does by bundling the two.
    setWeeklyWorkoutGoal(weeklyWorkouts);

    Alert.alert(
      'Goals set',
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
          <Icon name="close" size="md" color={c.textFaint} />
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
                const gc = goalColor(c, g);
                const active = goalType === g;
                return (
                  <TouchableOpacity
                    key={g}
                    style={[styles.bigCard, active && { borderColor: gc, backgroundColor: c.cardMuted }]}
                    onPress={() => handleSelectGoal(g)}
                    activeOpacity={0.8}
                  >
                    <Icon name={m.icon} size="lg" color={active ? gc : c.textMuted} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.bigCardLabel, active && { color: gc }]}>{m.label}</Text>
                      <Text style={styles.bigCardBlurb}>{m.blurb}</Text>
                    </View>
                    <View style={[styles.radio, active && { borderColor: gc }]}>
                      {active && <View style={[styles.radioDot, { backgroundColor: gc }]} />}
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
                      {s === 'male' ? 'Male' : 'Female'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.fieldLabel, { marginTop: space.xl }]}>Age</Text>
              <View style={styles.inputRow}>
                <TextInput
                  style={[styles.input, { width: 110 }]}
                  placeholder="30"
                  placeholderTextColor={c.textFaint}
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

              <Text style={[styles.fieldLabel, { marginTop: space.sm }]}>Weight</Text>
              {units === 'imperial' ? (
                <View style={styles.inputRow}>
                  <TextInput
                    style={[styles.input, { width: 110 }]}
                    placeholder="160"
                    placeholderTextColor={c.textFaint}
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
                    placeholderTextColor={c.textFaint}
                    value={weightKg}
                    onChangeText={setWeightKg}
                    keyboardType="decimal-pad"
                    inputAccessoryViewID={DONE_ACCESSORY_ID}
                  />
                  <Text style={styles.inputUnit}>kg</Text>
                </View>
              )}

              <Text style={[styles.fieldLabel, { marginTop: space.xl }]}>Height</Text>
              {units === 'imperial' ? (
                <View style={styles.inputRow}>
                  <TextInput
                    style={[styles.input, { width: 80 }]}
                    placeholder="5"
                    placeholderTextColor={c.textFaint}
                    value={heightFt}
                    onChangeText={setHeightFt}
                    keyboardType="number-pad"
                    inputAccessoryViewID={DONE_ACCESSORY_ID}
                  />
                  <Text style={styles.inputUnit}>ft</Text>
                  <TextInput
                    style={[styles.input, { width: 80, marginLeft: space.md }]}
                    placeholder="10"
                    placeholderTextColor={c.textFaint}
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
                    placeholderTextColor={c.textFaint}
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
                    <View style={[styles.radio, active && { borderColor: c.primary }]}>
                      {active && <View style={[styles.radioDot, { backgroundColor: c.primary }]} />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.optLabel, active && { color: c.primaryDark }]}>{a.label}</Text>
                      <Text style={styles.optDesc}>{a.description}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </>
          )}

          {step === 'training' && (
            <>
              <Text style={styles.title}>How often will you train?</Text>
              <Text style={styles.subtitle}>
                Sessions a week to aim for. This sets the ring on your home
                screen — it doesn't change your calories.
              </Text>
              {WEEKLY_WORKOUT_OPTIONS.map((o) => {
                const active = o.n === weeklyWorkouts;
                return (
                  <TouchableOpacity
                    key={o.n}
                    style={[styles.optRow, active && styles.optRowActive]}
                    onPress={() => setWeeklyWorkouts(o.n)}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.radio, active && { borderColor: c.primary }]}>
                      {active && <View style={[styles.radioDot, { backgroundColor: c.primary }]} />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.optLabel, active && { color: c.primaryDark }]}>
                        {o.n} days a week
                      </Text>
                      <Text style={styles.optDesc}>{o.description}</Text>
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
                    <View style={[styles.radio, active && { borderColor: c.primary }]}>
                      {active && <View style={[styles.radioDot, { backgroundColor: c.primary }]} />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.optLabel, active && { color: c.primaryDark }]}>
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

              <View style={[styles.reviewCard, { borderTopColor: goalColor(c, goalType) }]}>
                <View style={styles.reviewHead}>
                  <View>
                    <Icon
                      name={GOAL_META[goalType].icon}
                      size="lg"
                      color={goalColor(c, goalType)}
                      style={styles.reviewIcon}
                    />
                    <Text style={[styles.reviewGoal, { color: goalColor(c, goalType) }]}>
                      {GOAL_META[goalType].label}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[styles.reviewCals, { color: goalColor(c, goalType) }]}>
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
                    { label: 'Protein', g: plan.goals.protein, kcal: plan.goals.protein * 4, color: c.macroProtein },
                    { label: 'Carbs', g: plan.goals.carbs, kcal: plan.goals.carbs * 4, color: c.macroCarbs },
                    { label: 'Fat', g: plan.goals.fat, kcal: plan.goals.fat * 9, color: c.macroFat },
                    { label: 'Fiber', g: plan.goals.fiber, kcal: null, color: c.macroFiber },
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

const makeStyles = (c: Theme) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.card },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.xl,
    paddingTop: space.sm,
    paddingBottom: space.md,
  },
  close: { ...type.heading(c), color: c.textFaint, width: 20 },
  stepCount: { ...type.captionStrong(c), color: c.textFaint },
  progressTrack: {
    height: 4,
    backgroundColor: c.cardMuted,
    marginHorizontal: space.lg,
    borderRadius: radius.hairline,
    overflow: 'hidden',
  },
  progressFill: { height: 4, backgroundColor: c.primary, borderRadius: radius.hairline },
  content: { padding: space.xl, paddingBottom: space.xl },
  title: { ...type.title(c), color: c.text, marginBottom: space.xs },
  subtitle: { ...type.body(c), color: c.textMuted, marginBottom: space.xl },
  // Goal cards
  bigCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.card,
    borderRadius: radius.card,
    borderWidth: 2,
    borderColor: c.border,
    padding: space.lg,
    marginBottom: space.md,
    gap: space.md,
  },

  bigCardLabel: { ...type.subhead(c), color: c.text },
  bigCardBlurb: { ...type.caption(c), color: c.textFaint, marginTop: space.xxs },
  // Radio
  radio: {
    width: 24,
    height: 24,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: c.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: { width: 12, height: 12, borderRadius: radius.pill },
  // Fields
  fieldLabel: { ...type.bodyStrong(c), color: c.gray700, marginBottom: space.sm },
  segRow: { flexDirection: 'row', gap: space.md },
  segBtn: {
    flex: 1,
    paddingVertical: space.lg,
    borderRadius: radius.control,
    backgroundColor: c.cardMuted,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: c.border,
  },
  segBtnActive: { borderColor: c.primary, backgroundColor: c.primarySoft },
  segBtnText: { ...type.body(c), fontFamily: c.fontBodySemi, color: c.textMuted },
  segBtnTextActive: { color: c.primary },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  input: {
    ...type.heading(c),
    height: 52,
    borderWidth: 1.5,
    borderColor: c.border,
    borderRadius: radius.control,
    paddingHorizontal: space.lg,
    color: c.text,
    backgroundColor: c.input,
  },
  inputUnit: { ...type.body(c), color: c.textFaint },
  toggleRow: { flexDirection: 'row', gap: space.sm, marginBottom: space.lg },
  toggleBtn: {
    flex: 1,
    paddingVertical: space.md,
    borderRadius: radius.control,
    backgroundColor: c.card,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: c.border,
  },
  toggleBtnActive: { borderColor: c.primary, backgroundColor: c.primarySoft },
  toggleBtnText: { ...type.body(c), fontFamily: c.fontBodySemi, color: c.textMuted },
  toggleBtnTextActive: { color: c.primary },
  // Option rows (activity / pace)
  optRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.card,
    borderRadius: radius.card,
    borderWidth: 2,
    borderColor: c.border,
    padding: space.lg,
    marginBottom: space.md,
    gap: space.md,
  },
  optRowActive: { borderColor: c.primary, backgroundColor: c.primarySoft },
  optLabel: { ...type.bodyStrong(c), color: c.gray700 },
  optDesc: { ...type.caption(c), color: c.textFaint, marginTop: space.xxs },
  // Review
  reviewCard: {
    backgroundColor: c.card,
    borderRadius: radius.card,
    padding: space.xl,
    borderTopWidth: 4,
    borderWidth: 1,
    borderColor: c.border,
    shadowColor: c.shadow,
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
  reviewIcon: { marginBottom: space.xs },
  reviewGoal: { ...type.heading(c) },
  reviewCals: { ...type.hero(c) },
  reviewCalsUnit: { ...type.caption(c), color: c.textFaint },
  reviewDelta: { ...type.caption(c), color: c.textMuted, marginTop: space.sm },
  tdeeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: space.lg,
    paddingTop: space.lg,
    borderTopWidth: 1,
    borderTopColor: c.border,
  },
  tdeeLabel: { ...type.body(c), color: c.textMuted },
  tdeeValue: { ...type.bodyStrong(c), color: c.text },
  macroGrid: {
    flexDirection: 'row',
    gap: space.sm,
    marginTop: space.lg,
    paddingTop: space.xl,
    borderTopWidth: 1,
    borderTopColor: c.border,
  },
  macroCell: { flex: 1, alignItems: 'center' },
  macroG: { ...type.subhead(c) },
  macroLabel: { ...type.micro(c), color: c.textFaint, marginTop: space.xxs },
  macroPct: { ...type.micro(c), fontFamily: c.fontBodySemi, color: c.textMuted, marginTop: 1 },
  disclaimer: { ...type.caption(c), color: c.textFaint, textAlign: 'center', marginTop: space.lg },
  // Footer
  footer: {
    flexDirection: 'row',
    gap: space.md,
    paddingHorizontal: space.xl,
    paddingTop: space.md,
    paddingBottom: space.sm,
    borderTopWidth: 1,
    borderTopColor: c.border,
  },
  backBtn: {
    paddingVertical: space.lg,
    paddingHorizontal: space.xl,
    borderRadius: radius.control,
    backgroundColor: c.cardMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnText: { ...type.bodyStrong(c), color: c.textMuted },
  nextBtn: {
    flex: 1,
    paddingVertical: space.lg,
    borderRadius: radius.control,
    backgroundColor: c.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: c.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  nextBtnDisabled: { backgroundColor: c.borderStrong, shadowOpacity: 0 },
  nextBtnText: { ...type.subhead(c), color: c.onPrimary },
});
