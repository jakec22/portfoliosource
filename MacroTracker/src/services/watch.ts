import { Platform, AppState } from 'react-native';
import type { HeartRateSample } from '../types';
import type { WatchPalette } from '../utils/watchPalette';
import { RECOVERY_HK } from '../utils/workoutTypes';

/**
 * WatchConnectivity, loaded on demand.
 *
 * Nothing here may be imported at the top of the file: this module is pulled in
 * by the store at launch, and both react-native-watch-connectivity and
 * HealthKit's startWatchApp bind to iOS-only native modules as they evaluate.
 * On Android that happens before any Platform check can run, and takes the app
 * down on startup — the whole app, not the watch features.
 *
 * The thin wrappers below keep every call site in this file reading exactly as
 * it did when these were static imports.
 */
type WatchConnectivity = typeof import('react-native-watch-connectivity');

let wcModule: WatchConnectivity | null | undefined;
function wc(): WatchConnectivity | null {
  if (wcModule !== undefined) return wcModule;
  let loaded: WatchConnectivity | null = null;
  if (Platform.OS === 'ios') {
    try {
      loaded = require('react-native-watch-connectivity');
    } catch {
      // Native module missing (Expo Go, or a build without the pod).
    }
  }
  wcModule = loaded;
  return loaded;
}

type WC = WatchConnectivity;
const updateApplicationContext = (...a: Parameters<WC['updateApplicationContext']>) =>
  wc()?.updateApplicationContext(...a);
const sendMessage = (...a: Parameters<WC['sendMessage']>) => wc()?.sendMessage(...a);
const transferUserInfo = (...a: Parameters<WC['transferUserInfo']>) =>
  wc()?.transferUserInfo(...a);
const getIsPaired = (): Promise<boolean> => wc()?.getIsPaired() ?? Promise.resolve(false);
const getIsWatchAppInstalled = (): Promise<boolean> =>
  wc()?.getIsWatchAppInstalled() ?? Promise.resolve(false);

/** Subscribe to a WatchConnectivity event; a no-op unsubscribe off iOS. */
function onWatchEvent(event: string, cb: (payload: any) => void): () => void {
  const events = wc()?.watchEvents as any;
  if (!events) return () => {};
  return events.on(event, cb);
}

/**
 * How long a queued command from the watch stays worth acting on.
 *
 * `transferUserInfo` holds a command until this app next runs, which can be
 * minutes or hours. Most of what the watch sends is only meaningful close to
 * when it was sent — starting a workout above all — so anything older than
 * this is dropped rather than replayed into a phantom session. Matches the
 * window the watch already applies to a workout arriving by context.
 */
const COMMAND_TTL_MS = 5 * 60 * 1000;

/** False only when the watch stamped the command and it has since gone stale. */
function isFresh(message: any): boolean {
  const sentAt = Number(message?.sentAt);
  // An older watch build sends no stamp; treat those as live rather than
  // silently ignoring everything it sends.
  if (!Number.isFinite(sentAt)) return true;
  return Date.now() - sentAt <= COMMAND_TTL_MS;
}

/**
 * Subscribe to a command from the watch, however it travelled.
 *
 * The watch sends with `sendMessage` when this app is reachable and queues
 * with `transferUserInfo` when it is not (see sendReliable in
 * targets/watch/content.swift). Listening only to 'message', as this did,
 * meant every command sent while the phone was backgrounded or closed was
 * never seen — which is what made starting a workout from the wrist appear to
 * do nothing.
 *
 * 'user-info' delivers an array of `{ id, timestamp, userInfo }`, and the
 * binding also replays the queue missed while the app was not running, so
 * both channels have to feed the same handler.
 */
function onWatchCommand(cb: (message: any) => void): () => void {
  const offMessage = onWatchEvent('message', cb);
  const offQueued = onWatchEvent('user-info', (items: any) => {
    const list = Array.isArray(items) ? items : [items];
    for (const item of list) {
      const payload = item?.userInfo ?? item;
      if (payload) cb(payload);
    }
  });
  return () => {
    try {
      offMessage();
    } catch {}
    try {
      offQueued();
    } catch {}
  };
}

function startWatchApp(args: { activityType: number }): void {
  if (Platform.OS !== 'ios') return;
  try {
    require('@kingstinct/react-native-healthkit').startWatchApp(args)?.catch?.(() => {});
  } catch {
    // No HealthKit on this build — the context + message paths still apply.
  }
}

// Today's stats mirrored to the Apple Watch glance. Keys must match what the
// watch's WCSession delegate reads (see targets/watch/content.swift).
export interface WatchContext {
  // The day these numbers are for, YYYY-MM-DD. The watch discards totals
  // that are not for its own today — the widget has always done this
  // (zeroedIfStale in targets/widget/index.swift) and the watch did not, so
  // it kept showing yesterday until the phone happened to push again.
  date: string;
  caloriesConsumed: number;
  calorieGoal: number;
  protein: number;
  proteinGoal: number;
  carbs: number;
  carbsGoal: number;
  fat: number;
  fatGoal: number;
  fiber: number;
  fiberGoal: number;
  water: number;
  waterGoal: number;
  // Mirrors the phone's water tracker toggle — hiding it there hides it here.
  showWaterTracker: boolean;
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
// Accent colors for the active theme pack, adjusted for the watch's black
// screen. Kept separate from lastStats so a pack change can re-push without
// waiting for the next nutrition update.
let palette: Record<string, string> | null = null;
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

// Sauna / plunge entries for the watch's start screen, with the target the
// user last set so starting from the wrist uses the same number the phone
// would have. Short keys, as with templates.
export interface WatchRecoveryPreset {
  k: string; // RecoveryKind
  name: string;
  t: number; // target seconds
  m: string; // TimerMode
}
let watchRecovery: WatchRecoveryPreset[] = [];
let recoveryKnown = false;
// The running recovery, mirrored so the watch can draw its own timer against
// the same start, target and direction the phone is showing.
let recoveryState = {
  recoveryKind: '',
  recoveryTarget: 0,
  recoveryMode: '',
};
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
    onWatchEvent('paired', (paired: boolean) => {
      const was = watchPaired;
      watchPaired = !!paired;
      if (watchPaired && !was) pushContext();
    });
    onWatchEvent('installed', (installed: boolean) => {
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
    ...(palette ?? {}),
    workoutPlan,
  };
  // Only advertise the workout lifecycle once we actually know it. The watch
  // treats a missing workoutActive key as "no change", so a glance-only push
  // (or a pre-rehydration cold start) never ends a running workout.
  if (workoutStateKnown) Object.assign(ctx, workoutState);
  // Rides with the workout lifecycle rather than beside it: the watch reads
  // these only when workoutActive is also present, and an empty recoveryKind
  // is what tells it the session is a lift.
  if (workoutStateKnown) Object.assign(ctx, recoveryState);
  if (templatesKnown) ctx.workoutTemplates = watchTemplates;
  if (recoveryKnown) ctx.recoveryPresets = watchRecovery;
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

// Mirror the active pack's accents to the watch. The watch keeps its black
// background whatever the pack — only the accents travel.
// Takes WatchPalette rather than Record<string, string>: the body reads nine
// named keys, and against an index signature a renamed field would type-check
// happily and push undefined, blanking that colour on the wrist.
export function setWatchPalette(p: WatchPalette): void {
  palette = {
    themeGround: p.ground,
    themeAccent: p.accent,
    themeDanger: p.danger,
    themeProtein: p.protein,
    themeCarbs: p.carbs,
    themeFat: p.fat,
    themeFiber: p.fiber,
    themeWater: p.water,
    themeZoneEasy: p.zoneEasy,
    themeZoneMid: p.zoneMid,
    themeZoneHigh: p.zoneHigh,
  };
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
  const unsubscribe = onWatchCommand((message: any) => {
    // Stale-guarded: a queued start delivered long after the fact would open
    // a workout the user has forgotten about.
    if (message?.type === 'startTemplate' && isFresh(message)) {
      cb(typeof message.templateId === 'string' ? message.templateId : '');
    }
  });
  return () => {
    try {
      unsubscribe();
    } catch {}
  };
}

/**
 * Subscribe to a sauna / plunge started from the watch's own start screen.
 *
 * Stale-guarded like the template start above: this one arrives by
 * transferUserInfo when the phone is unreachable — which, for a phone in a
 * locker, is the normal case — and a queued start delivered an hour later
 * would open a timer for a sauna that finished long ago.
 */
export function subscribeWatchStartRecovery(
  cb: (kind: string) => void
): () => void {
  if (Platform.OS !== 'ios') return () => {};
  const unsubscribe = onWatchCommand((message: any) => {
    if (message?.type === 'startRecovery' && isFresh(message)) {
      const kind = typeof message.kind === 'string' ? message.kind : '';
      if (kind) cb(kind);
    }
  });
  return () => {
    try {
      unsubscribe();
    } catch {}
  };
}

export interface WatchRecoveryFinish {
  kind: string;
  startedAt: number;
  heldSeconds: number;
  save: boolean;
}

/**
 * Subscribe to a recovery finished on the wrist.
 *
 * Deliberately not stale-guarded, unlike the starts: a finish delivered late
 * is still a finish that happened, and dropping it would lose the session.
 * The payload describes the whole session rather than just its length,
 * because the phone may never have heard it begin — a start queued from the
 * watch while the phone sat in a locker is dropped on arrival for being
 * older than the command TTL, which is the ordinary outcome for anything
 * longer than five minutes.
 */
export function subscribeWatchRecoveryFinish(
  cb: (finish: WatchRecoveryFinish) => void
): () => void {
  if (Platform.OS !== 'ios') return () => {};
  const unsubscribe = onWatchCommand((message: any) => {
    if (message?.type === 'finishRecovery') {
      const held = typeof message.held === 'number' ? message.held : 0;
      const startedAt =
        typeof message.startedAt === 'number' && message.startedAt > 0
          ? message.startedAt
          : Date.now() - Math.max(0, held) * 1000;
      cb({
        kind: typeof message.kind === 'string' ? message.kind : '',
        startedAt,
        heldSeconds: Math.max(0, held),
        // Absent means save: an older watch build has no discard button.
        save: message.save !== false,
      });
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
  // A lift clears any recovery framing left over from a previous session, so
  // the watch doesn't draw a sauna timer over a set list.
  if (activityType !== RECOVERY_HK) {
    recoveryState = { recoveryKind: '', recoveryTarget: 0, recoveryMode: '' };
  }
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
  if (watchAppInstalled) startWatchApp({ activityType: activityType || 50 });
  try {
    sendMessage(
      { command: 'startWorkout', workoutId, workoutActivityType: activityType },
      () => {},
      () => {}
    );
  } catch {}
}

/**
 * Start a sauna or plunge on the wrist.
 *
 * The same channel a lift uses — one HKWorkoutSession per wrist, so there is
 * nothing to gain from a parallel one — with the kind, target and direction
 * alongside so the watch can draw the timer rather than a set list. The
 * activity type is RECOVERY_HK either way, which is what Apple Health will
 * file it under.
 */
export function startWatchRecovery(
  recoveryId: string,
  kind: string,
  targetSeconds: number,
  mode: string
): void {
  if (Platform.OS !== 'ios') return;
  recoveryState = {
    recoveryKind: kind,
    recoveryTarget: Math.round(targetSeconds),
    recoveryMode: mode,
  };
  startWatchWorkout(recoveryId, RECOVERY_HK);
}

// Mirror the user's remembered sauna / plunge targets so they can be started
// from the watch's own start screen.
export function setWatchRecoveryPresets(presets: WatchRecoveryPreset[]): void {
  watchRecovery = presets;
  recoveryKnown = true;
  pushContext();
}

// Clear the active workout (when the phone workout finishes/cancels).
export function endWatchWorkout(): void {
  if (Platform.OS !== 'ios') return;
  recoveryState = { recoveryKind: '', recoveryTarget: 0, recoveryMode: '' };
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

/**
 * Re-send the current context because the watch asked for it.
 *
 * The plan only ever reaches the watch by riding an application context push,
 * and a push has plenty of ways to come to nothing: the pairing flag is filled
 * in asynchronously and starts false, the watch's WCSession may not be
 * activated yet, and updateApplicationContext keeps only the newest payload.
 * Any of those leaves the watch in a workout with an empty exercise list and
 * nothing that would ever fix it — every later push is triggered by a change
 * on the phone, and a workout nobody is editing doesn't produce one. So the
 * watch is allowed to ask.
 */
export function subscribeWatchPlanRequest(): () => void {
  if (Platform.OS !== 'ios') return () => {};
  const unsubscribe = onWatchCommand((message: any) => {
    if (message?.type === 'requestPlan') pushContext();
  });
  return () => {
    try {
      unsubscribe();
    } catch {}
  };
}

// Subscribe to set check-offs coming from the watch. Delivered via the watch's
// sendMessage (the 'message' event — same proven path as HR streaming).
export function subscribeWatchSetToggle(
  cb: (exerciseId: string, setId: string, completed: boolean) => void
): () => void {
  if (Platform.OS !== 'ios') return () => {};
  const unsubscribe = onWatchCommand((message: any) => {
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
  const unsubscribe = onWatchCommand((message: any) => {
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
  const unsubscribe = onWatchCommand((message: any) => {
    // Stale-guarded for the same reason as the start: finishing a workout is
    // destructive, and a queued one could land against a different session.
    if (message?.type === 'finishWorkout' && isFresh(message)) {
      cb(!!message.completeAll);
    }
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
//
// Deliberately the only watch listener still on 'message' alone rather than
// onWatchCommand: this is a live stream, the watch sends it with a plain
// sendMessage, and a sample that misses because the phone was unreachable is
// correctly lost. Queueing it would replay a backlog of stale beats into a
// workout that has already moved on, or ended.
export function subscribeWatchHeartRate(
  cb: (bpm: number, timestamp: number) => void
): () => void {
  if (Platform.OS !== 'ios') return () => {};
  const unsubscribe = onWatchEvent('message', (message: any) => {
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
