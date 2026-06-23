import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from '../store/useStore';
import { formatDuration } from '../utils/date';

interface Props {
  route: { params: { sessionId: string } };
  navigation: any;
}

export function WorkoutSummaryScreen({ route, navigation }: Props) {
  const { sessionId } = route.params;
  const session = useStore((s) => s.workoutHistory.find((w) => w.id === sessionId));

  function done() {
    navigation.popToTop();
  }

  if (!session) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.emptyText}>Workout not found.</Text>
          <TouchableOpacity onPress={done}>
            <Text style={styles.doneLink}>Back to Exercise</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const durationMs = (session.completedAt ?? session.startedAt) - session.startedAt;
  const totalSets = session.exercises.reduce((n, e) => n + e.sets.length, 0);
  const completedSets = session.exercises.reduce(
    (n, e) => n + e.sets.filter((s) => s.completed).length,
    0
  );
  // Volume = sum of weight × reps over completed sets.
  const totalVolume = session.exercises.reduce(
    (n, e) =>
      n + e.sets.filter((s) => s.completed).reduce((v, s) => v + s.weight * s.reps, 0),
    0
  );

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.bigCheck}>🎉</Text>
        <Text style={styles.title}>Workout Complete</Text>
        <Text style={styles.subtitle}>{session.name}</Text>

        {/* Headline stats */}
        <View style={styles.statsRow}>
          <Stat label="Duration" value={formatDuration(durationMs)} />
          <Stat label="Exercises" value={String(session.exercises.length)} />
        </View>
        <View style={styles.statsRow}>
          <Stat label="Sets done" value={`${completedSets}/${totalSets}`} />
          <Stat label="Volume" value={`${Math.round(totalVolume).toLocaleString()} lb`} />
        </View>

        {/* Per-exercise breakdown */}
        <Text style={styles.sectionTitle}>Breakdown</Text>
        {session.exercises.map((e) => {
          const done = e.sets.filter((s) => s.completed);
          const vol = done.reduce((v, s) => v + s.weight * s.reps, 0);
          return (
            <View key={e.id} style={styles.exRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.exName}>{e.name}</Text>
                <Text style={styles.exDetail}>
                  {done.length}/{e.sets.length} sets
                  {vol > 0 ? ` · ${Math.round(vol).toLocaleString()} lb` : ''}
                </Text>
              </View>
              <View style={styles.setPills}>
                {e.sets.map((s) => (
                  <View
                    key={s.id}
                    style={[styles.setPill, s.completed && styles.setPillDone]}
                  >
                    <Text style={[styles.setPillText, s.completed && styles.setPillTextDone]}>
                      {s.weight ? `${s.weight}×${s.reps}` : `${s.reps}`}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          );
        })}

        <TouchableOpacity style={styles.doneBtn} onPress={done} activeOpacity={0.85}>
          <Text style={styles.doneText}>Done</Text>
        </TouchableOpacity>
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyText: { fontSize: 16, color: '#6B7280' },
  doneLink: { fontSize: 16, color: '#10B981', fontWeight: '700' },
  content: { padding: 16, paddingBottom: 40 },
  bigCheck: { fontSize: 48, textAlign: 'center', marginTop: 12 },
  title: { fontSize: 24, fontWeight: '800', color: '#111827', textAlign: 'center', marginTop: 8 },
  subtitle: { fontSize: 15, color: '#6B7280', textAlign: 'center', marginBottom: 20 },

  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  statValue: { fontSize: 22, fontWeight: '800', color: '#10B981' },
  statLabel: { fontSize: 12, color: '#9CA3AF', marginTop: 4 },

  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#111827', marginTop: 16, marginBottom: 10 },
  exRow: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  exName: { fontSize: 15, fontWeight: '700', color: '#111827' },
  exDetail: { fontSize: 12, color: '#9CA3AF', marginTop: 3 },
  setPills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  setPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  setPillDone: { backgroundColor: '#D1FAE5' },
  setPillText: { fontSize: 12, color: '#9CA3AF', fontWeight: '600' },
  setPillTextDone: { color: '#059669' },

  doneBtn: {
    backgroundColor: '#10B981',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  doneText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
