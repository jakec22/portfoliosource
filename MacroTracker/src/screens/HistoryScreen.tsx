import React, { useMemo } from 'react';
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

interface Props {
  navigation: any;
}

const MACRO_COLORS = {
  protein: '#3B82F6',
  carbs: '#F59E0B',
  fat: '#EF4444',
};

export function HistoryScreen({ navigation }: Props) {
  const logs = useStore((s) => s.logs);
  const goals = useStore((s) => s.goals);
  const workoutHistory = useStore((s) => s.workoutHistory);
  const deleteWorkout = useStore((s) => s.deleteWorkout);
  const days = getPastDays(14);

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
        <Text style={styles.subtitle}>Past 14 days</Text>

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
                              ? '#EF4444'
                              : '#10B981',
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
      </ScrollView>
    </SafeAreaView>
  );
}

const barStyles = StyleSheet.create({
  track: {
    height: 4,
    backgroundColor: '#F3F4F6',
    borderRadius: 2,
    marginTop: 4,
    overflow: 'hidden',
  },
  fill: {
    height: 4,
    borderRadius: 2,
  },
});

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#9CA3AF',
    marginBottom: 20,
  },
  dayCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
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
    color: '#111827',
  },
  dayCalories: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10B981',
  },
  overGoal: {
    color: '#EF4444',
  },
  noData: {
    fontSize: 13,
    color: '#D1D5DB',
    fontStyle: 'italic',
  },
  workoutDay: {
    fontSize: 13,
    fontWeight: '600',
    color: '#10B981',
  },
  workoutsSection: {
    marginTop: 4,
  },
  workoutsDivided: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  workoutsLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  calorieBarTrack: {
    height: 6,
    backgroundColor: '#F3F4F6',
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
    color: '#9CA3AF',
    marginTop: 4,
  },
});
