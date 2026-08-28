import SwiftUI
import Combine
import WatchConnectivity
import HealthKit
import WatchKit

// Brand + macro colors (match the phone app).
extension Color {
    static let hmGreen = Color(red: 16 / 255, green: 185 / 255, blue: 129 / 255)
    static let macroProtein = Color(red: 59 / 255, green: 130 / 255, blue: 246 / 255) // #3B82F6
    static let macroCarbs = Color(red: 245 / 255, green: 158 / 255, blue: 11 / 255)    // #F59E0B
    static let macroFat = Color(red: 239 / 255, green: 68 / 255, blue: 68 / 255)        // #EF4444
    static let waterBlue = Color(red: 56 / 255, green: 189 / 255, blue: 248 / 255)      // #38BDF8
}

// One planned/performed set of the active workout, mirrored from the phone.
struct WatchSet: Identifiable {
    let id: String
    var weight: Double
    var reps: Int
    var duration: Int
    var completed: Bool
}

// One exercise of the active workout.
struct WatchExercise: Identifiable {
    let id: String
    let name: String
    let mode: String // "reps" | "time"
    var sets: [WatchSet]
}

// A saved workout template the user can start from the wrist.
struct WatchTemplate: Identifiable {
    let id: String
    let name: String
    let activityType: Int // HKWorkoutActivityType raw value
    let exerciseCount: Int
}

// Today's stats shown on the watch, fed live from the phone over
// WatchConnectivity. Read-only: the phone is the source of truth and pushes the
// latest snapshot via updateApplicationContext (see src/services/watch.ts).
final class DayStats: NSObject, ObservableObject, WCSessionDelegate {
    static let shared = DayStats()

    @Published var calorieGoal = 0
    @Published var caloriesConsumed = 0
    @Published var protein = 0
    @Published var proteinGoal = 0
    @Published var carbs = 0
    @Published var carbsGoal = 0
    @Published var fat = 0
    @Published var fatGoal = 0
    @Published var water = 0
    @Published var waterGoal = 0
    @Published var hasData = false
    @Published var showWorkout = false // drives the full-screen workout cover
    @Published var exercises: [WatchExercise] = [] // active workout plan
    @Published var templates: [WatchTemplate] = [] // saved templates to start from

    var caloriesRemaining: Int { max(0, calorieGoal - caloriesConsumed) }
    var calorieProgress: Double { ratio(caloriesConsumed, calorieGoal) }
    var waterProgress: Double { ratio(water, waterGoal) }

    func ratio(_ value: Int, _ goal: Int) -> Double {
        goal > 0 ? min(1, Double(value) / Double(goal)) : 0
    }

    override init() {
        super.init()
        if WCSession.isSupported() {
            let session = WCSession.default
            session.delegate = self
            session.activate()
        }
    }

    // Tracks the last workout we auto-started so a repeated context delivery
    // doesn't restart it.
    private var lastHandledWorkoutId = ""

    // JS numbers bridge across as NSNumber; read them defensively.
    private func intVal(_ any: Any?) -> Int? {
        if let n = any as? NSNumber { return n.intValue }
        if let i = any as? Int { return i }
        if let d = any as? Double { return Int(d) }
        return nil
    }

    private func doubleVal(_ any: Any?) -> Double? {
        if let n = any as? NSNumber { return n.doubleValue }
        if let d = any as? Double { return d }
        if let i = any as? Int { return Double(i) }
        return nil
    }

    private func apply(_ ctx: [String: Any]) {
        guard !ctx.isEmpty else { return }
        DispatchQueue.main.async {
            if let v = self.intVal(ctx["caloriesConsumed"]) { self.caloriesConsumed = v }
            if let v = self.intVal(ctx["calorieGoal"]) { self.calorieGoal = v }
            if let v = self.intVal(ctx["protein"]) { self.protein = v }
            if let v = self.intVal(ctx["proteinGoal"]) { self.proteinGoal = v }
            if let v = self.intVal(ctx["carbs"]) { self.carbs = v }
            if let v = self.intVal(ctx["carbsGoal"]) { self.carbsGoal = v }
            if let v = self.intVal(ctx["fat"]) { self.fat = v }
            if let v = self.intVal(ctx["fatGoal"]) { self.fatGoal = v }
            if let v = self.intVal(ctx["water"]) { self.water = v }
            if let v = self.intVal(ctx["waterGoal"]) { self.waterGoal = v }
            // Calorie/macro keys may be absent on a workout-only push; only flip
            // hasData once we've actually received nutrition numbers.
            if ctx["calorieGoal"] != nil { self.hasData = true }
            self.handleWorkoutState(ctx)
            self.parsePlan(ctx)
            self.parseTemplates(ctx)
        }
    }

    // Parse the user's saved workout templates from the context (absent key =
    // leave the current list untouched).
    private func parseTemplates(_ ctx: [String: Any]) {
        guard let raw = ctx["workoutTemplates"] as? [[String: Any]] else { return }
        templates = raw.map { t in
            WatchTemplate(
                id: t["id"] as? String ?? UUID().uuidString,
                name: t["name"] as? String ?? "Workout",
                activityType: self.intVal(t["at"]) ?? 0,
                exerciseCount: self.intVal(t["n"]) ?? 0
            )
        }
    }

    // Parse the active workout's exercises/sets from the context.
    private func parsePlan(_ ctx: [String: Any]) {
        guard let raw = ctx["workoutPlan"] as? [[String: Any]] else { return }
        exercises = raw.map { ex in
            WatchExercise(
                id: ex["id"] as? String ?? UUID().uuidString,
                name: ex["name"] as? String ?? "Exercise",
                mode: ex["mode"] as? String ?? "reps",
                sets: (ex["sets"] as? [[String: Any]] ?? []).map { s in
                    WatchSet(
                        id: s["id"] as? String ?? UUID().uuidString,
                        weight: self.doubleVal(s["w"]) ?? 0,
                        reps: self.intVal(s["r"]) ?? 0,
                        duration: self.intVal(s["d"]) ?? 0,
                        completed: (s["c"] as? NSNumber)?.boolValue ?? (s["c"] as? Bool) ?? false
                    )
                }
            )
        }
    }

    // Check a set on/off from the wrist.
    func toggleSet(exerciseId: String, setId: String) {
        guard let exIdx = exercises.firstIndex(where: { $0.id == exerciseId }),
              let setIdx = exercises[exIdx].sets.firstIndex(where: { $0.id == setId })
        else { return }
        setSetCompleted(exerciseId: exerciseId, setId: setId,
                        completed: !exercises[exIdx].sets[setIdx].completed)
    }

    // Set a set's completed state to an absolute value: flip locally for instant
    // feedback and send it to the phone, which is the source of truth and
    // re-pushes the reconciled plan.
    func setSetCompleted(exerciseId: String, setId: String, completed: Bool) {
        guard let exIdx = exercises.firstIndex(where: { $0.id == exerciseId }),
              let setIdx = exercises[exIdx].sets.firstIndex(where: { $0.id == setId })
        else { return }
        exercises[exIdx].sets[setIdx].completed = completed // optimistic
        sendSetMessage([
            "type": "toggleSet",
            "exerciseId": exerciseId,
            "setId": setId,
            "completed": completed,
        ])
    }

    // Edit a set's weight/reps/duration from the wrist: update locally for
    // instant feedback and send the new values to the phone to persist.
    func updateSet(exerciseId: String, setId: String, weight: Double, reps: Int, duration: Int) {
        guard let exIdx = exercises.firstIndex(where: { $0.id == exerciseId }),
              let setIdx = exercises[exIdx].sets.firstIndex(where: { $0.id == setId })
        else { return }
        exercises[exIdx].sets[setIdx].weight = weight
        exercises[exIdx].sets[setIdx].reps = reps
        exercises[exIdx].sets[setIdx].duration = duration
        sendSetMessage([
            "type": "updateSet",
            "exerciseId": exerciseId,
            "setId": setId,
            "weight": weight,
            "reps": reps,
            "duration": duration,
        ])
    }

    // Watch→phone set updates. Uses sendMessage (the proven path, same as HR
    // streaming); transferUserInfo received events are unreliable on the RN side.
    private func sendSetMessage(_ message: [String: Any]) {
        sendReliable(message)
    }

    // sendMessage silently drops a command if the phone isn't reachable at that
    // exact instant (screen off, momentarily out of Bluetooth range) — there's no
    // queued fallback wired up on the phone's WatchConnectivity binding, so a
    // one-shot send can lose a set check-off or a finished workout entirely.
    // Retry with backoff instead of firing once and hoping; give up once the
    // session deactivates or after a handful of attempts.
    private func sendReliable(_ message: [String: Any], attempt: Int = 0) {
        let session = WCSession.default
        guard session.activationState == .activated else { return }
        guard session.isReachable else {
            retryReliableSend(message, attempt: attempt)
            return
        }
        session.sendMessage(message, replyHandler: nil, errorHandler: { [weak self] _ in
            self?.retryReliableSend(message, attempt: attempt)
        })
    }

    private func retryReliableSend(_ message: [String: Any], attempt: Int) {
        guard attempt < 5 else { return } // ~1+2+4+8+16s of retrying, then give up
        let delay = pow(2.0, Double(attempt))
        DispatchQueue.main.asyncAfter(deadline: .now() + delay) { [weak self] in
            self?.sendReliable(message, attempt: attempt + 1)
        }
    }

    // Complete the whole workout from the wrist: end the on-wrist session (shows
    // the watch summary) and tell the phone to finish + save it to history.
    func finishWorkoutFromWatch(completeAll: Bool = false) {
        // Optimistically reflect the "complete all" choice on the watch too, so
        // the exercises list matches what the phone will save.
        if completeAll {
            for i in exercises.indices {
                for j in exercises[i].sets.indices {
                    exercises[i].sets[j].completed = true
                }
            }
        }
        WorkoutManager.shared.end()
        sendReliable(["type": "finishWorkout", "completeAll": completeAll])
    }

    // Count of sets not yet checked off — drives the finish confirmation prompt.
    var uncheckedSetCount: Int {
        exercises.reduce(0) { $0 + $1.sets.filter { !$0.completed }.count }
    }

    // Start a workout from the wrist. Optimistically begin the on-wrist session
    // (so HR/calories start immediately) and ask the phone to create + log the
    // matching workout, which then streams the plan back. Pass nil for a blank
    // "quick start". Ignored if a workout is already running.
    func startTemplate(_ template: WatchTemplate?) {
        guard !WorkoutManager.shared.isActive else { return }
        let raw = UInt(max(0, template?.activityType ?? 0))
        let type = HKWorkoutActivityType(rawValue: raw) ?? .functionalStrengthTraining
        WorkoutManager.shared.start(activityType: type)
        showWorkout = true
        sendReliable(["type": "startTemplate", "templateId": template?.id ?? ""])
    }

    // Auto-start / end the on-wrist workout based on the phone's workout state.
    private func handleWorkoutState(_ ctx: [String: Any]) {
        // No workout signal in this context — e.g. a glance-only update, or the
        // phone app restarting before it has re-established its workout state.
        // Leave the on-wrist workout exactly as it is; only an explicit
        // workoutActive value may start or end it.
        guard ctx.keys.contains("workoutActive") else { return }
        let active = (ctx["workoutActive"] as? NSNumber)?.boolValue
            ?? (ctx["workoutActive"] as? Bool) ?? false
        let workoutId = ctx["workoutId"] as? String ?? ""
        let startedAt = (ctx["workoutStartedAt"] as? NSNumber)?.doubleValue ?? 0

        if active, !workoutId.isEmpty, workoutId != lastHandledWorkoutId {
            // Only start for a recently-begun workout, so a stale context after
            // a relaunch doesn't kick off a phantom session.
            let ageMs = Date().timeIntervalSince1970 * 1000 - startedAt
            if ageMs < 5 * 60 * 1000 {
                lastHandledWorkoutId = workoutId
                WorkoutManager.shared.start(activityType: activityType(from: ctx))
                self.showWorkout = true
            }
        } else if !active, !lastHandledWorkoutId.isEmpty {
            lastHandledWorkoutId = ""
            if WorkoutManager.shared.isActive {
                WorkoutManager.shared.end()
            }
            // Keep the recap up if the watch already finished it itself.
            if !WorkoutManager.shared.didFinish {
                self.showWorkout = false
            }
        }
    }

    // Map the phone's HKWorkoutActivityType raw value to the enum, defaulting to
    // functional strength training.
    private func activityType(from ctx: [String: Any]) -> HKWorkoutActivityType {
        if let raw = (ctx["workoutActivityType"] as? NSNumber)?.uintValue,
           raw > 0,
           let type = HKWorkoutActivityType(rawValue: raw) {
            return type
        }
        return .functionalStrengthTraining
    }

    func session(
        _ session: WCSession,
        activationDidCompleteWith activationState: WCSessionActivationState,
        error: Error?
    ) {
        apply(session.receivedApplicationContext)
    }

    func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) {
        apply(applicationContext)
    }

    // Live commands from the phone: start/end the on-wrist workout in step with
    // the phone's workout so heart rate is captured automatically.
    func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
        DispatchQueue.main.async {
            if let command = message["command"] as? String {
                switch command {
                case "startWorkout":
                    WorkoutManager.shared.start(activityType: self.activityType(from: message))
                    self.showWorkout = true
                case "endWorkout":
                    WorkoutManager.shared.end()
                    self.showWorkout = false
                default:
                    break
                }
            }
            // Rest timer may also arrive as a live message when reachable.
            self.handleRest(message)
        }
    }

    // Rest is sent via transferUserInfo so it lands even when the watch screen
    // is off during a workout (sendMessage would be dropped as unreachable).
    func session(_ session: WCSession, didReceiveUserInfo userInfo: [String: Any]) {
        DispatchQueue.main.async { self.handleRest(userInfo) }
    }

    private func handleRest(_ info: [String: Any]) {
        guard let type = info["type"] as? String else { return }
        switch type {
        case "rest":
            if let endAt = (info["endAt"] as? NSNumber)?.doubleValue {
                RestManager.shared.start(endAtMs: endAt)
            }
        case "restStop":
            RestManager.shared.stop()
        default:
            break
        }
    }
}

// Mirrors the phone's rest countdown and buzzes the wrist when it completes.
// Driven by a shared end timestamp so the watch and phone stay in lockstep.
final class RestManager: ObservableObject {
    static let shared = RestManager()

    @Published var active = false
    @Published var remaining: TimeInterval = 0
    private var endAt: Date?
    private var timer: Timer?

    func start(endAtMs: Double) {
        endAt = Date(timeIntervalSince1970: endAtMs / 1000)
        active = true
        tick()
        timer?.invalidate()
        timer = Timer.scheduledTimer(withTimeInterval: 0.25, repeats: true) { [weak self] _ in
            self?.tick()
        }
    }

    func stop() {
        timer?.invalidate()
        timer = nil
        endAt = nil
        active = false
        remaining = 0
    }

    private func tick() {
        guard let endAt = endAt else { return }
        let left = endAt.timeIntervalSinceNow
        if left <= 0 {
            remaining = 0
            timer?.invalidate()
            timer = nil
            WKInterfaceDevice.current().play(.notification) // buzz when rest is up
            DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
                if self.remaining == 0 { self.active = false; self.endAt = nil }
            }
        } else {
            remaining = left
        }
    }
}

struct ContentView: View {
    @StateObject private var stats = DayStats.shared

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                if !stats.hasData {
                    VStack(spacing: 6) {
                        Image(systemName: "iphone.and.arrow.forward")
                            .font(.title3)
                            .foregroundColor(.hmGreen)
                        Text("Open Holy Macro on your iPhone to sync.")
                            .font(.footnote)
                            .multilineTextAlignment(.center)
                            .foregroundColor(.secondary)
                    }
                    .padding(.top, 8)
                } else {
                    // Hero: calories remaining ring
                    ZStack {
                        Circle()
                            .stroke(Color.hmGreen.opacity(0.2), lineWidth: 9)
                        Circle()
                            .trim(from: 0, to: stats.calorieProgress)
                            .stroke(Color.hmGreen, style: StrokeStyle(lineWidth: 9, lineCap: .round))
                            .rotationEffect(.degrees(-90))
                        VStack(spacing: 0) {
                            Text("\(stats.caloriesRemaining)")
                                .font(.system(size: 30, weight: .bold, design: .rounded))
                                .foregroundColor(.hmGreen)
                            Text("cal left")
                                .font(.system(size: 11))
                                .foregroundColor(.secondary)
                        }
                    }
                    .frame(width: 112, height: 112)
                    .padding(.top, 2)

                    // Macros as colored rings
                    HStack(spacing: 6) {
                        MacroRing(label: "Protein", value: stats.protein, goal: stats.proteinGoal, color: .macroProtein)
                        MacroRing(label: "Carbs", value: stats.carbs, goal: stats.carbsGoal, color: .macroCarbs)
                        MacroRing(label: "Fat", value: stats.fat, goal: stats.fatGoal, color: .macroFat)
                    }

                    // Water bar
                    VStack(spacing: 4) {
                        HStack {
                            Text("Water")
                                .font(.caption2)
                                .foregroundColor(.secondary)
                            Spacer()
                            Text("\(stats.water) / \(stats.waterGoal) oz")
                                .font(.caption2)
                                .fontWeight(.semibold)
                        }
                        GeometryReader { geo in
                            ZStack(alignment: .leading) {
                                Capsule().fill(Color.waterBlue.opacity(0.22))
                                Capsule()
                                    .fill(Color.waterBlue)
                                    .frame(width: max(6, geo.size.width * stats.waterProgress))
                            }
                        }
                        .frame(height: 6)
                    }
                    .padding(.top, 2)
                }

                // Start a native on-wrist workout (live HR + calories).
                Button {
                    stats.showWorkout = true
                } label: {
                    Label("Start Workout", systemImage: "figure.run")
                        .font(.footnote)
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .tint(.hmGreen)
                .padding(.top, 2)
            }
            .padding(.horizontal)
            .frame(maxWidth: .infinity)
        }
        .fullScreenCover(isPresented: $stats.showWorkout) {
            WorkoutView()
        }
    }
}

// A small colored progress ring with the consumed grams in the center and the
// macro name below.
struct MacroRing: View {
    let label: String
    let value: Int
    let goal: Int
    let color: Color

    private var progress: Double {
        goal > 0 ? min(1, Double(value) / Double(goal)) : 0
    }

    var body: some View {
        VStack(spacing: 3) {
            ZStack {
                Circle().stroke(color.opacity(0.22), lineWidth: 5)
                Circle()
                    .trim(from: 0, to: progress)
                    .stroke(color, style: StrokeStyle(lineWidth: 5, lineCap: .round))
                    .rotationEffect(.degrees(-90))
                Text("\(value)")
                    .font(.system(size: 14, weight: .bold, design: .rounded))
                    .minimumScaleFactor(0.6)
            }
            .frame(width: 46, height: 46)
            Text(label)
                .font(.system(size: 9))
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity)
    }
}

// Live workout screen — presented full-screen from the glance. Shows elapsed
// time, live heart rate, and active calories from the HKWorkoutSession.
// Identifies the set being edited in the sheet, carrying its current values so
// the editor can seed itself without a live lookup (which could momentarily
// miss during a plan re-push).
struct SetRef: Identifiable {
    let exerciseId: String
    let setId: String
    let mode: String
    let weight: Double
    let reps: Int
    let duration: Int
    let completed: Bool
    var id: String { setId }
}

struct WorkoutView: View {
    @ObservedObject private var workout = WorkoutManager.shared
    @ObservedObject private var stats = DayStats.shared
    @ObservedObject private var rest = RestManager.shared
    @State private var showFinishPrompt = false
    @State private var editingSet: SetRef?

    var body: some View {
        Group {
            if workout.isActive {
                // Swipe between the live metrics and the exercise/set list.
                TabView {
                    ScrollView { liveScreen.padding() }
                    ScrollView { exercisesScreen.padding() }
                }
                .tabViewStyle(.page)
            } else if workout.didFinish {
                ScrollView { summaryScreen.padding() }
            } else {
                ScrollView { idleScreen.padding() }
            }
        }
        .onAppear { workout.requestAuthorization() }
        .alert(
            "Couldn't Start Workout",
            isPresented: Binding(
                get: { workout.startError != nil },
                set: { if !$0 { workout.startError = nil } }
            )
        ) {
            Button("OK", role: .cancel) { workout.startError = nil }
        } message: {
            Text(workout.startError ?? "")
        }
    }

    // The active workout's exercises + sets. Tap the circle to check a set off;
    // tap the row to edit its weight/reps on the wrist.
    private var exercisesScreen: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Exercises")
                .font(.caption2)
                .foregroundColor(.hmGreen)
                .fontWeight(.semibold)

            if stats.exercises.isEmpty {
                Text("No exercises in this workout.")
                    .font(.footnote)
                    .foregroundColor(.secondary)
            } else {
                ForEach(stats.exercises) { ex in
                    VStack(alignment: .leading, spacing: 6) {
                        Text(ex.name).font(.footnote).fontWeight(.bold)
                        ForEach(ex.sets) { set in
                            HStack(spacing: 8) {
                                Button {
                                    stats.toggleSet(exerciseId: ex.id, setId: set.id)
                                } label: {
                                    Image(systemName: set.completed ? "checkmark.circle.fill" : "circle")
                                        .foregroundColor(set.completed ? .hmGreen : .secondary)
                                }
                                .buttonStyle(.plain)

                                Button {
                                    editingSet = SetRef(
                                        exerciseId: ex.id,
                                        setId: set.id,
                                        mode: ex.mode,
                                        weight: set.weight,
                                        reps: set.reps,
                                        duration: set.duration,
                                        completed: set.completed
                                    )
                                } label: {
                                    HStack {
                                        Text(setLabel(ex, set))
                                            .font(.caption2)
                                            .foregroundColor(set.completed ? .secondary : .primary)
                                        Spacer()
                                        Image(systemName: "square.and.pencil")
                                            .font(.caption2)
                                            .foregroundColor(.hmGreen)
                                    }
                                }
                                .buttonStyle(.plain)
                            }
                            .padding(.vertical, 3)
                            .padding(.horizontal, 6)
                            .background(Color.gray.opacity(0.12))
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                        }
                    }
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .sheet(item: $editingSet) { ref in
            SetEditView(ref: ref)
        }
    }

    private func setLabel(_ ex: WatchExercise, _ set: WatchSet) -> String {
        if ex.mode == "time" {
            let t = timeString(TimeInterval(set.duration))
            return set.weight > 0 ? "\(weightString(set.weight)) × \(t)" : t
        }
        return set.weight > 0 ? "\(weightString(set.weight)) × \(set.reps)" : "\(set.reps) reps"
    }

    // Live metrics + pause/resume + end.
    private var liveScreen: some View {
        VStack(spacing: 10) {
            // Rest countdown mirrored from the phone (buzzes when it hits 0).
            if rest.active {
                HStack(spacing: 5) {
                    Image(systemName: "timer").foregroundColor(.hmGreen)
                    Text("Rest \(timeString(rest.remaining))")
                        .font(.footnote).fontWeight(.bold)
                        .monospacedDigit()
                }
                .padding(.vertical, 4)
                .padding(.horizontal, 10)
                .background(Color.hmGreen.opacity(0.18))
                .clipShape(Capsule())
            }

            Text(timeString(workout.elapsed))
                .font(.system(size: 30, weight: .bold, design: .rounded))
                .foregroundColor(workout.isPaused ? .secondary : .hmGreen)
                .monospacedDigit()

            if workout.isPaused {
                Text("Paused").font(.caption2).foregroundColor(.secondary)
            }

            HStack(spacing: 4) {
                Text(workout.heartRate > 0 ? "\(Int(workout.heartRate))" : "--")
                    .font(.title2).fontWeight(.bold)
                    .foregroundColor(workout.heartRate > 0 ? hrZoneColor(workout.heartRate) : .secondary)
                Text("bpm").font(.caption2).foregroundColor(.secondary)
            }

            HStack(spacing: 5) {
                Image(systemName: "flame.fill").foregroundColor(.orange)
                Text("\(Int(workout.activeCalories)) cal")
                    .font(.footnote).fontWeight(.semibold)
            }

            HStack(spacing: 8) {
                Button {
                    if workout.isPaused { workout.resume() } else { workout.pause() }
                } label: {
                    Image(systemName: workout.isPaused ? "play.fill" : "pause.fill")
                        .frame(maxWidth: .infinity)
                }
                .tint(.hmGreen)

                Button(role: .destructive) {
                    workout.end()
                } label: {
                    Image(systemName: "stop.fill").frame(maxWidth: .infinity)
                }
            }
            .padding(.top, 4)

            // Always available so the workout can be wrapped up from the wrist
            // at any point, not only once every set is checked off. If sets are
            // still unchecked, offer to complete them first.
            Button {
                if stats.uncheckedSetCount > 0 {
                    showFinishPrompt = true
                } else {
                    stats.finishWorkoutFromWatch()
                }
            } label: {
                Label("Complete Workout", systemImage: "checkmark")
                    .font(.footnote)
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .tint(.hmGreen)
            .padding(.top, 2)
            .confirmationDialog(
                "\(stats.uncheckedSetCount) set\(stats.uncheckedSetCount == 1 ? "" : "s") still unchecked",
                isPresented: $showFinishPrompt,
                titleVisibility: .visible
            ) {
                Button("Complete All & Finish") {
                    stats.finishWorkoutFromWatch(completeAll: true)
                }
                Button("Finish Anyway") {
                    stats.finishWorkoutFromWatch(completeAll: false)
                }
                Button("Cancel", role: .cancel) {}
            }
        }
    }

    // Post-workout recap.
    private var summaryScreen: some View {
        VStack(spacing: 8) {
            Text("Workout Complete")
                .font(.headline)
                .foregroundColor(.hmGreen)
            summaryRow("Time", timeString(workout.elapsed))
            summaryRow("Avg HR", workout.avgHeartRate > 0 ? "\(Int(workout.avgHeartRate)) bpm" : "--")
            summaryRow("Calories", "\(Int(workout.activeCalories))")
            Button {
                workout.reset()
                stats.showWorkout = false
            } label: {
                Text("Done").frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .tint(.hmGreen)
            .padding(.top, 4)
        }
    }

    private var idleScreen: some View {
        VStack(spacing: 8) {
            Text("Start Workout")
                .font(.headline)
                .foregroundColor(.hmGreen)

            // Saved templates from the phone — tap one to start it.
            if stats.templates.isEmpty {
                Text("No saved templates. Create them on your iPhone.")
                    .font(.caption2)
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
                    .padding(.vertical, 2)
            } else {
                ForEach(stats.templates) { t in
                    Button {
                        stats.startTemplate(t)
                    } label: {
                        VStack(alignment: .leading, spacing: 1) {
                            Text(t.name).font(.footnote).fontWeight(.semibold)
                            Text("\(t.exerciseCount) exercise\(t.exerciseCount == 1 ? "" : "s")")
                                .font(.caption2)
                                .foregroundColor(.secondary)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    .buttonStyle(.bordered)
                    .tint(.hmGreen)
                }
            }

            // Blank session.
            Button {
                stats.startTemplate(nil)
            } label: {
                Label("Quick Start", systemImage: "bolt.fill")
                    .font(.footnote)
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .tint(.hmGreen)
            .padding(.top, 2)

            Button("Cancel") { stats.showWorkout = false }
                .font(.footnote)
                .foregroundColor(.secondary)
        }
    }

    private func summaryRow(_ label: String, _ value: String) -> some View {
        HStack {
            Text(label).font(.caption2).foregroundColor(.secondary)
            Spacer()
            Text(value).font(.footnote).fontWeight(.semibold)
        }
    }
}

// Edit a single set from the wrist: adjust weight and reps (or time) with the
// steppers (Digital Crown works too), and check it off. Changes are pushed to
// the phone live; the phone persists them and re-pushes the reconciled plan.
struct SetEditView: View {
    let ref: SetRef
    @ObservedObject private var stats = DayStats.shared
    @Environment(\.dismiss) private var dismiss
    @State private var weight: Double
    @State private var reps: Int
    @State private var duration: Int
    @State private var completed: Bool

    init(ref: SetRef) {
        self.ref = ref
        _weight = State(initialValue: ref.weight)
        _reps = State(initialValue: ref.reps)
        _duration = State(initialValue: ref.duration)
        _completed = State(initialValue: ref.completed)
    }

    private var isTime: Bool { ref.mode == "time" }

    // Fine adjustment (±1 lb) for the first 10 lb, coarser (±2.5 lb) above.
    private func bumpWeightUp() {
        weight = min(2000, weight + (weight < 10 ? 1 : 2.5))
        pushEdit()
    }
    private func bumpWeightDown() {
        weight = max(0, weight - (weight <= 10 ? 1 : 2.5))
        pushEdit()
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 10) {
                Stepper(onIncrement: { bumpWeightUp() }, onDecrement: { bumpWeightDown() }) {
                    field("Weight", "\(weightString(weight)) lb")
                }

                if isTime {
                    Stepper(value: $duration, in: 0...86400, step: 5) {
                        field("Time", timeString(TimeInterval(duration)))
                    }
                    .onChange(of: duration) { _ in pushEdit() }
                } else {
                    Stepper(value: $reps, in: 0...999, step: 1) {
                        field("Reps", "\(reps)")
                    }
                    .onChange(of: reps) { _ in pushEdit() }
                }

                // Doubles as the "done" action: mark the set complete and close
                // the editor. Only ever checks (never unchecks) — uncheck from
                // the workout page's set list. Edits are pushed live as you go.
                Button {
                    completed = true
                    stats.setSetCompleted(exerciseId: ref.exerciseId, setId: ref.setId, completed: true)
                    dismiss()
                } label: {
                    HStack {
                        Image(systemName: completed ? "checkmark.circle.fill" : "circle")
                        Text(completed ? "Done" : "Mark Complete")
                    }
                    .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .tint(.hmGreen)
            }
            .padding()
        }
    }

    private func field(_ label: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 1) {
            Text(label).font(.caption2).foregroundColor(.secondary)
            Text(value).font(.title3).fontWeight(.bold).foregroundColor(.primary)
        }
    }

    private func pushEdit() {
        stats.updateSet(
            exerciseId: ref.exerciseId,
            setId: ref.setId,
            weight: weight,
            reps: reps,
            duration: duration
        )
    }
}

// Seconds → "m:ss".
func timeString(_ t: TimeInterval) -> String {
    let total = Int(t)
    return String(format: "%d:%02d", total / 60, total % 60)
}

// Weight → compact string: whole numbers show plain (45), halves show one
// decimal (12.5).
func weightString(_ w: Double) -> String {
    w == w.rounded() ? String(Int(w)) : String(format: "%.1f", w)
}

// Color the heart rate by intensity zone (mirrors the phone).
func hrZoneColor(_ bpm: Double) -> Color {
    if bpm >= 160 { return .red }
    if bpm >= 120 { return .orange }
    return .hmGreen
}

struct ContentView_Previews: PreviewProvider {
    static var previews: some View {
        ContentView()
    }
}
