import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from '../store/useStore';
import { ProgressLineChart, ChartEmpty } from '../components/ProgressLineChart';
import { MiniBarChart } from '../components/MiniBarChart';
import { ProgressExplorer } from '../components/ProgressExplorer';
import { formatDuration } from '../utils/date';
import {
  weightTrend,
  nutritionAdherence,
  weeklyInsights,
  weeklyVolume,
  workoutInsights,
} from '../utils/analytics';
import { progressHighlights } from '../utils/exerciseHistory';
import { useTheme } from '../theme/useTheme';
import type { Theme } from '../theme';

interface Props {
  navigation: any;
}

const WEIGHT_DAYS = 90;
const NUTRITION_DAYS = 14;
const VOLUME_WEEKS = 8;

// "Jun 5" from a YYYY-MM-DD string.
function shortDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// "Wednesday" from a YYYY-MM-DD string (used for the best-day callout).
function weekdayLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'long' });
}

// One-stop-shop for every essential fitness metric: this week's snapshot,
// workout consistency, body weight, nutrition adherence, training volume,
// personal records, and the exercises trending up or trained most. Replaces
// the old separate Trends and Workout Insights pages.
export function KeyInsightsScreen({ navigation }: Props) {
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
  const insights = useMemo(
    () => weeklyInsights(logs, goals, workoutHistory, bodyWeightLog),
    [logs, goals, workoutHistory, bodyWeightLog]
  );
  const summary = useMemo(() => workoutInsights(workoutHistory), [workoutHistory]);
  const weeks = useMemo(() => weeklyVolume(workoutHistory, VOLUME_WEEKS), [workoutHistory]);
  // Same merged list the Exercise tab uses, with a longer tail since this is
  // the browsing surface.
  const highlights = useMemo(() => progressHighlights(workoutHistory, 10), [workoutHistory]);

  const weightDelta =
    weight.length >= 2 ? weight[weight.length - 1].lbs - weight[0].lbs : 0;
  const totalWeekVol = weeks.reduce((n, w) => n + w.volume, 0);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.back}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Key Insights</Text>
        <View style={styles.backSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* ── This week's insights ── */}
        <Text style={styles.sectionTitle}>This Week</Text>
        <View style={styles.insightCard}>
          {!insights.hasData ? (
            <Text style={styles.insightEmpty}>
              Log food or finish a workout this week and your personalized
              summary will show up here.
            </Text>
          ) : (
            <>
              <View style={styles.insightStatRow}>
                <WeekStat
                  label="Avg / day"
                  value={insights.loggedDays ? `${insights.avgCalories}` : '—'}
                  unit="kcal"
                  color={c.primary}
                />
                <WeekStat
                  label="Avg protein"
                  value={insights.loggedDays ? `${insights.avgProtein}` : '—'}
                  unit="g"
                  color={c.macroProtein}
                />
                <WeekStat
                  label="Workouts"
                  value={`${insights.workouts}`}
                  unit={insights.workouts === 1 ? 'session' : 'sessions'}
                  color={c.warning}
                />
              </View>

              <View style={styles.insightMetaRow}>
                <Text style={styles.insightMeta}>
                  Logged {insights.loggedDays}/7 days
                </Text>
                {insights.streak > 0 && (
                  <Text style={styles.insightMeta}>· 🔥 {insights.streak}-day streak</Text>
                )}
                {insights.weightChange != null && (
                  <Text style={styles.insightMeta}>
                    {' '}· {insights.weightChange >= 0 ? '+' : ''}
                    {insights.weightChange} lb
                  </Text>
                )}
              </View>

              {insights.bestDay && (
                <Text style={styles.insightBest}>
                  Best day: {weekdayLabel(insights.bestDay.date)} —{' '}
                  {insights.bestDay.calories} kcal, {insights.bestDay.protein}g protein
                </Text>
              )}

              {insights.highlights.length > 0 && (
                <View style={styles.highlightList}>
                  {insights.highlights.map((h, i) => (
                    <View key={i} style={styles.highlightRow}>
                      <Text style={styles.highlightIcon}>{h.icon}</Text>
                      <Text
                        style={[
                          styles.highlightText,
                          h.tone === 'positive' && styles.highlightPositive,
                        ]}
                      >
                        {h.text}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </>
          )}
        </View>

        {/* ── Body weight ── */}
        <Text style={styles.sectionTitle}>Body Weight</Text>
        <View style={styles.card}>
          {weight.length === 0 ? (
            <ChartEmpty text="Log your weight on the Profile tab to see your trend." />
          ) : (
            <>
              <View style={styles.miniStatRow}>
                <MiniStat
                  label="Current"
                  value={`${weight[weight.length - 1].lbs} lb`}
                  color={c.text}
                />
                <MiniStat
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
                  color={c.info}
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
              <View style={styles.miniStatRow}>
                <MiniStat label="Avg calories" value={`${nutrition.avgCalories}`} color={c.primary} />
                <MiniStat label="Avg protein" value={`${nutrition.avgProtein} g`} color={c.macroProtein} />
              </View>
              <MiniBarChart
                values={nutrition.days.map((d) => d.calories)}
                labels={nutrition.days.map((d) => shortDate(d.date))}
                color={c.primary}
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

        {/* ── Training load ── */}
        {/* Streak and session count deliberately aren't here: the Exercise
            tab's ring and 12-week grid own "how consistently", so this owns
            "how much" — what the training actually produced. */}
        <Text style={styles.sectionTitle}>Training · last {VOLUME_WEEKS} weeks</Text>
        <View style={styles.card}>
          {totalWeekVol === 0 ? (
            <ChartEmpty text="No completed workouts in this window yet." />
          ) : (
            <>
              <View style={styles.miniStatRow}>
                <MiniStat
                  label="Avg duration"
                  value={formatDuration(summary.avgDurationMs)}
                  color={c.text}
                />
                <MiniStat
                  label="Total volume"
                  value={
                    summary.totalVolume >= 1000
                      ? `${(summary.totalVolume / 1000).toFixed(1)}k lb`
                      : `${Math.round(summary.totalVolume)} lb`
                  }
                  color={c.primary}
                />
              </View>
              <MiniBarChart
                values={weeks.map((w) => w.volume)}
                labels={weeks.map((w) => shortDate(w.startDate))}
                color={c.primary}
              />
              <Text style={styles.caption}>Each bar is one week's total volume (weight × reps).</Text>
            </>
          )}
        </View>

        {/* ── Progress ── */}
        {highlights.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Progress</Text>
            <View style={styles.card}>
              <ProgressExplorer
                highlights={highlights}
                onOpen={(name) => navigation.navigate('ExerciseProgress', { name })}
              />
            </View>
          </>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

function MiniStat({ label, value, color }: { label: string; value: string; color: string }) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <View style={styles.miniStat}>
      <Text style={[styles.miniStatValue, { color }]}>{value}</Text>
      <Text style={styles.miniStatLabel}>{label}</Text>
    </View>
  );
}

function WeekStat({
  label,
  value,
  unit,
  color,
}: {
  label: string;
  value: string;
  unit: string;
  color: string;
}) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <View style={styles.insightStat}>
      <Text style={[styles.insightStatValue, { color }]}>{value}</Text>
      <Text style={styles.insightStatUnit}>{unit}</Text>
      <Text style={styles.insightStatLabel}>{label}</Text>
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
  back: { fontSize: 15, color: c.primary, fontFamily: c.fontBodyBold, width: 64 },
  backSpacer: { width: 64 },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 18, fontFamily: c.fontDisplay, color: c.text },
  content: { padding: 16, paddingBottom: 40 },

  sectionTitle: {
    fontSize: 20,
    fontFamily: c.fontDisplay,
    color: c.text,
    marginTop: 14,
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
  caption: { fontSize: 11, color: c.textFaint, marginTop: 8, lineHeight: 16, fontFamily: c.fontBody },

  // "This Week" hero. Deliberately not a card: it sits directly on the page
  // with a rule beneath it so it outranks the chart cards below instead of
  // being one more equal-weight box in the stack.
  insightCard: {
    paddingTop: 2,
    paddingBottom: 18,
    marginBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: c.borderStrong,
  },
  insightEmpty: { fontSize: 13, color: c.textMuted, lineHeight: 19, fontFamily: c.fontBody },
  insightStatRow: { flexDirection: 'row', gap: 12 },
  insightStat: { flex: 1, alignItems: 'flex-start' },
  insightStatValue: { fontSize: 26, fontFamily: c.fontDisplay, fontVariant: ['tabular-nums'] },
  insightStatUnit: { fontSize: 11, color: c.textFaint, marginTop: -2, fontFamily: c.fontBody },
  insightStatLabel: { fontSize: 12, color: c.textMuted, marginTop: 3, fontFamily: c.fontBody },
  insightMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginTop: 14,
  },
  insightMeta: { fontSize: 12, color: c.textMuted, fontFamily: c.fontBody },
  insightBest: {
    fontSize: 13,
    color: c.text,
    fontWeight: '600',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: c.border,
  },
  highlightList: { marginTop: 12, gap: 8 },
  highlightRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  highlightIcon: { fontSize: 15, lineHeight: 20 },
  highlightText: { flex: 1, fontSize: 13, color: c.textMuted, lineHeight: 19, fontFamily: c.fontBody },
  highlightPositive: { color: c.primaryDark, fontFamily: c.fontBodyBold },


  // Weight / nutrition 2-up mini stats
  miniStatRow: { flexDirection: 'row', gap: 12, marginBottom: 8 },
  miniStat: { flex: 1 },
  miniStatValue: { fontSize: 22, fontWeight: '800', fontVariant: ['tabular-nums'] },
  miniStatLabel: { fontSize: 12, color: c.textFaint, marginTop: 2 },


});
