import { useReducedMotion } from 'react-native-reanimated';

/**
 * Which presentation a full-screen or bottom-sheet `Modal` should use.
 *
 * React Native's `Modal` is the one piece of motion in the app that ignores
 * Reduce Motion. Reanimated's layout animations default to
 * `ReduceMotion.System`, so the snackbar's entrance already respects it, and
 * `CountUp` checks `useReducedMotion()` itself — but `animationType="slide"`
 * slides whatever the setting says, and a sheet travelling the full height of
 * the screen is exactly the movement the setting exists to stop.
 *
 * Reduced motion means gentler, not absent: this crossfades rather than
 * cutting, so the sheet still reads as arriving rather than appearing out of
 * nowhere. Modals already set to `fade` need no change and do not use this.
 */
export function useSheetAnimation(): 'slide' | 'fade' {
  return useReducedMotion() ? 'fade' : 'slide';
}
