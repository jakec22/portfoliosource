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

interface Props {
  route: { params: { name: string } };
  navigation: any;
}

type Metric = 'topWeight' | 'best1RM' | 'volume';

const METRICS: { key: Metric; label: string; unit: string; color: string }[] = [
  { key: 'topWeight', label: 'Top Weight', unit: 'lb', color: '#10B981' },
  { key: 'best1RM', label: 'Est. 1RM', unit: 'lb', color: '#6366F1' },
  { key: 'volume', label: 'Volume', unit: 'lb', color: '#F59E0B' },
];

// Short axis date like "Jan 5" for chart endpoints.
function shortDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function metricValue(p: ExerciseSessionPoint, metric: Metric): number {
  return p[metric];
}

export function ExerciseProgressScreen({ route, navigation }: Props) {
  const { name } = route.params;
  const history = useStore((s) => s.workoutHistory);
  const [metric, setMetric] = useState<Metric>('topWeight');

  const series = useMemo(() => exerciseSeries(history, name), [history, name]);
  const bests = useMemo(() => exerciseBests(history, name), [history, name]);

  const active = METRICS.find((m) => m.key === metric)!;
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
              {METRICS.map((m) => {
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
                <Text style={[styles.delta, { color: delta >= 0 ? '#059669' : '#DC2626' }]}>
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
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    backgroundColor: '#fff',
  },
  back: { fontSize: 16, color: '#10B981', fontWeight: '600', width: 64 },
  backSpacer: { width: 64 },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '800', color: '#111827' },
  content: { padding: 16, paddingBottom: 40 },

  emptyCard: { backgroundColor: '#fff', borderRadius: 16, padding: 20 },
  emptyText: { fontSize: 14, color: '#6B7280', lineHeight: 20 },

  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  statValue: { fontSize: 20, fontWeight: '800', color: '#111827' },
  statLabel: { fontSize: 12, color: '#9CA3AF', marginTop: 4 },

  segment: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 4,
    marginTop: 4,
    marginBottom: 12,
  },
  segmentBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 9 },
  segmentBtnOn: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  segmentText: { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  segmentTextOn: { color: '#111827' },

  chartCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  delta: { fontSize: 13, fontWeight: '700', textAlign: 'center', marginTop: 8, fontVariant: ['tabular-nums'] },

  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#111827', marginTop: 16, marginBottom: 10 },
  logRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  logDate: { fontSize: 14, fontWeight: '700', color: '#111827' },
  logSets: { fontSize: 12, color: '#9CA3AF', marginTop: 3, fontVariant: ['tabular-nums'] },
  logMetric: { alignItems: 'flex-end' },
  logMetricValue: { fontSize: 17, fontWeight: '800', fontVariant: ['tabular-nums'] },
  logMetricLabel: { fontSize: 11, color: '#9CA3AF', marginTop: 1 },
});
