// Workout types offered on the phone when starting a workout. `hk` is the
// HKWorkoutActivityType raw value, sent to the watch so its HKWorkoutSession
// (and the resulting Apple Health / Fitness entry) is categorized correctly.
export interface WorkoutType {
  label: string;
  hk: number;
}

export const WORKOUT_TYPES: WorkoutType[] = [
  { label: 'Strength', hk: 50 }, // traditionalStrengthTraining
  { label: 'HIIT', hk: 63 }, // highIntensityIntervalTraining
  { label: 'Circuit', hk: 20 }, // functionalStrengthTraining
  { label: 'CrossFit', hk: 11 }, // crossTraining
];

export const DEFAULT_WORKOUT_HK = 50; // Strength
