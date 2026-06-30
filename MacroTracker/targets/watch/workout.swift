import Foundation
import HealthKit
import Combine
import WatchConnectivity

// Drives a native on-wrist workout: requests HealthKit access, runs an
// HKWorkoutSession + HKLiveWorkoutBuilder, and publishes live heart rate,
// active calories, and elapsed time for the UI to render. Shared so the
// WatchConnectivity delegate (DayStats) can start/end it on phone commands.
final class WorkoutManager: NSObject, ObservableObject {
    static let shared = WorkoutManager()

    private let healthStore = HKHealthStore()
    private var session: HKWorkoutSession?
    private var builder: HKLiveWorkoutBuilder?
    private var timer: Timer?
    // Elapsed time excluding paused stretches: accumulated time from finished
    // segments plus the time since the current segment began.
    private var accumulated: TimeInterval = 0
    private var segmentStart: Date?
    private var hrSum: Double = 0
    private var hrCount: Int = 0

    @Published var isActive = false
    @Published var isPaused = false
    @Published var didFinish = false
    @Published var heartRate: Double = 0
    @Published var avgHeartRate: Double = 0
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

    func start(activityType: HKWorkoutActivityType = .functionalStrengthTraining) {
        guard !isActive else { return } // ignore duplicate start commands

        requestAuthorization()
        let config = HKWorkoutConfiguration()
        config.activityType = activityType
        config.locationType = .unknown

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
            self.accumulated = 0
            self.segmentStart = start
            self.hrSum = 0
            self.hrCount = 0
            startTimer()
            DispatchQueue.main.async {
                self.heartRate = 0
                self.avgHeartRate = 0
                self.activeCalories = 0
                self.elapsed = 0
                self.isPaused = false
                self.didFinish = false
                self.isActive = true
            }
        } catch {
            // Session failed to start (e.g. authorization denied) — stay idle.
        }
    }

    func pause() {
        guard isActive, !isPaused else { return }
        session?.pause()
        if let segmentStart = segmentStart {
            accumulated += Date().timeIntervalSince(segmentStart)
        }
        segmentStart = nil
        DispatchQueue.main.async { self.isPaused = true }
    }

    func resume() {
        guard isActive, isPaused else { return }
        session?.resume()
        segmentStart = Date()
        DispatchQueue.main.async { self.isPaused = false }
    }

    func end() {
        stopTimer()
        if let segmentStart = segmentStart {
            accumulated += Date().timeIntervalSince(segmentStart)
        }
        segmentStart = nil
        session?.end()
        builder?.endCollection(withEnd: Date()) { [weak self] _, _ in
            self?.builder?.finishWorkout { _, _ in }
        }
        DispatchQueue.main.async {
            self.elapsed = self.accumulated
            self.isActive = false
            self.isPaused = false
            self.didFinish = true // drives the on-watch summary screen
            self.session = nil
            self.builder = nil
        }
    }

    // Clears the finished state when the summary is dismissed.
    func reset() {
        DispatchQueue.main.async { self.didFinish = false }
    }

    private func startTimer() {
        timer?.invalidate()
        timer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] _ in
            guard let self = self else { return }
            if self.isPaused { return }
            let current = self.segmentStart.map { Date().timeIntervalSince($0) } ?? 0
            self.elapsed = self.accumulated + current
        }
    }

    private func stopTimer() {
        timer?.invalidate()
        timer = nil
    }

    // Push a live heart-rate sample to the phone, which feeds it into the active
    // workout's HR pipeline. Best-effort: only when the phone app is reachable.
    private func streamHeartRate(_ bpm: Double) {
        let session = WCSession.default
        guard session.activationState == .activated, session.isReachable else { return }
        let timestamp = Date().timeIntervalSince1970 * 1000
        session.sendMessage(
            ["type": "heartRate", "bpm": bpm, "timestamp": timestamp],
            replyHandler: nil,
            errorHandler: nil
        )
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
                        self.hrSum += bpm
                        self.hrCount += 1
                        self.avgHeartRate = self.hrSum / Double(self.hrCount)
                        self.streamHeartRate(bpm)
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
