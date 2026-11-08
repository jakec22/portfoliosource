import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore, sumMacros, DEFAULT_GOALS } from '../store/useStore';
import { useToday } from '../hooks/useToday';
import { useSnackbar } from '../store/useSnackbar';
import { getPastDays, formatDuration, parseDate } from '../utils/date';
import { CalorieSummary } from '../components/CalorieSummary';
import { MacroBar } from '../components/MacroBar';
import { GoalsUpdatedCard } from '../components/GoalsUpdatedCard';
import { WorkoutHistoryItem } from '../components/WorkoutHistoryItem';
import { computeStreak } from '../utils/streak';
import { sessionVolume } from '../utils/analytics';
import { heartRateStats } from '../services/heartRate';
import {
  activeEnergyAvailable,
  requestActiveEnergyPermission,
  queryActiveEnergy,
} from '../services/activeEnergy';
import { useTheme } from '../theme/useTheme';
import type { Theme } from '../theme';
import { radius, space, tabular, type } from '../theme/tokens';
import { Icon } from '../components/Icon';
import { ConsistencyRing } from '../components/ConsistencyRing';
import { SetUpGoalsCard } from '../components/SetUpGoalsCard';
import { BodyHeatMap, BODY_CATEGORIES } from '../components/BodyHeatMap';
import { consistencyStats, trainingSplit } from '../utils/trainingSplit';

interface Props {
  navigation: any;
}

const WEEK = 7;

// Today, across both halves of the app.
//
// This screen used to be the food log with a summary on top, which made it the
// nutrition tab under another name — the only training fact on it was one line
// buried at the bottom of a card that otherwise repeated the card above it.
// The log moved to its own tab; what is left answers three questions without
// scrolling: how much is left to eat, did I train, and is the streak alive.
//
// Home reads, Food logs. Water is the one exception, because it is the only
// log in the app that finishes in a single tap with nothing to type.
export function HomeScreen({ navigation }: Props) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const today = useToday();

  const goals = useStore((s) => s.goals);
  const allLogs = useStore((s) => s.logs);
  const todayEntries = useStore((s) => s.logs[today]);
  const workoutHistory = useStore((s) => s.workoutHistory);
  const deleteWorkout = useStore((s) => s.deleteWorkout);
  const restoreWorkout = useStore((s) => s.restoreWorkout);
  const showSnackbar = useSnackbar((s) => s.show);
  const waterIntake = useStore((s) => s.waterIntake);
  const setWater = useStore((s) => s.setWater);
  const waterGoal = useStore((s) => s.waterGoal);
  const waterIncrement = useStore((s) => s.waterIncrement);
  const showWaterTracker = useStore((s) => s.showWaterTracker);
  const goalsUpdateNotice = useStore((s) => s.goalsUpdateNotice);
  const dismissGoalsUpdateNotice = useStore((s) => s.dismissGoalsUpdateNotice);
  const setGoalsAutoUpdate = useStore((s) => s.setGoalsAutoUpdate);

  const totals = useMemo(() => sumMacros(todayEntries ?? []), [todayEntries]);
  const water = waterIntake[today] ?? 0;

  const { current: currentStreak, best: bestStreak } = useMemo(
    () => computeStreak(allLogs),
    [allLogs]
  );

  const dayWorkouts = useMemo(
    () => workoutHistory.filter((w) => w.date === today),
    [workoutHistory, today]
  );
  const dayWorkoutStats = useMemo(() => {
    if (dayWorkouts.length === 0) return null;
    const totalDurationMs = dayWorkouts.reduce(
      (n, w) => n + Math.max(0, (w.completedAt ?? w.startedAt) - w.startedAt),
      0
    );
    const totalVolume = dayWorkouts.reduce((n, w) => n + sessionVolume(w), 0);
    const totalSets = dayWorkouts.reduce(
      (n, w) => n + w.exercises.reduce((en, e) => en + e.sets.length, 0),
      0
    );
    const doneSets = dayWorkouts.reduce(
      (n, w) => n + w.exercises.reduce((en, e) => en + e.sets.filter((s) => s.completed).length, 0),
      0
    );
    const hr = heartRateStats(dayWorkouts.flatMap((w) => w.heartRateSamples ?? []));
    return { totalDurationMs, totalVolume, totalSets, doneSets, hr };
  }, [dayWorkouts]);

  // Active Energy from HealthKit — enriched by a watch when one is worn, and
  // null (hidden) with no native module, no permission or no data, so it never
  // shows a misleading zero.
  // This week against a weekly target. Same numbers the Exercise tab leads
  // with — the component was written to be that tab's answer to Home's
  // calorie ring, and Home never had the training equivalent.
  const weeklyWorkoutGoal = useStore((s) => s.weeklyWorkoutGoal);
  const profile = useStore((s) => s.profile);
  const goalsPromptDismissed = useStore((s) => s.goalsPromptDismissed);
  const dismissGoalsPrompt = useStore((s) => s.dismissGoalsPrompt);

  // Only when the user has genuinely never set a target: no wizard profile,
  // and every goal still exactly the shipped default. Hand-typing goals in
  // the Calculator leaves no profile behind, so testing `profile` alone would
  // tell someone their own numbers are not theirs.
  const goalsAreUntouched =
    !profile &&
    !goalsPromptDismissed &&
    (Object.keys(DEFAULT_GOALS) as (keyof typeof DEFAULT_GOALS)[]).every(
      (k) => goals[k] === DEFAULT_GOALS[k]
    );
  const consistency = useMemo(() => consistencyStats(workoutHistory), [workoutHistory]);

  // Seven days, not the Exercise tab's thirty: Home is asking what this week
  // looks like, and a month-long window smooths over exactly the gap a rest
  // day wants to know about.
  const weekSplit = useMemo(() => trainingSplit(workoutHistory, 7, c), [workoutHistory, c]);

  // Regions with no volume this week. Drives the rest-day prompt, so that a
  // day off suggests something instead of only reporting that nothing has
  // happened.
  const untrainedThisWeek = useMemo(() => {
    const trained = new Set(weekSplit.filter((s) => s.volume > 0).map((s) => s.category));
    return BODY_CATEGORIES.filter((cat) => !trained.has(cat));
  }, [weekSplit]);

  const [activeEnergy, setActiveEnergy] = useState<number | null>(null);
  const [hkAvailable] = useState(() => activeEnergyAvailable());
  useEffect(() => {
    if (!hkAvailable) return;
    requestActiveEnergyPermission();
  }, [hkAvailable]);
  useEffect(() => {
    if (!hkAvailable) return;
    let cancelled = false;
    queryActiveEnergy(today).then((kcal) => {
      if (!cancelled) setActiveEnergy(kcal);
    });
    return () => {
      cancelled = true;
    };
  }, [hkAvailable, today]);

  // The week as adherence, not as a chart: one column per day, filled to how
  // close that day landed. Reading the shape is the point — detail is a tap away.
  const week = useMemo(() => {
    const workoutDates = new Set(workoutHistory.map((w) => w.date));
    return getPastDays(WEEK)
      .reverse()
      .map((date) => {
        const t = sumMacros(allLogs[date] ?? []);
        return {
          date,
          pct: goals.calories > 0 ? Math.min(t.calories / goals.calories, 1) : 0,
          logged: (allLogs[date]?.length ?? 0) > 0,
          trained: workoutDates.has(date),
          isToday: date === today,
          initial: parseDate(date).toLocaleDateString('en-US', { weekday: 'narrow' }),
        };
      });
  }, [allLogs, workoutHistory, goals.calories, today]);

  const OZ_PER_BUBBLE = waterIncrement;
  const numBubbles = Math.max(4, Math.round(waterGoal / OZ_PER_BUBBLE));
  const filledBubbles = Math.round(water / OZ_PER_BUBBLE);
  const waterPct = Math.min(Math.round((water / waterGoal) * 100), 100);

  function handleBubblePress(index: number) {
    // Tapping the topmost filled bubble un-fills it (undo an accidental tap);
    // any other bubble fills or empties up to that point.
    if (index + 1 === filledBubbles) setWater(today, index * OZ_PER_BUBBLE);
    else setWater(today, (index + 1) * OZ_PER_BUBBLE);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <StatusBar
        barStyle={c.scheme === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor={c.bg}
      />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.titleRow}>
          <Text style={styles.pageTitle}>Today</Text>
          {currentStreak > 0 && (
            <View style={styles.streakBadge}>
              <Icon name="streak" size="xs" color={c.warning} />
              <Text style={styles.streakBadgeText}>
                {currentStreak} day{currentStreak !== 1 ? 's' : ''}
              </Text>
            </View>
          )}
        </View>
        <Text style={styles.pageDate}>
          {parseDate(today).toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
          })}
        </Text>

        {goalsAreUntouched && (
          <SetUpGoalsCard
            onStart={() => navigation.navigate('GoalWizard')}
            onDismiss={dismissGoalsPrompt}
          />
        )}

        {goalsUpdateNotice && (
          <GoalsUpdatedCard
            notice={goalsUpdateNotice}
            onDismiss={dismissGoalsUpdateNotice}
            onTurnOff={() => {
              setGoalsAutoUpdate(false);
              dismissGoalsUpdateNotice();
            }}
          />
        )}

        {/* Calories and macros are one question, so they are one card. */}
        <View style={[styles.card, styles.todayCard]}>
          <CalorieSummary consumed={totals.calories} goal={goals.calories} />
          <View style={styles.todayDivider} />
          <View style={styles.macroList}>
            <MacroBar current={totals.protein} goal={goals.protein} label="Protein" color={c.macroProtein} />
            <MacroBar current={totals.carbs} goal={goals.carbs} label="Carbs" color={c.macroCarbs} />
            <MacroBar current={totals.fat} goal={goals.fat} label="Fat" color={c.macroFat} />
            <MacroBar current={totals.fiber ?? 0} goal={goals.fiber} label="Fiber" color={c.macroFiber} />
          </View>
        </View>

        {/* Training. Used to be one line at the bottom of the screen, under the
            entire food log, which is why this never read as a training app. */}
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Icon name="workout" size="sm" color={c.gray700} />
            <Text style={styles.cardTitleInline}>Training</Text>
          </View>

          {/* The card's anchor, and the reason it no longer reads as empty on
              the days you don't train — which is most of them. A single day's
              training is often nothing; a week's is always something.

              Hidden until there is a first session, matching the Exercise
              tab: "0 of 4" and "0 sessions all-time" is a discouraging thing
              to hand someone who has not started, and the rest state below
              already offers them the way in. */}
          {consistency.totalSessions > 0 && (
            <>
              <ConsistencyRing stats={consistency} target={weeklyWorkoutGoal} />

              {/* Where the week's volume went. Withheld when nothing has been
                  lifted in seven days: every region would render at the same
                  empty grey, which looks like a broken figure rather than a
                  rest week. */}
              {weekSplit.length > 0 && (
                <View style={styles.coverage}>
                  <Text style={styles.coverageLabel}>Coverage this week</Text>
                  <BodyHeatMap slices={weekSplit} days={7} compact />
                </View>
              )}

              <View style={styles.trainingDivider} />
            </>
          )}

          {/* Burned leads the stats row rather than sitting in the header as a
              13pt caption, which is where it was and where it read as a
              footnote to the card's title instead of as one of the day's
              numbers.

              It is also the reason this row no longer lives inside the
              `dayWorkoutStats` branch: active energy is a whole-day figure
              from the health store, not something the workout produced, so it
              is just as true on a day with no workout logged — and on exactly
              that day the old placement hid it completely. */}
          {/* Names the half below the divider, the way "Coverage this week"
              names the half above it. Without it the card runs week numbers
              into day numbers with nothing saying which is which. Shown only
              once there is a week block to be distinguished from. */}
          {consistency.totalSessions > 0 && <Text style={styles.todayLabel}>Today</Text>}

          {(dayWorkoutStats || activeEnergy != null) && (
            <View style={styles.workoutStatsRow}>
              {activeEnergy != null && (
                <WorkoutStat
                  label="Burned"
                  value={Math.round(activeEnergy).toLocaleString()}
                  unit="kcal"
                  c={c}
                />
              )}
              {dayWorkoutStats && (
                <>
                  <WorkoutStat
                    label="Duration"
                    value={formatDuration(dayWorkoutStats.totalDurationMs)}
                    c={c}
                  />
                  <WorkoutStat
                    label="Volume"
                    value={
                      dayWorkoutStats.totalVolume >= 1000
                        ? `${(dayWorkoutStats.totalVolume / 1000).toFixed(1)}k`
                        : String(Math.round(dayWorkoutStats.totalVolume))
                    }
                    unit="lb"
                    c={c}
                  />
                  {dayWorkoutStats.hr && (
                    <WorkoutStat
                      label="Avg HR"
                      value={String(dayWorkoutStats.hr.avg)}
                      unit="bpm"
                      c={c}
                    />
                  )}
                </>
              )}
            </View>
          )}

          {dayWorkoutStats ? (
            <>
              {dayWorkouts.map((w) => (
                <WorkoutHistoryItem
                  key={w.id}
                  session={w}
                  showDate={false}
                  onPress={() =>
                    navigation.navigate('WorkoutSummary', { sessionId: w.id, viewOnly: true })
                  }
                  onDelete={() => {
                    deleteWorkout(w.id);
                    showSnackbar('Workout deleted', {
                      label: 'Undo',
                      onPress: () => restoreWorkout(w),
                    });
                  }}
                />
              ))}
            </>
          ) : (
            <TouchableOpacity
              style={styles.restRow}
              onPress={() => navigation.navigate('Exercise')}
              activeOpacity={0.7}
            >
              <View style={styles.restCopy}>
                <Text style={styles.restText}>Nothing logged yet today</Text>
                {/* A rest day that only reports emptiness wastes the one
                    moment the card has the user's attention and a genuine
                    suggestion to make. The week's untrained regions are
                    already computed for the figure above, so the prompt and
                    the figure can never disagree. */}
                {untrainedThisWeek.length > 0 && (
                  <Text style={styles.restHint} numberOfLines={2}>
                    {listRegions(untrainedThisWeek)} untrained this week
                  </Text>
                )}
              </View>
              <Text style={styles.restAction}>Start a workout</Text>
              <Icon name="forward" size="sm" color={c.primary} />
            </TouchableOpacity>
          )}
        </View>

        {showWaterTracker && (
          <View style={styles.card}>
            <View style={styles.waterHeader}>
              <View style={styles.cardTitleRow}>
                <Icon name="water" size="sm" color={c.gray700} />
                <Text style={styles.cardTitleInline}>Water</Text>
              </View>
              <Text style={styles.waterAmount}>
                {Math.round(water)} / {waterGoal} fl oz
              </Text>
            </View>
            <View style={styles.waterBarTrack}>
              <View style={[styles.waterBarFill, { width: `${waterPct}%` as any }]} />
            </View>
            <View style={styles.waterDots}>
              {Array.from({ length: numBubbles }).map((_, i) => (
                <TouchableOpacity
                  key={i}
                  onPress={() => handleBubblePress(i)}
                  style={[styles.waterDot, i < filledBubbles && styles.waterDotFilled]}
                  activeOpacity={0.6}
                  hitSlop={4}
                >
                  <Icon name="water" size="xs" color={i < filledBubbles ? c.info : c.textFaint} />
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.waterGoal}>
              Tap to fill {OZ_PER_BUBBLE} fl oz · tap the last drop again to undo
            </Text>
          </View>
        )}

        {/* The week, then the door to every day before it. */}
        <TouchableOpacity
          style={styles.card}
          onPress={() => navigation.navigate('History')}
          activeOpacity={0.7}
        >
          <View style={styles.weekHeader}>
            <Text style={styles.cardTitle}>This week</Text>
            <View style={styles.weekLink}>
              <Text style={styles.weekLinkText}>All days</Text>
              <Icon name="forward" size="sm" color={c.textFaint} />
            </View>
          </View>
          <View style={styles.weekRow}>
            {week.map((d) => (
              <View key={d.date} style={styles.weekCol}>
                <View style={styles.weekTrack}>
                  <View
                    style={[
                      styles.weekFill,
                      { height: `${Math.max(d.pct * 100, d.logged ? 6 : 0)}%` as any },
                      d.isToday && { backgroundColor: c.primary },
                    ]}
                  />
                </View>
                <View style={[styles.weekDot, d.trained && { backgroundColor: c.primary }]} />
                <Text style={[styles.weekDay, d.isToday && styles.weekDayToday]}>{d.initial}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.weekCaption}>
            Bar is calories against goal · dot means you trained
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.trendsBtn}
          onPress={() => navigation.navigate('KeyInsights')}
          activeOpacity={0.7}
        >
          <Icon name="insights" size="lg" color={c.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.trendsTitle}>Key Insights</Text>
            <Text style={styles.trendsSub}>Weight, nutrition, consistency & workout volume</Text>
          </View>
          <Icon name="forward" size="md" color={c.textFaint} />
        </TouchableOpacity>

        {bestStreak > 1 && currentStreak < bestStreak && (
          <Text style={styles.bestStreak}>Best streak: {bestStreak} days</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// "Legs", "Legs and Back", "Legs, Back and Core" — and nothing longer, since
// a rest-day prompt naming five regions is a wall, not a suggestion.
function listRegions(regions: readonly string[]): string {
  const shown = regions.slice(0, 3);
  if (shown.length === 1) return shown[0];
  const rest = shown.slice(0, -1).join(', ');
  return `${rest} and ${shown[shown.length - 1]}`;
}

function WorkoutStat({
  label,
  value,
  unit,
  c,
}: {
  label: string;
  value: string;
  unit?: string;
  c: Theme;
}) {
  const s = useMemo(() => makeStatStyles(c), [c]);
  return (
    <View style={s.stat}>
      <View style={s.statValueRow}>
        <Text
          style={s.statValue}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.75}
        >
          {value}
        </Text>
        {unit && <Text style={s.statUnit}>{unit}</Text>}
      </View>
      <Text style={s.statLabel} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const makeStatStyles = (c: Theme) =>
  StyleSheet.create({
    stat: { flex: 1, alignItems: 'center' },
    statValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 2 },
    statValue: { ...type.subhead(c), ...tabular, color: c.text },
    statUnit: { ...type.micro(c), color: c.textFaint },
    statLabel: { ...type.micro(c), color: c.textMuted, marginTop: space.xxs },
  });

const makeStyles = (c: Theme) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    scroll: { flex: 1 },
    content: { padding: space.lg, paddingBottom: space.xxl },

    titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    pageTitle: { ...type.title(c), color: c.text },
    pageDate: { ...type.caption(c), color: c.textMuted, marginTop: space.xxs, marginBottom: space.lg },

    streakBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.xs,
      backgroundColor: c.warningSoft,
      borderRadius: radius.card,
      paddingHorizontal: space.md,
      paddingVertical: space.xs,
      borderWidth: 1,
      borderColor: `${c.warning}80`,
    },
    streakBadgeText: { ...type.captionStrong(c), color: c.warning },

    card: {
      backgroundColor: c.card,
      borderRadius: radius.card,
      padding: space.xl,
      marginBottom: space.lg,
      shadowColor: c.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 3,
    },
    todayCard: { paddingVertical: space.xl },
    todayDivider: { height: 1, backgroundColor: c.border, marginVertical: space.lg },
    // Same rule as the Today card's, so the two cards read as one system:
    // anchor, divider, detail.
    trainingDivider: { height: 1, backgroundColor: c.border, marginVertical: space.lg },
    todayLabel: { ...type.overline(c), color: c.textFaint, marginBottom: space.md },
    coverage: { marginTop: space.lg },
    coverageLabel: {
      ...type.overline(c),
      color: c.textFaint,
      textAlign: 'center',
      marginBottom: space.sm,
    },
    macroList: { gap: space.md },

    cardTitle: { ...type.bodyStrong(c), color: c.gray700 },
    cardTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.sm,
      marginBottom: space.lg,
    },
    cardTitleInline: { ...type.bodyStrong(c), color: c.gray700 },

    workoutStatsRow: { flexDirection: 'row', marginBottom: space.md },
    restRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
    restCopy: { flex: 1, gap: space.xxs },
    restText: { ...type.body(c), color: c.textMuted },
    restHint: { ...type.caption(c), color: c.textFaint },
    restAction: { ...type.captionStrong(c), color: c.primary },

    waterHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    waterAmount: { ...type.caption(c), ...tabular, color: c.textMuted, marginBottom: space.lg },
    waterBarTrack: {
      height: 8,
      borderRadius: radius.hairline,
      backgroundColor: c.borderStrong,
      overflow: 'hidden',
    },
    waterBarFill: { height: '100%', borderRadius: radius.hairline, backgroundColor: c.info },
    waterDots: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: space.sm,
      marginTop: space.md,
    },
    waterDot: {
      width: 36,
      height: 36,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: 'center',
      justifyContent: 'center',
      opacity: 0.55,
    },
    waterDotFilled: { opacity: 1, backgroundColor: c.infoSoft, borderColor: c.info },
    waterGoal: { ...type.caption(c), color: c.textFaint, textAlign: 'center', marginTop: space.md },

    weekHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: space.lg,
    },
    weekLink: { flexDirection: 'row', alignItems: 'center', gap: space.xxs },
    weekLinkText: { ...type.caption(c), color: c.textFaint },
    weekRow: { flexDirection: 'row', gap: space.sm },
    weekCol: { flex: 1, alignItems: 'center' },
    weekTrack: {
      width: '100%',
      height: 56,
      borderRadius: radius.hairline,
      backgroundColor: c.cardMuted,
      justifyContent: 'flex-end',
      overflow: 'hidden',
    },
    weekFill: { width: '100%', borderRadius: radius.hairline, backgroundColor: c.borderStrong },
    weekDot: {
      width: 5,
      height: 5,
      borderRadius: radius.pill,
      backgroundColor: 'transparent',
      marginTop: space.sm,
    },
    weekDay: { ...type.micro(c), color: c.textFaint, marginTop: space.xs },
    weekDayToday: { color: c.text, fontFamily: c.fontBodyBold },
    weekCaption: { ...type.micro(c), color: c.textFaint, textAlign: 'center', marginTop: space.md },

    trendsBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.md,
      backgroundColor: c.card,
      borderRadius: radius.card,
      padding: space.lg,
      marginBottom: space.lg,
      borderWidth: 1,
      borderColor: c.border,
    },
    trendsTitle: { ...type.bodyStrong(c), color: c.text },
    trendsSub: { ...type.caption(c), color: c.textMuted, marginTop: space.xxs },

    bestStreak: { ...type.caption(c), color: c.textFaint, textAlign: 'center' },
  });
