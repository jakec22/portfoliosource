import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from '../store/useStore';
import { ProgressLineChart, ChartEmpty } from '../components/ProgressLineChart';
import { MiniBarChart } from '../components/MiniBarChart';
import { weightTrend, nutritionAdherence, weeklyInsights } from '../utils/analytics';
import { useTheme } from '../theme/useTheme';
import type { Theme } from '../theme';

interface Props {
  navigation: any;
}

const WEIGHT_DAYS = 90;
const NUTRITION_DAYS = 14;

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
  const insights = useMemo(
    () => weeklyInsights(logs, goals, workoutHistory, bodyWeightLog),
    [logs, goals, workoutHistory, bodyWeightLog]
  );

  const weightDelta =
    weight.length >= 2 ? weight[weight.length - 1].lbs - weight[0].lbs : 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.back}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Progress & Trends</Text>
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
                <InsightStat
                  label="Avg / day"
                  value={insights.loggedDays ? `${insights.avgCalories}` : '—'}
                  unit="kcal"
                  color={c.primary}
                />
                <InsightStat
                  label="Avg protein"
                  value={insights.loggedDays ? `${insights.avgProtein}` : '—'}
                  unit="g"
                  color={c.macroProtein}
                />
                <InsightStat
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
                <Stat label="Avg calories" value={`${nutrition.avgCalories}`} color={c.primary} />
                <Stat label="Avg protein" value={`${nutrition.avgProtein} g`} color={c.macroProtein} />
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

        {/* Workout volume, records, and streaks live on their own page now. */}
        <TouchableOpacity
          style={styles.workoutLink}
          onPress={() => navigation.navigate('WorkoutInsights')}
          activeOpacity={0.7}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.workoutLinkTitle}>Workout Insights</Text>
            <Text style={styles.workoutLinkSub}>Streaks, volume, records, and strength progress</Text>
          </View>
          <Text style={styles.workoutLinkArrow}>›</Text>
        </TouchableOpacity>
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

function InsightStat({
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

  // Weekly insights card
  insightCard: {
    backgroundColor: c.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: c.scheme === 'dark' ? 'rgba(16,185,129,0.25)' : '#D1FAE5',
    shadowColor: c.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  insightEmpty: { fontSize: 13, color: c.textMuted, lineHeight: 19 },
  insightStatRow: { flexDirection: 'row', gap: 12 },
  insightStat: { flex: 1, alignItems: 'flex-start' },
  insightStatValue: { fontSize: 24, fontWeight: '800', fontVariant: ['tabular-nums'] },
  insightStatUnit: { fontSize: 11, color: c.textFaint, marginTop: -2 },
  insightStatLabel: { fontSize: 12, color: c.textMuted, marginTop: 3, fontWeight: '500' },
  insightMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginTop: 14,
  },
  insightMeta: { fontSize: 12, color: c.textMuted, fontWeight: '600' },
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
  highlightText: { flex: 1, fontSize: 13, color: c.textMuted, lineHeight: 19 },
  highlightPositive: { color: c.primaryDark, fontWeight: '600' },

  workoutLink: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.card,
    borderRadius: 16,
    padding: 16,
    marginTop: 4,
    shadowColor: c.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  workoutLinkTitle: { fontSize: 15, fontWeight: '700', color: c.text },
  workoutLinkSub: { fontSize: 12.5, color: c.textMuted, marginTop: 3 },
  workoutLinkArrow: { fontSize: 22, color: c.textFaint, marginLeft: 8 },
});
