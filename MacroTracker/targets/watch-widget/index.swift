import WidgetKit
import SwiftUI

// The watch-face complications.
//
// Until this target existed the watch app could be reached exactly two ways:
// opening it from the app grid, or the phone launching it into a workout. A
// companion you have to go and open is the thing most working against the
// word "companion", and it is also what the day stack depends on — that stack
// gives each reading a whole screen, which is only affordable because the
// whole-day audit lives out here on the face.
//
// Four families, each answering a different amount of glance:
//   corner      — calories left, with the day's progress as the curved gauge
//   circular    — the same, as a dial
//   rectangular — the full audit: calories plus all four macros
//   inline      — one line of text, for faces that only offer one
//
// The app itself is one scrolling screen, so none of these deep-links: a tap
// opens the app, which is already showing everything.
//
// Everything is set in the system face on purpose. DM Serif Display carries
// the hero numerals inside the app, but a complication is 20-40pt of glass
// read in passing: SF is what stays legible there, it is what every other
// complication on the face is set in, and `.accessoryInline` is drawn by the
// system in its own font regardless. Using the serif here would also mean
// duplicating 360KB of font files into this extension's bundle to register
// them in a second process.

private let appGroup = "group.com.jacobclover.macrotracker"
private let snapshotKey = "watchDayStats"

// Must stay identical to WatchSnapshot in targets/watch/content.swift — the
// two targets are separate compilation units with no shared file, so the
// struct travels by being the same on both sides. Change one, change the
// other.
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

    static let placeholder = WatchSnapshot(
        date: "",
        caloriesConsumed: 1420, calorieGoal: 2000,
        protein: 128, proteinGoal: 185,
        carbs: 96, carbsGoal: 240,
        fat: 51, fatGoal: 70,
        fiber: 18, fiberGoal: 30,
        water: 40, waterGoal: 64,
        showWater: true,
        accent: "#34C77B", danger: "#F4756D",
        proteinColor: "#E2683C", carbsColor: "#E0A32E",
        fatColor: "#D1699B", fiberColor: "#79C993", waterColor: "#5A9FD4"
    )

    /// Yesterday's numbers are worse than no numbers. The watch app rewrites
    /// the snapshot whenever it notices the day rolled over, but the face can
    /// be looked at long before the app is next opened, so the guard has to
    /// live on this side too.
    func zeroedIfStale(now: Date = Date()) -> WatchSnapshot {
        let fmt = DateFormatter()
        fmt.dateFormat = "yyyy-MM-dd"
        guard date == fmt.string(from: now) else {
            var copy = self
            copy.caloriesConsumed = 0
            copy.protein = 0
            copy.carbs = 0
            copy.fat = 0
            copy.fiber = 0
            copy.water = 0
            return copy
        }
        return self
    }

    var isOver: Bool { calorieGoal > 0 && caloriesConsumed > calorieGoal }
    var remaining: Int { abs(calorieGoal - caloriesConsumed) }
    /// "580" under the goal, "+580" over it. On a watch face the system
    /// recolours everything to the face tint, so `tint` below cannot be the
    /// thing that says you have gone over — in the two families with room for
    /// a number and nothing else, the sign is what says it.
    var signedRemaining: String { isOver ? "+\(remaining)" : "\(remaining)" }
    var calorieProgress: Double {
        calorieGoal > 0 ? min(1, Double(caloriesConsumed) / Double(calorieGoal)) : 0
    }
    var tint: Color { Color(hex: isOver ? danger : accent) }
}

struct DayEntry: TimelineEntry {
    let date: Date
    let snapshot: WatchSnapshot
}

struct DayProvider: TimelineProvider {
    private func load() -> WatchSnapshot {
        guard let data = UserDefaults(suiteName: appGroup)?.data(forKey: snapshotKey),
              let decoded = try? JSONDecoder().decode(WatchSnapshot.self, from: data)
        else { return .placeholder }
        return decoded.zeroedIfStale()
    }

    func placeholder(in context: Context) -> DayEntry {
        DayEntry(date: Date(), snapshot: .placeholder)
    }

    func getSnapshot(in context: Context, completion: @escaping (DayEntry) -> Void) {
        completion(DayEntry(date: Date(), snapshot: load()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<DayEntry>) -> Void) {
        let entry = DayEntry(date: Date(), snapshot: load())
        // The watch app reloads this whenever the numbers change, so the
        // policy only has to cover the day rolling over while nothing is
        // running.
        let nextMidnight = Calendar.current.nextDate(
            after: Date(),
            matching: DateComponents(hour: 0, minute: 0),
            matchingPolicy: .nextTime
        ) ?? Date().addingTimeInterval(3600)
        completion(Timeline(entries: [entry], policy: .after(nextMidnight)))
    }
}

/// One macro as a line in the ledger: name, a bar for progress against the
/// goal, and the number, right-aligned so the column reads down.
///
/// The goal is in the bar, not in the text. Showing "128/185" instead costs
/// the bar most of its width — measured at 41mm it leaves 7pt of track, which
/// is a bar in name only — and the bar is the thing that answers "am I on
/// course" without being read.
struct MacroRow: View {
    let name: String
    let value: Int
    let goal: Int
    let color: Color

    private var progress: Double {
        goal > 0 ? min(1, Double(value) / Double(goal)) : 0
    }

    var body: some View {
        HStack(spacing: 3) {
            Text(name)
                .font(.system(size: 10, weight: .semibold))
                .foregroundColor(.primary.opacity(0.6))
                .frame(width: 16, alignment: .leading)
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Capsule().fill(Color.primary.opacity(0.18))
                    Capsule()
                        .fill(color)
                        .frame(width: max(1.5, geo.size.width * progress))
                }
            }
            .frame(height: 3.5)
            Text("\(value)")
                .font(.system(size: 10, weight: .medium))
                .lineLimit(1)
                .minimumScaleFactor(0.7)
                .frame(width: 26, alignment: .trailing)
        }
        .frame(height: 13)
    }
}

struct DayComplicationView: View {
    var entry: DayEntry
    @Environment(\.widgetFamily) private var family

    private var s: WatchSnapshot { entry.snapshot }

    var body: some View {
        Group {
            switch family {
            case .accessoryCorner:   corner
            case .accessoryCircular: circular
            case .accessoryInline:   inline
            default:                 rectangular
            }
        }
        // No widgetURL. These used to deep-link into one stop of a crown-paged
        // stack; the app is a single screen again, so a tap opens it at the
        // only place there is to open, which is what a complication does by
        // default.
        .containerBackground(for: .widget) { Color.clear }
    }

    /// The curved corner gauge: the numeral sits in the corner, the day's
    /// progress bends around the bezel beside it.
    private var corner: some View {
        Text(s.signedRemaining)
            .font(.system(size: 17, weight: .semibold, design: .rounded))
            .widgetLabel {
                Gauge(value: s.calorieProgress) {
                    Text(s.isOver ? "over" : "left")
                }
                .tint(s.tint)
            }
            .widgetAccentable()
    }

    private var circular: some View {
        Gauge(value: s.calorieProgress) {
            Text(s.isOver ? "OVER" : "LEFT")
                .font(.system(size: 10, weight: .semibold))
        } currentValueLabel: {
            Text(s.signedRemaining)
                .font(.system(size: 17, weight: .semibold, design: .rounded))
                .minimumScaleFactor(0.5)
                .lineLimit(1)
                .widgetAccentable()
        }
        .gaugeStyle(.accessoryCircular)
        .tint(s.tint)
    }

    private var inline: some View {
        // The system draws this one in its own font and a single color, so
        // it carries the two numbers and no styling of its own.
        Text("\(s.remaining) cal \(s.isOver ? "over" : "left") · \(s.protein)g protein")
    }

    /// The whole-day audit. This is the family the day stack leans on: the
    /// stack trades the overview for legibility, and this is where the
    /// overview went.
    /// A dial and a ledger: the calorie ring as the one thing the eye lands
    /// on, the four macros listed beside it.
    ///
    /// This replaced a header line over four bare bars. The shape is the
    /// change — a ring is a different object from a row of text, so there is
    /// somewhere to look first, and the macros become a column that reads
    /// downward instead of four things competing across. It also survives
    /// what a watch face does to it: the rows stay apart because they are
    /// separate rows, where before they were four hues the system flattened
    /// into one.
    private var rectangular: some View {
        HStack(spacing: 6) {
            ZStack {
                Circle().stroke(Color.primary.opacity(0.18), lineWidth: 5)
                Circle()
                    .trim(from: 0, to: s.calorieProgress)
                    .stroke(s.tint, style: StrokeStyle(lineWidth: 5, lineCap: .round))
                    .rotationEffect(.degrees(-90))
                VStack(spacing: 0) {
                    // "+310" is four glyphs where "580" is three, so it shrinks
                    // to fit rather than growing the ring for the rarer case.
                    Text(s.signedRemaining)
                        .font(.system(size: 18, weight: .bold, design: .rounded))
                        .lineLimit(1)
                        .minimumScaleFactor(0.6)
                        .widgetAccentable()
                    Text(s.isOver ? "OVER" : "LEFT")
                        .font(.system(size: 9, weight: .semibold))
                        .foregroundColor(.primary.opacity(0.55))
                }
                .padding(.horizontal, 3)
            }
            .frame(width: 46, height: 46)

            VStack(spacing: 1) {
                MacroRow(name: "P", value: s.protein, goal: s.proteinGoal,
                         color: Color(hex: s.proteinColor))
                MacroRow(name: "C", value: s.carbs, goal: s.carbsGoal,
                         color: Color(hex: s.carbsColor))
                MacroRow(name: "F", value: s.fat, goal: s.fatGoal,
                         color: Color(hex: s.fatColor))
                MacroRow(name: "Fib", value: s.fiber, goal: s.fiberGoal,
                         color: Color(hex: s.fiberColor))
            }
        }
    }
}

struct DayComplication: Widget {
    let kind = "HolyMacroDay"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: DayProvider()) { entry in
            DayComplicationView(entry: entry)
        }
        .configurationDisplayName("Macros")
        .description("Calories left, or the whole day's macros, on your watch face.")
        .supportedFamilies([
            .accessoryCorner,
            .accessoryCircular,
            .accessoryRectangular,
            .accessoryInline,
        ])
    }
}

@main
struct HolyMacroWatchComplications: WidgetBundle {
    var body: some Widget {
        DayComplication()
    }
}

extension Color {
    // Accepts "#RRGGBB" / "RRGGBB"; falls back to the system accent on
    // anything else, so a malformed value leaves a readable complication
    // rather than an invisible one.
    init(hex: String) {
        let raw = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var value: UInt64 = 0
        guard raw.count == 6, Scanner(string: raw).scanHexInt64(&value) else {
            self = .accentColor
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
