import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from '../store/useStore';
import { formatDuration, displayDate } from '../utils/date';
import { formatDuration as formatSetTime } from '../utils/duration';
import {
  detectSessionPRs,
  estimate1RM,
  normalizeExerciseName,
  type ExercisePR,
} from '../utils/exerciseHistory';
import { sessionVolume } from '../utils/analytics';
import {
  activeEnergyAvailable,
  requestActiveEnergyPermission,
  queryActiveEnergyForWorkout,
} from '../services/activeEnergy';
import { HeartRateGraph } from '../components/HeartRateGraph';
import { useTheme } from '../theme/useTheme';
import type { Theme } from '../theme';
import type { WorkoutExercise } from '../types';

// The heaviest completed working set by estimated 1RM — the single most
// representative number for "how strong was this exercise today."
function bestSet(ex: WorkoutExercise): { weight: number; reps: number } | null {
  const candidates = ex.sets.filter((s) => s.completed && s.type !== 'warmup' && s.reps > 0);
  if (candidates.length === 0) return null;
  return candidates.reduce((best, s) =>
    estimate1RM(s.weight, s.reps) > estimate1RM(best.weight, best.reps) ? s : best
  );
}

// "+320 lb" / "−40 lb" / "±0 lb" style delta label.
function deltaLabel(diff: number, unit: string, decimals = 0): string {
  const rounded = Number(diff.toFixed(decimals));
  if (rounded === 0) return `±0${unit}`;
  const sign = rounded > 0 ? '+' : '−';
  return `${sign}${Math.abs(rounded).toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}${unit}`;
}

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

  // The most recent earlier session of this same workout (matched by
  // template when the workout came from one, otherwise by name) — the basis
  // for the "vs last time" comparison below.
  const previousSession = useMemo(() => {
    if (!session) return null;
    const candidates = history.filter(
      (w) =>
        w.id !== session.id &&
        w.completedAt != null &&
        w.startedAt < session.startedAt &&
        (session.templateId ? w.templateId === session.templateId : w.name === session.name)
    );
    if (candidates.length === 0) return null;
    return candidates.reduce((latest, w) => (w.startedAt > latest.startedAt ? w : latest));
  }, [session, history]);

  // Active Energy Burned from HealthKit, scoped to this workout's actual
  // start/end — null (hidden) with no Watch/permission/data, never a fake 0.
  const [calories, setCalories] = useState<number | null>(null);
  useEffect(() => {
    if (!session?.completedAt || !activeEnergyAvailable()) return;
    let cancelled = false;
    requestActiveEnergyPermission().then((granted) => {
      if (!granted || cancelled) return;
      queryActiveEnergyForWorkout(session.startedAt, session.completedAt!).then((kcal) => {
        if (!cancelled) setCalories(kcal);
      });
    });
    return () => {
      cancelled = true;
    };
  }, [session?.id]);

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
  const totalReps = session.exercises.reduce(
    (n, e) => n + e.sets.filter((s) => s.completed).reduce((r, s) => r + (s.reps || 0), 0),
    0
  );
  const totalVolume = sessionVolume(session);

  const prevDurationMs = previousSession
    ? (previousSession.completedAt ?? previousSession.startedAt) - previousSession.startedAt
    : null;
  const prevVolume = previousSession ? sessionVolume(previousSession) : null;
  const prevCompletedSets = previousSession
    ? previousSession.exercises.reduce((n, e) => n + e.sets.filter((s) => s.completed).length, 0)
    : null;

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
          <StatCard label="Reps" value={String(totalReps)} color={c.macroProtein} c={c} />
          <StatCard label="Exercises" value={String(session.exercises.length)} color={c.info} c={c} />
          {calories != null && (
            <StatCard label="Active Energy" value={`${calories} kcal`} color={c.danger} c={c} />
          )}
        </View>

        {/* vs. the last time this workout was done */}
        {previousSession && prevDurationMs != null && prevVolume != null && prevCompletedSets != null && (
          <>
            <Text style={styles.sectionTitle}>vs. Last Time ({displayDate(previousSession.date)})</Text>
            <View style={styles.vsCard}>
              <VsStat
                label="Volume"
                delta={deltaLabel(totalVolume - prevVolume, ' lb')}
                positive={totalVolume >= prevVolume}
                c={c}
              />
              <VsStat
                label="Duration"
                delta={deltaLabel((durationMs - prevDurationMs) / 60000, ' min')}
                // Shorter duration for the same or more work reads as an
                // improvement (denser session), so this one inverts.
                positive={durationMs <= prevDurationMs}
                c={c}
              />
              <VsStat
                label="Sets"
                delta={deltaLabel(completedSets - prevCompletedSets, '')}
                positive={completedSets >= prevCompletedSets}
                c={c}
              />
            </View>
          </>
        )}

        {/* Heart rate (only when samples were captured). HeartRateGraph
            already renders its own Avg/Peak/Low row above the chart. */}
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
          const best = bestSet(e);
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
                  {best ? ` · best ${best.weight}×${best.reps}` : ''}
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

function VsStat({
  label,
  delta,
  positive,
  c,
}: {
  label: string;
  delta: string;
  positive: boolean;
  c: Theme;
}) {
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <View style={styles.vsStat}>
      <Text style={[styles.vsValue, { color: positive ? c.primary : c.danger }]}>{delta}</Text>
      <Text style={styles.vsLabel}>{label}</Text>
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

  vsCard: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: c.card,
    borderRadius: 16,
    paddingVertical: 16,
    shadowColor: c.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  vsStat: { alignItems: 'center' },
  vsValue: { fontSize: 18, fontWeight: '800', fontVariant: ['tabular-nums'] },
  vsLabel: { fontSize: 12, color: c.textMuted, marginTop: 4, fontWeight: '500' },

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
