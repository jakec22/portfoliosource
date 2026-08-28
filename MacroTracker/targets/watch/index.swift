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
        WorkoutManager.shared.recoverActiveSessionIfNeeded()
    }
}

@main
struct watchEntry: App {
    @WKApplicationDelegateAdaptor private var appDelegate: WorkoutAppDelegate

    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}
