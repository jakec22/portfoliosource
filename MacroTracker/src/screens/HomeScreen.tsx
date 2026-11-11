import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore, sumMacros, DEFAULT_GOALS } from '../store/useStore';
import { useToday } from '../hooks/useToday';
import { useSnackbar } from '../store/useSnackbar';
import {
  getPastDays,
  formatDuration,
  parseDate,
  displayDate,
  shiftDate,
  shortDate,
  relativeDateLabel,
} from '../utils/date';
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
import { isRecoverySession } from '../utils/workoutTypes';
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
//
// Home opens on today and is usually today, but it is no longer only today.
// One rule holds the screen together: every figure on it is anchored to the
// day in the header. The arrows step that day, the week strip picks one, and
// the "Back to today" pill ends the excursion. Anything that cannot honour
// the anchor — the streak, the goal-setup prompts, the start-a-workout row —
// is shown on today and hidden otherwise, rather than left on screen
// answering a question about a different day.
export function HomeScreen({ navigation }: Props) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const today = useToday();

  // The day on screen. Defaults to today and returns there at midnight: a
  // phone left open overnight on "Today" would otherwise be showing
  // yesterday under today's title.
  const [viewDate, setViewDate] = useState(today);
  useEffect(() => setViewDate(today), [today]);
  const isToday = viewDate === today;

  const goals = useStore((s) => s.goals);
  const allLogs = useStore((s) => s.logs);
  const dayEntries = useStore((s) => s.logs[viewDate]);
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

  const totals = useMemo(() => sumMacros(dayEntries ?? []), [dayEntries]);
  const water = waterIntake[viewDate] ?? 0;

  const { current: currentStreak, best: bestStreak } = useMemo(
    () => computeStreak(allLogs),
    [allLogs]
  );

  const dayWorkouts = useMemo(
    () => workoutHistory.filter((w) => w.date === viewDate),
    [workoutHistory, viewDate]
  );
  // Training stats only. A sauna has no volume, no sets and no business
  // lengthening the day's "Duration" beside a lift's — it still appears in
  // the session list below, which is what "tracked but not counted" means.
  const dayTraining = useMemo(
    () => dayWorkouts.filter((w) => !isRecoverySession(w)),
    [dayWorkouts]
  );

  const dayWorkoutStats = useMemo(() => {
    if (dayTraining.length === 0) return null;
    const totalDurationMs = dayTraining.reduce(
      (n, w) => n + Math.max(0, (w.completedAt ?? w.startedAt) - w.startedAt),
      0
    );
    const totalVolume = dayTraining.reduce((n, w) => n + sessionVolume(w), 0);
    const totalSets = dayTraining.reduce(
      (n, w) => n + w.exercises.reduce((en, e) => en + e.sets.length, 0),
      0
    );
    const doneSets = dayTraining.reduce(
      (n, w) => n + w.exercises.reduce((en, e) => en + e.sets.filter((s) => s.completed).length, 0),
      0
    );
    const hr = heartRateStats(dayTraining.flatMap((w) => w.heartRateSamples ?? []));
    return { totalDurationMs, totalVolume, totalSets, doneSets, hr };
  }, [dayTraining]);

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
  const consistency = useMemo(
    () => consistencyStats(workoutHistory, viewDate),
    [workoutHistory, viewDate]
  );

  // Seven days, not the Exercise tab's thirty: Home is asking what this week
  // looks like, and a month-long window smooths over exactly the gap a rest
  // day wants to know about. Ends on the viewed day, so the figure and the
  // stats below it are always describing the same week.
  const weekSplit = useMemo(
    () => trainingSplit(workoutHistory, 7, c, viewDate),
    [workoutHistory, c, viewDate]
  );

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
    // Cleared first: the query is a round trip to the health store, and
    // without this the previous day's figure sits under the new day's date
    // until it answers.
    setActiveEnergy(null);
    queryActiveEnergy(viewDate).then((kcal) => {
      if (!cancelled) setActiveEnergy(kcal);
    });
    return () => {
      cancelled = true;
    };
  }, [hkAvailable, viewDate]);

  // The week as adherence, not as a chart: one column per day, filled to how
  // close that day landed. Reading the shape is the point — detail is a tap away.
  //
  // The window ends on the viewed day, so the day you are reading is always
  // the rightmost column and stepping back walks the strip with you.
  const week = useMemo(() => {
    const workoutDates = new Set(workoutHistory.map((w) => w.date));
    return getPastDays(WEEK, viewDate)
      .reverse()
      .map((date) => {
        const t = sumMacros(allLogs[date] ?? []);
        return {
          date,
          pct: goals.calories > 0 ? Math.min(t.calories / goals.calories, 1) : 0,
          logged: (allLogs[date]?.length ?? 0) > 0,
          trained: workoutDates.has(date),
          isToday: date === today,
          isViewed: date === viewDate,
          initial: parseDate(date).toLocaleDateString('en-US', { weekday: 'narrow' }),
        };
      });
  }, [allLogs, workoutHistory, goals.calories, today, viewDate]);

  const OZ_PER_BUBBLE = waterIncrement;
  const numBubbles = Math.max(4, Math.round(waterGoal / OZ_PER_BUBBLE));
  const filledBubbles = Math.round(water / OZ_PER_BUBBLE);
  const waterPct = Math.min(Math.round((water / waterGoal) * 100), 100);

  /**
   * Open the viewed day in the food log.
   *
   * Addressed through the tab, not the stack: FoodHome lives in a sibling
   * navigator, and this is the same call History's day cards make.
   *
   * The week strip used to make this call. It now selects the day on Home
   * instead, which is cheaper and reversible, so the door to the log moved
   * onto the card that holds the day's food.
   */
  function openFoodLog() {
    navigation.navigate('Food', { screen: 'FoodHome', params: { date: viewDate } });
  }

  // Forward stops at today. There is nothing to show for tomorrow and a
  // disabled arrow says so more clearly than an empty screen would.
  const canGoForward = !isToday;
  function stepDay(n: number) {
    if (n > 0 && !canGoForward) return;
    setViewDate((d) => shiftDate(d, n));
  }

  function handleBubblePress(index: number) {
    // Writes to the viewed day, not to today. Backdating water is the point
    // rather than a hazard: the store has always keyed it by date, the dots
    // are deliberate targets rather than something a scroll can catch, the
    // caption below names the day being written to, and the top drop undoes
    // itself.
    //
    // Tapping the topmost filled bubble un-fills it (undo an accidental tap);
    // any other bubble fills or empties up to that point.
    if (index + 1 === filledBubbles) setWater(viewDate, index * OZ_PER_BUBBLE);
    else setWater(viewDate, (index + 1) * OZ_PER_BUBBLE);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <StatusBar
        barStyle={c.scheme === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor={c.bg}
      />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {/* The date, and the controls that move it. Centred with the arrows
            flanking it so that stepping a day changes nothing but the words:
            a header that re-flows on every tap reads as the screen having
            been replaced rather than re-pointed.

            The streak badge and the "Back to today" button share the slot
            under the date. They are mutually exclusive — the streak is a
            fact about now, the button only exists when you are not on now —
            so the header is the same height either way. */}
        <View style={styles.dateRow}>
          <TouchableOpacity
            style={styles.dateNav}
            onPress={() => stepDay(-1)}
            activeOpacity={0.7}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Previous day"
          >
            <Icon name="back" size="lg" color={c.gray700} />
          </TouchableOpacity>

          <View style={styles.dateMid}>
            <Text style={styles.pageTitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
              {headline(viewDate)}
            </Text>
            <Text style={styles.pageDate}>{subhead(viewDate, today)}</Text>
          </View>

          <TouchableOpacity
            style={styles.dateNav}
            onPress={() => stepDay(1)}
            activeOpacity={0.7}
            hitSlop={8}
            disabled={!canGoForward}
            accessibilityRole="button"
            accessibilityLabel="Next day"
            accessibilityState={{ disabled: !canGoForward }}
          >
            {/* borderStrong, not border: a disabled control should read as
                disabled, not as absent, and `border` against the card is
                close enough to invisible that the header looks lopsided on
                the day you spend almost all of your time on. */}
            <Icon name="forward" size="lg" color={canGoForward ? c.gray700 : c.borderStrong} />
          </TouchableOpacity>
        </View>

        <View style={styles.dateFooter}>
          {isToday ? (
            currentStreak > 0 && (
              <View style={styles.streakBadge}>
                <Icon name="streak" size="xs" color={c.warning} />
                <Text style={styles.streakBadgeText}>
                  {currentStreak} day{currentStreak !== 1 ? 's' : ''}
                </Text>
              </View>
            )
          ) : (
            <TouchableOpacity
              style={styles.todayBtn}
              onPress={() => setViewDate(today)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Back to today"
            >
              <Icon name="calendar" size="xs" color={c.primary} />
              <Text style={styles.todayBtnText}>Back to today</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Both prompts are about the goals in force now, and the second is a
            notice to be dismissed. Neither belongs on a day in the past. */}
        {isToday && goalsAreUntouched && (
          <SetUpGoalsCard
            onStart={() => navigation.navigate('GoalWizard')}
            onDismiss={dismissGoalsPrompt}
          />
        )}

        {isToday && goalsUpdateNotice && (
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

          {/* What these numbers are made of. The week strip used to be the
              way through to the log; now that a bar selects a day here
              instead, the door belongs on the card that holds the food —
              and it finally works for today too, which the strip's own
              today-bar never usefully did. */}
          <View style={styles.todayDivider} />
          <TouchableOpacity
            style={styles.logLink}
            onPress={openFoodLog}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={`Open the food log for ${displayDate(viewDate)}`}
          >
            <Text style={styles.logLinkText}>
              {isToday ? "See today's food" : `See what you ate on ${shortDate(viewDate)}`}
            </Text>
            <Icon name="forward" size="sm" color={c.primary} />
          </TouchableOpacity>
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
              <ConsistencyRing
                stats={consistency}
                target={weeklyWorkoutGoal}
                past={!isToday}
              />

              {/* Where the week's volume went. Withheld when nothing has been
                  lifted in seven days: every region would render at the same
                  empty grey, which looks like a broken figure rather than a
                  rest week. */}
              {weekSplit.length > 0 && (
                <View style={styles.coverage}>
                  <Text style={styles.coverageLabel}>
                    {isToday ? 'Coverage this week' : 'Coverage that week'}
                  </Text>
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
          {consistency.totalSessions > 0 && (
            <Text style={styles.todayLabel}>{displayDate(viewDate)}</Text>
          )}

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

          {/* Branches on whether anything was logged, not on whether there
              are training stats: a day with only a sauna has no stats row but
              is emphatically not a rest day. */}
          {dayWorkouts.length > 0 ? (
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
          ) : !isToday ? (
            // No call to action on a past day: "Start a workout" starts one
            // now, and offering it under a date three days gone is an offer
            // to log to the wrong day.
            <Text style={styles.restText}>No training logged</Text>
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
                  accessibilityRole="button"
                  // Each dot sets the day's total to its own mark, so the
                  // label is the amount it would log, not "water dot 3".
                  accessibilityLabel={`Set water to ${(i + 1) * waterIncrement} ounces`}
                  accessibilityState={{ selected: i < filledBubbles }}
                >
                  <Icon name="water" size="xs" color={i < filledBubbles ? c.info : c.textFaint} />
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.waterGoal}>
              {isToday
                ? `Tap to fill ${OZ_PER_BUBBLE} fl oz · tap the last drop again to undo`
                : `Tap to fill ${OZ_PER_BUBBLE} fl oz · logs to ${shortDate(viewDate)}`}
            </Text>
          </View>
        )}

        {/* The week, and the fastest way to move around in it.
            The whole card was once a single button to History, so tapping
            Tuesday's bar went to a list rather than to Tuesday. Then each
            bar opened its own day in the food log. Now that Home itself
            holds a date, a bar sets it: no screen change, no trip back, and
            the strip redraws around the day you picked. "All days" keeps the
            door to everything older than the seven columns. */}
        <View style={styles.card}>
          <View style={styles.weekHeader}>
            <Text style={styles.cardTitle}>
              {isToday ? 'This week' : `Week to ${shortDate(viewDate)}`}
            </Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('History')}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="All days"
            >
              <View style={styles.weekLink}>
                <Text style={styles.weekLinkText}>All days</Text>
                <Icon name="forward" size="sm" color={c.textFaint} />
              </View>
            </TouchableOpacity>
          </View>
          <View style={styles.weekRow}>
            {week.map((d) => (
              <TouchableOpacity
                key={d.date}
                style={styles.weekCol}
                onPress={() => setViewDate(d.date)}
                activeOpacity={0.7}
                // A seventh of the card is 40pt wide. The 8pt gap between
                // columns absorbs this without the targets overlapping.
                hitSlop={{ left: 2, right: 2 }}
                accessibilityRole="button"
                accessibilityLabel={`${displayDate(d.date)} — show this day`}
                accessibilityState={{ selected: d.isViewed }}
              >
                <View style={styles.weekTrack}>
                  <View
                    style={[
                      styles.weekFill,
                      { height: `${Math.max(d.pct * 100, d.logged ? 6 : 0)}%` as any },
                      // Today is green wherever it falls in the strip; the
                      // day being read is blue. On today they are the same
                      // column and green wins, which is why the two colours
                      // never compete for the same meaning.
                      d.isViewed && { backgroundColor: c.info },
                      d.isToday && { backgroundColor: c.primary },
                    ]}
                  />
                </View>
                <View style={[styles.weekDot, d.trained && { backgroundColor: c.primary }]} />
                <Text
                  style={[
                    styles.weekDay,
                    d.isViewed && styles.weekDayViewed,
                    d.isToday && styles.weekDayToday,
                  ]}
                >
                  {d.initial}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.weekCaption}>
            Tap a day to see it · bar is calories against goal, dot means you trained
          </Text>
        </View>

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

/**
 * The big word in the header.
 *
 * "Today" and "Yesterday" rather than the weekday, because that is what the
 * day is called; further back the weekday is the fastest handle on it, and
 * the date underneath carries the precision.
 */
function headline(viewDate: string): string {
  const label = displayDate(viewDate);
  if (label === 'Today' || label === 'Yesterday') return label;
  return parseDate(viewDate).toLocaleDateString('en-US', { weekday: 'long' });
}

/**
 * The line under it. On today and yesterday the headline has not spent the
 * weekday, so the full date can carry it and the header reads exactly as it
 * did before any of this existed. Further back the weekday is already above,
 * so the line spends its room on how far back you have gone instead.
 */
function subhead(viewDate: string, today: string): string {
  const label = displayDate(viewDate);
  const d = parseDate(viewDate);
  if (label === 'Today' || label === 'Yesterday') {
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  }

  const sameYear = d.getFullYear() === parseDate(today).getFullYear();
  const date = d.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    // "October 12" is a guess once you are far enough back to have crossed a
    // new year, and stepping back a day at a time is a way to get there.
    ...(sameYear ? {} : { year: 'numeric' }),
  });

  // relativeDateLabel gives up and returns a short date past four weeks,
  // which here would print the date twice — "October 12 · Oct 12". Past that
  // point the date alone is the better answer anyway: nobody reads "7w ago".
  const days = Math.round((parseDate(today).getTime() - d.getTime()) / 86400000);
  return days < 28 ? `${date} · ${relativeDateLabel(viewDate)}` : date;
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

    dateRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
    // 44pt, the full touch target, and round so the arrow sits in something
    // rather than floating next to the title.
    dateNav: {
      width: 44,
      height: 44,
      borderRadius: radius.pill,
      backgroundColor: c.card,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dateMid: { flex: 1, alignItems: 'center' },
    pageTitle: { ...type.title(c), color: c.text, textAlign: 'center' },
    pageDate: { ...type.caption(c), color: c.textMuted, marginTop: space.xxs, textAlign: 'center' },
    // Fixed height so the header does not grow and shrink by a badge as you
    // step across today, and so a streakless first week leaves the same gap
    // the badge would have.
    dateFooter: {
      height: 34,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: space.sm,
      marginBottom: space.lg,
    },

    todayBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.xs,
      backgroundColor: c.primarySoft,
      borderRadius: radius.control,
      paddingHorizontal: space.md,
      paddingVertical: space.sm,
    },
    todayBtnText: { ...type.captionStrong(c), color: c.primary },

    logLink: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: space.xs,
      // The row is the target: the text alone is 18pt tall.
      paddingVertical: space.xs,
    },
    logLinkText: { ...type.captionStrong(c), color: c.primary },

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
    weekDayViewed: { color: c.info, fontFamily: c.fontBodyBold },
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
