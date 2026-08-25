import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from '../store/useStore';
import { MiniBarChart } from '../components/MiniBarChart';
import { ProgressCardRow } from '../components/ProgressCardRow';
import { ChartEmpty } from '../components/ProgressLineChart';
import { formatDuration } from '../utils/date';
import { weeklyVolume, workoutInsights } from '../utils/analytics';
import {
  recentPRs,
  topMovers,
  exerciseSummaries,
} from '../utils/exerciseHistory';
import { useTheme } from '../theme/useTheme';
import type { Theme } from '../theme';

interface Props {
  navigation: any;
}

const VOLUME_WEEKS = 8;
const MOST_TRAINED_LIMIT = 6;

// "Jun 5" from a YYYY-MM-DD string.
function shortDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function WorkoutInsightsScreen({ navigation }: Props) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const history = useStore((s) => s.workoutHistory);

  const summary = useMemo(() => workoutInsights(history), [history]);
  const weeks = useMemo(() => weeklyVolume(history, VOLUME_WEEKS), [history]);
  const prs = useMemo(() => recentPRs(history, 8), [history]);
  const movers = useMemo(() => topMovers(history, 6), [history]);
  const mostTrained = useMemo(
    () =>
      [...exerciseSummaries(history)]
        .sort((a, b) => b.sessions - a.sessions)
        .slice(0, MOST_TRAINED_LIMIT),
    [history]
  );

  const hasAnyData = summary.totalWorkouts > 0;
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
        <Text style={styles.headerTitle}>Workout Insights</Text>
        <View style={styles.backSpacer} />
      </View>

      {!hasAnyData ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>
            Finish a few workouts and your consistency, records, and trends will show up here.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {/* ── Consistency ── */}
          <Text style={styles.sectionTitle}>Consistency</Text>
          <View style={styles.statGrid}>
            <StatCard
              label="Current streak"
              value={String(summary.currentStreakWeeks)}
              unit={summary.currentStreakWeeks === 1 ? 'week' : 'weeks'}
              color={c.primary}
            />
            <StatCard
              label="Total workouts"
              value={String(summary.totalWorkouts)}
              unit={summary.totalWorkouts === 1 ? 'session' : 'sessions'}
              color={c.accent}
            />
            <StatCard
              label="Avg duration"
              value={formatDuration(summary.avgDurationMs)}
              unit="h:mm:ss"
              color={c.warning}
            />
            <StatCard
              label="Total volume"
              value={
                summary.totalVolume >= 1000
                  ? `${(summary.totalVolume / 1000).toFixed(1)}k`
                  : String(Math.round(summary.totalVolume))
              }
              unit="lb lifted"
              color={c.info}
            />
          </View>

          {/* ── Weekly volume trend ── */}
          <Text style={styles.sectionTitle}>Volume · last {VOLUME_WEEKS} weeks</Text>
          <View style={styles.card}>
            {totalWeekVol === 0 ? (
              <ChartEmpty text="No completed workouts in this window yet." />
            ) : (
              <>
                <MiniBarChart
                  values={weeks.map((w) => w.volume)}
                  labels={weeks.map((w) => shortDate(w.startDate))}
                  color={c.primary}
                />
                <Text style={styles.caption}>Each bar is one week's total volume (weight × reps).</Text>
              </>
            )}
          </View>

          {/* ── Recent PRs ── */}
          {prs.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Recent Records</Text>
              <View style={styles.prCard}>
                {prs.map((pr, i) => (
                  <View key={`${pr.name}-${i}`} style={[styles.prRow, i === prs.length - 1 && styles.prRowLast]}>
                    <Text style={styles.prName} numberOfLines={1}>
                      {pr.name}
                    </Text>
                    <Text style={styles.prValue}>
                      {pr.label} {pr.value}
                      <Text style={styles.prPrev}> · was {pr.prev}</Text>
                    </Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {/* ── Top movers ── */}
          {movers.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Trending Up</Text>
              {movers.map((card) => (
                <ProgressCardRow
                  key={card.key}
                  card={card}
                  onPress={() => navigation.navigate('ExerciseProgress', { name: card.name })}
                />
              ))}
            </>
          )}

          {/* ── Most trained ── */}
          {mostTrained.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Most Trained</Text>
              <View style={styles.card}>
                {mostTrained.map((ex, i) => (
                  <TouchableOpacity
                    key={ex.key}
                    style={[styles.trainedRow, i === mostTrained.length - 1 && styles.trainedRowLast]}
                    onPress={() => navigation.navigate('ExerciseProgress', { name: ex.name })}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.trainedName} numberOfLines={1}>
                      {ex.name}
                    </Text>
                    <Text style={styles.trainedMeta}>
                      {ex.sessions} {ex.sessions === 1 ? 'session' : 'sessions'}
                      {ex.bestWeight > 0 ? ` · ${ex.bestWeight} lb best` : ''}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function StatCard({
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
    <View style={styles.statCard}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statUnit}>{unit}</Text>
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

  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyText: { fontSize: 14, color: c.textMuted, textAlign: 'center', lineHeight: 20 },

  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: c.textFaint,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 8,
    marginBottom: 10,
  },

  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 16 },
  statCard: {
    flexBasis: '47%',
    flexGrow: 1,
    backgroundColor: c.card,
    borderRadius: 16,
    padding: 16,
    shadowColor: c.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  statValue: { fontSize: 26, fontWeight: '800', fontFamily: c.fontDisplay, fontVariant: ['tabular-nums'] },
  statUnit: { fontSize: 11, color: c.textFaint, marginTop: 2 },
  statLabel: { fontSize: 12, color: c.textMuted, marginTop: 6, fontWeight: '500' },

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
  caption: { fontSize: 11, color: c.textFaint, marginTop: 8, lineHeight: 16 },

  prCard: {
    backgroundColor: c.card,
    borderRadius: 16,
    paddingHorizontal: 16,
    marginBottom: 16,
    shadowColor: c.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  prRow: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
  },
  prRowLast: { borderBottomWidth: 0 },
  prName: { fontSize: 14, fontWeight: '700', color: c.text },
  prValue: { fontSize: 12.5, color: c.text, marginTop: 3, fontVariant: ['tabular-nums'] },
  prPrev: { color: c.textFaint, fontVariant: ['tabular-nums'] },

  trainedRow: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
  },
  trainedRowLast: { borderBottomWidth: 0 },
  trainedName: { fontSize: 14.5, fontWeight: '700', color: c.text },
  trainedMeta: { fontSize: 12, color: c.textMuted, marginTop: 2 },
});
