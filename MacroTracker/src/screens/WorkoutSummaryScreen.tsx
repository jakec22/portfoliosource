import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from '../store/useStore';
import { formatDuration, displayDate } from '../utils/date';
import {
  detectSessionPRs,
  normalizeExerciseName,
  type ExercisePR,
} from '../utils/exerciseHistory';
import { HeartRateGraph } from '../components/HeartRateGraph';
import { useTheme } from '../theme/useTheme';
import type { Theme } from '../theme';

// Pick the most impressive record to headline for a given exercise PR.
function prHeadline(pr: ExercisePR): string {
  if (pr.new1RM != null) return `Est. 1RM ${pr.new1RM} lb · prev ${pr.prev1RM}`;
  if (pr.newWeight != null) return `Top set ${pr.newWeight} lb · prev ${pr.prevWeight}`;
  if (pr.newVolume != null)
    return `Volume ${pr.newVolume.toLocaleString()} lb · prev ${pr.prevVolume?.toLocaleString()}`;
  return 'New record';
}

interface Props {
  route: { params: { sessionId: string; viewOnly?: boolean } };
  navigation: any;
}

export function WorkoutSummaryScreen({ route, navigation }: Props) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { sessionId, viewOnly } = route.params;
  const session = useStore((s) => s.workoutHistory.find((w) => w.id === sessionId));
  const history = useStore((s) => s.workoutHistory);

  // PRs are only meaningful for a just-finished session (compared against all
  // prior history). Skip when re-viewing an old workout, where "prior" would
  // include later sessions and be misleading.
  const prs = useMemo(
    () => (session && !viewOnly ? detectSessionPRs(session, history) : []),
    [session, history, viewOnly]
  );
  const prNames = useMemo(
    () => new Set(prs.map((p) => normalizeExerciseName(p.name))),
    [prs]
  );

  function done() {
    // Viewing a past workout returns to the list; finishing pops the stack.
    if (viewOnly) navigation.goBack();
    else navigation.popToTop();
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
        <Text style={styles.bigCheck}>{viewOnly ? '🏋️' : '🎉'}</Text>
        <Text style={styles.title}>{viewOnly ? session.name : 'Workout Complete'}</Text>
        <Text style={styles.subtitle}>
          {viewOnly ? displayDate(session.date) : session.name}
        </Text>

        {/* Headline stats */}
        <View style={styles.statsRow}>
          <Stat label="Duration" value={formatDuration(durationMs)} />
          <Stat label="Exercises" value={String(session.exercises.length)} />
        </View>
        <View style={styles.statsRow}>
          <Stat label="Sets done" value={`${completedSets}/${totalSets}`} />
          <Stat label="Volume" value={`${Math.round(totalVolume).toLocaleString()} lb`} />
        </View>

        {/* Heart rate (only when samples were captured) */}
        {session.heartRateSamples && session.heartRateSamples.length >= 2 && (
          <>
            <Text style={styles.sectionTitle}>Heart Rate</Text>
            <View style={styles.hrCard}>
              <HeartRateGraph
                samples={session.heartRateSamples}
                startMs={session.startedAt}
                endMs={session.completedAt ?? session.startedAt}
              />
            </View>
          </>
        )}

        {/* Personal records hit this session */}
        {prs.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Personal Records 🏆</Text>
            <View style={styles.prCard}>
              {prs.map((pr) => (
                <View key={pr.name} style={styles.prRow}>
                  <Text style={styles.prName}>{pr.name}</Text>
                  <Text style={styles.prDetail}>{prHeadline(pr)}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* Per-exercise breakdown */}
        <Text style={styles.sectionTitle}>Breakdown</Text>
        {session.exercises.map((e) => {
          const done = e.sets.filter((s) => s.completed);
          const vol = done.reduce((v, s) => v + s.weight * s.reps, 0);
          return (
            <View key={e.id} style={styles.exRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.exName}>
                  {e.name}
                  {prNames.has(normalizeExerciseName(e.name)) ? '  🏆' : ''}
                </Text>
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
          <Text style={styles.doneText}>{viewOnly ? 'Close' : 'Done'}</Text>
        </TouchableOpacity>
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyText: { fontSize: 16, color: c.textMuted },
  doneLink: { fontSize: 16, color: c.primary, fontWeight: '700' },
  content: { padding: 16, paddingBottom: 40 },
  bigCheck: { fontSize: 48, textAlign: 'center', marginTop: 12 },
  title: { fontSize: 24, fontWeight: '800', color: c.text, textAlign: 'center', marginTop: 8 },
  subtitle: { fontSize: 15, color: c.textMuted, textAlign: 'center', marginBottom: 20 },

  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  statCard: {
    flex: 1,
    backgroundColor: c.card,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    shadowColor: c.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  statValue: { fontSize: 22, fontWeight: '800', color: c.primary },
  statLabel: { fontSize: 12, color: c.textFaint, marginTop: 4 },

  sectionTitle: { fontSize: 18, fontWeight: '700', color: c.text, marginTop: 16, marginBottom: 10 },
  hrCard: {
    backgroundColor: c.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 4,
    shadowColor: c.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  prCard: {
    backgroundColor: c.warningSoft,
    borderWidth: 1,
    borderColor: c.scheme === 'dark' ? 'rgba(245,158,11,0.4)' : '#FDE68A',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 4,
    marginBottom: 4,
  },
  prRow: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.scheme === 'dark' ? 'rgba(245,158,11,0.4)' : '#FDE68A',
  },
  prName: { fontSize: 15, fontWeight: '700', color: c.scheme === 'dark' ? c.warning : '#92400E' },
  prDetail: { fontSize: 13, color: c.scheme === 'dark' ? c.textMuted : '#B45309', marginTop: 2, fontVariant: ['tabular-nums'] },

  exRow: {
    backgroundColor: c.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  exName: { fontSize: 15, fontWeight: '700', color: c.text },
  exDetail: { fontSize: 12, color: c.textFaint, marginTop: 3 },
  setPills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  setPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: c.cardMuted,
  },
  setPillDone: { backgroundColor: c.primarySoft },
  setPillText: { fontSize: 12, color: c.textFaint, fontWeight: '600' },
  setPillTextDone: { color: c.primaryDark },

  doneBtn: {
    backgroundColor: c.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  doneText: { color: c.onPrimary, fontWeight: '700', fontSize: 16 },
});
