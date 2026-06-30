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
