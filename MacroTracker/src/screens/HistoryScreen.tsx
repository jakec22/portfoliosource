import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
} from 'react-native';
import { useStore } from '../store/useStore';
import { getPastDays, displayDate } from '../utils/date';

interface Props {
  navigation: any;
}

const MACRO_COLORS = {
  protein: '#3B82F6',
  carbs: '#F59E0B',
  fat: '#EF4444',
};

export function HistoryScreen({ navigation }: Props) {
  const getTotals = useStore((s) => s.getTotalsForDate);
  const goals = useStore((s) => s.goals);
  const days = getPastDays(14);

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
          const totals = getTotals(date);
          const hasData = totals.calories > 0;
          const calPct = Math.round((totals.calories / goals.calories) * 100);

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
