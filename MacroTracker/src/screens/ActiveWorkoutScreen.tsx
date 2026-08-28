import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  InputAccessoryView,
  ActionSheetIOS,
  Platform,
  Alert,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { useKeepAwake } from 'expo-keep-awake';
import { useStore } from '../store/useStore';
import type { SetType } from '../types';
import { formatDuration, relativeDateLabel } from '../utils/date';
import { lastPerformance } from '../utils/exerciseHistory';
import { DurationInput } from '../components/DurationInput';
import { WorkoutStatusBar } from '../components/WorkoutStatusBar';
import { ExercisePickerModal } from '../components/ExercisePickerModal';
import { getHeartRateMonitor } from '../services/heartRate';
import { subscribeWatchHeartRate, getWorkoutHrSamples } from '../services/watch';
import { useTheme } from '../theme/useTheme';
import type { Theme } from '../theme';

type ActiveStyles = ReturnType<typeof makeStyles>;

interface Props {
  navigation: any;
}

// Label + colors for the left-side set bubble. Normal sets show their number;
// tagged sets show a colored letter (W / F / D).
function setBadgeInfo(type: SetType | undefined, index: number, styles: ActiveStyles) {
  switch (type) {
    case 'warmup':
      return { label: 'W', bubble: styles.badgeWarmup, text: styles.badgeWarmupText };
    case 'failure':
      return { label: 'F', bubble: styles.badgeFailure, text: styles.badgeFailureText };
    case 'dropset':
      return { label: 'D', bubble: styles.badgeDropset, text: styles.badgeDropsetText };
    default:
      return { label: String(index + 1), bubble: styles.badgeNormal, text: styles.badgeNormalText };
  }
}

export function ActiveWorkoutScreen({ navigation }: Props) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  // Keep the screen on during a workout: an auto-locking / sleeping screen
  // backgrounds the app, which can suspend timers, stall the watch sync, and
  // (under memory pressure) get the app killed and cold-started.
  useKeepAwake();
  const workout = useStore((s) => s.activeWorkout);
  const addWorkoutExercise = useStore((s) => s.addWorkoutExercise);
  const removeWorkoutExercise = useStore((s) => s.removeWorkoutExercise);
  const addWorkoutSet = useStore((s) => s.addWorkoutSet);
  const updateWorkoutSet = useStore((s) => s.updateWorkoutSet);
  const setExerciseMode = useStore((s) => s.setExerciseMode);
  const toggleWorkoutSet = useStore((s) => s.toggleWorkoutSet);
  const removeWorkoutSet = useStore((s) => s.removeWorkoutSet);
  const reorderWorkoutExercise = useStore((s) => s.reorderWorkoutExercise);
  const finishWorkout = useStore((s) => s.finishWorkout);
  const cancelWorkout = useStore((s) => s.cancelWorkout);
  const completeAllWorkoutSets = useStore((s) => s.completeAllWorkoutSets);
  const attachWorkoutHeartRate = useStore((s) => s.attachWorkoutHeartRate);
  // Past sessions, used to show each exercise's previous performance inline.
  const workoutHistory = useStore((s) => s.workoutHistory);

  // Live heart rate from the Apple Watch (via HealthKit) during the workout.
  const [showExercisePicker, setShowExercisePicker] = useState(false);
  const [liveBpm, setLiveBpm] = useState<number | null>(null);
  const [bpmUpdatedAt, setBpmUpdatedAt] = useState<number | null>(null);
  const monitorRef = useRef(getHeartRateMonitor());
  const workoutId = workout?.id;

  // Live heart rate for the on-screen readout. The actual samples that get
  // attached to the session are buffered centrally in useWatchWorkout (so they
  // survive this screen unmounting / a watch-driven finish); here we only drive
  // the live display.
  useEffect(() => {
    if (!workoutId) return;
    const monitor = monitorRef.current;
    let active = true;
    (async () => {
      await monitor.requestPermissions();
      if (!active) return;
      monitor.start((sample) => {
        setLiveBpm(sample.bpm);
        setBpmUpdatedAt(sample.timestamp);
      });
    })();
    return () => {
      active = false;
      monitor.stop();
    };
  }, [workoutId]);

  // Live heart rate streamed from the Apple Watch during the workout (on-wrist,
  // more accurate). Updates the live display; sample buffering happens centrally.
  useEffect(() => {
    if (!workoutId) return;
    return subscribeWatchHeartRate((bpm, timestamp) => {
      setLiveBpm(bpm);
      setBpmUpdatedAt(timestamp);
    });
  }, [workoutId]);

  // Tracks which set + field is currently focused for the fill-all toolbar.
  const [focusCtx, setFocusCtx] = useState<{
    exId: string;
    setId: string;
    field: 'weight' | 'reps';
  } | null>(null);

  // Raw in-progress text for the weight input, keyed by set id. Needed because
  // the field is otherwise derived from the numeric store value every render —
  // typing "12." parses to 12, which immediately redraws as "12" and strips the
  // trailing dot before the next digit lands, so a decimal like 12.5 could never
  // actually form. Cleared on blur so the display reformats from the store.
  const [weightDrafts, setWeightDrafts] = useState<Record<string, string>>({});

  function sanitizeDecimal(v: string): string {
    let cleaned = v.replace(/[^0-9.]/g, '');
    const firstDot = cleaned.indexOf('.');
    if (firstDot !== -1) {
      cleaned = cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, '');
    }
    return cleaned;
  }

  function fillAll() {
    if (!focusCtx || !workout) return;
    const ex = workout.exercises.find((e) => e.id === focusCtx.exId);
    if (!ex) return;
    const src = ex.sets.find((s) => s.id === focusCtx.setId);
    if (!src) return;
    const value = src[focusCtx.field];
    ex.sets.forEach((s) => {
      if (s.id !== focusCtx.setId) {
        updateWorkoutSet(focusCtx.exId, s.id, { [focusCtx.field]: value });
      }
    });
  }

  // Per-set type picker: tap the left bubble to tag a set.
  function pickSetType(exId: string, setId: string) {
    const labels = ['Normal', 'Warm up', 'Failure', 'Drop set'];
    const types: SetType[] = ['normal', 'warmup', 'failure', 'dropset'];
    const apply = (i: number) => {
      if (i >= 0 && i < types.length) updateWorkoutSet(exId, setId, { type: types[i] });
    };
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { title: 'Set type', options: [...labels, 'Cancel'], cancelButtonIndex: labels.length },
        apply
      );
    } else {
      Alert.alert('Set type', undefined, [
        ...labels.map((label, i) => ({ text: label, onPress: () => apply(i) })),
        { text: 'Cancel', style: 'cancel' as const },
      ]);
    }
  }

  // Elapsed workout timer, ticking every second from the session start.
  const startedAt = workout?.startedAt;
  const [elapsed, setElapsed] = useState(startedAt ? Date.now() - startedAt : 0);
  useEffect(() => {
    if (!startedAt) return;
    const id = setInterval(() => setElapsed(Date.now() - startedAt), 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  if (!workout) {
    // Nothing in progress (e.g. just finished) — bounce back to the list.
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No active workout.</Text>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.save}>Go back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const totalSets = workout.exercises.reduce((n, e) => n + e.sets.length, 0);
  const doneSets = workout.exercises.reduce(
    (n, e) => n + e.sets.filter((s) => s.completed).length,
    0
  );

  function promptAddExercise() {
    setShowExercisePicker(true);
  }

  // Save the session and leave to the summary. When `completeAll` is set, every
  // remaining set is marked done first so the saved workout reflects that.
  async function finishAndSummarize(completeAll: boolean) {
    const id = workout?.id;
    const startedAt = workout?.startedAt ?? Date.now();
    if (completeAll) completeAllWorkoutSets();
    // Stop live tracking — heart-rate capture ends with the workout.
    const monitor = monitorRef.current;
    monitor.stop();
    finishWorkout();
    if (id) {
      try {
        // Prefer the dense end-of-workout batch query (HealthKit); fall
        // back to the samples the watch streamed live (buffered centrally).
        const queried = await monitor.query(startedAt, Date.now());
        const samples = queried.length ? queried : getWorkoutHrSamples();
        if (samples.length) attachWorkoutHeartRate(id, samples);
      } catch {
        const buffered = getWorkoutHrSamples();
        if (buffered.length) attachWorkoutHeartRate(id, buffered);
      }
      navigation.replace('WorkoutSummary', { sessionId: id });
    } else {
      navigation.goBack();
    }
  }

  function handleFinish() {
    const remaining = totalSets - doneSets;
    // Offer to check off anything left unfinished before saving.
    if (remaining > 0) {
      Alert.alert(
        'Finish workout',
        `You have ${remaining} unchecked ${remaining === 1 ? 'set' : 'sets'}. Mark ${
          remaining === 1 ? 'it' : 'them'
        } complete before finishing?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Finish anyway', onPress: () => finishAndSummarize(false) },
          { text: 'Complete all & finish', onPress: () => finishAndSummarize(true) },
        ]
      );
      return;
    }
    Alert.alert('Finish workout', 'Save this workout and end the session?', [
      { text: 'Keep going', style: 'cancel' },
      { text: 'Finish', onPress: () => finishAndSummarize(false) },
    ]);
  }

  function handleCancel() {
    Alert.alert('Cancel workout', 'Discard this workout? This cannot be undone.', [
      { text: 'Keep going', style: 'cancel' },
      {
        text: 'Discard',
        style: 'destructive',
        onPress: () => {
          cancelWorkout();
          navigation.goBack();
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleCancel}>
          <Text style={styles.cancel}>Cancel</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.timer}>{formatDuration(elapsed)}</Text>
          <Text style={styles.progress}>
            {doneSets}/{totalSets} sets · {workout.name}
          </Text>
        </View>
        <TouchableOpacity onPress={handleFinish}>
          <Text style={styles.save}>Finish</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={8}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {workout.exercises.length === 0 && (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyCardText}>
                No exercises yet. Tap “+ Add Exercise” to start logging sets.
              </Text>
            </View>
          )}

          {workout.exercises.map((ex, exIdx) => (
            <View key={ex.id} style={styles.exCard}>
              <View style={styles.exHeader}>
                <Text style={styles.exName} numberOfLines={1}>
                  {ex.name}
                </Text>
                <View style={styles.exHeaderActions}>
                  <TouchableOpacity
                    onPress={() => reorderWorkoutExercise(ex.id, 'up')}
                    disabled={exIdx === 0}
                    style={styles.reorderBtn}
                  >
                    <Text style={[styles.reorderText, exIdx === 0 && styles.reorderDisabled]}>↑</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => reorderWorkoutExercise(ex.id, 'down')}
                    disabled={exIdx === workout.exercises.length - 1}
                    style={styles.reorderBtn}
                  >
                    <Text
                      style={[
                        styles.reorderText,
                        exIdx === workout.exercises.length - 1 && styles.reorderDisabled,
                      ]}
                    >
                      ↓
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => removeWorkoutExercise(ex.id)}>
                    <Text style={styles.exRemove}>Remove</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Reps vs. time-based logging for this exercise. */}
              <View style={styles.modeToggle}>
                {(['reps', 'time'] as const).map((m) => {
                  const active = (ex.mode ?? 'reps') === m;
                  return (
                    <TouchableOpacity
                      key={m}
                      style={[styles.modeBtn, active && styles.modeBtnActive]}
                      onPress={() => setExerciseMode(ex.id, m)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.modeBtnText, active && styles.modeBtnTextActive]}>
                        {m === 'reps' ? 'Reps' : 'Time'}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Values were pre-filled from the last session — note when, so
                  the numbers below read as "last time" rather than fresh. */}
              {(() => {
                const last = lastPerformance(workoutHistory, ex.name);
                if (!last) return null;
                return (
                  <Text style={styles.lastTime} numberOfLines={1}>
                    <Text style={styles.lastTimeLabel}>Pre-filled</Text> from last time ·{' '}
                    {relativeDateLabel(last.date)}
                  </Text>
                );
              })()}

              {/* Column labels */}
              <View style={styles.setRowHead}>
                <Text style={[styles.colSet, styles.headText]}>Set</Text>
                <Text style={[styles.colNum, styles.headText]}>lbs</Text>
                <Text style={[styles.colNum, styles.headText]}>
                  {(ex.mode ?? 'reps') === 'time' ? 'Time' : 'Reps'}
                </Text>
                <View style={styles.colCheck} />
              </View>

              {ex.sets.map((set, i) => (
                <ReanimatedSwipeable
                  key={set.id}
                  renderRightActions={() => (
                    <TouchableOpacity
                      style={styles.swipeDeleteAction}
                      onPress={() => removeWorkoutSet(ex.id, set.id)}
                    >
                      <Text style={styles.swipeDeleteText}>Delete</Text>
                    </TouchableOpacity>
                  )}
                  overshootRight={false}
                  friction={2}
                >
                  <View style={[styles.setRow, set.completed && styles.setRowDone]}>
                    <TouchableOpacity
                      style={styles.colSet}
                      onPress={() => pickSetType(ex.id, set.id)}
                      activeOpacity={0.7}
                    >
                      {(() => {
                        const badge = setBadgeInfo(set.type, i, styles);
                        return (
                          <View style={[styles.setBadge, badge.bubble]}>
                            <Text style={[styles.setBadgeText, badge.text]}>{badge.label}</Text>
                          </View>
                        );
                      })()}
                    </TouchableOpacity>
                    <TextInput
                      style={[styles.colNum, styles.setInput]}
                      value={
                        weightDrafts[set.id] ?? (set.weight === 0 ? '' : String(set.weight))
                      }
                      onChangeText={(v) => {
                        const cleaned = sanitizeDecimal(v);
                        setWeightDrafts((prev) => ({ ...prev, [set.id]: cleaned }));
                        const n = parseFloat(cleaned);
                        updateWorkoutSet(ex.id, set.id, { weight: Number.isNaN(n) ? 0 : n });
                      }}
                      onFocus={() => setFocusCtx({ exId: ex.id, setId: set.id, field: 'weight' })}
                      onBlur={() =>
                        setWeightDrafts((prev) => {
                          if (!(set.id in prev)) return prev;
                          const next = { ...prev };
                          delete next[set.id];
                          return next;
                        })
                      }
                      keyboardType="decimal-pad"
                      placeholder="0"
                      placeholderTextColor={c.textFaint}
                      inputAccessoryViewID="workout-fill-bar"
                    />
                    {(ex.mode ?? 'reps') === 'time' ? (
                      <DurationInput
                        style={[styles.colNum, styles.setInput]}
                        seconds={set.durationSeconds ?? 0}
                        onChange={(secs) =>
                          updateWorkoutSet(ex.id, set.id, { durationSeconds: secs })
                        }
                        placeholder="0:00"
                        placeholderTextColor={c.textFaint}
                      />
                    ) : (
                      <TextInput
                        style={[styles.colNum, styles.setInput]}
                        value={set.reps === 0 ? '' : String(set.reps)}
                        onChangeText={(v) => {
                          const n = parseInt(v.replace(/[^0-9]/g, ''), 10);
                          updateWorkoutSet(ex.id, set.id, { reps: Number.isNaN(n) ? 0 : n });
                        }}
                        onFocus={() => setFocusCtx({ exId: ex.id, setId: set.id, field: 'reps' })}
                        keyboardType="number-pad"
                        placeholder="0"
                        placeholderTextColor={c.textFaint}
                        inputAccessoryViewID="workout-fill-bar"
                      />
                    )}
                    <TouchableOpacity
                      style={styles.colCheck}
                      onPress={() => toggleWorkoutSet(ex.id, set.id)}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.checkbox, set.completed && styles.checkboxOn]}>
                        {set.completed && <Text style={styles.checkmark}>✓</Text>}
                      </View>
                    </TouchableOpacity>
                  </View>
                </ReanimatedSwipeable>
              ))}

              <TouchableOpacity
                style={styles.addSetBtn}
                onPress={() => addWorkoutSet(ex.id)}
                activeOpacity={0.8}
              >
                <Text style={styles.addSetText}>+ Add Set</Text>
              </TouchableOpacity>
            </View>
          ))}

          <TouchableOpacity style={styles.addExBtn} onPress={promptAddExercise} activeOpacity={0.85}>
            <Text style={styles.addExText}>+ Add Exercise</Text>
          </TouchableOpacity>
        </ScrollView>
        <WorkoutStatusBar bpm={liveBpm} bpmUpdatedAt={bpmUpdatedAt} />
      </KeyboardAvoidingView>

      {Platform.OS === 'ios' && (
        <InputAccessoryView nativeID="workout-fill-bar">
          <View style={styles.fillBar}>
            <Text style={styles.fillBarLabel}>
              {focusCtx?.field === 'weight' ? 'Fill lbs to all sets' : 'Fill reps to all sets'}
            </Text>
            <View style={styles.fillBarActions}>
              <TouchableOpacity style={styles.fillBtn} onPress={fillAll}>
                <Text style={styles.fillBtnText}>Fill all</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => Keyboard.dismiss()} hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}>
                <Text style={styles.fillDoneText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </InputAccessoryView>
      )}
      <ExercisePickerModal
        visible={showExercisePicker}
        onClose={() => setShowExercisePicker(false)}
        onSelect={(name) => addWorkoutExercise(name)}
      />
    </SafeAreaView>
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
  headerCenter: { flex: 1, alignItems: 'center' },
  cancel: { fontSize: 16, color: c.danger },
  save: { fontSize: 16, color: c.primary, fontWeight: '700' },
  title: { fontSize: 16, fontWeight: '700', color: c.text, maxWidth: 180 },
  timer: { fontSize: 18, fontWeight: '800', color: c.text, fontVariant: ['tabular-nums'] },
  progress: { fontSize: 12, color: c.textFaint, marginTop: 1, maxWidth: 220 },
  content: { padding: 16, paddingBottom: 40 },

  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyText: { fontSize: 16, color: c.textMuted },
  emptyCard: { backgroundColor: c.card, borderRadius: 14, padding: 20, marginBottom: 16 },
  emptyCardText: { fontSize: 14, color: c.textMuted, lineHeight: 20, textAlign: 'center' },

  exCard: {
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
  exHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  exName: { fontSize: 16, fontWeight: '700', color: c.text, flex: 1 },
  exHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  reorderBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: c.cardMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reorderText: { fontSize: 16, fontWeight: '800', color: c.textMuted },
  reorderDisabled: { color: c.textFaint },
  exRemove: { fontSize: 13, color: c.danger, fontWeight: '600' },

  lastTime: { fontSize: 12, color: c.textMuted, marginTop: -2, marginBottom: 10 },
  lastTimeLabel: { color: c.textFaint, fontWeight: '600' },

  setRowHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 6, paddingHorizontal: 2 },
  headText: { fontSize: 11, color: c.textFaint, fontWeight: '600' },
  modeToggle: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    backgroundColor: c.bg,
    borderRadius: 8,
    padding: 2,
    marginBottom: 12,
  },
  modeBtn: { paddingVertical: 5, paddingHorizontal: 14, borderRadius: 6 },
  modeBtnActive: { backgroundColor: c.card, borderWidth: 1, borderColor: c.border },
  modeBtnText: { fontSize: 13, fontWeight: '600', color: c.textFaint },
  modeBtnTextActive: { color: c.primary },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderRadius: 10,
  },
  setRowDone: { backgroundColor: c.primarySoft },
  colSet: { width: 40, textAlign: 'center', alignItems: 'center', justifyContent: 'center' },
  colNum: { flex: 1, marginHorizontal: 4 },
  colCheck: { width: 64, alignItems: 'center' },

  // Left-side set-type bubble (tap to tag a set).
  setBadge: {
    minWidth: 28,
    height: 28,
    paddingHorizontal: 6,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  setBadgeText: { fontSize: 13, fontWeight: '800' },
  badgeNormal: { backgroundColor: c.cardMuted, borderColor: c.border },
  badgeNormalText: { color: c.textMuted },
  badgeWarmup: { backgroundColor: c.warningSoft, borderColor: `${c.warning}80` },
  badgeWarmupText: { color: c.warning },
  badgeFailure: { backgroundColor: c.dangerSoft, borderColor: `${c.danger}80` },
  badgeFailureText: { color: c.danger },
  badgeDropset: { backgroundColor: c.accentSoft, borderColor: `${c.accent}80` },
  badgeDropsetText: { color: c.accent },
  setInput: {
    backgroundColor: c.input,
    borderRadius: 8,
    paddingVertical: 8,
    fontSize: 15,
    color: c.text,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: c.border,
  },
  checkbox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 2.5,
    borderColor: c.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: c.primary, borderColor: c.primary },
  checkmark: { color: c.onPrimary, fontSize: 20, fontWeight: '800' },
  swipeDeleteAction: {
    backgroundColor: c.danger,
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    borderRadius: 10,
    marginVertical: 2,
    marginLeft: 8,
  },
  swipeDeleteText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  addSetBtn: { paddingVertical: 10, alignItems: 'center', marginTop: 4 },
  addSetText: { color: c.primary, fontWeight: '600', fontSize: 14 },

  addExBtn: {
    backgroundColor: c.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  addExText: { color: c.onPrimary, fontWeight: '700', fontSize: 16 },

  fillBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: c.cardMuted,
    borderTopWidth: 1,
    borderTopColor: c.border,
  },
  fillBarLabel: { fontSize: 13, color: c.textMuted, fontWeight: '500' },
  fillBarActions: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  fillBtn: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    backgroundColor: c.primary,
    borderRadius: 10,
  },
  fillBtnText: { color: c.onPrimary, fontSize: 14, fontWeight: '700' },
  fillDoneText: { fontSize: 15, fontWeight: '700', color: c.primary },
});
