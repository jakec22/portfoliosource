import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from '../store/useStore';
import { formatDuration, displayDate } from '../utils/date';
import { formatDuration as formatSetTime } from '../utils/duration';
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
        {!viewOnly && (
          <View style={styles.completeBadge}>
            <Text style={styles.completeBadgeText}>Completed</Text>
          </View>
        )}
        <Text style={styles.title}>{session.name}</Text>
        <Text style={styles.subtitle}>{displayDate(session.date)}</Text>

        {/* Headline stats */}
        <View style={styles.statGrid}>
          <StatCard label="Duration" value={formatDuration(durationMs)} color={c.primary} c={c} />
          <StatCard label="Volume" value={`${Math.round(totalVolume).toLocaleString()} lb`} color={c.accent} c={c} />
          <StatCard label="Sets" value={`${completedSets}/${totalSets}`} color={c.warning} c={c} />
          <StatCard label="Exercises" value={String(session.exercises.length)} color={c.info} c={c} />
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
            <Text style={styles.sectionTitle}>Personal Records</Text>
            <View style={styles.prCard}>
              {prs.map((pr, i) => (
                <View key={pr.name} style={[styles.prRow, i === prs.length - 1 && styles.prRowLast]}>
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
          const isPR = prNames.has(normalizeExerciseName(e.name));
          return (
            <View key={e.id} style={styles.exRow}>
              <View style={{ flex: 1 }}>
                <View style={styles.exNameRow}>
                  <Text style={styles.exName}>{e.name}</Text>
                  {isPR && (
                    <View style={styles.exPrTag}>
                      <Text style={styles.exPrTagText}>PR</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.exDetail}>
                  {done.length}/{e.sets.length} sets
                  {vol > 0 ? ` · ${Math.round(vol).toLocaleString()} lb` : ''}
                </Text>
              </View>
              <View style={styles.setPills}>
                {e.sets.map((s) => {
                  const isTime = (e.mode ?? 'reps') === 'time';
                  const measure = isTime ? formatSetTime(s.durationSeconds ?? 0) : `${s.reps}`;
                  return (
                    <View
                      key={s.id}
                      style={[styles.setPill, s.completed && styles.setPillDone]}
                    >
                      <Text style={[styles.setPillText, s.completed && styles.setPillTextDone]}>
                        {s.weight ? `${s.weight}×${measure}` : measure}
                      </Text>
                    </View>
                  );
                })}
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

function StatCard({
  label,
  value,
  color,
  c,
}: {
  label: string;
  value: string;
  color: string;
  c: Theme;
}) {
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyText: { fontSize: 16, color: c.textMuted },
  doneLink: { fontSize: 16, color: c.primary, fontWeight: '700' },
  content: { padding: 16, paddingBottom: 40 },

  completeBadge: {
    alignSelf: 'center',
    backgroundColor: c.primarySoft,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 5,
    marginTop: 12,
  },
  completeBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: c.primaryDark,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  title: { fontSize: 24, fontWeight: '800', color: c.text, textAlign: 'center', marginTop: 10 },
  subtitle: { fontSize: 14, color: c.textMuted, textAlign: 'center', marginBottom: 20 },

  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 4 },
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
  statValue: { fontSize: 24, fontWeight: '800', fontFamily: c.fontDisplay, fontVariant: ['tabular-nums'] },
  statLabel: { fontSize: 12, color: c.textMuted, marginTop: 6, fontWeight: '500' },

  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: c.textFaint,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 20,
    marginBottom: 10,
  },
  hrCard: {
    backgroundColor: c.card,
    borderRadius: 16,
    padding: 16,
    shadowColor: c.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },

  prCard: {
    backgroundColor: c.card,
    borderRadius: 16,
    paddingHorizontal: 16,
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
  prName: { fontSize: 15, fontWeight: '700', color: c.text },
  prDetail: { fontSize: 13, color: c.textMuted, marginTop: 2, fontVariant: ['tabular-nums'] },

  exRow: {
    backgroundColor: c.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  exNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  exName: { fontSize: 15, fontWeight: '700', color: c.text },
  exPrTag: {
    backgroundColor: c.primarySoft,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  exPrTagText: { fontSize: 10, fontWeight: '800', color: c.primaryDark, letterSpacing: 0.4 },
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
