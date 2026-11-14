import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from '../store/useStore';
import { useTheme } from '../theme/useTheme';
import type { Theme } from '../theme';
import { radius, space, type } from '../theme/tokens';
import { Icon, type IconName } from '../components/Icon';
import { WizardHeader, WizardFooter } from '../components/WizardChrome';
import { trainingSplit } from '../utils/trainingSplit';
import { designPlan, type EquipmentAccess, type TrainingGoal } from '../services/workoutDesign';
import type { Sex } from '../utils/tdee';

interface Props {
  navigation: any;
}

// 'sex' is dropped when the profile already has one — see `steps` below.
type StepKey = 'goal' | 'sex' | 'days' | 'length' | 'equipment';

/** Male, female, or declined. 'skip' sends nothing rather than guessing. */
type SexChoice = Sex | 'skip';

const GOALS: { key: TrainingGoal; label: string; blurb: string; icon: IconName }[] = [
  { key: 'muscle', label: 'Build muscle', blurb: 'Moderate reps, enough volume per muscle', icon: 'muscle' },
  { key: 'strength', label: 'Get stronger', blurb: 'Low reps on the big lifts, longer rests', icon: 'workout' },
  { key: 'fatloss', label: 'Lose fat', blurb: 'Lifting to keep muscle, plus conditioning', icon: 'trendDown' },
  { key: 'fitness', label: 'General fitness', blurb: 'Balanced across the body', icon: 'heart' },
];

const DAYS: { n: number; blurb: string }[] = [
  { n: 2, blurb: 'Two full-body days' },
  { n: 3, blurb: 'Full body, or push/pull/legs' },
  { n: 4, blurb: 'Upper and lower, twice over' },
  { n: 5, blurb: 'A push/pull/legs rotation' },
];

const LENGTHS: { n: number; blurb: string }[] = [
  { n: 30, blurb: 'In and out' },
  { n: 45, blurb: 'A normal session' },
  { n: 60, blurb: 'Room for more volume' },
];

const EQUIPMENT: { key: EquipmentAccess; label: string; blurb: string }[] = [
  { key: 'gym', label: 'A gym', blurb: 'Barbells, machines, cables' },
  { key: 'home', label: 'Dumbbells', blurb: 'At home, plus bodyweight' },
  { key: 'bodyweight', label: 'Just me', blurb: 'No equipment at all' },
];

const SEXES: { key: SexChoice; label: string; blurb: string }[] = [
  { key: 'male', label: 'Male', blurb: '' },
  { key: 'female', label: 'Female', blurb: '' },
  { key: 'skip', label: 'Rather not say', blurb: 'The program is built without it' },
];

/**
 * One question per screen, the same shape as the Goal Wizard.
 *
 * This was a single sheet with every control stacked on it. Five groups do
 * not fit a phone, so the last of them sat under a fold — which on a screen
 * whose entire job is collecting answers means the answers do not get given.
 * Paging them turns the scroll into a progress bar: nothing is below the
 * fold because there is nothing else on the screen.
 *
 * The sex step is skipped outright when the profile already has one. The app
 * asked for it once, in the Goal Wizard, and asking again on the way to a
 * different feature is the app admitting it does not remember. "Rather not
 * say" is there because a workout generator is a bad place to insist.
 *
 * Experience is still never asked. It is inferred from how much the app has
 * watched them do, which it knows and they would only estimate.
 */
export function DesignProgramScreen({ navigation }: Props) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const profile = useStore((s) => s.profile);
  const history = useStore((s) => s.workoutHistory);

  const [goal, setGoal] = useState<TrainingGoal>('muscle');
  const [days, setDays] = useState(3);
  const [minutes, setMinutes] = useState(45);
  const [equipment, setEquipment] = useState<EquipmentAccess>('gym');
  const [sexChoice, setSexChoice] = useState<SexChoice | undefined>();
  const [busy, setBusy] = useState(false);

  // Asked only when the account cannot answer it.
  const knownSex = profile?.sex;
  const steps: StepKey[] = useMemo(() => {
    const base: StepKey[] = ['goal'];
    if (!knownSex) base.push('sex');
    base.push('days', 'length', 'equipment');
    return base;
  }, [knownSex]);

  const [stepIdx, setStepIdx] = useState(0);
  const step = steps[Math.min(stepIdx, steps.length - 1)];
  const isLast = stepIdx === steps.length - 1;

  // Every step but 'sex' opens with a sensible answer already chosen, so the
  // only thing that can gate Continue is a sex step nobody has answered.
  const canAdvance = step !== 'sex' || sexChoice != null;

  function handleBack() {
    if (busy) return;
    if (stepIdx === 0) {
      navigation.goBack();
      return;
    }
    setStepIdx((i) => Math.max(0, i - 1));
  }

  async function handleNext() {
    if (!canAdvance || busy) return;
    if (!isLast) {
      setStepIdx((i) => Math.min(i + 1, steps.length - 1));
      return;
    }

    setBusy(true);
    try {
      // What they have actually trained, so the program can lean away from
      // it. Absent on a first run, which the function reads as a beginner.
      const split = trainingSplit(history, 30, c);
      const recent = Object.fromEntries(split.map((s) => [s.category, s.share]));

      // Not asked for — the app has watched them and they would only guess.
      const experience =
        history.length === 0 ? 'new' : history.length < 10 ? 'returning' : 'experienced';

      // The profile's answer first; the asked one only where there was none.
      // 'skip' stays undefined and is simply never sent.
      const sex: Sex | undefined =
        knownSex ?? (sexChoice === 'male' || sexChoice === 'female' ? sexChoice : undefined);

      const plan = await designPlan(
        { days, minutes, equipment, goal, sex, experience },
        { profile, recentSplit: recent }
      );
      // replace, not navigate: going back from the review should return to the
      // library, not to a filled-in wizard that would build a second copy.
      navigation.replace('WorkoutPlanReview', { plan });
    } catch (e) {
      Alert.alert(
        'Could not build a program',
        `${(e as Error)?.message ?? e}\n\nYou can try again, or build one yourself.`
      );
    } finally {
      setBusy(false);
    }
  }

  /** One choice row: an icon or a numeral, a label, a blurb, and a radio. */
  function Choice({
    active,
    onPress,
    icon,
    numeral,
    label,
    blurb,
  }: {
    active: boolean;
    onPress: () => void;
    icon?: IconName;
    numeral?: string;
    label: string;
    blurb?: string;
  }) {
    return (
      <TouchableOpacity
        style={[styles.card, active && styles.cardOn]}
        onPress={onPress}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
        accessibilityLabel={blurb ? `${label}. ${blurb}.` : label}
      >
        {icon ? (
          <Icon name={icon} size="lg" color={active ? c.primary : c.textMuted} />
        ) : numeral ? (
          <Text style={[styles.numeral, active && styles.numeralOn]}>{numeral}</Text>
        ) : null}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.cardLabel, active && styles.cardLabelOn]}>{label}</Text>
          {blurb ? <Text style={styles.cardBlurb}>{blurb}</Text> : null}
        </View>
        <View style={[styles.radio, active && styles.radioOn]}>
          {active && <View style={styles.radioDot} />}
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <WizardHeader
        step={stepIdx}
        total={steps.length}
        onClose={() => navigation.goBack()}
        disabled={busy}
      />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {step === 'goal' && (
          <>
            <Text style={styles.title}>What are you training for?</Text>
            <Text style={styles.subtitle}>
              This decides the rep ranges and how the week is put together.
            </Text>
            {GOALS.map((g) => (
              <Choice
                key={g.key}
                active={goal === g.key}
                onPress={() => setGoal(g.key)}
                icon={g.icon}
                label={g.label}
                blurb={g.blurb}
              />
            ))}
          </>
        )}

        {step === 'sex' && (
          <>
            <Text style={styles.title}>A bit about you</Text>
            <Text style={styles.subtitle}>
              Used only to pick starting variations where average strength
              differs — never to decide which muscles you want to train.
            </Text>
            {SEXES.map((s) => (
              <Choice
                key={s.key}
                active={sexChoice === s.key}
                onPress={() => setSexChoice(s.key)}
                label={s.label}
                blurb={s.blurb || undefined}
              />
            ))}
          </>
        )}

        {step === 'days' && (
          <>
            <Text style={styles.title}>How many days a week?</Text>
            <Text style={styles.subtitle}>Pick what you'll actually keep to.</Text>
            {DAYS.map((d) => (
              <Choice
                key={d.n}
                active={days === d.n}
                onPress={() => setDays(d.n)}
                numeral={String(d.n)}
                label={`${d.n} days`}
                blurb={d.blurb}
              />
            ))}
          </>
        )}

        {step === 'length' && (
          <>
            <Text style={styles.title}>How long a session?</Text>
            <Text style={styles.subtitle}>Including the rest between sets.</Text>
            {LENGTHS.map((l) => (
              <Choice
                key={l.n}
                active={minutes === l.n}
                onPress={() => setMinutes(l.n)}
                numeral={String(l.n)}
                label={`${l.n} minutes`}
                blurb={l.blurb}
              />
            ))}
          </>
        )}

        {step === 'equipment' && (
          <>
            <Text style={styles.title}>What do you have?</Text>
            <Text style={styles.subtitle}>
              Only exercises you can actually do will be used.
            </Text>
            {EQUIPMENT.map((e) => (
              <Choice
                key={e.key}
                active={equipment === e.key}
                onPress={() => setEquipment(e.key)}
                label={e.label}
                blurb={e.blurb}
              />
            ))}
            {/* Said before they commit, not after. */}
            <Text style={styles.disclaimer}>
              Written by AI from the exercises in this app. Read it before you
              follow it, and change anything that doesn't suit you.
            </Text>
          </>
        )}
      </ScrollView>

      <WizardFooter
        backLabel={stepIdx === 0 ? 'Cancel' : 'Back'}
        nextLabel={isLast ? 'Build it' : 'Continue'}
        onBack={handleBack}
        onNext={handleNext}
        nextDisabled={!canAdvance}
        busy={busy}
      />
    </SafeAreaView>
  );
}

const makeStyles = (c: Theme) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.card },

    // Tighter than the Goal Wizard's equivalents by 8pt each. The four cards
    // on the goal step overflowed a 375x667 screen by 13px, which clips the
    // last option — and an option you cannot see is one nobody picks. Nothing
    // here scrolls on any phone now.
    content: { padding: space.xl, paddingBottom: space.md },
    title: { ...type.title(c), color: c.text, marginBottom: space.xs },
    subtitle: { ...type.body(c), color: c.textMuted, marginBottom: space.lg },

    card: {
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
    cardOn: { borderColor: c.primary, backgroundColor: c.cardMuted },
    cardLabel: { ...type.subhead(c), color: c.text },
    cardLabelOn: { color: c.primary },
    cardBlurb: { ...type.caption(c), color: c.textFaint, marginTop: space.xxs },
    // Stands in for the icon where the answer *is* the number. Fixed width so
    // the labels beside them line up down the list.
    numeral: {
      ...type.heading(c),
      color: c.textMuted,
      width: 24,
      textAlign: 'center',
      fontVariant: ['tabular-nums'],
    },
    numeralOn: { color: c.primary },

    radio: {
      width: 24,
      height: 24,
      borderRadius: radius.pill,
      borderWidth: 2,
      borderColor: c.borderStrong,
      alignItems: 'center',
      justifyContent: 'center',
    },
    radioOn: { borderColor: c.primary },
    radioDot: { width: 12, height: 12, borderRadius: radius.pill, backgroundColor: c.primary },

    disclaimer: {
      ...type.micro(c),
      color: c.textFaint,
      textAlign: 'center',
      marginTop: space.md,
    },

  });
