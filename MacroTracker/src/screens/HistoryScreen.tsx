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

interface Props {
  navigation: any;
}

const MACRO_COLORS = {
  protein: '#3B82F6',
  carbs: '#F59E0B',
  fat: '#EF4444',
};

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
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.pageTitle}>History</Text>

        {/* Trends */}
        <TouchableOpacity
          style={styles.trendsBtn}
          onPress={() => navigation.navigate('Analytics')}
          activeOpacity={0.7}
        >
          <Text style={styles.trendsIcon}>📊</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.trendsTitle}>Trends</Text>
            <Text style={styles.trendsSub}>Weight, nutrition & workout volume over time</Text>
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
                      <Text style={[styles.macroValue, { color: '#3B82F6' }]}>
                        {Math.round(totals.protein)}g
                      </Text>
                      <MacroBar
                        value={totals.protein}
                        goal={goals.protein}
                        color="#3B82F6"
                      />
                      <Text style={styles.macroLabel}>Protein</Text>
                    </View>
                    <View style={styles.macroCell}>
                      <Text style={[styles.macroValue, { color: '#F59E0B' }]}>
                        {Math.round(totals.carbs)}g
                      </Text>
                      <MacroBar
                        value={totals.carbs}
                        goal={goals.carbs}
                        color="#F59E0B"
                      />
                      <Text style={styles.macroLabel}>Carbs</Text>
                    </View>
                    <View style={styles.macroCell}>
                      <Text style={[styles.macroValue, { color: '#EF4444' }]}>
                        {Math.round(totals.fat)}g
                      </Text>
                      <MacroBar
                        value={totals.fat}
                        goal={goals.fat}
                        color="#EF4444"
                      />
                      <Text style={styles.macroLabel}>Fat</Text>
                    </View>
                    <View style={styles.macroCell}>
                      <Text style={[styles.macroValue, { color: '#8B5CF6' }]}>
                        {Math.round(totals.fiber ?? 0)}g
                      </Text>
                      <MacroBar
                        value={totals.fiber ?? 0}
                        goal={goals.fiber}
                        color="#8B5CF6"
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
    borderRadius: 2,
    marginTop: 4,
    overflow: 'hidden',
  },
  fill: {
    height: 4,
    borderRadius: 2,
  },
});

const makeStyles = (c: Theme) => StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: c.bg,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: c.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: c.textFaint,
    marginBottom: 20,
  },
  dayCard: {
    backgroundColor: c.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
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
    marginBottom: 10,
  },
  dayLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: c.text,
  },
  dayCalories: {
    fontSize: 14,
    fontWeight: '600',
    color: c.primary,
  },
  overGoal: {
    color: c.danger,
  },
  noData: {
    fontSize: 13,
    color: c.textFaint,
    fontStyle: 'italic',
  },
  workoutDay: {
    fontSize: 13,
    fontWeight: '600',
    color: c.primary,
  },
  workoutsSection: {
    marginTop: 4,
  },
  workoutsDivided: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: c.border,
  },
  workoutsLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: c.textFaint,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  calorieBarTrack: {
    height: 6,
    backgroundColor: c.cardMuted,
    borderRadius: 3,
    marginBottom: 12,
    overflow: 'hidden',
  },
  calorieBarFill: {
    height: 6,
    borderRadius: 3,
  },
  macroGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  macroCell: {
    flex: 1,
    alignItems: 'center',
  },
  macroValue: {
    fontSize: 13,
    fontWeight: '700',
  },
  macroLabel: {
    fontSize: 10,
    color: c.textFaint,
    marginTop: 4,
  },
  loadMoreBtn: {
    alignItems: 'center',
    paddingVertical: 14,
    marginTop: 4,
    marginBottom: 8,
  },
  loadMoreText: {
    fontSize: 14,
    fontWeight: '600',
    color: c.primary,
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
});
