import { createNavigationContainerRef } from '@react-navigation/native';

// Root navigation ref, attached to the app's NavigationContainer. Lets code
// outside the React tree (e.g. the watch-connectivity hooks) drive navigation
// — specifically, popping the workout overview when a workout is finished from
// the Apple Watch while the phone may be on a different screen or tab.
export const navigationRef = createNavigationContainerRef();

// Navigate to the just-finished workout's summary. WorkoutSummary lives inside
// the Exercise tab's stack (alongside ActiveWorkout), so we target it there.
// This mirrors the phone Finish button's `navigation.replace('WorkoutSummary')`
// for the case where the finish originates on the watch.
export function navigateToWorkoutSummary(sessionId: string): void {
  if (!navigationRef.isReady()) return;
  try {
    // The ref is created without a typed ParamList, so navigate() is typed as
    // `never`; cast to reach the nested Exercise-stack route.
    (navigationRef.navigate as any)('Exercise', {
      screen: 'WorkoutSummary',
      params: { sessionId },
    });
  } catch {
    // Navigator not in a state that can accept this — safe to ignore; the
    // session is still saved and viewable from history.
  }
}
