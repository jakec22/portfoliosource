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
    // Guards against a second start() while the authorization sheet is up.
    private var isStarting = false
    // When the current builder began collecting, so the no-heart-rate watchdog
    // measures from that point rather than from the workout's start — a
    // recovered session is already minutes old when we re-attach to it.
    private var collectionStartedAt: Date?
    private var hasHeartRateSample = false

    /// How long a running workout may go without a single heart-rate sample
    /// before we say so. Long enough to cover a loose band settling, short
    /// enough that the user finds out mid-warmup rather than at the summary.
    private static let heartRateGracePeriod: TimeInterval = 30

    @Published var isActive = false
    @Published var isPaused = false
    @Published var didFinish = false
    @Published var heartRate: Double = 0
    @Published var avgHeartRate: Double = 0
    @Published var activeCalories: Double = 0
    @Published var elapsed: TimeInterval = 0
    // Set when start() fails (e.g. HealthKit authorization denied) so the UI can
    // tell the user why nothing happened instead of silently staying idle.
    @Published var startError: String?
    // Set when a running workout has gone heartRateGracePeriod without a
    // sample. HealthKit reports a denied *read* as an empty result, never as an
    // error — authorizationStatus(for:) deliberately won't tell us either — so
    // a silent stream is the only signal there is that something is wrong.
    @Published var hrUnavailable = false

    // Ask for the data we read (HR, active energy) and write (the workout).
    func requestAuthorization(completion: ((Error?) -> Void)? = nil) {
        guard HKHealthStore.isHealthDataAvailable() else {
            completion?(nil)
            return
        }
        let share: Set<HKSampleType> = [HKQuantityType.workoutType()]
        let read: Set<HKObjectType> = [
            HKQuantityType(.heartRate),
            HKQuantityType(.activeEnergyBurned),
        ]
        healthStore.requestAuthorization(toShare: share, read: read) { _, error in
            completion?(error)
        }
    }

    func start(activityType: HKWorkoutActivityType = .functionalStrengthTraining) {
        guard !isActive, !isStarting else { return } // ignore duplicate start commands
        isStarting = true
        // Authorization has to resolve *before* collection begins. This used to
        // fire and forget, so on the first workout after install the builder
        // started collecting while the permission sheet was still on screen,
        // and the session recorded no heart rate at all. Nothing surfaced it:
        // HealthKit answers an unauthorized read with an empty result.
        requestAuthorization { [weak self] error in
            DispatchQueue.main.async {
                guard let self = self else { return }
                self.isStarting = false
                self.beginSession(activityType: activityType, authError: error)
            }
        }
    }

    private func beginSession(activityType: HKWorkoutActivityType, authError: Error?) {
        guard !isActive else { return }

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
            self.hasHeartRateSample = false
            self.collectionStartedAt = start
            startTimer()
            DispatchQueue.main.async {
                self.heartRate = 0
                self.avgHeartRate = 0
                self.activeCalories = 0
                self.elapsed = 0
                self.isPaused = false
                self.didFinish = false
                self.isActive = true
                self.startError = nil
                self.hrUnavailable = false
            }
        } catch {
            // Previously silently swallowed, leaving the watch stuck on the idle
            // screen with no indication anything went wrong. Surface it instead.
            DispatchQueue.main.async {
                self.startError = authError?.localizedDescription ?? error.localizedDescription
            }
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
        collectionStartedAt = nil
        DispatchQueue.main.async {
            self.elapsed = self.accumulated
            self.isActive = false
            self.isPaused = false
            self.didFinish = true // drives the on-watch summary screen
            self.hrUnavailable = false
            self.session = nil
            self.builder = nil
        }
    }

    // Clears the finished state when the summary is dismissed.
    func reset() {
        DispatchQueue.main.async { self.didFinish = false }
    }

    // watchOS can kill this process under memory pressure mid-workout and
    // relaunch it later — the HKWorkoutSession keeps running in HealthKit's
    // own daemon the whole time, but our in-memory state (session, builder,
    // elapsed/HR accumulators) is gone, so a fresh launch would otherwise show
    // the idle "Start Workout" screen while data collection is actually still
    // live. Call this on every launch to re-attach to that session instead of
    // silently losing the rest of the workout.
    func recoverActiveSessionIfNeeded() {
        guard !isActive else { return }
        healthStore.recoverActiveWorkoutSession { [weak self] session, _ in
            guard let self = self, let session = session else { return }
            let builder = session.associatedWorkoutBuilder()

            // The data source is an in-process object; the HKWorkoutSession
            // that survived in HealthKit's daemon did not bring one with it, so
            // a recovered builder has none. Without this, the builder never
            // collects, workoutBuilder(_:didCollectDataOf:) is never called,
            // and the rest of the workout shows "--" for heart rate and streams
            // nothing to the phone — while the daemon keeps recording happily,
            // so the built-in Heart Rate app looks completely normal.
            builder.dataSource = HKLiveWorkoutDataSource(
                healthStore: self.healthStore,
                workoutConfiguration: session.workoutConfiguration
            )
            session.delegate = self
            builder.delegate = self

            let hrUnit = HKUnit.count().unitDivided(by: .minute())
            let hrStats = builder.statistics(for: HKQuantityType(.heartRate))
            if let avg = hrStats?.averageQuantity()?.doubleValue(for: hrUnit) {
                self.hrSum = avg
                self.hrCount = 1
                self.avgHeartRate = avg
            }
            if let latest = hrStats?.mostRecentQuantity()?.doubleValue(for: hrUnit) {
                self.heartRate = latest
            }
            if let cals = builder.statistics(for: HKQuantityType(.activeEnergyBurned))?
                .sumQuantity()?.doubleValue(for: .kilocalorie()) {
                self.activeCalories = cals
            }

            self.session = session
            self.builder = builder
            self.accumulated = builder.elapsedTime(at: Date())
            self.segmentStart = session.state == .running ? Date() : nil
            // Deliberately not seeded from the statistics above: those are what
            // the daemon banked before the relaunch and say nothing about
            // whether this process's new data source is delivering. Let the
            // watchdog confirm collection actually resumed.
            self.hasHeartRateSample = false
            self.collectionStartedAt = Date()

            DispatchQueue.main.async {
                self.elapsed = self.accumulated
                self.isPaused = session.state == .paused
                self.didFinish = false
                self.isActive = true
                self.hrUnavailable = false
                // Inside the main hop, not outside it: scheduledTimer attaches
                // to the calling thread's run loop, and HealthKit calls this
                // completion back on a queue of its own choosing — one with no
                // run loop spinning, where the timer would never fire and the
                // recovered workout's clock would sit frozen.
                self.startTimer()
                DayStats.shared.showWorkout = true
            }
        }
    }

    private func startTimer() {
        timer?.invalidate()
        timer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] _ in
            guard let self = self else { return }
            if self.isPaused { return }
            let current = self.segmentStart.map { Date().timeIntervalSince($0) } ?? 0
            self.elapsed = self.accumulated + current

            if !self.hasHeartRateSample, !self.hrUnavailable,
               let since = self.collectionStartedAt,
               Date().timeIntervalSince(since) > Self.heartRateGracePeriod {
                self.hrUnavailable = true
            }
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
                        self.hasHeartRateSample = true
                        self.hrUnavailable = false
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
