// Workout types offered on the phone when starting a workout. `hk` is the
// HKWorkoutActivityType raw value, sent to the watch so its HKWorkoutSession
// (and the resulting Apple Health / Fitness entry) is categorized correctly.
export interface WorkoutType {
  label: string;
  hk: number;
}

export const WORKOUT_TYPES: WorkoutType[] = [
  { label: 'Strength', hk: 50 }, // traditionalStrengthTraining
  { label: 'Running', hk: 37 }, // running
  { label: 'Cycling', hk: 13 }, // cycling
  { label: 'HIIT', hk: 63 }, // highIntensityIntervalTraining
  { label: 'Walking', hk: 52 }, // walking
  { label: 'Yoga', hk: 57 }, // yoga
  { label: 'Other', hk: 3000 }, // other
];

export const DEFAULT_WORKOUT_HK = 50; // Strength
