import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  AppState as RNAppState,
  Vibration,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { useStore } from '../store/useStore';
import { useTheme } from '../theme/useTheme';
import type { Theme } from '../theme';
import { radius, space, tabular, type } from '../theme/tokens';
import { Icon } from '../components/Icon';
import { beginRecovery, endRecovery } from '../services/recoverySession';
import { subscribeWatchHeartRate } from '../services/watch';
import { recoveryType, type RecoveryKind, type TimerMode } from '../utils/workoutTypes';

interface Props {
  navigation: any;
  route: { params?: { kind?: RecoveryKind } };
}

const RING = 232;
const STROKE = 16;

/** Targets the stepper moves between, in seconds. */
const MIN_TARGET = 30;
const MAX_TARGET = 60 * 60;
/** 30s below five minutes, a minute above — the resolution each range wants. */
const stepFor = (seconds: number) => (seconds < 5 * 60 ? 30 : 60);

function clock(totalSeconds: number): string {
  const t = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(t / 60);
  const s = t % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * The sauna / cold plunge timer.
 *
 * Elapsed time is derived from a start timestamp on every tick rather than
 * counted up in state. A JS interval does not run while the phone is asleep
 * or the app is backgrounded — which, for a timer you start and then put the
 * phone down for, is the normal case rather than the edge case — so counting
 * ticks would drift low by however long the screen was off.
 *
 * The running session lives in the store, not here. A sauna outlasts this
 * screen: the phone goes in a locker, the app is backgrounded for fifteen
 * minutes and may be killed, and the watch — which is running the
 * HKWorkoutSession that makes continuous heart rate possible — can start and
 * finish the whole thing by itself. Local state would lose every one of
 * those.
 *
 * Both directions measure the same thing and save the same number: the time
 * actually held. Down counts toward zero from the target and keeps going
 * negative past it; up counts from zero with the target as a mark to pass.
 * Stopping early records what was really done, never the target.
 */
export function RecoveryTimerScreen({ navigation, route }: Props) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  const activeRecovery = useStore((s) => s.activeRecovery);
  const cancelRecovery = useStore((s) => s.cancelRecovery);
  const activeWorkout = useStore((s) => s.activeWorkout);

  // A recovery started on the wrist decides which kind this screen is showing;
  // the route param only chooses it when nothing is running yet.
  const kind: RecoveryKind = activeRecovery?.kind ?? route.params?.kind ?? 'sauna';
  const meta = recoveryType(kind);

  const preset = useStore((s) => s.recoveryPresets[kind]);

  const [targetSeconds, setTargetSeconds] = useState(
    preset?.targetSeconds ?? meta.defaultTargetSeconds
  );
  const [mode, setMode] = useState<TimerMode>(preset?.mode ?? meta.defaultMode);
  const [elapsed, setElapsed] = useState(0);
  const [liveBpm, setLiveBpm] = useState(0);

  const running = activeRecovery != null;
  const startedAt = activeRecovery?.startedAt ?? null;
  // While running, the session's own target and direction win over the local
  // stepper — they may have been set on the watch.
  const shownTarget = activeRecovery?.targetSeconds ?? targetSeconds;
  const shownMode = activeRecovery?.mode ?? mode;

  // So the target buzz fires once rather than on every tick past it.
  const reachedRef = useRef(false);
  // Set while this screen is the one ending the session, so the effect below
  // doesn't also treat its own save as a finish that happened elsewhere.
  const endingRef = useRef(false);

  // Derive from the clock, not from a counter. Also recomputed when the app
  // comes back to the foreground, which is when the interval has been frozen.
  useEffect(() => {
    if (startedAt == null) return;
    const tick = () => setElapsed((Date.now() - startedAt) / 1000);
    tick();
    const id = setInterval(tick, 250);
    const sub = RNAppState.addEventListener('change', (s) => {
      if (s === 'active') tick();
    });
    return () => {
      clearInterval(id);
      sub.remove();
    };
  }, [startedAt]);

  // Live heart rate streamed from the watch, when it's reachable. Display
  // only — the samples that get saved are buffered centrally and attached by
  // endRecovery, which prefers a batch query of the health store.
  useEffect(() => {
    if (!running) return;
    return subscribeWatchHeartRate((bpm) => setLiveBpm(bpm));
  }, [running]);

  /**
   * The phone's alerts, for a session run without a watch.
   *
   * Secondary by design. During a sauna the phone is in a locker and during
   * a plunge it is well away from the water, so this reaches nobody who is
   * wearing a watch — that side plays its own, stronger schedule on the
   * wrist (see DayStats.recoveryTick). What this covers is the user who has
   * no watch and keeps the phone within arm's reach.
   *
   * Five buzzes at the target, matching the wrist. iOS ignores the duration
   * argument and plays one fixed buzz whatever is passed, so the only way to
   * make this carry is to repeat it: the array form is a gap-and-buzz
   * pattern, which iOS does honour.
   */
  useEffect(() => {
    if (!running || reachedRef.current) return;
    if (elapsed >= shownTarget) {
      reachedRef.current = true;
      Vibration.vibrate([0, 400, 250, 400, 250, 400, 250, 400, 250, 400]);
    }
  }, [elapsed, running, shownTarget]);

  // The watch can save or discard the session itself. When it does, the store
  // clears under this screen and there is nothing left to show.
  //
  // Guarded on having seen a session: the screen also mounts with nothing
  // running, which is the ordinary way in, and must not pop itself then.
  const sawSession = useRef(false);
  useEffect(() => {
    if (running) {
      sawSession.current = true;
      return;
    }
    if (sawSession.current && !endingRef.current) navigation.goBack();
  }, [running, navigation]);

  const adjust = useCallback(
    (direction: 1 | -1) => {
      setTargetSeconds((t) => {
        const next = t + direction * stepFor(direction > 0 ? t : t - 1);
        return Math.max(MIN_TARGET, Math.min(MAX_TARGET, next));
      });
    },
    []
  );

  function handleStart() {
    if (activeWorkout) {
      Alert.alert(
        'Workout in progress',
        'Finish or cancel your workout first — your watch can only track one session at a time.',
        [{ text: 'OK' }]
      );
      return;
    }
    reachedRef.current = false;
    setElapsed(0);
    setLiveBpm(0);
    beginRecovery(kind, { targetSeconds, mode });
  }

  async function save(heldSeconds: number) {
    endingRef.current = true;
    const id = await endRecovery(heldSeconds);
    // Replace rather than push, so Back from the recap lands on Exercise and
    // not on a timer for a session that has already been saved — the same
    // thing the workout finish does.
    if (id) navigation.replace('WorkoutSummary', { sessionId: id });
    else navigation.goBack();
  }

  function discard() {
    endingRef.current = true;
    cancelRecovery();
    navigation.goBack();
  }

  function handleStop() {
    if (!running) return;
    const held = elapsed;
    // Under ten seconds is a mis-tap, not a session.
    if (held < 10) {
      Alert.alert(
        `Discard this ${meta.label.toLowerCase()}?`,
        `Only ${clock(held)} — too short to save.`,
        [
          { text: 'Keep going', style: 'cancel' },
          { text: 'Discard', style: 'destructive', onPress: discard },
        ]
      );
      return;
    }
    void save(held);
  }

  function handleLeave() {
    if (!running) {
      navigation.goBack();
      return;
    }
    // Leaving the screen does not stop the session: the watch is still
    // holding it, and the phone going in a locker is the normal case. Backing
    // out is offered as a third option precisely so it stays running.
    Alert.alert(`${meta.label} in progress`, 'Stop and save it, or discard it?', [
      { text: 'Leave running', style: 'cancel', onPress: () => navigation.goBack() },
      { text: 'Discard', style: 'destructive', onPress: discard },
      { text: 'Save', onPress: () => void save(elapsed) },
    ]);
  }

  // Down shows what is left and goes negative past the target; up shows what
  // has been held. The ring fills the same way in both.
  const remaining = shownTarget - elapsed;
  const overshot = elapsed > shownTarget;
  const display = running
    ? shownMode === 'down'
      ? `${overshot ? '+' : ''}${clock(Math.abs(remaining))}`
      : clock(elapsed)
    : clock(targetSeconds);
  const progress = Math.min(shownTarget > 0 ? elapsed / shownTarget : 0, 1);

  const radius_ = (RING - STROKE) / 2;
  const circumference = 2 * Math.PI * radius_;
  const tint = overshot ? c.hrZone3 : c.primary;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={handleLeave}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Icon name="back" size="lg" color={c.gray700} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{meta.label}</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.body}>
        <View style={{ width: RING, height: RING }}>
          <Svg width={RING} height={RING} viewBox={`0 0 ${RING} ${RING}`}>
            <Circle
              cx={RING / 2}
              cy={RING / 2}
              r={radius_}
              stroke={c.cardMuted}
              strokeWidth={STROKE}
              fill="none"
            />
            <Circle
              cx={RING / 2}
              cy={RING / 2}
              r={radius_}
              stroke={tint}
              strokeWidth={STROKE}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - progress)}
              rotation="-90"
              origin={`${RING / 2}, ${RING / 2}`}
            />
          </Svg>
          <View style={[styles.ringCenter, { width: RING, height: RING }]}>
            <Text style={[styles.clock, overshot && { color: tint }]}>{display}</Text>
            <Text style={styles.clockLabel}>
              {!running
                ? 'target'
                : shownMode === 'down'
                  ? overshot
                    ? 'past target'
                    : 'remaining'
                  : `of ${clock(shownTarget)}`}
            </Text>
          </View>
        </View>

        {running && (
          <View style={styles.hrRow}>
            <Icon name="heart" size="sm" color={liveBpm > 0 ? c.danger : c.textFaint} />
            <Text style={[styles.hrValue, liveBpm === 0 && { color: c.textFaint }]}>
              {liveBpm > 0 ? Math.round(liveBpm) : '--'}
            </Text>
            <Text style={styles.hrUnit}>bpm</Text>
          </View>
        )}

        {!running && (
          <>
            <View style={styles.stepperRow}>
              <TouchableOpacity style={styles.stepBtn} onPress={() => adjust(-1)} hitSlop={6}>
                <Text style={styles.stepBtnText}>−</Text>
              </TouchableOpacity>
              <Text style={styles.stepperLabel}>Target</Text>
              <TouchableOpacity style={styles.stepBtn} onPress={() => adjust(1)} hitSlop={6}>
                <Text style={styles.stepBtnText}>+</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modeRow}>
              {(['down', 'up'] as const).map((m) => {
                const active = m === mode;
                return (
                  <TouchableOpacity
                    key={m}
                    style={[styles.modeBtn, active && { backgroundColor: c.primary }]}
                    onPress={() => setMode(m)}
                    activeOpacity={0.85}
                    accessibilityLabel={m === 'down' ? 'Count down' : 'Count up'}
                  >
                    <Text style={[styles.modeText, active && { color: c.onPrimary }]}>
                      {m === 'down' ? 'Count down' : 'Count up'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={styles.modeHint}>
              {mode === 'down'
                ? 'Counts down to zero, then keeps going if you stay in.'
                : 'Counts up, with your target marked. Go as far past it as you like.'}
            </Text>
          </>
        )}
      </View>

      <TouchableOpacity
        style={[styles.action, running && { backgroundColor: c.danger }]}
        onPress={running ? handleStop : handleStart}
        activeOpacity={0.85}
      >
        <Text style={styles.actionText}>{running ? 'Stop & save' : 'Start'}</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const makeStyles = (c: Theme) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: space.lg,
      paddingVertical: space.md,
    },
    headerTitle: { ...type.heading(c), color: c.text },

    body: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.xl },
    ringCenter: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
    clock: { ...type.hero(c), ...tabular, color: c.text },
    clockLabel: { ...type.overline(c), color: c.textFaint, marginTop: space.xs },

    hrRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
    hrValue: { ...type.subhead(c), fontFamily: c.fontBodyBold, ...tabular, color: c.text },
    hrUnit: { ...type.caption(c), fontFamily: c.fontBody, color: c.textFaint },

    stepperRow: { flexDirection: 'row', alignItems: 'center', gap: space.xl },
    stepperLabel: { ...type.caption(c), color: c.textMuted, minWidth: 48, textAlign: 'center' },
    stepBtn: {
      width: 44,
      height: 44,
      borderRadius: radius.pill,
      backgroundColor: c.card,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepBtnText: { ...type.heading(c), color: c.text, lineHeight: 26 },

    modeRow: { flexDirection: 'row', gap: space.sm },
    modeBtn: {
      paddingHorizontal: space.lg,
      paddingVertical: space.sm,
      borderRadius: radius.pill,
      backgroundColor: c.card,
    },
    modeText: { ...type.captionStrong(c), color: c.textMuted },
    modeHint: {
      ...type.caption(c),
      color: c.textFaint,
      textAlign: 'center',
      paddingHorizontal: space.xxl,
    },

    action: {
      marginHorizontal: space.lg,
      marginBottom: space.lg,
      backgroundColor: c.primary,
      borderRadius: radius.card,
      paddingVertical: space.lg,
      alignItems: 'center',
    },
    actionText: { ...type.bodyStrong(c), color: c.onPrimary },
  });
