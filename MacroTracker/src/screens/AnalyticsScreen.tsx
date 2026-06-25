import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from '../store/useStore';
import { ProgressLineChart, ChartEmpty } from '../components/ProgressLineChart';
import { MiniBarChart } from '../components/MiniBarChart';
import { weightTrend, nutritionAdherence, weeklyVolume } from '../utils/analytics';
import { useTheme } from '../theme/useTheme';
import type { Theme } from '../theme';

interface Props {
  navigation: any;
}

const WEIGHT_DAYS = 90;
const NUTRITION_DAYS = 14;
const WORKOUT_WEEKS = 6;

// "Jun 5" from a YYYY-MM-DD string.
function shortDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function AnalyticsScreen({ navigation }: Props) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const bodyWeightLog = useStore((s) => s.bodyWeightLog);
  const logs = useStore((s) => s.logs);
  const goals = useStore((s) => s.goals);
  const workoutHistory = useStore((s) => s.workoutHistory);

  const weight = useMemo(() => weightTrend(bodyWeightLog, WEIGHT_DAYS), [bodyWeightLog]);
  const nutrition = useMemo(
    () => nutritionAdherence(logs, goals, NUTRITION_DAYS),
    [logs, goals]
  );
  const weeks = useMemo(() => weeklyVolume(workoutHistory, WORKOUT_WEEKS), [workoutHistory]);

  const weightDelta =
    weight.length >= 2 ? weight[weight.length - 1].lbs - weight[0].lbs : 0;

  const thisWeek = weeks[weeks.length - 1];
  const totalWeekVol = weeks.reduce((n, w) => n + w.volume, 0);
  const weeksWithData = weeks.filter((w) => w.workouts > 0).length;
  const avgWeekVol = weeksWithData ? Math.round(totalWeekVol / weeksWithData) : 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.back}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Trends</Text>
        <View style={styles.backSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* ── Body weight ── */}
        <Text style={styles.sectionTitle}>Body Weight</Text>
        <View style={styles.card}>
          {weight.length === 0 ? (
            <ChartEmpty text="Log your weight on the Profile tab to see your trend." />
          ) : (
            <>
              <View style={styles.statRow}>
                <Stat
                  label="Current"
                  value={`${weight[weight.length - 1].lbs} lb`}
                  color={c.text}
                />
                <Stat
                  label="Change"
                  value={`${weightDelta >= 0 ? '+' : ''}${weightDelta.toFixed(1)} lb`}
                  color={weightDelta > 0 ? c.danger : weightDelta < 0 ? c.primaryDark : c.textMuted}
                />
              </View>
              {weight.length < 2 ? (
                <ChartEmpty text="One reading so far — log again to see a trend." />
              ) : (
                <ProgressLineChart
                  values={weight.map((p) => p.lbs)}
                  labels={weight.map((p) => shortDate(p.date))}
                  color="#0EA5E9"
                />
              )}
            </>
          )}
        </View>

        {/* ── Nutrition adherence ── */}
        <Text style={styles.sectionTitle}>Nutrition · last {NUTRITION_DAYS} days</Text>
        <View style={styles.card}>
          {nutrition.loggedDays === 0 ? (
            <ChartEmpty text="No food logged in this window yet." />
          ) : (
            <>
              <View style={styles.statRow}>
                <Stat label="Avg calories" value={`${nutrition.avgCalories}`} color="#10B981" />
                <Stat label="Avg protein" value={`${nutrition.avgProtein} g`} color="#3B82F6" />
              </View>
              <MiniBarChart
                values={nutrition.days.map((d) => d.calories)}
                labels={nutrition.days.map((d) => shortDate(d.date))}
                color="#10B981"
                goal={goals.calories}
                dimEmpty
              />
              <Text style={styles.caption}>
                Dashed line = {goals.calories} kcal goal · {nutrition.daysOnTarget}/
                {nutrition.loggedDays} logged days within 10%
              </Text>
            </>
          )}
        </View>

        {/* ── Workout volume ── */}
        <Text style={styles.sectionTitle}>Workout Volume · last {WORKOUT_WEEKS} weeks</Text>
        <View style={styles.card}>
          {totalWeekVol === 0 ? (
            <ChartEmpty text="No completed workouts in this window yet." />
          ) : (
            <>
              <View style={styles.statRow}>
                <Stat
                  label="This week"
                  value={`${Math.round(thisWeek.volume).toLocaleString()} lb`}
                  color="#F59E0B"
                />
                <Stat label="Avg / week" value={`${avgWeekVol.toLocaleString()} lb`} color={c.textMuted} />
              </View>
              <MiniBarChart
                values={weeks.map((w) => w.volume)}
                labels={weeks.map((w) => shortDate(w.startDate))}
                color="#F59E0B"
              />
              <Text style={styles.caption}>
                Each bar is one week's total volume (weight × reps).
              </Text>
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <View style={styles.statCard}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const makeStyles = (c: Theme) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
    backgroundColor: c.card,
  },
  back: { fontSize: 16, color: c.primary, fontWeight: '600', width: 64 },
  backSpacer: { width: 64 },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '800', color: c.text },
  content: { padding: 16, paddingBottom: 40 },

  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: c.textFaint,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 8,
    marginBottom: 10,
  },
  card: {
    backgroundColor: c.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: c.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  statRow: { flexDirection: 'row', gap: 12, marginBottom: 8 },
  statCard: { flex: 1 },
  statValue: { fontSize: 22, fontWeight: '800', fontVariant: ['tabular-nums'] },
  statLabel: { fontSize: 12, color: c.textFaint, marginTop: 2 },
  caption: { fontSize: 11, color: c.textFaint, marginTop: 8, lineHeight: 16 },
});
