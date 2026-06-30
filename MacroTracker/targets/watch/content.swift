import SwiftUI
import Combine
import WatchConnectivity

// Brand + macro colors (match the phone app).
extension Color {
    static let hmGreen = Color(red: 16 / 255, green: 185 / 255, blue: 129 / 255)
    static let macroProtein = Color(red: 59 / 255, green: 130 / 255, blue: 246 / 255) // #3B82F6
    static let macroCarbs = Color(red: 245 / 255, green: 158 / 255, blue: 11 / 255)    // #F59E0B
    static let macroFat = Color(red: 239 / 255, green: 68 / 255, blue: 68 / 255)        // #EF4444
    static let waterBlue = Color(red: 56 / 255, green: 189 / 255, blue: 248 / 255)      // #38BDF8
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
        }
    }

    // Auto-start / end the on-wrist workout based on the phone's workout state.
    private func handleWorkoutState(_ ctx: [String: Any]) {
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
                WorkoutManager.shared.start()
                self.showWorkout = true
            }
        } else if !active, !lastHandledWorkoutId.isEmpty {
            lastHandledWorkoutId = ""
            WorkoutManager.shared.end()
            self.showWorkout = false
        }
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
        guard let command = message["command"] as? String else { return }
        DispatchQueue.main.async {
            switch command {
            case "startWorkout":
                WorkoutManager.shared.start()
                self.showWorkout = true
            case "endWorkout":
                WorkoutManager.shared.end()
                self.showWorkout = false
            default:
                break
            }
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
struct WorkoutView: View {
    @ObservedObject private var workout = WorkoutManager.shared
    @ObservedObject private var stats = DayStats.shared

    var body: some View {
        VStack(spacing: 10) {
            if workout.isActive {
                Text(timeString(workout.elapsed))
                    .font(.system(size: 30, weight: .bold, design: .rounded))
                    .foregroundColor(.hmGreen)
                    .monospacedDigit()

                HStack(spacing: 6) {
                    Image(systemName: "heart.fill").foregroundColor(.red)
                    Text(workout.heartRate > 0 ? "\(Int(workout.heartRate))" : "--")
                        .font(.title3).fontWeight(.bold)
                    Text("bpm").font(.caption2).foregroundColor(.secondary)
                }

                HStack(spacing: 5) {
                    Image(systemName: "flame.fill").foregroundColor(.orange)
                    Text("\(Int(workout.activeCalories)) cal")
                        .font(.footnote).fontWeight(.semibold)
                }

                Button(role: .destructive) {
                    workout.end()
                    stats.showWorkout = false
                } label: {
                    Text("End").frame(maxWidth: .infinity)
                }
                .padding(.top, 4)
            } else {
                Image(systemName: "figure.run")
                    .font(.largeTitle)
                    .foregroundColor(.hmGreen)
                Button {
                    workout.start()
                } label: {
                    Text("Start").frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .tint(.hmGreen)
                Button("Cancel") { stats.showWorkout = false }
                    .font(.footnote)
                    .foregroundColor(.secondary)
            }
        }
        .padding()
        .onAppear { workout.requestAuthorization() }
    }
}

// Seconds → "m:ss".
func timeString(_ t: TimeInterval) -> String {
    let total = Int(t)
    return String(format: "%d:%02d", total / 60, total % 60)
}

struct ContentView_Previews: PreviewProvider {
    static var previews: some View {
        ContentView()
    }
}
