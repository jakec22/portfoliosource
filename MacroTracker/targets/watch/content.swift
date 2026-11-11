import SwiftUI
import Combine
import WatchConnectivity
import HealthKit
import WatchKit
import WidgetKit

// Fallback palette, used until the phone pushes the active theme pack's colors
// (see WatchPalette).
//
// These are exactly what watchPalette() produces for the default Executive
// pack, taken from running it rather than worked out by hand. They are what a
// watch shows before the phone has pushed anything — on a fresh install, or
// when a payload is malformed — so they have to be kept in step with the pack
// by hand. A stale set here means a watch that hasn't synced yet shows a
// palette the phone has long since dropped.
//
// Nothing is lifted any more: Executive is dark on the same #0E0E10 ground the
// watch paints, so every value already clears 4.5:1 there.
extension Color {
    static let hmGreen = Color(red: 0x34 / 255, green: 0xC7 / 255, blue: 0x7B / 255) // #34C77B
    static let macroProtein = Color(red: 0xE2 / 255, green: 0x68 / 255, blue: 0x3C / 255) // #E2683C
    static let macroCarbs = Color(red: 0xE0 / 255, green: 0xA3 / 255, blue: 0x2E / 255)   // #E0A32E
    static let macroFat = Color(red: 0xD1 / 255, green: 0x69 / 255, blue: 0x9B / 255)     // #D1699B
    static let waterBlue = Color(red: 0x5A / 255, green: 0x9F / 255, blue: 0xD4 / 255)    // #5A9FD4

    // "#RRGGBB" → Color, falling back to a supplied default on anything
    // malformed so a bad payload can't blank the UI.
    init(hex: String, fallback: Color) {
        let raw = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var value: UInt64 = 0
        guard raw.count == 6, Scanner(string: raw).scanHexInt64(&value) else {
            self = fallback
            return
        }
        self = Color(
            .sRGB,
            red: Double((value & 0xFF0000) >> 16) / 255,
            green: Double((value & 0x00FF00) >> 8) / 255,
            blue: Double(value & 0x0000FF) / 255,
            opacity: 1
        )
    }
}

// The active pack's colors, pushed by the phone. Every pack stays dark on the
// wrist — watchOS has no light mode to follow — and the phone lifts anything
// too dim to read against that ground before sending it.
struct WatchPalette {
    // Background the app paints, per pack: Executive's neutral near-black,
    // which is also what the phone paints, so the two match. Modern keeps pure
    // black where its neon accents already sit high. See watchPalette.ts.
    var ground: Color = Color(red: 0x0E / 255, green: 0x0E / 255, blue: 0x10 / 255) // #0E0E10
    var accent: Color = .hmGreen
    // Executive's danger. Explicit rather than relying on SwiftUI's
    // `role: .destructive`: the view-level tint below wins over the role,
    // which is what turned the stop button green.
    var danger: Color = Color(red: 0xF4 / 255, green: 0x75 / 255, blue: 0x6D / 255) // #F4756D
    var protein: Color = .macroProtein
    var carbs: Color = .macroCarbs
    var fat: Color = .macroFat
    var fiber: Color = Color(red: 0x79 / 255, green: 0xC9 / 255, blue: 0x93 / 255) // #79C993
    var water: Color = .waterBlue
    // Executive's hrZone2 / hrZone3 / hrZone5.
    var zoneEasy: Color = Color(red: 0x79 / 255, green: 0xC9 / 255, blue: 0x93 / 255) // #79C993
    var zoneMid: Color = Color(red: 0xE0 / 255, green: 0xA3 / 255, blue: 0x2E / 255)  // #E0A32E
    var zoneHigh: Color = Color(red: 0xF4 / 255, green: 0x75 / 255, blue: 0x6D / 255) // #F4756D

    static func from(_ ctx: [String: Any], current: WatchPalette) -> WatchPalette {
        func color(_ key: String, _ fallback: Color) -> Color {
            guard let hex = ctx[key] as? String else { return fallback }
            return Color(hex: hex, fallback: fallback)
        }
        return WatchPalette(
            ground: color("themeGround", current.ground),
            accent: color("themeAccent", current.accent),
            danger: color("themeDanger", current.danger),
            protein: color("themeProtein", current.protein),
            carbs: color("themeCarbs", current.carbs),
            fat: color("themeFat", current.fat),
            fiber: color("themeFiber", current.fiber),
            water: color("themeWater", current.water),
            zoneEasy: color("themeZoneEasy", current.zoneEasy),
            zoneMid: color("themeZoneMid", current.zoneMid),
            zoneHigh: color("themeZoneHigh", current.zoneHigh)
        )
    }
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

/// A sauna / cold plunge the watch can start on its own, with the target the
/// user last set on the phone.
struct WatchRecovery: Identifiable {
    let id: String   // the RecoveryKind: "sauna" | "plunge"
    let name: String
    let target: Int  // seconds
    let mode: String // "down" | "up"

    var symbol: String { id == "plunge" ? "snowflake" : "thermometer.sun.fill" }
}

// A saved workout template the user can start from the wrist.
struct WatchTemplate: Identifiable {
    let id: String
    let name: String
    let activityType: Int // HKWorkoutActivityType raw value
    let exerciseCount: Int
}

// What the watch app leaves behind for its complication.
//
// The iOS widget reads the phone's App Group; a watchOS complication cannot
// reach that container, and DayStats lives only in memory, so without this the
// complication would have nothing to draw between launches. Written on every
// context the phone pushes and on every wrist-side edit.
//
// Deliberately duplicated in targets/watch-widget/index.swift: the two are
// separate compilation units with no shared file, so the struct travels by
// being identical. Change one, change the other.
struct WatchSnapshot: Codable {
    var date: String
    var caloriesConsumed: Int
    var calorieGoal: Int
    var protein: Int
    var proteinGoal: Int
    var carbs: Int
    var carbsGoal: Int
    var fat: Int
    var fatGoal: Int
    var fiber: Int
    var fiberGoal: Int
    var water: Int
    var waterGoal: Int
    var showWater: Bool
    var accent: String
    var danger: String
    var proteinColor: String
    var carbsColor: String
    var fatColor: String
    var fiberColor: String
    var waterColor: String
}

let watchAppGroup = "group.com.jacobclover.macrotracker"
let watchSnapshotKey = "watchDayStats"

// Today's stats shown on the watch, fed live from the phone over
// WatchConnectivity. Read-only: the phone is the source of truth and pushes the
// latest snapshot via updateApplicationContext (see src/services/watch.ts).
/// The app's faces on the wrist.
///
/// The phone's rule (src/theme/index.ts) is that `fontDisplay` carries
/// headlines and hero numerals and the body ladder carries everything else.
/// The watch follows the same rule: the serif is on each stop's hero numeral
/// and on the three short headings (Train, Start Workout, Workout Complete),
/// and nothing else. Labels stay on Manrope, which holds up at 11pt where a
/// serif would not, and so do two numerals that change while you watch them —
/// the workout clock and the live heart rate — because DM Serif Display has
/// no tabular figures and would jitter sideways on every tick.
///
/// Every size passes through `relativeTo:`, so the watch's own text-size
/// setting scales the app instead of being ignored. Sizes below are the
/// default-setting values, not fixed points.
///
/// Every call falls back to the system face, so a build where the fonts did
/// not register renders plainly instead of blank.
enum WatchType {
    static func display(_ size: CGFloat, relativeTo style: Font.TextStyle = .title) -> Font {
        Font.custom("DMSerifDisplay-Regular", size: size, relativeTo: style)
    }
    static func body(_ size: CGFloat, relativeTo style: Font.TextStyle = .body) -> Font {
        Font.custom("Manrope-Medium", size: size, relativeTo: style)
    }
    static func semibold(_ size: CGFloat, relativeTo style: Font.TextStyle = .body) -> Font {
        Font.custom("Manrope-SemiBold", size: size, relativeTo: style)
    }
    static func bold(_ size: CGFloat, relativeTo style: Font.TextStyle = .body) -> Font {
        Font.custom("Manrope-Bold", size: size, relativeTo: style)
    }

    /// The one face that is not the app's own: live numerals.
    ///
    /// A value that updates in place needs tabular figures, and neither
    /// DM Serif Display nor Manrope has them — a clock on either jitters
    /// sideways on every digit change. SF Rounded does, and `monospacedDigit`
    /// is baked in here rather than left to each call site, which is how the
    /// two heart-rate readouts ended up without it while the clocks had it.
    ///
    /// Deliberately a fixed size, unlike every other face here: these are the
    /// elements the glance screens are laid out around, and a clock that
    /// reflows at a larger text setting costs more than one that does not.
    /// Use it only for numbers that change while you are looking at them.
    static func readout(_ size: CGFloat) -> Font {
        Font.system(size: size, weight: .bold, design: .rounded).monospacedDigit()
    }
}

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
    @Published var fiber = 0
    @Published var fiberGoal = 0
    @Published var water = 0
    @Published var waterGoal = 0
    // Mirrors the phone's toggle. Defaults to true so an older phone build,
    // which doesn't send the key, keeps showing water as it always has.
    @Published var showWater = true
    @Published var hasData = false
    // The day the nutrition numbers are for, as sent by the phone. Empty for
    // a context from a build that predates the key, which is treated as
    // current so an older phone keeps working.
    private var statsDate = ""
    @Published var showWorkout = false // drives the full-screen workout cover
    @Published var exercises: [WatchExercise] = [] // active workout plan
    @Published var templates: [WatchTemplate] = [] // saved templates to start from
    @Published var recoveries: [WatchRecovery] = [] // sauna / plunge, startable here
    // The running recovery, mirrored from the phone (or set locally when this
    // watch started it). Empty kind means the live session is a lift, which is
    // what WorkoutView branches on.
    @Published var recoveryKind = ""
    @Published var recoveryTarget = 0
    @Published var recoveryMode = "down"
    // When this watch began the session, in ms epoch. Travels with the finish
    // so the phone can record a session it never heard start — see
    // finishRecoveryFromWatch.
    private var recoveryStartedAt: Double = 0
    // Which alerts this session has already played. See recoveryTick.
    private var playedTarget = false
    private var overtimeMinutesPlayed = 0
    var isRecovery: Bool { !recoveryKind.isEmpty }
    var recoveryLabel: String {
        recoveries.first { $0.id == recoveryKind }?.name
            ?? (recoveryKind == "plunge" ? "Cold Plunge" : "Sauna")
    }
    @Published var palette = WatchPalette() // active pack's accents

    // The same colours as `palette`, kept as the hex the phone sent so the
    // snapshot can carry them to the complication. SwiftUI's Color has no
    // reliable way back to a hex string, and the complication needs one.
    private var paletteHex: [String: String] = [
        "themeAccent": "#34C77B", "themeDanger": "#F4756D",
        "themeProtein": "#E2683C", "themeCarbs": "#E0A32E",
        "themeFat": "#D1699B", "themeFiber": "#79C993",
        "themeWater": "#5A9FD4",
    ]

    var isOverCalories: Bool { calorieGoal > 0 && caloriesConsumed > calorieGoal }
    /// Unsigned, with `isOverCalories` carrying the direction — the old
    /// max(0,) clamp meant 2,340 of 2,000 displayed "0 cal left", which is
    /// both wrong and the least useful thing it could say.
    var caloriesRemaining: Int { abs(calorieGoal - caloriesConsumed) }
    var calorieProgress: Double { ratio(caloriesConsumed, calorieGoal) }
    /// How far into a second lap the overage is, matching the phone's ring.
    var calorieOverProgress: Double {
        guard isOverCalories else { return 0 }
        return ratio(caloriesConsumed - calorieGoal, calorieGoal)
    }
    var waterProgress: Double { ratio(water, waterGoal) }

    func ratio(_ value: Int, _ goal: Int) -> Double {
        goal > 0 ? min(1, Double(value) / Double(goal)) : 0
    }

    private static let dayFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        return f
    }()

    private func todayString() -> String { Self.dayFormatter.string(from: Date()) }

    /// Yesterday's numbers are worse than no numbers.
    ///
    /// The phone pushes a context when the totals change, so between midnight
    /// and the next thing logged there is no push at all — overnight plus a
    /// morning — and the watch sat there showing yesterday as if it were
    /// today. The widget has always guarded this (zeroedIfStale in
    /// targets/widget/index.swift); the watch did not.
    ///
    /// Goals are kept: those do not belong to a day. Only what was consumed
    /// is zeroed, which is exactly what is true at the start of a new day.
    func zeroIfStale() {
        guard !statsDate.isEmpty, statsDate != todayString() else { return }
        caloriesConsumed = 0
        protein = 0
        carbs = 0
        fat = 0
        fiber = 0
        water = 0
        // The complication reads the same stale snapshot, so it has to be
        // rewritten here too — otherwise the wrist is right and the face is
        // still showing yesterday, which is the original complaint wearing a
        // different hat.
        persistSnapshot()
    }

    /// Leave the day where the complication can read it, and tell WidgetKit.
    private func persistSnapshot() {
        let snap = WatchSnapshot(
            date: todayString(),
            caloriesConsumed: caloriesConsumed, calorieGoal: calorieGoal,
            protein: protein, proteinGoal: proteinGoal,
            carbs: carbs, carbsGoal: carbsGoal,
            fat: fat, fatGoal: fatGoal,
            fiber: fiber, fiberGoal: fiberGoal,
            water: water, waterGoal: waterGoal,
            showWater: showWater,
            accent: paletteHex["themeAccent"] ?? "#34C77B",
            danger: paletteHex["themeDanger"] ?? "#F4756D",
            proteinColor: paletteHex["themeProtein"] ?? "#E2683C",
            carbsColor: paletteHex["themeCarbs"] ?? "#E0A32E",
            fatColor: paletteHex["themeFat"] ?? "#D1699B",
            fiberColor: paletteHex["themeFiber"] ?? "#79C993",
            waterColor: paletteHex["themeWater"] ?? "#5A9FD4"
        )
        guard let data = try? JSONEncoder().encode(snap),
              let store = UserDefaults(suiteName: watchAppGroup) else { return }
        store.set(data, forKey: watchSnapshotKey)
        WidgetCenter.shared.reloadAllTimelines()
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

    // JS booleans arrive as NSNumber across the bridge, same as the numbers.
    private func boolVal(_ any: Any?) -> Bool? {
        if let n = any as? NSNumber { return n.boolValue }
        if let b = any as? Bool { return b }
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
            if let v = ctx["date"] as? String { self.statsDate = v }
            if let v = self.intVal(ctx["caloriesConsumed"]) { self.caloriesConsumed = v }
            if let v = self.intVal(ctx["calorieGoal"]) { self.calorieGoal = v }
            if let v = self.intVal(ctx["protein"]) { self.protein = v }
            if let v = self.intVal(ctx["proteinGoal"]) { self.proteinGoal = v }
            if let v = self.intVal(ctx["carbs"]) { self.carbs = v }
            if let v = self.intVal(ctx["carbsGoal"]) { self.carbsGoal = v }
            if let v = self.intVal(ctx["fat"]) { self.fat = v }
            if let v = self.intVal(ctx["fatGoal"]) { self.fatGoal = v }
            if let v = self.intVal(ctx["fiber"]) { self.fiber = v }
            if let v = self.intVal(ctx["fiberGoal"]) { self.fiberGoal = v }
            if let v = self.intVal(ctx["water"]) { self.water = v }
            if let v = self.intVal(ctx["waterGoal"]) { self.waterGoal = v }
            if let v = self.boolVal(ctx["showWaterTracker"]) { self.showWater = v }
            // Calorie/macro keys may be absent on a workout-only push; only flip
            // hasData once we've actually received nutrition numbers.
            if ctx["calorieGoal"] != nil { self.hasData = true }
            self.zeroIfStale()
            self.palette = WatchPalette.from(ctx, current: self.palette)
            for key in self.paletteHex.keys {
                if let hex = ctx[key] as? String { self.paletteHex[key] = hex }
            }
            self.handleWorkoutState(ctx)
            self.parsePlan(ctx)
            self.parseTemplates(ctx)
            self.parseRecoveries(ctx)
            // Last, so the complication is written from the finished state
            // rather than halfway through applying it.
            self.persistSnapshot()
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

    // Parse the sauna / plunge entries offered on the start screen (absent key
    // = leave the current list untouched).
    private func parseRecoveries(_ ctx: [String: Any]) {
        guard let raw = ctx["recoveryPresets"] as? [[String: Any]] else { return }
        recoveries = raw.compactMap { (r: [String: Any]) -> WatchRecovery? in
            guard let kind = r["k"] as? String, !kind.isEmpty else { return nil }
            return WatchRecovery(
                id: kind,
                name: r["name"] as? String ?? "Recovery",
                target: self.intVal(r["t"]) ?? 0,
                mode: r["m"] as? String ?? "down"
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

    // Watch→phone set updates.
    private func sendSetMessage(_ message: [String: Any]) {
        sendReliable(message)
    }

    /// Send a command to the phone so that it actually arrives.
    ///
    /// `sendMessage` only delivers while the counterpart app is *reachable*,
    /// which on iOS means roughly "in the foreground". This used to answer an
    /// unreachable phone by retrying five times over about 31 seconds and then
    /// giving up, which is why starting a workout from the wrist did nothing
    /// unless the phone app happened to be open at that moment: the phone was
    /// in a pocket, every attempt missed, and the command was dropped without
    /// a trace. Set check-offs and Complete Workout had the same hole.
    ///
    /// `transferUserInfo` is the fix. The OS queues it, it survives both apps
    /// being closed, it is delivered FIFO, and the phone's binding replays
    /// whatever was missed when the app next runs. A previous comment here
    /// claimed that channel was unreliable on the React Native side; it was
    /// not — nothing on the phone had ever subscribed to it, so nothing was
    /// ever received. That subscription now exists (onWatchCommand in
    /// src/services/watch.ts) and both channels feed the same handlers.
    ///
    /// Every command carries `sentAt`, because a queued command can arrive
    /// long after it stopped meaning anything — a "start workout" delivered an
    /// hour late must not open a phantom session. The phone drops stale ones.
    ///
    /// Heart rate deliberately does not come through here: it streams with a
    /// plain `sendMessage` in workout.swift, where dropping a sample during a
    /// blip is correct and queueing hundreds of them would not be.
    private func sendReliable(_ payload: [String: Any]) {
        let session = WCSession.default
        guard session.activationState == .activated else { return }
        var message = payload
        message["sentAt"] = Date().timeIntervalSince1970 * 1000

        guard session.isReachable else {
            session.transferUserInfo(message)
            return
        }
        session.sendMessage(message, replyHandler: nil, errorHandler: { _ in
            // Reachable an instant ago, not any more. Queue rather than retry:
            // the queue outlives the app, a retry ladder does not.
            session.transferUserInfo(message)
        })
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

    // Ask the phone to re-send its context, because we're in a workout and
    // have no exercises to show.
    //
    // The plan only arrives by application context, and a push can come to
    // nothing — the phone's pairing flag is filled in asynchronously and starts
    // false, our WCSession may not have activated yet, and only the newest
    // context survives. Nothing on the phone would push again by itself: every
    // push follows a change there, and a workout nobody is editing makes none.
    // Rate-limited because the view this runs from can re-render freely.
    private var lastPlanRequest = Date.distantPast
    func requestPlanIfMissing() {
        guard exercises.isEmpty, WorkoutManager.shared.isActive else { return }
        guard Date().timeIntervalSince(lastPlanRequest) > 5 else { return }
        lastPlanRequest = Date()
        sendReliable(["type": "requestPlan"])
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

    /// Start a sauna or plunge from the wrist.
    ///
    /// HKWorkoutActivityTypeOther, the same type the phone sends, so the two
    /// routes produce one kind of session in Apple Health. Water lock goes on
    /// for a plunge: a wet wrist registers taps of its own, and the one
    /// control on the screen ends the session.
    func startRecovery(_ recovery: WatchRecovery) {
        guard !WorkoutManager.shared.isActive else { return }
        recoveryKind = recovery.id
        recoveryTarget = recovery.target
        recoveryMode = recovery.mode
        recoveryStartedAt = Date().timeIntervalSince1970 * 1000
        resetRecoveryAlerts()
        WorkoutManager.shared.start(activityType: .other)
        showWorkout = true
        if recovery.id == "plunge" {
            WKInterfaceDevice.current().enableWaterLock()
        }
        sendReliable(["type": "startRecovery", "kind": recovery.id])
    }

    /// The alerts for a sauna or plunge, driven from the workout timer.
    ///
    /// This is the only thing that can reach the user during a session. The
    /// phone is in a locker or well away from the water, so the buzz it plays
    /// is for people with no watch; the wrist is where the session actually
    /// is. Until now the watch played nothing at all — the one device on the
    /// user was the silent one.
    ///
    /// Two stages, deliberately different strengths:
    ///
    ///   - the notification pattern three times at the target, 1.5s apart
    ///     (see pulseGap — the spacing is load-bearing, not taste). Once is
    ///     easy to miss when you are cold, breathing hard and not looking at
    ///     your wrist, and three carries far enough to notice without
    ///     turning into an alarm;
    ///   - a single firm tap once a minute past the target, to five, so
    ///     staying in longer is still tracked without being nagged out.
    ///
    /// Nothing before the end. A heads-up tap was tried and dropped: these
    /// sessions are short enough that a second alert reads as the end
    /// arriving early, and being told at the end is the whole job.
    ///
    /// No sound. A sauna is shared and muffles a watch speaker; a plunge is
    /// wet and loud in your own head. watchOS already routes these through
    /// the user's Sound & Haptics setting, so anyone who wants the tone gets
    /// it without this choosing for them.
    func recoveryTick(_ elapsed: TimeInterval) {
        guard isRecovery, recoveryTarget > 0 else { return }
        let target = TimeInterval(recoveryTarget)
        let device = WKInterfaceDevice.current()

        if !playedTarget, elapsed >= target {
            playedTarget = true
            for i in 0..<Self.targetPulses {
                DispatchQueue.main.asyncAfter(deadline: .now() + Double(i) * Self.pulseGap) {
                    device.play(.notification)
                }
            }
            return
        }

        if playedTarget, overtimeMinutesPlayed < 5 {
            let minutesOver = Int((elapsed - target) / 60)
            if minutesOver > overtimeMinutesPlayed {
                overtimeMinutesPlayed = minutesOver
                // .directionUp, not .click: .click is the crown's detent
                // tick, the lightest thing the device plays, and it does not
                // survive sauna heat or cold water. This is a single firm
                // tap — still plainly lighter than the target's pattern, so
                // the two stages stay distinguishable, but actually felt.
                device.play(.directionUp)
            }
        }
    }

    /// How many times the target alert repeats, and how far apart.
    ///
    /// `play(_:)` has no queue: a request that arrives while a haptic is
    /// still running is dropped, silently and with nothing returned to say
    /// so. `.notification` is a repeating pattern rather than a single tap,
    /// so five requests 0.65s apart produced three pulses on the wrist —
    /// t=0 played, 0.65 was dropped, 1.3 played, 1.95 was dropped, 2.6
    /// played. That count is also the measurement: the pattern runs about
    /// 1.3 seconds, which Apple documents nowhere.
    ///
    /// 1.5s leaves roughly 0.2s of margin on that. Three pulses at that gap
    /// is, almost exactly, the alert that was reaching the wrist all along —
    /// the five were never felt as five, and asked for in full they ran six
    /// seconds, which is long enough to nag. So the count follows what the
    /// wrist actually liked rather than what the code was asking for, and
    /// the alert lands in three seconds.
    private static let targetPulses = 3
    private static let pulseGap = 1.5

    /// Clear the alert marks so the next session starts silent.
    private func resetRecoveryAlerts() {
        playedTarget = false
        overtimeMinutesPlayed = 0
    }

    /// End the running recovery and tell the phone about it.
    ///
    /// The payload carries the whole session — kind, start, held — not just
    /// the duration, because the phone may never have learned it began. A
    /// start sent from here is queued when the phone is unreachable, which
    /// for a phone in a locker is the normal case, and the phone drops a
    /// queued start older than five minutes rather than open a timer for
    /// something long finished. A fifteen-minute sauna is exactly that. So
    /// the finish has to stand on its own.
    ///
    /// The watch's own elapsed is the held time: this side is the one that
    /// was actually there.
    func finishRecoveryFromWatch(save: Bool) {
        let held = WorkoutManager.shared.elapsed
        let kind = recoveryKind
        let startedAt = recoveryStartedAt > 0
            ? recoveryStartedAt
            : Date().timeIntervalSince1970 * 1000 - held * 1000
        WorkoutManager.shared.end()
        // Clear the recap the workout path would otherwise show: it reports
        // sets and volume, which a sauna has none of.
        WorkoutManager.shared.reset()
        recoveryKind = ""
        recoveryStartedAt = 0
        showWorkout = false
        // `save: false` is a discard, not a zero-second session — without the
        // flag the phone would faithfully record that you sat in the sauna for
        // no time at all.
        sendReliable([
            "type": "finishRecovery",
            "kind": kind,
            "startedAt": startedAt,
            "held": held,
            "save": save,
        ])
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

        // Read before the start below, so WorkoutView shows the recovery timer
        // on its first frame rather than a set list that flips a moment later.
        if let kind = ctx["recoveryKind"] as? String {
            self.recoveryKind = kind
            if let t = self.intVal(ctx["recoveryTarget"]), t > 0 { self.recoveryTarget = t }
            if let m = ctx["recoveryMode"] as? String, !m.isEmpty { self.recoveryMode = m }
            // Adopt the phone's start for a session it began, so a Stop & Save
            // from this side reports the same window the phone is showing.
            let isNewSession = self.recoveryStartedAt != startedAt
            self.recoveryStartedAt = (kind.isEmpty || startedAt <= 0) ? 0 : startedAt
            if isNewSession { self.resetRecoveryAlerts() }
        }

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
            self.recoveryKind = ""
            self.recoveryStartedAt = 0
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
                    self.recoveryKind = ""
                    self.recoveryStartedAt = 0
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

// One stop of the day stack.
//
// The whole screen is one number. That is the point: the old day screen put
// five readings and a water bar on one 242pt panel, where none of them could
// be read without looking properly, which is the one thing a wrist is for.
// Here each reading gets the whole panel and the crown carries you between
// them, and the day's audit — all of it at once — moves to the complication.
//
// The arc sits behind the numeral rather than around it, so the numeral is
// free to be as large as the panel allows instead of being sized to fit a
// ring's hole.
struct ContentView: View {
    @StateObject private var stats = DayStats.shared

    // The workout screen swaps in place rather than being presented.
    //
    // It used to be a fullScreenCover, and watchOS gives every modal
    // presentation a toolbar with a dismiss "✕" in the top-leading corner —
    // which is not optional, and which inset every workout screen downward to
    // make room for itself. The workout is a mode of this app, not something
    // stacked on top of it, and the idle screen has its own Cancel, so the
    // system's affordance was redundant as well as intrusive.
    var body: some View {
        Group {
            if stats.showWorkout {
                WorkoutView()
            } else {
                dayScreen
            }
        }
    }

    /// The day on one screen.
    ///
    /// This replaced a seven-stop crown-paged stack. That design gave every
    /// reading a whole panel, which read well in isolation and badly in use:
    /// the dial ended up smaller than the screen could afford once a label
    /// and a caption sat under it, and the whole day took six crown turns to
    /// audit. One screen you scroll beats seven you page.
    private var dayScreen: some View {
        ScrollView {
            VStack(spacing: 10) {
                if !stats.hasData {
                    VStack(spacing: 6) {
                        Image(systemName: "iphone.and.arrow.forward")
                            .font(.title3)
                            .foregroundColor(stats.palette.accent)
                        Text("Open Holy Macro on your iPhone to sync.")
                            .font(WatchType.body(13))
                            .multilineTextAlignment(.center)
                            .foregroundColor(.secondary)
                    }
                    .padding(.top, 8)
                } else {
                    calorieRing

                    // Macros as bars, matching the phone and the widget. Four
                    // small rings under a larger calorie ring read as five
                    // competing circles on a 40mm screen; bars let the calorie
                    // ring stay the one focal point and give the numbers room.
                    //
                    // Fiber is here because it is on the phone: four goals on
                    // one screen and three on the other meant the wrist quietly
                    // disagreed with the app about what the day's targets were.
                    //
                    VStack(spacing: 6) {
                        MacroBar(label: "Protein", value: stats.protein, goal: stats.proteinGoal,
                                 color: stats.palette.protein, over: stats.palette.danger)
                        MacroBar(label: "Carbs", value: stats.carbs, goal: stats.carbsGoal,
                                 color: stats.palette.carbs, over: stats.palette.danger)
                        MacroBar(label: "Fat", value: stats.fat, goal: stats.fatGoal,
                                 color: stats.palette.fat, over: stats.palette.danger)
                        MacroBar(label: "Fiber", value: stats.fiber, goal: stats.fiberGoal,
                                 color: stats.palette.fiber, over: stats.palette.danger)
                    }

                    // Water bar — hidden when the phone's tracker is off.
                    // Read-only, like everything else here: the ±8oz buttons
                    // the wrist briefly had are gone with the meal logger.
                    if stats.showWater {
                        VStack(spacing: 4) {
                            HStack(alignment: .firstTextBaseline) {
                                Text("Water")
                                    .font(WatchType.semibold(11))
                                    .foregroundColor(.secondary)
                                Spacer()
                                Text("\(stats.water)")
                                    .font(WatchType.bold(11))
                                + Text(" / \(stats.waterGoal) oz")
                                    .font(WatchType.body(10))
                                    .foregroundColor(.secondary)
                            }
                            GeometryReader { geo in
                                ZStack(alignment: .leading) {
                                    Capsule().fill(stats.palette.water.opacity(0.22))
                                    Capsule()
                                        .fill(stats.palette.water)
                                        .frame(width: max(6, geo.size.width * stats.waterProgress))
                                }
                            }
                            .frame(height: 6)
                        }
                    }
                }

                // Start a native on-wrist workout (live HR + calories).
                Button {
                    stats.showWorkout = true
                } label: {
                    Label("Start Workout", systemImage: "figure.run")
                        .font(WatchType.semibold(13))
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .tint(stats.palette.accent)
                .padding(.top, 4)
            }
            .padding(.horizontal)
            .frame(maxWidth: .infinity)
        }
        // ignoresSafeArea so the ground reaches under the clock and the bottom
        // curve rather than leaving black bands around a tinted middle.
        .background(stats.palette.ground.ignoresSafeArea())
        // Every control SwiftUI draws for us — Stepper's ± buttons, toggles,
        // the crown indicator — otherwise falls back to the target's static
        // $accent from expo-target.config.js, which no theme sync can reach.
        // Set here rather than per-control so a control added later is themed
        // by default instead of quietly shipping the asset-catalog color.
        .tint(stats.palette.accent)
    }

    /// The day's one hero: calories left, or over.
    ///
    /// 118pt, up from the 92 that was the complaint.
    ///
    /// The intent was to keep all four macro bars above the fold as well, and
    /// measuring killed it: a macro bar renders about 26pt, so four of them
    /// plus their gaps need ~116pt, and on a 242pt screen with a ~20pt status
    /// inset that caps the ring near 93 — and even then the fourth bar sits
    /// against the bottom curve where the rounded corner eats it. There is no
    /// dial size worth having that also clears the fold, so the constraint was
    /// dropped rather than quietly half-met: Protein and Carbs sit under the
    /// ring, Fat and Fiber are one short scroll down.
    ///
    /// That trade is only affordable because the complication carries the
    /// whole day on the watch face. The app no longer has to be the overview.
    ///
    /// Over goal draws a second lap: the completed first lap dims to 38% and
    /// a solid arc tracks the overage, which is the phone's ring exactly.
    /// What it replaces was worse than merely plain — the ring pinned full
    /// and the numeral read "0 cal left", because remaining was clamped at
    /// zero. The one moment the screen most needs to say something, it said
    /// nothing.
    private var calorieRing: some View {
        let over = stats.isOverCalories
        let tint = over ? stats.palette.danger : stats.palette.accent
        return ZStack {
            Circle()
                .stroke(tint.opacity(0.2), lineWidth: 10)
            // First lap. Full and dimmed once the goal is passed, so the
            // second lap on top of it reads as the part that matters.
            Circle()
                .trim(from: 0, to: over ? 1 : stats.calorieProgress)
                .stroke(tint.opacity(over ? 0.38 : 1),
                        style: StrokeStyle(lineWidth: 10, lineCap: .round))
                .rotationEffect(.degrees(-90))
            if over {
                Circle()
                    .trim(from: 0, to: stats.calorieOverProgress)
                    .stroke(tint, style: StrokeStyle(lineWidth: 10, lineCap: .round))
                    .rotationEffect(.degrees(-90))
            }
            VStack(spacing: 2) {
                // The serif, at the one size on the watch where it earns its
                // keep. Every label stays on Manrope: DM Serif Display's thin
                // strokes disappear at 10–11pt on a wrist.
                Text(grouped(stats.caloriesRemaining))
                    .font(WatchType.display(36))
                    .foregroundColor(tint)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
                Text(over ? "CAL OVER" : "CAL LEFT")
                    .font(WatchType.semibold(10))
                    .tracking(0.7)
                    .foregroundColor(.secondary)
            }
            // Inside the 10pt stroke, so a four-digit figure never sits on it.
            .padding(.horizontal, 12)
        }
        .frame(width: 118, height: 118)
    }

    private static let groupingFormatter: NumberFormatter = {
        let f = NumberFormatter()
        f.numberStyle = .decimal
        return f
    }()

    /// 1420 → "1,420", matching the phone's toLocaleString().
    private func grouped(_ value: Int) -> String {
        Self.groupingFormatter.string(from: NSNumber(value: value)) ?? "\(value)"
    }
}

// One macro as a labelled bar: name and value on one line, a filled track
// underneath. Mirrors MacroBar.tsx on the phone and the widget's rows.
struct MacroBar: View {
    let label: String
    let value: Int
    let goal: Int
    let color: Color
    // The pack's own over-goal color. System .red belongs to no pack — it read
    // as a stray on Modern, whose danger is a magenta.
    let over: Color

    private var progress: Double {
        goal > 0 ? min(1, Double(value) / Double(goal)) : 0
    }
    private var isOver: Bool { goal > 0 && value > goal }

    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            HStack(alignment: .firstTextBaseline) {
                Text(label)
                    .font(WatchType.semibold(11))
                Spacer()
                Text("\(value)")
                    .font(WatchType.bold(11))
                    .foregroundColor(isOver ? over : .primary)
                + Text(" / \(goal)g")
                    .font(WatchType.body(10))
                    .foregroundColor(.secondary)
            }
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Capsule().fill(color.opacity(0.22))
                    Capsule()
                        .fill(isOver ? over : color)
                        .frame(width: max(2, geo.size.width * progress))
                }
            }
            .frame(height: 5)
        }
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
    @State private var showDiscardPrompt = false
    @State private var editingSet: SetRef?

    var body: some View {
        Group {
            if workout.isActive && stats.isRecovery {
                // One page, not two: a sauna has no sets, so the swipe would
                // only ever land on "No exercises in this workout".
                ScrollView { recoveryScreen.padding() }
            } else if workout.isActive {
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
        .background(stats.palette.ground.ignoresSafeArea())
        // Set again here, not inherited: WorkoutView is swapped in as its own
        // root rather than nested inside the day screen's hierarchy.
        .tint(stats.palette.accent)
        .onAppear {
            workout.requestAuthorization()
            stats.requestPlanIfMissing()
        }
        // The plan usually lands before the session does; this covers the case
        // where the push that carried it never arrived.
        .onChange(of: workout.isActive) { _, _ in stats.requestPlanIfMissing() }
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

    /// The sauna / plunge screen.
    ///
    /// Everything a workout shows that a sauna cannot answer is gone: no
    /// sets, no volume, and no calorie figure — HealthKit will happily report
    /// active energy from a heart rate that is elevated by heat rather than
    /// by work, and a number you have to disbelieve is worse than no number.
    /// What is left is the time, the heart rate, and how to stop.
    private var recoveryScreen: some View {
        let target = TimeInterval(stats.recoveryTarget)
        let elapsed = workout.elapsed
        let over = target > 0 && elapsed > target
        let down = stats.recoveryMode == "down"
        let tint = over ? stats.palette.zoneMid : stats.palette.accent

        return VStack(spacing: 8) {
            Text(stats.recoveryLabel)
                .font(WatchType.semibold(11))
                .tracking(0.7)
                .foregroundColor(stats.palette.accent)

            // Same size and face as the workout clock — this is the same
            // element doing the same job on a different screen.
            Text(down
                 ? (over ? "+" : "") + timeString(abs(target - elapsed))
                 : timeString(elapsed))
                .font(WatchType.readout(30))
                .foregroundColor(tint)

            Text(down
                 ? (over ? "past target" : "remaining")
                 : (target > 0 ? "of \(timeString(target))" : "elapsed"))
                .font(WatchType.body(11))
                .foregroundColor(.secondary)

            HStack(spacing: 4) {
                Text(workout.heartRate > 0 ? "\(Int(workout.heartRate))" : "--")
                    .font(WatchType.readout(20))
                    .foregroundColor(workout.heartRate > 0
                                     ? hrZoneColor(workout.heartRate, stats.palette)
                                     : .secondary)
                Text("bpm").font(WatchType.semibold(11)).foregroundColor(.secondary)
            }
            .padding(.top, 2)

            if workout.hrUnavailable {
                Text("No heart rate yet. Check Health access for Holy Macro in Watch settings.")
                    .font(WatchType.body(11))
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 4)
            }

            Button {
                stats.finishRecoveryFromWatch(save: true)
            } label: {
                Text("Stop & Save")
                    .font(WatchType.semibold(13))
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .tint(stats.palette.accent)
            .padding(.top, 4)

            Button("Discard") { showDiscardPrompt = true }
                .font(WatchType.body(13))
                .foregroundColor(stats.palette.danger)
        }
        .confirmationDialog(
            "Discard this \(stats.recoveryLabel.lowercased())?",
            isPresented: $showDiscardPrompt,
            titleVisibility: .visible
        ) {
            Button("Discard", role: .destructive) {
                stats.finishRecoveryFromWatch(save: false)
            }
            Button("Keep going", role: .cancel) {}
        }
    }

    // The active workout's exercises + sets. Tap the circle to check a set off;
    // tap the row to edit its weight/reps on the wrist.
    private var exercisesScreen: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Exercises")
                .font(WatchType.semibold(11))
                .tracking(0.7)
                .foregroundColor(stats.palette.accent)

            if stats.exercises.isEmpty {
                Text(workout.isActive
                     ? "Waiting for the workout from your iPhone…"
                     : "No exercises in this workout.")
                    .font(WatchType.body(13))
                    .foregroundColor(.secondary)
            } else {
                ForEach(stats.exercises) { ex in
                    VStack(alignment: .leading, spacing: 6) {
                        Text(ex.name).font(WatchType.bold(13))
                        ForEach(ex.sets) { set in
                            HStack(spacing: 8) {
                                Button {
                                    stats.toggleSet(exerciseId: ex.id, setId: set.id)
                                } label: {
                                    Image(systemName: set.completed ? "checkmark.circle.fill" : "circle")
                                        .foregroundColor(set.completed ? stats.palette.accent : .secondary)
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
                                            .font(WatchType.body(11))
                                            .foregroundColor(set.completed ? .secondary : .primary)
                                        Spacer()
                                        Image(systemName: "square.and.pencil")
                                            .font(.caption2)
                                            .foregroundColor(stats.palette.accent)
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
                    Image(systemName: "timer").foregroundColor(stats.palette.accent)
                    Text("Rest \(timeString(rest.remaining))")
                        .font(WatchType.readout(13))
                }
                .padding(.vertical, 4)
                .padding(.horizontal, 10)
                .background(stats.palette.accent.opacity(0.18))
                .clipShape(Capsule())
            }

            // See WatchType.readout: ticking numerals take SF Rounded, which
            // has the tabular figures the app's own faces do not.
            Text(timeString(workout.elapsed))
                .font(WatchType.readout(30))
                .foregroundColor(workout.isPaused ? .secondary : stats.palette.accent)

            if workout.isPaused {
                Text("Paused").font(WatchType.body(11)).foregroundColor(.secondary)
            }

            HStack(spacing: 4) {
                Text(workout.heartRate > 0 ? "\(Int(workout.heartRate))" : "--")
                    .font(WatchType.readout(20))
                    .foregroundColor(workout.heartRate > 0 ? hrZoneColor(workout.heartRate, stats.palette) : .secondary)
                Text("bpm").font(WatchType.semibold(11)).foregroundColor(.secondary)
            }

            // A denied HealthKit read looks exactly like a workout where the
            // heart simply hasn't been measured yet — empty results, no error.
            // Without this the only symptom is "--" sitting there forever,
            // which reads as a sensor problem rather than a permission one.
            if workout.hrUnavailable {
                Text("No heart rate yet. Check Health access for Holy Macro in Watch settings.")
                    .font(WatchType.body(11))
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 4)
            }

            HStack(spacing: 5) {
                Image(systemName: "flame.fill").foregroundColor(.orange)
                Text("\(Int(workout.activeCalories)) cal")
                    .font(WatchType.semibold(13))
            }

            HStack(spacing: 8) {
                Button {
                    if workout.isPaused { workout.resume() } else { workout.pause() }
                } label: {
                    Image(systemName: workout.isPaused ? "play.fill" : "pause.fill")
                        .frame(maxWidth: .infinity)
                }
                .tint(stats.palette.accent)

                Button(role: .destructive) {
                    workout.end()
                } label: {
                    Image(systemName: "stop.fill").frame(maxWidth: .infinity)
                }
                // The role alone isn't enough — the tint set on this view so
                // system-drawn controls follow the pack overrides it, and stop
                // came out the same green as pause.
                .tint(stats.palette.danger)
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
                    .font(WatchType.semibold(13))
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .tint(stats.palette.accent)
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
                .font(WatchType.display(18))
                .foregroundColor(stats.palette.accent)
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
            .tint(stats.palette.accent)
            .padding(.top, 4)
        }
    }

    private var idleScreen: some View {
        VStack(spacing: 8) {
            Text("Start Workout")
                .font(WatchType.display(18))
                .foregroundColor(stats.palette.accent)

            // Sauna and plunge sit at the top, side by side, because a list
            // this long scrolls: below the templates and Quick Start they
            // were off the bottom of a 45mm screen before the second one was
            // reached. Two to a row costs one row to say both. They stay
            // visually quieter than the lifting options — this screen is
            // opened to train far more often than to sit in the heat — and
            // the target is left to the timer itself, which shows it the
            // moment it opens.
            if !stats.recoveries.isEmpty {
                HStack(spacing: 6) {
                    ForEach(stats.recoveries) { r in
                        Button {
                            stats.startRecovery(r)
                        } label: {
                            VStack(spacing: 2) {
                                Image(systemName: r.symbol)
                                Text(r.name)
                                    .font(WatchType.semibold(11))
                                    .lineLimit(1)
                                    .minimumScaleFactor(0.7)
                            }
                            .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.bordered)
                        .tint(.secondary)
                    }
                }
            }

            // Saved templates from the phone — tap one to start it.
            if stats.templates.isEmpty {
                Text("No saved templates. Create them on your iPhone.")
                    .font(WatchType.body(11))
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
                    .padding(.vertical, 2)
            } else {
                ForEach(stats.templates) { t in
                    Button {
                        stats.startTemplate(t)
                    } label: {
                        VStack(alignment: .leading, spacing: 1) {
                            Text(t.name).font(WatchType.semibold(13))
                            Text("\(t.exerciseCount) exercise\(t.exerciseCount == 1 ? "" : "s")")
                                .font(WatchType.body(11))
                                .foregroundColor(.secondary)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    .buttonStyle(.bordered)
                    .tint(stats.palette.accent)
                }
            }

            // Blank session.
            Button {
                stats.startTemplate(nil)
            } label: {
                Label("Quick Start", systemImage: "bolt.fill")
                    .font(WatchType.semibold(13))
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .tint(stats.palette.accent)
            .padding(.top, 2)

            Button("Cancel") { stats.showWorkout = false }
                .font(WatchType.body(13))
                .foregroundColor(.secondary)
        }
    }

    private func summaryRow(_ label: String, _ value: String) -> some View {
        HStack {
            Text(label).font(WatchType.body(11)).foregroundColor(.secondary)
            Spacer()
            Text(value).font(WatchType.semibold(13))
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
                    .onChange(of: duration) { _, _ in pushEdit() }
                } else {
                    Stepper(value: $reps, in: 0...999, step: 1) {
                        field("Reps", "\(reps)")
                    }
                    .onChange(of: reps) { _, _ in pushEdit() }
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
            }
            .padding()
        }
        // The steppers' ± buttons are drawn by SwiftUI from the accent color,
        // so without this they render in the target's static $accent — the old
        // emerald — while everything around them follows the synced pack. This
        // view is presented in a sheet, so it needs its own tint rather than
        // inheriting WorkoutView's.
        .tint(stats.palette.accent)
        .background(stats.palette.ground.ignoresSafeArea())
    }

    private func field(_ label: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 1) {
            Text(label).font(WatchType.body(11)).foregroundColor(.secondary)
            Text(value).font(WatchType.bold(20)).foregroundColor(.primary)
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

// Color the heart rate by intensity zone (mirrors the phone). Takes the
// palette rather than reading a global, so it stays a pure function.
func hrZoneColor(_ bpm: Double, _ palette: WatchPalette) -> Color {
    if bpm >= 160 { return palette.zoneHigh }
    if bpm >= 120 { return palette.zoneMid }
    return palette.zoneEasy
}

struct ContentView_Previews: PreviewProvider {
    static var previews: some View {
        ContentView()
    }
}
