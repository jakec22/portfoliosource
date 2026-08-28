import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  ActionSheetIOS,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore, sumMacros } from '../store/useStore';
import { todayString, displayDate, formatDate } from '../utils/date';
import { CalorieSummary } from '../components/CalorieSummary';
import { MacroRing } from '../components/MacroRing';
import { MealSection } from '../components/MealSection';
import { WorkoutHistoryItem } from '../components/WorkoutHistoryItem';
import { MealType } from '../types';
import { computeStreak } from '../utils/streak';
import { sessionVolume } from '../utils/analytics';
import { formatDuration } from '../utils/date';
import { heartRateStats } from '../services/heartRate';
import {
  activeEnergyAvailable,
  requestActiveEnergyPermission,
  queryActiveEnergy,
} from '../services/activeEnergy';
import { useTheme } from '../theme/useTheme';
import type { Theme } from '../theme';

interface Props {
  navigation: any;
}

export function HomeScreen({ navigation }: Props) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [selectedDate, setSelectedDate] = useState(todayString());
  const goals = useStore((s) => s.goals);
  const dateEntries = useStore((s) => s.logs[selectedDate]);
  const workoutHistory = useStore((s) => s.workoutHistory);
  const deleteWorkout = useStore((s) => s.deleteWorkout);
  const waterIntake = useStore((s) => s.waterIntake);

  const dayWorkouts = useMemo(
    () => workoutHistory.filter((w) => w.date === selectedDate),
    [workoutHistory, selectedDate]
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

  // Active Energy (kcal burned) from HealthKit — enriched by an Apple Watch
  // when one's worn, but degrades to null (hidden) with no native module,
  // no permission, or no data for the selected day.
  const [activeEnergy, setActiveEnergy] = useState<number | null>(null);
  const [hkAvailable] = useState(() => activeEnergyAvailable());
  useEffect(() => {
    if (!hkAvailable) return;
    requestActiveEnergyPermission();
  }, [hkAvailable]);
  useEffect(() => {
    if (!hkAvailable) return;
    let cancelled = false;
    queryActiveEnergy(selectedDate).then((kcal) => {
      if (!cancelled) setActiveEnergy(kcal);
    });
    return () => {
      cancelled = true;
    };
  }, [hkAvailable, selectedDate]);
  const setWater = useStore((s) => s.setWater);
  const waterGoal = useStore((s) => s.waterGoal);
  const waterIncrement = useStore((s) => s.waterIncrement);
  const showWaterTracker = useStore((s) => s.showWaterTracker);

  const totals = useMemo(() => sumMacros(dateEntries ?? []), [dateEntries]);
  const water = waterIntake[selectedDate] ?? 0;

  const allLogs = useStore((s) => s.logs);
  const { current: currentStreak, best: bestStreak } = useMemo(
    () => computeStreak(allLogs),
    [allLogs]
  );

  const calPct = goals.calories > 0
    ? Math.min(Math.round((totals.calories / goals.calories) * 100), 100)
    : 0;

  function macroStatus(current: number, goal: number) {
    return goal > 0 && current / goal >= 0.8;
  }

  const OZ_PER_BUBBLE = waterIncrement;
  const numBubbles = Math.max(4, Math.round(waterGoal / OZ_PER_BUBBLE));
  const filledBubbles = Math.round(water / OZ_PER_BUBBLE);
  const waterPct = Math.min(Math.round((water / waterGoal) * 100), 100);

  function handleBubblePress(index: number) {
    // Tapping the topmost filled bubble un-fills it (undo accidental tap);
    // tapping any other bubble fills/empties up to that point.
    if (index + 1 === filledBubbles) {
      setWater(selectedDate, index * OZ_PER_BUBBLE);
    } else {
      setWater(selectedDate, (index + 1) * OZ_PER_BUBBLE);
    }
  }

  function goDay(offset: number) {
    const current = new Date(selectedDate + 'T12:00:00');
    current.setDate(current.getDate() + offset);
    const newDate = formatDate(current);
    if (newDate <= todayString()) {
      setSelectedDate(newDate);
    }
  }

  function handleAddFood(meal: MealType) {
    navigation.navigate('LogFood', { meal, date: selectedDate });
  }

  function handleSnapMeal() {
    const meals: MealType[] = ['breakfast', 'lunch', 'dinner', 'snacks'];
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: ['Cancel', 'Breakfast', 'Lunch', 'Dinner', 'Snacks'],
        cancelButtonIndex: 0,
      },
      (index) => {
        if (index === 0) return;
        navigation.navigate('MealPhoto', { meal: meals[index - 1], date: selectedDate });
      },
    );
  }

  const isToday = selectedDate === todayString();

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <StatusBar
        barStyle={c.scheme === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor={c.bg}
      />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {/* Date Navigation */}
        <View style={styles.dateNav}>
          <TouchableOpacity onPress={() => goDay(-1)} style={styles.navBtn}>
            <Text style={styles.navArrow}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.dateLabel}>{displayDate(selectedDate)}</Text>
          <TouchableOpacity
            onPress={() => goDay(1)}
            style={[styles.navBtn, isToday && styles.navBtnDisabled]}
            disabled={isToday}
          >
            <Text style={[styles.navArrow, isToday && styles.navArrowDisabled]}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Calorie Summary */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Calories</Text>
          <CalorieSummary consumed={totals.calories} goal={goals.calories} />
        </View>

        {/* Macro Rings */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Macros</Text>
          <View style={styles.macroRow}>
            <MacroRing
              current={totals.protein}
              goal={goals.protein}
              label="Protein"
              color={c.macroProtein}
            />
            <MacroRing
              current={totals.carbs}
              goal={goals.carbs}
              label="Carbs"
              color={c.macroCarbs}
            />
            <MacroRing
              current={totals.fat}
              goal={goals.fat}
              label="Fat"
              color={c.macroFat}
            />
            <MacroRing
              current={totals.fiber ?? 0}
              goal={goals.fiber}
              label="Fiber"
              color={c.macroFiber}
            />
          </View>
        </View>

        {/* Active Energy (Apple Health / Apple Watch) — only shown when we
            actually got a reading, so it's invisible for anyone not using
            HealthKit rather than showing a misleading zero. */}
        {activeEnergy != null && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>🔥 Active Energy</Text>
            <View style={styles.energyRow}>
              <Text style={styles.energyValue}>{activeEnergy}</Text>
              <Text style={styles.energyUnit}>kcal burned</Text>
            </View>
            <Text style={styles.energyCaption}>From Apple Health</Text>
          </View>
        )}

        {/* Today's Summary + Streak */}
        {isToday && (
          <View style={styles.card}>
            <View style={styles.summaryHeader}>
              <Text style={styles.cardTitle}>Today's Summary</Text>
              {currentStreak > 0 && (
                <View style={styles.streakBadge}>
                  <Text style={styles.streakBadgeText}>
                    🔥 {currentStreak} day{currentStreak !== 1 ? 's' : ''}
                  </Text>
                </View>
              )}
            </View>

            {/* Calorie progress bar */}
            <View style={styles.summaryCalRow}>
              <Text style={styles.summaryCalNum}>{Math.round(totals.calories)}</Text>
              <Text style={styles.summaryCalSep}> / {goals.calories} kcal</Text>
              <View style={{ flex: 1 }} />
              <Text style={calPct >= 90 ? styles.summaryHit : styles.summaryMiss}>
                {calPct >= 100
                  ? '🎯 Goal hit!'
                  : calPct >= 80
                  ? '💪 Almost there'
                  : `${calPct}%`}
              </Text>
            </View>
            <View style={styles.summaryBarTrack}>
              <View style={[styles.summaryBarFill, { width: `${calPct}%` as any }]} />
            </View>

            {/* Macro status dots */}
            <View style={styles.summaryMacroRow}>
              {[
                { label: 'Protein', hit: macroStatus(totals.protein, goals.protein),        color: c.macroProtein },
                { label: 'Carbs',   hit: macroStatus(totals.carbs, goals.carbs),            color: c.macroCarbs },
                { label: 'Fat',     hit: macroStatus(totals.fat, goals.fat),                color: c.macroFat },
                { label: 'Fiber',   hit: macroStatus(totals.fiber ?? 0, goals.fiber),       color: c.macroFiber },
              ].map(({ label, hit, color }) => (
                <View key={label} style={styles.summaryMacro}>
                  <View style={[styles.summaryMacroDot, { backgroundColor: hit ? color : c.border }]} />
                  <Text style={[styles.summaryMacroLabel, hit && { color }]}>{label}</Text>
                </View>
              ))}
            </View>

            {/* Workout status & best streak note */}
            <View style={styles.summaryFooter}>
              {dayWorkouts.length > 0 ? (
                <Text style={styles.summaryWorkout}>
                  💪 {dayWorkouts.length} workout{dayWorkouts.length !== 1 ? 's' : ''} logged
                </Text>
              ) : (
                <Text style={styles.summaryNoWorkout}>No workout logged yet</Text>
              )}
              {bestStreak > 1 && currentStreak < bestStreak && (
                <Text style={styles.summaryBest}>Best: {bestStreak} days</Text>
              )}
            </View>
          </View>
        )}

        {/* Water Tracker */}
        {showWaterTracker && (
          <View style={styles.card}>
            <View style={styles.waterHeader}>
              <Text style={styles.cardTitle}>💧 Water</Text>
              <Text style={styles.waterAmount}>
                {Math.round(water)} / {waterGoal} fl oz
              </Text>
            </View>

            {/* Progress bar */}
            <View style={styles.waterBarTrack}>
              <View style={[styles.waterBarFill, { width: `${waterPct}%` as any }]} />
            </View>
            <Text style={styles.waterPctText}>{waterPct}% of daily goal</Text>

            {/* Bubbles */}
            <View style={styles.waterDots}>
              {Array.from({ length: numBubbles }).map((_, i) => (
                <TouchableOpacity
                  key={i}
                  onPress={() => handleBubblePress(i)}
                  style={[styles.waterDot, i < filledBubbles && styles.waterDotFilled]}
                  activeOpacity={0.6}
                >
                  <Text style={styles.waterDotText}>💧</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.waterGoal}>
              Tap to fill {OZ_PER_BUBBLE} fl oz · tap the last drop again to undo
            </Text>
          </View>
        )}

        {/* Key Insights */}
        <TouchableOpacity
          style={styles.trendsBtn}
          onPress={() => navigation.navigate('KeyInsights')}
          activeOpacity={0.7}
        >
          <Text style={styles.trendsIcon}>📈</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.trendsTitle}>Key Insights</Text>
            <Text style={styles.trendsSub}>Weight, nutrition, consistency & workout volume</Text>
          </View>
          <Text style={styles.trendsArrow}>›</Text>
        </TouchableOpacity>

        {/* AI Meal Logger */}
        <TouchableOpacity style={styles.snapBtn} onPress={handleSnapMeal} activeOpacity={0.85}>
          <Text style={styles.snapIcon}>✨</Text>
          <View>
            <Text style={styles.snapTitle}>AI Meal Logger</Text>
            <Text style={styles.snapSub}>Snap a photo or describe your meal in words</Text>
          </View>
        </TouchableOpacity>

        {/* Meal Sections */}
        <View style={styles.mealsHeader}>
          <Text style={styles.mealsTitle}>Food Log</Text>
        </View>
        {(['breakfast', 'lunch', 'dinner', 'snacks'] as MealType[]).map((meal) => (
          <MealSection
            key={meal}
            meal={meal}
            date={selectedDate}
            onAddFood={handleAddFood}
          />
        ))}

        {dayWorkouts.length > 0 && dayWorkoutStats && (
          <View style={styles.workoutsSection}>
            <Text style={styles.workoutsTitle}>Workouts</Text>

            <View style={styles.workoutStatsRow}>
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
              <WorkoutStat
                label="Sets"
                value={`${dayWorkoutStats.doneSets}/${dayWorkoutStats.totalSets}`}
                c={c}
              />
              {dayWorkoutStats.hr && (
                <WorkoutStat label="Avg HR" value={String(dayWorkoutStats.hr.avg)} unit="bpm" c={c} />
              )}
            </View>

            {dayWorkouts.map((w) => (
              <WorkoutHistoryItem
                key={w.id}
                session={w}
                showDate={false}
                onPress={() =>
                  navigation.navigate('WorkoutSummary', {
                    sessionId: w.id,
                    viewOnly: true,
                  })
                }
                onDelete={() => deleteWorkout(w.id)}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
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
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <View style={styles.workoutStat}>
      <Text style={styles.workoutStatValue}>
        {value}
        {unit ? <Text style={styles.workoutStatUnit}> {unit}</Text> : null}
      </Text>
      <Text style={styles.workoutStatLabel}>{label}</Text>
    </View>
  );
}

const makeStyles = (c: Theme) => StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: c.bg,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  dateNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    gap: 20,
  },
  navBtn: {
    padding: 8,
  },
  navBtnDisabled: {
    opacity: 0.3,
  },
  navArrow: {
    fontSize: 28,
    color: c.gray700,
    fontWeight: '300',
  },
  navArrowDisabled: {
    color: c.textFaint,
  },
  dateLabel: {
    fontSize: 20,
    fontWeight: '700',
    color: c.text,
    minWidth: 120,
    textAlign: 'center',
  },
  card: {
    backgroundColor: c.card,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    shadowColor: c.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: c.gray700,
    marginBottom: 16,
  },
  macroRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  waterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  waterAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: c.info,
  },
  waterBarTrack: {
    height: 8,
    backgroundColor: c.infoSoft,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 4,
  },
  waterBarFill: {
    height: 8,
    borderRadius: 4,
    backgroundColor: c.info,
  },
  waterPctText: {
    fontSize: 11,
    color: c.textFaint,
    marginBottom: 12,
  },
  waterDots: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  waterDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: c.infoSoft,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.3,
  },
  waterDotFilled: {
    opacity: 1,
    backgroundColor: c.infoSoft,
  },
  waterDotText: {
    fontSize: 18,
  },
  waterGoal: {
    fontSize: 12,
    color: c.textFaint,
    textAlign: 'center',
  },
  snapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: c.primary,
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    shadowColor: c.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  snapIcon: {
    fontSize: 32,
  },
  snapTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: c.onPrimary,
  },
  snapSub: {
    fontSize: 12,
    color: `${c.onPrimary}CC`,
    marginTop: 2,
  },
  trendsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: c.card,
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    shadowColor: c.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  trendsIcon: { fontSize: 28 },
  trendsTitle: { fontSize: 16, fontWeight: '700', color: c.text },
  trendsSub: { fontSize: 12, color: c.textFaint, marginTop: 2 },
  trendsArrow: { fontSize: 26, color: c.textFaint, fontWeight: '300' },
  mealsHeader: {
    marginBottom: 8,
  },
  mealsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: c.text,
  },
  workoutsSection: {
    marginTop: 8,
  },
  workoutsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: c.text,
    marginBottom: 10,
  },
  workoutStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: c.card,
    borderRadius: 16,
    paddingVertical: 14,
    marginBottom: 12,
    shadowColor: c.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  workoutStat: { alignItems: 'center' },
  workoutStatValue: {
    fontSize: 16,
    fontWeight: '800',
    color: c.text,
    fontVariant: ['tabular-nums'],
  },
  workoutStatUnit: { fontSize: 11, fontWeight: '600', color: c.textFaint },
  workoutStatLabel: { fontSize: 11, color: c.textFaint, marginTop: 3 },

  // Active Energy card
  energyRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  energyValue: { fontSize: 28, fontWeight: '800', color: c.text, fontVariant: ['tabular-nums'] },
  energyUnit: { fontSize: 14, color: c.textFaint, fontWeight: '600' },
  energyCaption: { fontSize: 11, color: c.textFaint, marginTop: 6 },
  // Today's Summary card
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  streakBadge: {
    backgroundColor: c.warningSoft,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: `${c.warning}80`,
  },
  streakBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: c.warning,
  },
  summaryCalRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 6,
  },
  summaryCalNum: {
    fontSize: 20,
    fontWeight: '800',
    color: c.text,
  },
  summaryCalSep: {
    fontSize: 13,
    color: c.textFaint,
    marginLeft: 2,
  },
  summaryHit: {
    fontSize: 13,
    fontWeight: '700',
    color: c.primary,
  },
  summaryMiss: {
    fontSize: 13,
    fontWeight: '600',
    color: c.textFaint,
  },
  summaryBarTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: c.cardMuted,
    overflow: 'hidden',
    marginBottom: 14,
  },
  summaryBarFill: {
    height: 6,
    borderRadius: 3,
    backgroundColor: c.primary,
  },
  summaryMacroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  summaryMacro: {
    alignItems: 'center',
    gap: 4,
  },
  summaryMacroDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  summaryMacroLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: c.textFaint,
  },
  summaryFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: c.border,
  },
  summaryWorkout: {
    fontSize: 13,
    fontWeight: '600',
    color: c.gray700,
  },
  summaryNoWorkout: {
    fontSize: 13,
    color: c.textFaint,
  },
  summaryBest: {
    fontSize: 12,
    color: c.textFaint,
  },
});
