import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from '../store/useStore';
import { formatDuration, displayDate } from '../utils/date';
import { formatDuration as formatSetTime } from '../utils/duration';
import { sanitizeDecimal, sanitizeInteger } from '../utils/numberInput';
import { DurationInput } from '../components/DurationInput';
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
import { radius, space, type } from '../theme/tokens';
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
  const updateHistoryWorkoutSet = useStore((s) => s.updateHistoryWorkoutSet);

  // The set being corrected, plus its draft text. Held as a draft rather than
  // written through on each keystroke like the live workout screen: this is
  // editing the past, so a mis-tap on the wrong pill should be cancellable
  // without having already overwritten a recorded number.
  const [editing, setEditing] = useState<{
    exerciseId: string;
    setId: string;
    exerciseName: string;
    setNumber: number;
    isTime: boolean;
  } | null>(null);
  const [draftWeight, setDraftWeight] = useState('');
  const [draftReps, setDraftReps] = useState('');
  const [draftSeconds, setDraftSeconds] = useState(0);

  function beginEdit(
    exercise: WorkoutExercise,
    set: { id: string; weight: number; reps: number; durationSeconds?: number },
    index: number
  ) {
    const isTime = (exercise.mode ?? 'reps') === 'time';
    setDraftWeight(set.weight === 0 ? '' : String(set.weight));
    setDraftReps(set.reps === 0 ? '' : String(set.reps));
    setDraftSeconds(set.durationSeconds ?? 0);
    setEditing({
      exerciseId: exercise.id,
      setId: set.id,
      exerciseName: exercise.name,
      setNumber: index + 1,
      isTime,
    });
  }

  function saveEdit() {
    if (!editing) return;
    const weight = parseFloat(draftWeight);
    const reps = parseInt(draftReps, 10);
    updateHistoryWorkoutSet(sessionId, editing.exerciseId, editing.setId, {
      weight: Number.isNaN(weight) ? 0 : weight,
      ...(editing.isTime
        ? { durationSeconds: draftSeconds }
        : { reps: Number.isNaN(reps) ? 0 : reps }),
    });
    setEditing(null);
  }

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
        <Text style={styles.sectionHint}>Tap a set to correct it.</Text>
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
                {e.sets.map((s, i) => {
                  const isTime = (e.mode ?? 'reps') === 'time';
                  const measure = isTime ? formatSetTime(s.durationSeconds ?? 0) : `${s.reps}`;
                  return (
                    <TouchableOpacity
                      key={s.id}
                      style={[styles.setPill, s.completed && styles.setPillDone]}
                      onPress={() => beginEdit(e, s, i)}
                      activeOpacity={0.6}
                    >
                      <Text style={[styles.setPillText, s.completed && styles.setPillTextDone]}>
                        {s.weight ? `${s.weight}×${measure}` : measure}
                      </Text>
                    </TouchableOpacity>
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

      <Modal
        visible={editing != null}
        transparent
        animationType="fade"
        onRequestClose={() => setEditing(null)}
      >
        <KeyboardAvoidingView
          style={styles.sheetBackdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* Tapping the dimmed area behind the card dismisses without saving,
              matching the Cancel button rather than committing the draft. */}
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setEditing(null)}
          />
          {editing && (
            <View style={styles.sheet}>
              <Text style={styles.sheetTitle}>{editing.exerciseName}</Text>
              <Text style={styles.sheetSubtitle}>Set {editing.setNumber}</Text>

              <View style={styles.sheetFields}>
                <View style={styles.sheetField}>
                  <Text style={styles.sheetLabel}>Weight (lb)</Text>
                  <TextInput
                    style={styles.sheetInput}
                    value={draftWeight}
                    onChangeText={(v) => setDraftWeight(sanitizeDecimal(v))}
                    keyboardType="decimal-pad"
                    placeholder="0"
                    placeholderTextColor={c.textFaint}
                    autoFocus
                    selectTextOnFocus
                  />
                </View>

                <View style={styles.sheetField}>
                  <Text style={styles.sheetLabel}>{editing.isTime ? 'Time' : 'Reps'}</Text>
                  {editing.isTime ? (
                    <DurationInput
                      style={styles.sheetInput}
                      seconds={draftSeconds}
                      onChange={setDraftSeconds}
                      placeholder="0:00"
                      placeholderTextColor={c.textFaint}
                    />
                  ) : (
                    <TextInput
                      style={styles.sheetInput}
                      value={draftReps}
                      onChangeText={(v) => setDraftReps(sanitizeInteger(v))}
                      keyboardType="number-pad"
                      placeholder="0"
                      placeholderTextColor={c.textFaint}
                      selectTextOnFocus
                    />
                  )}
                </View>
              </View>

              <View style={styles.sheetActions}>
                <TouchableOpacity
                  style={[styles.sheetBtn, styles.sheetBtnGhost]}
                  onPress={() => setEditing(null)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.sheetBtnGhostText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.sheetBtn, styles.sheetBtnPrimary]}
                  onPress={saveEdit}
                  activeOpacity={0.85}
                >
                  <Text style={styles.sheetBtnPrimaryText}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </KeyboardAvoidingView>
      </Modal>
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md },
  emptyText: { ...type.body(c), color: c.textMuted },
  doneLink: { ...type.bodyStrong(c), color: c.primary },
  content: { padding: space.lg, paddingBottom: space.xxxl },

  completeBadge: {
    alignSelf: 'center',
    backgroundColor: c.primarySoft,
    borderRadius: radius.card,
    paddingHorizontal: space.lg,
    paddingVertical: space.xs,
    marginTop: space.md,
  },
  completeBadgeText: {
    ...type.overline(c),
    color: c.primaryDark,
  },
  title: { ...type.title(c), color: c.text, textAlign: 'center', marginTop: space.sm },
  subtitle: { ...type.body(c), color: c.textMuted, textAlign: 'center', marginBottom: space.lg },

  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md, marginBottom: space.xs },
  statCard: {
    flexBasis: '47%',
    flexGrow: 1,
    backgroundColor: c.card,
    borderRadius: radius.card,
    padding: space.lg,
    shadowColor: c.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  statValue: { ...type.title(c), fontVariant: ['tabular-nums'] },
  statLabel: { ...type.caption(c), color: c.textMuted, marginTop: space.xs },

  sectionTitle: {
    ...type.overline(c),
    color: c.textFaint,
    marginTop: space.lg,
    marginBottom: space.sm,
  },
  // The pills don't look tappable on their own, and a correction is the sort
  // of thing people go looking for only once they've already been annoyed.
  sectionHint: {
    ...type.caption(c),
    color: c.textFaint,
    marginTop: -6,
    marginBottom: space.sm,
  },

  vsCard: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: c.card,
    borderRadius: radius.card,
    paddingVertical: space.lg,
    shadowColor: c.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  vsStat: { alignItems: 'center' },
  vsValue: { ...type.subhead(c), fontVariant: ['tabular-nums'] },
  vsLabel: { ...type.caption(c), color: c.textMuted, marginTop: space.xs },

  hrCard: {
    backgroundColor: c.card,
    borderRadius: radius.card,
    padding: space.lg,
    shadowColor: c.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },

  prCard: {
    backgroundColor: c.card,
    borderRadius: radius.card,
    paddingHorizontal: space.lg,
    shadowColor: c.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  prRow: {
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
  },
  prRowLast: { borderBottomWidth: 0 },
  prName: { ...type.bodyStrong(c), color: c.text },
  prDetail: { ...type.caption(c), color: c.textMuted, marginTop: space.xxs, fontVariant: ['tabular-nums'] },

  exRow: {
    backgroundColor: c.card,
    borderRadius: radius.card,
    padding: space.lg,
    marginBottom: space.sm,
  },
  exNameRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  exName: { ...type.bodyStrong(c), color: c.text },
  exPrTag: {
    backgroundColor: c.primarySoft,
    borderRadius: radius.hairline,
    paddingHorizontal: space.sm,
    paddingVertical: space.xxs,
  },
  exPrTagText: { ...type.micro(c), fontFamily: c.fontBodyBold, color: c.primaryDark },
  exDetail: { ...type.caption(c), color: c.textFaint, marginTop: space.xxs },
  setPills: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, marginTop: space.sm },
  setPill: {
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
    borderRadius: radius.control,
    backgroundColor: c.cardMuted,
  },
  setPillDone: { backgroundColor: c.primarySoft },
  setPillText: { ...type.captionStrong(c), color: c.textFaint },
  setPillTextDone: { color: c.primaryDark },

  doneBtn: {
    backgroundColor: c.primary,
    borderRadius: radius.control,
    paddingVertical: space.lg,
    alignItems: 'center',
    marginTop: space.lg,
  },
  doneText: { ...type.bodyStrong(c), color: c.onPrimary },

  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.xl,
  },
  sheet: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: c.card,
    borderRadius: radius.sheet,
    padding: space.xl,
    shadowColor: c.shadow,
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  sheetTitle: { ...type.subhead(c), color: c.text },
  sheetSubtitle: { ...type.caption(c), color: c.textMuted, marginTop: space.xxs },

  sheetFields: { flexDirection: 'row', gap: space.md, marginTop: space.lg },
  sheetField: { flex: 1 },
  sheetLabel: { ...type.captionStrong(c), color: c.textMuted, marginBottom: space.xs },
  sheetInput: {
    ...type.subhead(c),
    backgroundColor: c.input,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radius.control,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    color: c.text,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },

  sheetActions: { flexDirection: 'row', gap: space.sm, marginTop: space.lg },
  sheetBtn: { flex: 1, borderRadius: radius.control, paddingVertical: space.md, alignItems: 'center' },
  sheetBtnGhost: { backgroundColor: c.cardMuted },
  sheetBtnGhostText: { ...type.bodyStrong(c), color: c.textMuted },
  sheetBtnPrimary: { backgroundColor: c.primary },
  sheetBtnPrimaryText: { ...type.bodyStrong(c), color: c.onPrimary },
});
