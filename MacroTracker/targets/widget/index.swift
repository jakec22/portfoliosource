import WidgetKit
import SwiftUI

// Shared container the JS side writes to via ExtensionStorage. Must match
// app.json's ios.entitlements and this target's expo-target.config.js.
private let appGroup = "group.com.jacobclover.macrotracker"
private let storageKey = "macroWidget"

// ExtensionStorage.setObject JSON-encodes the payload and stores it as Data, so
// this is decoded with JSONDecoder rather than read as plist values.
//
// The shape is deliberately flat: ExtensionStorage.set() is typed for
// Record<string, string | number>, so nesting the macros as an array of objects
// would fight that signature on the JS side.
struct MacroPayload: Codable {
    var date: String

    var caloriesConsumed: Double
    var calorieGoal: Double

    var proteinCurrent: Double
    var proteinGoal: Double
    var proteinColor: String

    var carbsCurrent: Double
    var carbsGoal: Double
    var carbsColor: String

    var fatCurrent: Double
    var fatGoal: Double
    var fatColor: String

    var fiberCurrent: Double
    var fiberGoal: Double
    var fiberColor: String

    // Resolved from the user's selected theme pack, so the widget follows
    // whichever pack the app is on without hardcoding any palette here.
    var textColor: String
    var mutedColor: String
    var trackColor: String
    var cardColor: String
    var accentColor: String
    var dangerColor: String

    static let placeholder = MacroPayload(
        date: "",
        caloriesConsumed: 1840, calorieGoal: 2200,
        proteinCurrent: 124, proteinGoal: 150, proteinColor: "#9C5B45",
        carbsCurrent: 180, carbsGoal: 220, carbsColor: "#B98A3E",
        fatCurrent: 48, fatGoal: 70, fatColor: "#A46C74",
        fiberCurrent: 22, fiberGoal: 30, fiberColor: "#6E7B63",
        textColor: "#221F1B", mutedColor: "#B5AB9E", trackColor: "#D6CBBC",
        cardColor: "#FFFFFF", accentColor: "#3F6B52", dangerColor: "#B54A3B"
    )

    // Yesterday's numbers are worse than no numbers — if the app hasn't written
    // since the day rolled over, show an empty day instead of stale totals.
    func zeroedIfStale(now: Date = Date()) -> MacroPayload {
        let fmt = DateFormatter()
        fmt.dateFormat = "yyyy-MM-dd"
        guard date == fmt.string(from: now) else {
            var copy = self
            copy.caloriesConsumed = 0
            copy.proteinCurrent = 0
            copy.carbsCurrent = 0
            copy.fatCurrent = 0
            copy.fiberCurrent = 0
            return copy
        }
        return self
    }
}

struct MacroEntry: TimelineEntry {
    let date: Date
    let payload: MacroPayload
}

struct Provider: TimelineProvider {
    private func load() -> MacroPayload {
        guard let data = UserDefaults(suiteName: appGroup)?.data(forKey: storageKey),
              let decoded = try? JSONDecoder().decode(MacroPayload.self, from: data)
        else { return .placeholder }
        return decoded.zeroedIfStale()
    }

    func placeholder(in context: Context) -> MacroEntry {
        MacroEntry(date: Date(), payload: .placeholder)
    }

    func getSnapshot(in context: Context, completion: @escaping (MacroEntry) -> Void) {
        completion(MacroEntry(date: Date(), payload: load()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<MacroEntry>) -> Void) {
        let entry = MacroEntry(date: Date(), payload: load())
        // The app reloads the timeline whenever totals change, so this only has
        // to cover the day rolling over while the app is closed.
        let nextMidnight = Calendar.current.nextDate(
            after: Date(),
            matching: DateComponents(hour: 0, minute: 0),
            matchingPolicy: .nextTime
        ) ?? Date().addingTimeInterval(3600)
        completion(Timeline(entries: [entry], policy: .after(nextMidnight)))
    }
}

struct MacroBarRow: View {
    let label: String
    let current: Double
    let goal: Double
    let color: Color
    let textColor: Color
    let mutedColor: Color
    let trackColor: Color
    let dangerColor: Color

    private var progress: Double {
        goal > 0 ? min(current / goal, 1) : 0
    }
    private var over: Bool { goal > 0 && current > goal }

    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            HStack(alignment: .firstTextBaseline) {
                Text(label)
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundColor(textColor)
                Spacer()
                Text("\(Int(current))")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundColor(over ? dangerColor : textColor)
                + Text(" / \(Int(goal))g")
                    .font(.system(size: 10))
                    .foregroundColor(mutedColor)
            }
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Capsule().fill(trackColor)
                    Capsule()
                        .fill(over ? dangerColor : color)
                        .frame(width: max(0, geo.size.width * progress))
                }
            }
            .frame(height: 5)
        }
    }
}

struct MacroWidgetView: View {
    var entry: MacroEntry

    private var p: MacroPayload { entry.payload }
    private var text: Color { Color(hex: p.textColor) }
    private var muted: Color { Color(hex: p.mutedColor) }
    private var track: Color { Color(hex: p.trackColor) }

    private var remaining: Int {
        Int(max(0, p.calorieGoal - p.caloriesConsumed).rounded())
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 7) {
            HStack(alignment: .firstTextBaseline) {
                Text("\(remaining)")
                    .font(.system(size: 20, weight: .bold, design: .rounded))
                    .foregroundColor(Color(hex: p.accentColor))
                Text("cal left")
                    .font(.system(size: 11))
                    .foregroundColor(muted)
                Spacer()
                Text("\(Int(p.caloriesConsumed)) / \(Int(p.calorieGoal))")
                    .font(.system(size: 11, weight: .medium))
                    .foregroundColor(muted)
            }

            MacroBarRow(label: "Protein", current: p.proteinCurrent, goal: p.proteinGoal,
                        color: Color(hex: p.proteinColor), textColor: text,
                        mutedColor: muted, trackColor: track,
                        dangerColor: Color(hex: p.dangerColor))
            MacroBarRow(label: "Carbs", current: p.carbsCurrent, goal: p.carbsGoal,
                        color: Color(hex: p.carbsColor), textColor: text,
                        mutedColor: muted, trackColor: track,
                        dangerColor: Color(hex: p.dangerColor))
            MacroBarRow(label: "Fat", current: p.fatCurrent, goal: p.fatGoal,
                        color: Color(hex: p.fatColor), textColor: text,
                        mutedColor: muted, trackColor: track,
                        dangerColor: Color(hex: p.dangerColor))
            MacroBarRow(label: "Fiber", current: p.fiberCurrent, goal: p.fiberGoal,
                        color: Color(hex: p.fiberColor), textColor: text,
                        mutedColor: muted, trackColor: track,
                        dangerColor: Color(hex: p.dangerColor))
        }
        .containerBackground(for: .widget) { Color(hex: p.cardColor) }
    }
}

struct MacroWidget: Widget {
    let kind = "MacroWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: Provider()) { entry in
            MacroWidgetView(entry: entry)
        }
        .configurationDisplayName("Macros")
        .description("Today's calories and macro progress.")
        .supportedFamilies([.systemMedium])
    }
}

@main
struct MacroWidgetBundle: WidgetBundle {
    var body: some Widget {
        MacroWidget()
    }
}

extension Color {
    // Accepts "#RRGGBB" / "RRGGBB"; falls back to clear on anything else so a
    // malformed value can't crash the widget process.
    init(hex: String) {
        let raw = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var value: UInt64 = 0
        guard raw.count == 6, Scanner(string: raw).scanHexInt64(&value) else {
            self = .clear
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
