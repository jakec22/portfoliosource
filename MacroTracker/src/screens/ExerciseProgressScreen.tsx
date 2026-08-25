import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from '../store/useStore';
import { displayDate } from '../utils/date';
import {
  exerciseSeries,
  exerciseBests,
  formatPerformedSets,
  type ExerciseSessionPoint,
} from '../utils/exerciseHistory';
import { ProgressLineChart, ChartEmpty } from '../components/ProgressLineChart';
import { useTheme } from '../theme/useTheme';
import type { Theme } from '../theme';

interface Props {
  route: { params: { name: string } };
  navigation: any;
}

type Metric = 'topWeight' | 'best1RM' | 'volume';

function getMetrics(c: Theme): { key: Metric; label: string; unit: string; color: string }[] {
  return [
    { key: 'topWeight', label: 'Top Weight', unit: 'lb', color: c.primary },
    { key: 'best1RM', label: 'Est. 1RM', unit: 'lb', color: c.accent },
    { key: 'volume', label: 'Volume', unit: 'lb', color: c.warning },
  ];
}

// Short axis date like "Jan 5" for chart endpoints.
function shortDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function metricValue(p: ExerciseSessionPoint, metric: Metric): number {
  return p[metric];
}

export function ExerciseProgressScreen({ route, navigation }: Props) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { name } = route.params;
  const history = useStore((s) => s.workoutHistory);
  const [metric, setMetric] = useState<Metric>('topWeight');

  const series = useMemo(() => exerciseSeries(history, name), [history, name]);
  const bests = useMemo(() => exerciseBests(history, name), [history, name]);
  const metrics = useMemo(() => getMetrics(c), [c]);

  const active = metrics.find((m) => m.key === metric)!;
  const values = series.map((p) => metricValue(p, metric));
  const labels = series.map((p) => shortDate(p.date));

  // Change since the first recorded session, for the selected metric.
  const delta =
    values.length >= 2 ? values[values.length - 1] - values[0] : 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.back}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {name}
        </Text>
        <View style={styles.backSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {series.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>
              No logged sets for this exercise yet. Finish a workout that includes
              it to start tracking progress.
            </Text>
          </View>
        ) : (
          <>
            {/* Bests */}
            <View style={styles.statsRow}>
              <Stat label="Top set" value={`${bests.maxWeight} lb`} />
              <Stat label="Est. 1RM" value={`${Math.round(bests.best1RM)} lb`} />
            </View>
            <View style={styles.statsRow}>
              <Stat label="Best volume" value={`${bests.maxVolume.toLocaleString()} lb`} />
              <Stat label="Sessions" value={String(series.length)} />
            </View>

            {/* Metric toggle */}
            <View style={styles.segment}>
              {metrics.map((m) => {
                const on = m.key === metric;
                return (
                  <TouchableOpacity
                    key={m.key}
                    style={[styles.segmentBtn, on && styles.segmentBtnOn]}
                    onPress={() => setMetric(m.key)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.segmentText, on && styles.segmentTextOn]}>{m.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Chart */}
            <View style={styles.chartCard}>
              {values.length < 2 ? (
                <ChartEmpty text="One session so far — log another to see a trend." />
              ) : (
                <ProgressLineChart values={values} labels={labels} color={active.color} />
              )}
              {values.length >= 2 && (
                <Text style={[styles.delta, { color: delta >= 0 ? c.primaryDark : c.danger }]}>
                  {delta >= 0 ? '▲' : '▼'} {Math.abs(delta).toLocaleString()} {active.unit} since{' '}
                  {shortDate(series[0].date)}
                </Text>
              )}
            </View>

            {/* Per-session log, newest first */}
            <Text style={styles.sectionTitle}>History</Text>
            {[...series].reverse().map((p) => (
              <View key={p.sessionId} style={styles.logRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.logDate}>{displayDate(p.date)}</Text>
                  <Text style={styles.logSets}>{formatPerformedSets(p.sets)}</Text>
                </View>
                <View style={styles.logMetric}>
                  <Text style={[styles.logMetricValue, { color: active.color }]}>
                    {metricValue(p, metric).toLocaleString()}
                  </Text>
                  <Text style={styles.logMetricLabel}>{active.unit}</Text>
                </View>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
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

  emptyCard: { backgroundColor: c.card, borderRadius: 16, padding: 20 },
  emptyText: { fontSize: 14, color: c.textMuted, lineHeight: 20 },

  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  statCard: {
    flex: 1,
    backgroundColor: c.card,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: c.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  statValue: { fontSize: 20, fontWeight: '800', color: c.text },
  statLabel: { fontSize: 12, color: c.textFaint, marginTop: 4 },

  segment: {
    flexDirection: 'row',
    backgroundColor: c.cardMuted,
    borderRadius: 12,
    padding: 4,
    marginTop: 4,
    marginBottom: 12,
  },
  segmentBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 9 },
  segmentBtnOn: {
    backgroundColor: c.card,
    shadowColor: c.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  segmentText: { fontSize: 13, fontWeight: '600', color: c.textMuted },
  segmentTextOn: { color: c.text },

  chartCard: {
    backgroundColor: c.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 8,
    shadowColor: c.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  delta: { fontSize: 13, fontWeight: '700', textAlign: 'center', marginTop: 8, fontVariant: ['tabular-nums'] },

  sectionTitle: { fontSize: 18, fontWeight: '700', color: c.text, marginTop: 16, marginBottom: 10 },
  logRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  logDate: { fontSize: 14, fontWeight: '700', color: c.text },
  logSets: { fontSize: 12, color: c.textFaint, marginTop: 3, fontVariant: ['tabular-nums'] },
  logMetric: { alignItems: 'flex-end' },
  logMetricValue: { fontSize: 17, fontWeight: '800', fontVariant: ['tabular-nums'] },
  logMetricLabel: { fontSize: 11, color: c.textFaint, marginTop: 1 },
});
