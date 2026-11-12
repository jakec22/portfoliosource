import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from '../store/useStore';
import { recoveryType } from '../utils/workoutTypes';
import { progressHighlights } from '../utils/exerciseHistory';
import { consistencyStats, trainingCalendar, trainingSplit } from '../utils/trainingSplit';
import { recoverySummaries } from '../utils/recovery';
import { RecoveryTrend } from '../components/RecoveryTrend';
import { ConsistencyRing } from '../components/ConsistencyRing';
import { ProgressExplorer } from '../components/ProgressExplorer';
import { TrainingCalendar } from '../components/TrainingCalendar';
import { BodyHeatMap } from '../components/BodyHeatMap';
import { useTheme } from '../theme/useTheme';
import type { Theme } from '../theme';
import { radius, space, type } from '../theme/tokens';
import { Icon } from '../components/Icon';
import { StartSessionSheet, type StartChoice } from '../components/StartSessionSheet';
import { useTemplateActions } from '../hooks/useTemplateActions';

interface Props {
  navigation: any;
}

// Window the training-split figure summarizes.
const SPLIT_DAYS = 30;
// Weeks shown in the consistency grid.
const CALENDAR_WEEKS = 12;
// Weeks of heat/cold behind the current one. Eight rather than the grid's
// twelve: these bars are a quarter of the width, and a week of sauna is a
// habit that changes over a month or two rather than over a season.
const RECOVERY_WEEKS = 8;

export function ExerciseScreen({ navigation }: Props) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const templates = useStore((s) => s.workoutTemplates);
  const { startTemplate } = useTemplateActions(navigation);
  const activeWorkout = useStore((s) => s.activeWorkout);
  const activeRecovery = useStore((s) => s.activeRecovery);
  const history = useStore((s) => s.workoutHistory);
  const startWorkout = useStore((s) => s.startWorkout);

  // One merged progress list — PR'd lifts first, then biggest improvers.
  // Full browsing lives under Key Insights.
  const highlights = useMemo(() => progressHighlights(history), [history]);

  // Visual training summary: how consistent the last week was, and what the
  // volume was actually spent on.
  const weeklyWorkoutGoal = useStore((s) => s.weeklyWorkoutGoal);
  const recoveryGoals = useStore((s) => s.recoveryGoals);
  const consistency = useMemo(() => consistencyStats(history), [history]);
  const split = useMemo(() => trainingSplit(history, SPLIT_DAYS, c), [history, c]);
  const calendar = useMemo(() => trainingCalendar(history, CALENDAR_WEEKS), [history]);
  const hasTrained = consistency.totalSessions > 0;

  // Heat and cold, counted in minutes against the weeks behind them. Only
  // the kinds that have actually been logged: a plunge card on the screen of
  // someone who has only ever used the sauna is an advert, not a summary.
  const recovery = useMemo(
    () => recoverySummaries(history, RECOVERY_WEEKS),
    [history]
  );

  // Ask what's starting, then go. Strength opens the set-logging screen; a
  // sauna or plunge opens a timer and nothing else, which is the whole of
  // what they record. The workout type is what Apple Health categorizes the
  // session as; it's stored on Android too, so a workout logged there keeps
  // its type if the account is later opened on an iPhone.
  const [startSheet, setStartSheet] = useState(false);

  function handleChoose(choice: StartChoice) {
    if (choice.kind === 'recovery') {
      navigation.navigate('RecoveryTimer', { kind: choice.recovery });
      return;
    }
    if (choice.kind === 'library') {
      navigation.navigate('WorkoutLibrary');
      return;
    }
    if (choice.kind === 'template') {
      const t = templates.find((x) => x.id === choice.templateId);
      if (t) startTemplate(t);
      return;
    }
    startWorkout(undefined, choice.hk);
    navigation.navigate('ActiveWorkout');
  }

  function handleStartEmpty() {
    if (activeWorkout) {
      navigation.navigate('ActiveWorkout');
      return;
    }
    // A sauna already holds the watch's session; take the user back to it
    // rather than opening a sheet whose every option would be refused.
    if (activeRecovery) {
      navigation.navigate('RecoveryTimer', { kind: activeRecovery.kind });
      return;
    }
    setStartSheet(true);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <StatusBar
        barStyle={c.scheme === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor={c.bg}
      />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Text style={styles.screenTitle}>Exercise</Text>

        {/* Resume banner */}
        {activeWorkout && (
          <TouchableOpacity
            style={styles.resumeBanner}
            onPress={() => navigation.navigate('ActiveWorkout')}
            activeOpacity={0.85}
          >
            <View>
              <Text style={styles.resumeTitle}>Workout in progress</Text>
              <Text style={styles.resumeSub}>{activeWorkout.name} · tap to resume</Text>
            </View>
            <Icon name="forward" size="md" color={c.primary} />
          </TouchableOpacity>
        )}

        {/* A sauna outlives this screen — it runs on the watch with the phone
            in a locker — so it needs a way back in, same as a workout. */}
        {activeRecovery && (
          <TouchableOpacity
            style={styles.resumeBanner}
            onPress={() =>
              navigation.navigate('RecoveryTimer', { kind: activeRecovery.kind })
            }
            activeOpacity={0.85}
          >
            <View>
              <Text style={styles.resumeTitle}>
                {recoveryType(activeRecovery.kind).label} in progress
              </Text>
              <Text style={styles.resumeSub}>Tap to see the timer</Text>
            </View>
            <Icon name="forward" size="md" color={c.primary} />
          </TouchableOpacity>
        )}

        {/* Start a Workout */}
        <TouchableOpacity style={styles.startBtn} onPress={handleStartEmpty} activeOpacity={0.85}>
          <Icon name="workout" size="lg" color={c.onPrimary} />
          <View>
            <Text style={styles.startBtnTitle}>
              {activeWorkout ? 'Resume Workout' : 'Start a Workout'}
            </Text>
            <Text style={styles.startBtnSub}>
              {activeWorkout
                ? 'Continue where you left off'
                : 'Your saved workouts, an empty session, or a timer'}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Training summary — consistency ring and where the volume went.
            Full browsing lives in Key Insights. */}
        {hasTrained && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Training</Text>
              <TouchableOpacity onPress={() => navigation.navigate('KeyInsights')}>
                <View style={styles.seeAllRow}>
              <Text style={styles.seeAll}>See all</Text>
              <Icon name="forward" size="xs" color={c.primary} />
            </View>
              </TouchableOpacity>
            </View>

            <View style={styles.chartCard}>
              <ConsistencyRing stats={consistency} target={weeklyWorkoutGoal} />
            </View>

            {split.length > 0 && (
              <View style={styles.chartCard}>
                <Text style={styles.chartTitle}>Training Split</Text>
                <BodyHeatMap slices={split} days={SPLIT_DAYS} />
              </View>
            )}
          </>
        )}

        {/* Recovery, in its own section rather than folded into Training.
            It is excluded from every figure above on purpose — a week of
            saunas must not read as a week of training — and a thing held
            out of the count needs somewhere it *is* counted, or logging it
            goes nowhere. Sits directly under Training because both answer
            for the same week. */}
        {recovery.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recovery</Text>
            </View>
            {recovery.map((r) => (
              <RecoveryTrend
                key={r.kind}
                summary={r}
                goalMinutes={recoveryGoals[r.kind] ?? 0}
              />
            ))}
          </>
        )}

        {/* Progress — one chart, switched between the lifts worth watching. */}
        {highlights.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Progress</Text>
            </View>
            <View style={styles.chartCard}>
              <ProgressExplorer
                highlights={highlights}
                onOpen={(name) => navigation.navigate('ExerciseProgress', { name })}
              />
            </View>
          </>
        )}

        {/* Rhythm — when the training actually happened. Browsing individual
            sessions lives on the History tab, which does it properly, so this
            slot shows the pattern instead of repeating that list. */}
        {hasTrained && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Consistency</Text>
            </View>
            <View style={styles.chartCard}>
              <TrainingCalendar calendar={calendar} />
            </View>
          </>
        )}
      </ScrollView>

      <StartSessionSheet
        visible={startSheet}
        onClose={() => setStartSheet(false)}
        onChoose={handleChoose}
      />
    </SafeAreaView>
  );
}

const makeStyles = (c: Theme) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg },
  scroll: { flex: 1 },
  content: { padding: space.lg, paddingBottom: space.xxl },
  screenTitle: { ...type.hero(c), color: c.text, marginBottom: space.lg },

  resumeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: c.primarySoft,
    borderWidth: 1,
    borderColor: `${c.primary}66`,
    borderRadius: radius.card,
    padding: space.lg,
    marginBottom: space.lg,
  },
  resumeTitle: { ...type.bodyStrong(c), color: c.primaryDark },
  resumeSub: { ...type.caption(c), color: c.textMuted, marginTop: space.xxs },

  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: c.primary,
    borderRadius: radius.card,
    padding: space.lg,
    marginBottom: space.xl,
    shadowColor: c.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  startBtnTitle: { ...type.subhead(c), fontFamily: c.fontBodyBold, color: c.onPrimary },
  startBtnSub: { ...type.caption(c), fontFamily: c.fontBody, color: `${c.onPrimary}CC`, marginTop: space.xxs, maxWidth: 240 },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: space.sm,
    marginTop: space.xs,
  },
  sectionTitle: { ...type.heading(c), color: c.text },
  seeAllRow: { flexDirection: 'row', alignItems: 'center', gap: space.xxs },
  seeAll: { ...type.bodyStrong(c), color: c.primary },
  chartCard: {
    backgroundColor: c.card,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: c.border,
    padding: space.lg,
    marginBottom: space.md,
  },
  chartTitle: { ...type.bodyStrong(c), color: c.text, marginBottom: space.md },




});
