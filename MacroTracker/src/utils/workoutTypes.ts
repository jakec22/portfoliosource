// Workout types offered on the phone when starting a workout. `hk` is the
// HKWorkoutActivityType raw value, sent to the watch so its HKWorkoutSession
// (and the resulting Apple Health / Fitness entry) is categorized correctly.
export interface WorkoutType {
  label: string;
  hk: number;
}

// Strength is the only lifting type now. HIIT, Circuit and Cross Training
// were removed: they produced the same screen, the same sets-and-reps data
// and the same body-heat-map volume as Strength, so the picker was asking a
// question whose answer changed nothing but a label in Apple Health.
export const WORKOUT_TYPES: WorkoutType[] = [
  { label: 'Strength', hk: 50 }, // traditionalStrengthTraining
];

export const DEFAULT_WORKOUT_HK = 50; // Strength

/**
 * HKWorkoutActivityTypeOther.
 *
 * Apple has no activity type for a sauna or a cold plunge, so both carry
 * this one and are told apart by the session's name. "Other" is the honest
 * mapping; inventing a closer-sounding one (Cooldown is a post-exercise
 * cool-down, not cold exposure) would mislabel the session in Health.
 */
export const RECOVERY_HK = 3000;

export type RecoveryKind = 'sauna' | 'plunge';

export interface RecoveryType {
  kind: RecoveryKind;
  /** Also the saved session's name, which is how the two are told apart. */
  label: string;
  /** Starting point for the timer the first time; the user's choice sticks. */
  defaultTargetSeconds: number;
  defaultMode: TimerMode;
}

/** Count down from the target, or up toward it and past it. */
export type TimerMode = 'down' | 'up';

export const RECOVERY_TYPES: RecoveryType[] = [
  { kind: 'sauna', label: 'Sauna', defaultTargetSeconds: 15 * 60, defaultMode: 'down' },
  { kind: 'plunge', label: 'Cold Plunge', defaultTargetSeconds: 3 * 60, defaultMode: 'up' },
];

export function recoveryType(kind: RecoveryKind): RecoveryType {
  return RECOVERY_TYPES.find((r) => r.kind === kind) ?? RECOVERY_TYPES[0];
}

/**
 * Whether a session is recovery rather than training.
 *
 * Recovery is tracked but never counted: it stays out of the consistency
 * ring, the week streak, the training calendar and the body heat map, so
 * "3 of 4 this week" keeps meaning three lifting sessions rather than three
 * visits to a sauna.
 *
 * A missing activityType means a session saved before the column existed,
 * which is strength — the same rule WorkoutTemplate.activityType has always
 * used.
 */
export function isRecoverySession(s: { activityType?: number }): boolean {
  return s.activityType === RECOVERY_HK;
}
