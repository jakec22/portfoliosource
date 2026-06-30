import SwiftUI
import Combine
import WatchConnectivity

// Brand colors (matches the phone app's #10B981 green on a dark surface).
extension Color {
    static let hmGreen = Color(red: 16 / 255, green: 185 / 255, blue: 129 / 255)
}

// Today's stats shown on the watch, fed live from the phone over
// WatchConnectivity. Read-only: the phone is the source of truth and pushes the
// latest snapshot via updateApplicationContext (see src/services/watch.ts).
final class DayStats: NSObject, ObservableObject, WCSessionDelegate {
    static let shared = DayStats()

    @Published var calorieGoal = 0
    @Published var caloriesConsumed = 0
    @Published var protein = 0
    @Published var carbs = 0
    @Published var fat = 0
    @Published var water = 0
    @Published var waterGoal = 0
    @Published var hasData = false

    var caloriesRemaining: Int { max(0, calorieGoal - caloriesConsumed) }
    var calorieProgress: Double {
        calorieGoal > 0 ? min(1, Double(caloriesConsumed) / Double(calorieGoal)) : 0
    }

    override init() {
        super.init()
        if WCSession.isSupported() {
            let session = WCSession.default
            session.delegate = self
            session.activate()
        }
    }

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
            if let v = self.intVal(ctx["carbs"]) { self.carbs = v }
            if let v = self.intVal(ctx["fat"]) { self.fat = v }
            if let v = self.intVal(ctx["water"]) { self.water = v }
            if let v = self.intVal(ctx["waterGoal"]) { self.waterGoal = v }
            self.hasData = true
        }
    }

    func session(
        _ session: WCSession,
        activationDidCompleteWith activationState: WCSessionActivationState,
        error: Error?
    ) {
        // Adopt any context already delivered before activation finished.
        apply(session.receivedApplicationContext)
    }

    func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) {
        apply(applicationContext)
    }
}

struct ContentView: View {
    @StateObject private var stats = DayStats.shared

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                Text("Holy Macro")
                    .font(.caption2)
                    .foregroundColor(.hmGreen)
                    .fontWeight(.semibold)

                if !stats.hasData {
                    Text("Open Holy Macro on your iPhone to sync today's numbers.")
                        .font(.footnote)
                        .foregroundColor(.secondary)
                        .padding(.top, 4)
                } else {
                    // Calories remaining
                    VStack(alignment: .leading, spacing: 1) {
                        Text("\(stats.caloriesRemaining)")
                            .font(.system(size: 38, weight: .bold, design: .rounded))
                            .foregroundColor(.hmGreen)
                        Text("calories left")
                            .font(.caption2)
                            .foregroundColor(.secondary)
                    }
                    ProgressView(value: stats.calorieProgress)
                        .tint(.hmGreen)

                    // Macros
                    HStack(spacing: 0) {
                        MacroCol(label: "Protein", grams: stats.protein)
                        MacroCol(label: "Carbs", grams: stats.carbs)
                        MacroCol(label: "Fat", grams: stats.fat)
                    }
                    .padding(.top, 2)

                    Divider()

                    // Water (read-only)
                    VStack(alignment: .leading, spacing: 1) {
                        Text("Water")
                            .font(.caption2)
                            .foregroundColor(.secondary)
                        Text("\(stats.water) / \(stats.waterGoal) oz")
                            .font(.footnote)
                            .fontWeight(.semibold)
                    }
                }
            }
            .padding()
        }
    }
}

// One protein/carbs/fat column.
struct MacroCol: View {
    let label: String
    let grams: Int

    var body: some View {
        VStack(spacing: 1) {
            Text("\(grams)g")
                .font(.footnote)
                .fontWeight(.bold)
            Text(label)
                .font(.system(size: 9))
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity)
    }
}

struct ContentView_Previews: PreviewProvider {
    static var previews: some View {
        ContentView()
    }
}
