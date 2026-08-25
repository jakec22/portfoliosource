import { Platform, AppState } from 'react-native';
import {
  updateApplicationContext,
  sendMessage,
  transferUserInfo,
  watchEvents,
  getIsPaired,
  getIsWatchAppInstalled,
} from 'react-native-watch-connectivity';
import { startWatchApp } from '@kingstinct/react-native-healthkit';
import type { HeartRateSample } from '../types';

// Today's stats mirrored to the Apple Watch glance. Keys must match what the
// watch's WCSession delegate reads (see targets/watch/content.swift).
export interface WatchContext {
  caloriesConsumed: number;
  calorieGoal: number;
  protein: number;
  proteinGoal: number;
  carbs: number;
  carbsGoal: number;
  fat: number;
  fatGoal: number;
  water: number;
  waterGoal: number;
  updatedAt: number;
}

// Latest daily stats and current workout state are merged into a single
// application context. `updateApplicationContext` is the reliable channel (the
// same one the glance uses): it's queued and delivered when the watch app next
// becomes active, unlike `sendMessage` which needs the watch reachable at the
// exact send instant. We keep the last stats so a workout start/end can re-push
// the full context without losing the glance data.
// Compact per-set/-exercise shape sent to the watch (short keys to stay small).
export interface WatchPlanSet {
  id: string;
  w: number; // weight
  r: number; // reps
  d: number; // durationSeconds
  c: boolean; // completed
}
export interface WatchPlanExercise {
  id: string;
  name: string;
  mode: string; // 'reps' | 'time'
  sets: WatchPlanSet[];
}

let lastStats: WatchContext | null = null;
let workoutState = {
  workoutActive: false,
  workoutId: '',
  workoutStartedAt: 0,
  workoutActivityType: 0, // HKWorkoutActivityType raw value
};
// Whether we actually know the workout state. Starts false: after a phone
// cold-start / JS reload the in-memory workoutState resets to inactive, but the
// real workout is still in progress (restored from persistence). Until the app
// re-asserts it, we must NOT push workoutActive:false — the watch would take
// that as "end the workout" and quit its live session mid-workout. So glance /
// plan pushes omit the workout fields entirely until the state is known.
let workoutStateKnown = false;
let workoutPlan: WatchPlanExercise[] = [];

// Compact template shape sent to the watch's start screen (short keys).
export interface WatchTemplateSummary {
  id: string;
  name: string;
  at: number; // activityType (HKWorkoutActivityType raw value)
  n: number; // exercise count
}
let watchTemplates: WatchTemplateSummary[] = [];
// Only advertise templates once we've actually set them, so a pre-rehydration
// glance push doesn't momentarily clear the watch's list.
let templatesKnown = false;

// Whether a watch is paired and our watch app is installed. ALL outbound watch
// communication is gated on this. On an iPhone with no paired Apple Watch,
// calling into WatchConnectivity (updateApplicationContext / transferUserInfo /
// sendMessage) or HealthKit's startWatchApp can raise a native exception that
// crashes the whole app — and a native crash can't be caught by a JS try/catch.
// So instead of trying to catch it, we simply never make the call when there's
// no watch to talk to. Flags start false and are filled in asynchronously.
let watchPaired = false;
let watchAppInstalled = false;

function refreshWatchAvailability(): void {
  if (Platform.OS !== 'ios') return;
  try {
    getIsPaired()
      .then((v: boolean) => {
        const was = watchPaired;
        watchPaired = !!v;
        // Flush the latest context once a watch becomes available.
        if (watchPaired && !was) pushContext();
      })
      .catch(() => {});
    getIsWatchAppInstalled()
      .then((v: boolean) => {
        watchAppInstalled = !!v;
      })
      .catch(() => {});
  } catch {
    // Native module missing (e.g. Expo Go) — leave flags false so we no-op.
  }
}

if (Platform.OS === 'ios') {
  refreshWatchAvailability();
  try {
    watchEvents.on('paired', (paired: boolean) => {
      const was = watchPaired;
      watchPaired = !!paired;
      if (watchPaired && !was) pushContext();
    });
    watchEvents.on('installed', (installed: boolean) => {
      watchAppInstalled = !!installed;
    });
  } catch {}
  try {
    AppState.addEventListener('change', (s) => {
      if (s === 'active') refreshWatchAvailability();
    });
  } catch {}
}

function pushContext(): void {
  if (Platform.OS !== 'ios' || !watchPaired) return;
  const ctx: Record<string, unknown> = {
    ...(lastStats ?? {}),
    workoutPlan,
  };
  // Only advertise the workout lifecycle once we actually know it. The watch
  // treats a missing workoutActive key as "no change", so a glance-only push
  // (or a pre-rehydration cold start) never ends a running workout.
  if (workoutStateKnown) Object.assign(ctx, workoutState);
  if (templatesKnown) ctx.workoutTemplates = watchTemplates;
  try {
    updateApplicationContext(ctx);
  } catch {
    // No paired watch / session unavailable — safe to ignore.
  }
}

export function sendWatchContext(ctx: WatchContext): void {
  lastStats = ctx;
  pushContext();
}

// Push the current workout's exercises + sets to the watch so it can display
// (and, later, check off) them. Pass [] to clear.
export function setWatchWorkoutPlan(plan: WatchPlanExercise[]): void {
  workoutPlan = plan;
  pushContext();
}

// Mirror the user's saved workout templates so they can be started from the
// watch's Start Workout screen. Pass [] to clear.
export function setWatchTemplates(templates: WatchTemplateSummary[]): void {
  watchTemplates = templates;
  templatesKnown = true;
  pushContext();
}

// Subscribe to a "start workout" request from the watch's template picker.
// templateId is '' for a blank quick-start. Returns an unsubscribe function.
export function subscribeWatchStartWorkout(cb: (templateId: string) => void): () => void {
  if (Platform.OS !== 'ios') return () => {};
  const unsubscribe = watchEvents.on('message', (message: any) => {
    if (message?.type === 'startTemplate') {
      cb(typeof message.templateId === 'string' ? message.templateId : '');
    }
  });
  return () => {
    try {
      unsubscribe();
    } catch {}
  };
}

// Mark a workout active in the context so the watch starts its on-wrist session
// (live HR/calories) when it next becomes active. Also fire a sendMessage for
// the case where the watch app is already reachable (instant start).
export function startWatchWorkout(workoutId: string, activityType = 0): void {
  if (Platform.OS !== 'ios') return;
  workoutState = {
    workoutActive: true,
    workoutId,
    workoutStartedAt: Date.now(),
    workoutActivityType: activityType,
  };
  workoutStateKnown = true;
  pushContext();
  // Nothing below can reach a watch that isn't there — and startWatchApp in
  // particular crashes natively on an unpaired iPhone — so bail out early.
  if (!watchPaired) return;
  // Launch the watch app and start its workout session from the phone (the only
  // Apple-supported way to open a watch app remotely). The watch handles the
  // delivered configuration in its app delegate. Falls back gracefully — the
  // context + message paths still drive the watch if it's already open.
  if (watchAppInstalled) {
    try {
      startWatchApp({ activityType: (activityType || 50) as any })?.catch?.(() => {});
    } catch {}
  }
  try {
    sendMessage(
      { command: 'startWorkout', workoutId, workoutActivityType: activityType },
      () => {},
      () => {}
    );
  } catch {}
}

// Clear the active workout (when the phone workout finishes/cancels).
export function endWatchWorkout(): void {
  if (Platform.OS !== 'ios') return;
  workoutState = {
    workoutActive: false,
    workoutId: '',
    workoutStartedAt: 0,
    workoutActivityType: 0,
  };
  workoutStateKnown = true; // an explicit end — the watch should hear the false
  workoutPlan = [];
  pushContext();
  if (!watchPaired) return;
  try {
    sendMessage({ command: 'endWorkout' }, () => {}, () => {});
  } catch {}
}

// Re-assert an in-progress workout to the watch after the phone app restarts.
// A cold start / JS reload resets the in-memory workoutState to inactive even
// though the workout is still live (restored from persistence); without this
// the next context push would omit (or, worse, contradict) the workout and the
// watch could drop its session. We mark the state known + active so pushes keep
// the watch's workout alive. No app relaunch / sendMessage — the watch session
// is already running; we're only keeping the mirrored state truthful.
export function restoreWatchWorkoutState(workoutId: string, startedAt: number): void {
  if (Platform.OS !== 'ios' || !workoutId) return;
  // Already tracking this workout — nothing to repair.
  if (workoutStateKnown && workoutState.workoutActive && workoutState.workoutId === workoutId) {
    return;
  }
  workoutState = {
    workoutActive: true,
    workoutId,
    workoutStartedAt: startedAt || Date.now(),
    workoutActivityType: workoutState.workoutActivityType || 0,
  };
  workoutStateKnown = true;
  pushContext();
}

// Mirror the rest countdown to the watch using a shared end timestamp. Uses
// transferUserInfo (not sendMessage): it's queued and delivered reliably even
// when the watch screen is off / app is backgrounded — which is exactly the
// case when you tap a set on the phone with your wrist down. The watch computes
// the remaining time from the absolute endAt, so a second or two of delivery
// latency doesn't desync the countdown.
export function startWatchRest(endAt: number): void {
  if (Platform.OS !== 'ios' || !watchPaired) return;
  try {
    transferUserInfo({ type: 'rest', endAt });
  } catch {}
}

// Clear the watch rest countdown without buzzing (e.g. the user skipped rest).
export function stopWatchRest(): void {
  if (Platform.OS !== 'ios' || !watchPaired) return;
  try {
    transferUserInfo({ type: 'restStop' });
  } catch {}
}

// Subscribe to set check-offs coming from the watch. Delivered via the watch's
// sendMessage (the 'message' event — same proven path as HR streaming).
export function subscribeWatchSetToggle(
  cb: (exerciseId: string, setId: string, completed: boolean) => void
): () => void {
  if (Platform.OS !== 'ios') return () => {};
  const unsubscribe = watchEvents.on('message', (message: any) => {
    if (
      message?.type === 'toggleSet' &&
      typeof message.exerciseId === 'string' &&
      typeof message.setId === 'string'
    ) {
      cb(message.exerciseId, message.setId, !!message.completed);
    }
  });
  return () => {
    try {
      unsubscribe();
    } catch {}
  };
}

// Subscribe to set weight/reps/duration edits coming from the watch's set
// editor. Delivered via the watch's sendMessage ('message' event).
export function subscribeWatchSetEdit(
  cb: (
    exerciseId: string,
    setId: string,
    weight: number,
    reps: number,
    duration: number
  ) => void
): () => void {
  if (Platform.OS !== 'ios') return () => {};
  const unsubscribe = watchEvents.on('message', (message: any) => {
    if (
      message?.type === 'updateSet' &&
      typeof message.exerciseId === 'string' &&
      typeof message.setId === 'string'
    ) {
      cb(
        message.exerciseId,
        message.setId,
        Number(message.weight) || 0,
        Number(message.reps) || 0,
        Number(message.duration) || 0
      );
    }
  });
  return () => {
    try {
      unsubscribe();
    } catch {}
  };
}

// Subscribe to a "finish workout" command from the watch (Complete Workout
// button). Returns an unsubscribe function.
export function subscribeWatchWorkoutFinish(
  cb: (completeAll: boolean) => void
): () => void {
  if (Platform.OS !== 'ios') return () => {};
  const unsubscribe = watchEvents.on('message', (message: any) => {
    if (message?.type === 'finishWorkout') cb(!!message.completeAll);
  });
  return () => {
    try {
      unsubscribe();
    } catch {}
  };
}

// ── Workout heart-rate buffer ────────────────────────────────────────────
// Samples streamed from the watch during the current workout, kept at module
// scope (not in a React ref) so they survive the ActiveWorkout screen being
// unmounted. The watch can finish a workout while the phone is on another
// screen (or its screen is off), and we still need these to attach to the
// saved session for the history graph.
let workoutHrBuffer: HeartRateSample[] = [];

export function addWorkoutHrSample(sample: HeartRateSample): void {
  workoutHrBuffer.push(sample);
}

export function getWorkoutHrSamples(): HeartRateSample[] {
  return workoutHrBuffer.slice();
}

export function resetWorkoutHrBuffer(): void {
  workoutHrBuffer = [];
}

// Subscribe to live heart-rate samples streamed from the watch during a
// workout. Returns an unsubscribe function.
export function subscribeWatchHeartRate(
  cb: (bpm: number, timestamp: number) => void
): () => void {
  if (Platform.OS !== 'ios') return () => {};
  const unsubscribe = watchEvents.on('message', (message: any) => {
    if (message?.type === 'heartRate' && typeof message.bpm === 'number') {
      const ts = typeof message.timestamp === 'number' ? message.timestamp : Date.now();
      cb(message.bpm, ts);
    }
  });
  return () => {
    try {
      unsubscribe();
    } catch {}
  };
}
