import SwiftUI
import HealthKit

// When the phone calls HKHealthStore.startWatchApp(with:), the system launches
// this watch app and delivers the workout configuration here. We start the
// matching HKWorkoutSession and show the live workout screen.
class WorkoutAppDelegate: NSObject, WKApplicationDelegate {
    func handle(_ workoutConfiguration: HKWorkoutConfiguration) {
        DispatchQueue.main.async {
            WorkoutManager.shared.start(activityType: workoutConfiguration.activityType)
            DayStats.shared.showWorkout = true
        }
    }

    // Fires on every process launch, including a system-initiated relaunch
    // after watchOS killed the app mid-workout — re-attach to any HKWorkoutSession
    // still running in HealthKit's daemon so the UI and HR streaming pick back up
    // instead of silently dropping the rest of the workout.
    func applicationDidFinishLaunching() {
        // Ask up front, so a workout started from the phone finds permissions
        // already settled. start() can't wait for this — a background launch
        // can't show the prompt, and watchOS wants the session immediately —
        // so the only way the first workout captures heart rate is if the
        // question was already answered before it began.
        WorkoutManager.shared.requestAuthorization()
        WorkoutManager.shared.recoverActiveSessionIfNeeded()
    }
}

@main
struct watchEntry: App {
    @WKApplicationDelegateAdaptor private var appDelegate: WorkoutAppDelegate
    @Environment(\.scenePhase) private var scenePhase

    var body: some Scene {
        WindowGroup {
            ContentView()
        }
        // Drop yesterday's totals the moment the app comes forward.
        //
        // The phone only pushes a context when the numbers change, so there
        // is no push between midnight and the next thing logged. Checking
        // only on delivery would leave the watch showing yesterday to anyone
        // who raises their wrist before logging breakfast — which is the
        // whole complaint.
        .onChange(of: scenePhase) { phase in
            if phase == .active { DayStats.shared.zeroIfStale() }
        }
    }
}
