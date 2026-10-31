import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore, sumMacros } from '../store/useStore';
import { getPastDays, displayDate } from '../utils/date';
import { WorkoutHistoryItem } from '../components/WorkoutHistoryItem';
import { WorkoutSession } from '../types';
import { useTheme } from '../theme/useTheme';
import type { Theme } from '../theme';
import { radius, space, type } from '../theme/tokens';

interface Props {
  navigation: any;
}

const PAGE = 14;

export function HistoryScreen({ navigation }: Props) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const barStyles = useMemo(() => makeBarStyles(c), [c]);
  const logs = useStore((s) => s.logs);
  const goals = useStore((s) => s.goals);
  const workoutHistory = useStore((s) => s.workoutHistory);
  const deleteWorkout = useStore((s) => s.deleteWorkout);
  const [visibleDays, setVisibleDays] = useState(PAGE);
  const days = getPastDays(visibleDays);

  // Group completed workouts by their date so each day card can list them.
  const workoutsByDate = useMemo(() => {
    const map: Record<string, WorkoutSession[]> = {};
    for (const w of workoutHistory) {
      (map[w.date] ??= []).push(w);
    }
    return map;
  }, [workoutHistory]);

  function MacroBar({
    value,
    goal,
    color,
  }: {
    value: number;
    goal: number;
    color: string;
  }) {
    const pct = Math.min(value / goal, 1);
    return (
      <View style={barStyles.track}>
        <View
          style={[
            barStyles.fill,
            { width: `${pct * 100}%` as any, backgroundColor: color },
          ]}
        />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.pageTitle}>History</Text>

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

        <Text style={styles.subtitle}>Past {visibleDays} days</Text>

        {days.map((date) => {
          const totals = sumMacros(logs[date] ?? []);
          const hasData = totals.calories > 0;
          const calPct = Math.round((totals.calories / goals.calories) * 100);
          const dayWorkouts = workoutsByDate[date] ?? [];

          return (
            <View key={date} style={styles.dayCard}>
              <View style={styles.dayHeader}>
                <Text style={styles.dayLabel}>{displayDate(date)}</Text>
                {hasData ? (
                  <Text
                    style={[
                      styles.dayCalories,
                      totals.calories > goals.calories && styles.overGoal,
                    ]}
                  >
                    {Math.round(totals.calories)} / {goals.calories} kcal
                  </Text>
                ) : dayWorkouts.length > 0 ? (
                  <Text style={styles.workoutDay}>Workout day</Text>
                ) : (
                  <Text style={styles.noData}>No data</Text>
                )}
              </View>

              {hasData && (
                <>
                  <View style={styles.calorieBarTrack}>
                    <View
                      style={[
                        styles.calorieBarFill,
                        {
                          width: `${Math.min(calPct, 100)}%` as any,
                          backgroundColor:
                            totals.calories > goals.calories
                              ? c.danger
                              : c.primary,
                        },
                      ]}
                    />
                  </View>

                  <View style={styles.macroGrid}>
                    <View style={styles.macroCell}>
                      <Text style={[styles.macroValue, { color: c.macroProtein }]}>
                        {Math.round(totals.protein)}g
                      </Text>
                      <MacroBar
                        value={totals.protein}
                        goal={goals.protein}
                        color={c.macroProtein}
                      />
                      <Text style={styles.macroLabel}>Protein</Text>
                    </View>
                    <View style={styles.macroCell}>
                      <Text style={[styles.macroValue, { color: c.macroCarbs }]}>
                        {Math.round(totals.carbs)}g
                      </Text>
                      <MacroBar
                        value={totals.carbs}
                        goal={goals.carbs}
                        color={c.macroCarbs}
                      />
                      <Text style={styles.macroLabel}>Carbs</Text>
                    </View>
                    <View style={styles.macroCell}>
                      <Text style={[styles.macroValue, { color: c.macroFat }]}>
                        {Math.round(totals.fat)}g
                      </Text>
                      <MacroBar
                        value={totals.fat}
                        goal={goals.fat}
                        color={c.macroFat}
                      />
                      <Text style={styles.macroLabel}>Fat</Text>
                    </View>
                    <View style={styles.macroCell}>
                      <Text style={[styles.macroValue, { color: c.macroFiber }]}>
                        {Math.round(totals.fiber ?? 0)}g
                      </Text>
                      <MacroBar
                        value={totals.fiber ?? 0}
                        goal={goals.fiber}
                        color={c.macroFiber}
                      />
                      <Text style={styles.macroLabel}>Fiber</Text>
                    </View>
                  </View>
                </>
              )}

              {dayWorkouts.length > 0 && (
                <View style={[styles.workoutsSection, hasData && styles.workoutsDivided]}>
                  <Text style={styles.workoutsLabel}>
                    {dayWorkouts.length} workout{dayWorkouts.length === 1 ? '' : 's'}
                  </Text>
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
            </View>
          );
        })}

        <TouchableOpacity
          style={styles.loadMoreBtn}
          onPress={() => setVisibleDays((d) => d + PAGE)}
          activeOpacity={0.7}
        >
          <Text style={styles.loadMoreText}>Load {PAGE} more days</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeBarStyles = (c: Theme) => StyleSheet.create({
  track: {
    height: 4,
    backgroundColor: c.cardMuted,
    borderRadius: radius.hairline,
    marginTop: space.xs,
    overflow: 'hidden',
  },
  fill: {
    height: 4,
    borderRadius: radius.hairline,
  },
});

const makeStyles = (c: Theme) => StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: c.bg,
  },
  content: {
    padding: space.lg,
    paddingBottom: space.xxl,
  },
  pageTitle: {
    ...type.title(c),
    color: c.text,
    marginBottom: space.xs,
  },
  subtitle: {
    ...type.body(c),
    color: c.textFaint,
    marginBottom: space.lg,
  },
  dayCard: {
    backgroundColor: c.card,
    borderRadius: radius.card,
    padding: space.lg,
    marginBottom: space.md,
    shadowColor: c.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: space.sm,
  },
  dayLabel: {
    ...type.bodyStrong(c),
    color: c.text,
  },
  dayCalories: {
    ...type.body(c),
    fontFamily: c.fontBodySemi,
    color: c.primary,
  },
  overGoal: {
    color: c.danger,
  },
  noData: {
    ...type.caption(c),
    color: c.textFaint,
    fontStyle: 'italic',
  },
  workoutDay: {
    ...type.captionStrong(c),
    color: c.primary,
  },
  workoutsSection: {
    marginTop: space.xs,
  },
  workoutsDivided: {
    marginTop: space.md,
    paddingTop: space.lg,
    borderTopWidth: 1,
    borderTopColor: c.border,
  },
  workoutsLabel: {
    ...type.overline(c),
    color: c.textFaint,
    marginBottom: space.sm,
  },
  calorieBarTrack: {
    height: 6,
    backgroundColor: c.cardMuted,
    borderRadius: radius.hairline,
    marginBottom: space.md,
    overflow: 'hidden',
  },
  calorieBarFill: {
    height: 6,
    borderRadius: radius.hairline,
  },
  macroGrid: {
    flexDirection: 'row',
    gap: space.md,
  },
  macroCell: {
    flex: 1,
    alignItems: 'center',
  },
  macroValue: {
      ...type.captionStrong(c),
  },
  macroLabel: {
    ...type.micro(c),
    color: c.textFaint,
    marginTop: space.xs,
  },
  loadMoreBtn: {
    alignItems: 'center',
    paddingVertical: space.lg,
    marginTop: space.xs,
    marginBottom: space.sm,
  },
  loadMoreText: {
    ...type.body(c),
    fontFamily: c.fontBodySemi,
    color: c.primary,
  },
  trendsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: c.card,
    borderRadius: radius.card,
    padding: space.lg,
    marginBottom: space.lg,
    shadowColor: c.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  trendsIcon: { ...type.title(c) },
  trendsTitle: { ...type.bodyStrong(c), color: c.text },
  trendsSub: { ...type.caption(c), color: c.textFaint, marginTop: space.xxs },
  trendsArrow: { ...type.title(c), color: c.textFaint },
});
