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

/// How far today is from a target, and which side of it.
///
/// Both families compute this the same way now. They did not before: the ring
/// used `abs(goal - consumed)` with an "over" state, while the medium layout
/// used `max(0, goal - consumed)` in the accent colour with no over state at
/// all — so going 280 over showed "0 cal left" in green on one widget and
/// "280 over" in red on the other, from the same payload.
private struct Progress {
    let over: Bool
    /// Distance from the goal, whichever side of it we are on.
    let distance: Int
    /// "left" or "over" — the word that makes `distance` mean something.
    let word: String
    /// 0...1, for a ring. A ring cannot usefully overshoot, so this clamps and
    /// the colour plus the word carry the over state instead.
    let ringFraction: Double

    init(current: Double, goal: Double) {
        over = goal > 0 && current > goal
        distance = Int(abs(goal - current).rounded())
        word = over ? "over" : "left"
        ringFraction = goal > 0 ? min(current / goal, 1) : 0
    }
}

/// A progress bar that can show overshoot as length rather than only colour.
///
/// The old bar clamped its fill at the goal, so 268g against a 220g target and
/// a perfect 220g drew the identical full bar — the one state worth noticing
/// looked like the one state you were aiming for. Here the goal sits at the end
/// of the bar while you are under it, and slides back to `overMark` once you
/// are past, leaving the remainder of the width to show how far past. The tick
/// is punched out in the card colour so it reads as a mark on the bar rather
/// than another segment of it.
struct GoalBar: View {
    let current: Double
    let goal: Double
    let color: Color
    let track: Color
    let danger: Color
    let card: Color
    var height: CGFloat = 6

    /// Where the goal sits once exceeded, as a fraction of the width. 0.72
    /// leaves just over a quarter of the bar to overshoot into, which is enough
    /// to be unmistakable without making a small overshoot look catastrophic.
    private let overMark: Double = 0.72

    private var over: Bool { goal > 0 && current > goal }
    private var goalMark: Double { over ? overMark : 1 }
    private var fraction: Double {
        guard goal > 0 else { return 0 }
        return min((current / goal) * goalMark, 1)
    }

    var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .leading) {
                Capsule().fill(track)
                Capsule()
                    .fill(over ? danger : color)
                    .frame(width: max(0, geo.size.width * fraction))
                if over {
                    Rectangle()
                        .fill(card)
                        .frame(width: 2)
                        .offset(x: geo.size.width * goalMark - 1)
                }
            }
        }
        .frame(height: height)
    }
}

/// One macro in the medium widget's 2x2 grid: name, value against goal, bar.
struct MacroCell: View {
    let label: String
    let current: Double
    let goal: Double
    let color: Color
    let text: Color
    let muted: Color
    let track: Color
    let danger: Color
    let card: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack(alignment: .firstTextBaseline, spacing: 0) {
                Text(label)
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundColor(muted)
                Spacer(minLength: 4)
                Text("\(Int(current))")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundColor(current > goal ? danger : text)
                Text("/\(Int(goal))")
                    .font(.system(size: 9))
                    .foregroundColor(muted)
            }
            GoalBar(current: current, goal: goal, color: color,
                    track: track, danger: danger, card: card, height: 4)
        }
    }
}

struct MacroWidgetView: View {
    var entry: MacroEntry
    @Environment(\.widgetFamily) private var family

    private var p: MacroPayload { entry.payload }
    private var text: Color { Color(hex: p.textColor) }
    private var muted: Color { Color(hex: p.mutedColor) }
    private var track: Color { Color(hex: p.trackColor) }
    private var card: Color { Color(hex: p.cardColor) }
    private var accent: Color { Color(hex: p.accentColor) }
    private var danger: Color { Color(hex: p.dangerColor) }

    private var calories: Progress {
        Progress(current: p.caloriesConsumed, goal: p.calorieGoal)
    }
    private var calorieColor: Color { calories.over ? danger : accent }

    var body: some View {
        Group {
            if family == .systemSmall {
                smallBody
            } else {
                mediumBody
            }
        }
        .containerBackground(for: .widget) { card }
    }

    // 2x2: the ring, and the one macro worth a bar at this size. Four bars here
    // would be four unreadable bars; protein is the one people are actually
    // chasing, and the ring already answers the calorie question.
    private var smallBody: some View {
        VStack(spacing: 8) {
            ZStack {
                Circle().stroke(track, lineWidth: 9)
                Circle()
                    .trim(from: 0, to: calories.ringFraction)
                    .stroke(calorieColor, style: StrokeStyle(lineWidth: 9, lineCap: .round))
                    .rotationEffect(.degrees(-90))
                VStack(spacing: 0) {
                    Text("\(calories.distance)")
                        .font(.system(size: 26, weight: .bold, design: .rounded))
                        .foregroundColor(calorieColor)
                        .minimumScaleFactor(0.6)
                        .lineLimit(1)
                    Text("cal \(calories.word)")
                        .font(.system(size: 10))
                        .foregroundColor(muted)
                }
            }
            .frame(width: 84, height: 84)

            VStack(alignment: .leading, spacing: 3) {
                HStack(alignment: .firstTextBaseline, spacing: 0) {
                    Text("Protein")
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundColor(muted)
                    Spacer(minLength: 4)
                    Text("\(Int(p.proteinCurrent))")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundColor(p.proteinCurrent > p.proteinGoal ? danger : text)
                    Text("/\(Int(p.proteinGoal))g")
                        .font(.system(size: 9))
                        .foregroundColor(muted)
                }
                GoalBar(current: p.proteinCurrent, goal: p.proteinGoal,
                        color: Color(hex: p.proteinColor), track: track,
                        danger: danger, card: card, height: 4)
            }
        }
    }

    // 4x2: one number big enough to read at arm's length, the calorie bar in
    // the same visual language as the macros, then the four macros in a grid.
    // The old header spent its whole width saying one thing twice — "360 cal
    // left" beside "1840 / 2200" — so the totals are now the quiet half of a
    // line whose loud half is the only number most glances want.
    private var mediumBody: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .firstTextBaseline, spacing: 6) {
                Text("\(calories.distance)")
                    .font(.system(size: 34, weight: .bold, design: .rounded))
                    .foregroundColor(calorieColor)
                    .minimumScaleFactor(0.5)
                    .lineLimit(1)
                Text("cal \(calories.word)")
                    .font(.system(size: 12))
                    .foregroundColor(muted)
                Spacer(minLength: 4)
                Text("\(Int(p.caloriesConsumed)) / \(Int(p.calorieGoal))")
                    .font(.system(size: 10, weight: .medium))
                    .foregroundColor(muted)
            }

            GoalBar(current: p.caloriesConsumed, goal: p.calorieGoal,
                    color: accent, track: track, danger: danger, card: card, height: 7)
                .padding(.top, 8)

            HStack(alignment: .top, spacing: 16) {
                cell("Protein", p.proteinCurrent, p.proteinGoal, p.proteinColor)
                cell("Carbs", p.carbsCurrent, p.carbsGoal, p.carbsColor)
            }
            .padding(.top, 10)

            HStack(alignment: .top, spacing: 16) {
                cell("Fat", p.fatCurrent, p.fatGoal, p.fatColor)
                cell("Fiber", p.fiberCurrent, p.fiberGoal, p.fiberColor)
            }
            .padding(.top, 7)
        }
    }

    private func cell(_ label: String, _ current: Double, _ goal: Double, _ hex: String) -> some View {
        MacroCell(label: label, current: current, goal: goal,
                  color: Color(hex: hex), text: text, muted: muted,
                  track: track, danger: danger, card: card)
    }
}

struct MacroWidget: Widget {
    let kind = "MacroWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: Provider()) { entry in
            MacroWidgetView(entry: entry)
        }
        .configurationDisplayName("Macros")
        .description("Calories left at a glance, or the full macro breakdown.")
        .supportedFamilies([.systemSmall, .systemMedium])
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
