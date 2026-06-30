import SwiftUI
import Combine

// Brand colors (matches the phone app's #10B981 green on a dark surface).
extension Color {
    static let hmGreen = Color(red: 16 / 255, green: 185 / 255, blue: 129 / 255)
}

// Today's stats shown on the watch. For Milestone 2a these are placeholder
// values; Milestone 2b feeds them live from the phone over WatchConnectivity
// and routes `logWater()` back to the phone.
final class DayStats: ObservableObject {
    static let shared = DayStats()

    @Published var calorieGoal = 2200
    @Published var caloriesConsumed = 1450
    @Published var protein = 95
    @Published var carbs = 160
    @Published var fat = 48
    @Published var water = 32
    @Published var waterGoal = 64

    var caloriesRemaining: Int { max(0, calorieGoal - caloriesConsumed) }
    var calorieProgress: Double {
        calorieGoal > 0 ? min(1, Double(caloriesConsumed) / Double(calorieGoal)) : 0
    }

    func logWater() {
        // Optimistic local bump; 2b sends this to the phone as the source of truth.
        water += 8
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

                // Water + quick log
                HStack {
                    VStack(alignment: .leading, spacing: 1) {
                        Text("Water")
                            .font(.caption2)
                            .foregroundColor(.secondary)
                        Text("\(stats.water) / \(stats.waterGoal) oz")
                            .font(.footnote)
                            .fontWeight(.semibold)
                    }
                    Spacer()
                    Button {
                        stats.logWater()
                    } label: {
                        Image(systemName: "plus")
                            .font(.system(size: 16, weight: .bold))
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(.hmGreen)
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
