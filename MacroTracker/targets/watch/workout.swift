import Foundation
import HealthKit
import Combine

// Drives a native on-wrist workout: requests HealthKit access, runs an
// HKWorkoutSession + HKLiveWorkoutBuilder, and publishes live heart rate,
// active calories, and elapsed time for the UI to render.
final class WorkoutManager: NSObject, ObservableObject {
    private let healthStore = HKHealthStore()
    private var session: HKWorkoutSession?
    private var builder: HKLiveWorkoutBuilder?
    private var startDate: Date?
    private var timer: Timer?

    @Published var isActive = false
    @Published var heartRate: Double = 0
    @Published var activeCalories: Double = 0
    @Published var elapsed: TimeInterval = 0

    // Ask for the data we read (HR, active energy) and write (the workout).
    func requestAuthorization() {
        guard HKHealthStore.isHealthDataAvailable() else { return }
        let share: Set<HKSampleType> = [HKQuantityType.workoutType()]
        let read: Set<HKObjectType> = [
            HKQuantityType(.heartRate),
            HKQuantityType(.activeEnergyBurned),
        ]
        healthStore.requestAuthorization(toShare: share, read: read) { _, _ in }
    }

    func start() {
        let config = HKWorkoutConfiguration()
        config.activityType = .functionalStrengthTraining
        config.locationType = .indoor

        do {
            let session = try HKWorkoutSession(healthStore: healthStore, configuration: config)
            let builder = session.associatedWorkoutBuilder()
            builder.dataSource = HKLiveWorkoutDataSource(
                healthStore: healthStore,
                workoutConfiguration: config
            )
            session.delegate = self
            builder.delegate = self

            let start = Date()
            session.startActivity(with: start)
            builder.beginCollection(withStart: start) { _, _ in }

            self.session = session
            self.builder = builder
            self.startDate = start
            startTimer()
            DispatchQueue.main.async { self.isActive = true }
        } catch {
            // Session failed to start (e.g. authorization denied) — stay idle.
        }
    }

    func end() {
        stopTimer()
        session?.end()
        builder?.endCollection(withEnd: Date()) { [weak self] _, _ in
            self?.builder?.finishWorkout { _, _ in }
        }
        DispatchQueue.main.async {
            self.isActive = false
            self.session = nil
            self.builder = nil
        }
    }

    private func startTimer() {
        timer?.invalidate()
        timer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] _ in
            guard let self = self, let start = self.startDate else { return }
            self.elapsed = Date().timeIntervalSince(start)
        }
    }

    private func stopTimer() {
        timer?.invalidate()
        timer = nil
    }
}

extension WorkoutManager: HKWorkoutSessionDelegate {
    func workoutSession(
        _ workoutSession: HKWorkoutSession,
        didChangeTo toState: HKWorkoutSessionState,
        from fromState: HKWorkoutSessionState,
        date: Date
    ) {}

    func workoutSession(_ workoutSession: HKWorkoutSession, didFailWithError error: Error) {
        DispatchQueue.main.async { self.isActive = false }
    }
}

extension WorkoutManager: HKLiveWorkoutBuilderDelegate {
    func workoutBuilderDidCollectEvent(_ workoutBuilder: HKLiveWorkoutBuilder) {}

    func workoutBuilder(
        _ workoutBuilder: HKLiveWorkoutBuilder,
        didCollectDataOf collectedTypes: Set<HKSampleType>
    ) {
        for type in collectedTypes {
            guard let quantityType = type as? HKQuantityType else { continue }
            let stats = workoutBuilder.statistics(for: quantityType)

            DispatchQueue.main.async {
                if quantityType == HKQuantityType(.heartRate) {
                    let unit = HKUnit.count().unitDivided(by: .minute())
                    if let bpm = stats?.mostRecentQuantity()?.doubleValue(for: unit) {
                        self.heartRate = bpm
                    }
                } else if quantityType == HKQuantityType(.activeEnergyBurned) {
                    let unit = HKUnit.kilocalorie()
                    if let cals = stats?.sumQuantity()?.doubleValue(for: unit) {
                        self.activeCalories = cals
                    }
                }
            }
        }
    }
}
