import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  ActionSheetIOS,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore, sumMacros } from '../store/useStore';
import { todayString, displayDate, formatDate } from '../utils/date';
import { CalorieSummary } from '../components/CalorieSummary';
import { MacroRing } from '../components/MacroRing';
import { MealSection } from '../components/MealSection';
import { WorkoutHistoryItem } from '../components/WorkoutHistoryItem';
import { MealType } from '../types';

interface Props {
  navigation: any;
}

export function HomeScreen({ navigation }: Props) {
  const [selectedDate, setSelectedDate] = useState(todayString());
  const goals = useStore((s) => s.goals);
  const dateEntries = useStore((s) => s.logs[selectedDate]);
  const workoutHistory = useStore((s) => s.workoutHistory);
  const deleteWorkout = useStore((s) => s.deleteWorkout);
  const waterIntake = useStore((s) => s.waterIntake);

  const dayWorkouts = useMemo(
    () => workoutHistory.filter((w) => w.date === selectedDate),
    [workoutHistory, selectedDate]
  );
  const setWater = useStore((s) => s.setWater);
  const waterGoal = useStore((s) => s.waterGoal);
  const waterIncrement = useStore((s) => s.waterIncrement);
  const showWaterTracker = useStore((s) => s.showWaterTracker);

  const totals = useMemo(() => sumMacros(dateEntries ?? []), [dateEntries]);
  const water = waterIntake[selectedDate] ?? 0;

  const OZ_PER_BUBBLE = waterIncrement;
  const numBubbles = Math.max(4, Math.round(waterGoal / OZ_PER_BUBBLE));
  const filledBubbles = Math.round(water / OZ_PER_BUBBLE);
  const waterPct = Math.min(Math.round((water / waterGoal) * 100), 100);

  function handleBubblePress(index: number) {
    // Tapping the topmost filled bubble un-fills it (undo accidental tap);
    // tapping any other bubble fills/empties up to that point.
    if (index + 1 === filledBubbles) {
      setWater(selectedDate, index * OZ_PER_BUBBLE);
    } else {
      setWater(selectedDate, (index + 1) * OZ_PER_BUBBLE);
    }
  }

  function goDay(offset: number) {
    const current = new Date(selectedDate + 'T12:00:00');
    current.setDate(current.getDate() + offset);
    const newDate = formatDate(current);
    if (newDate <= todayString()) {
      setSelectedDate(newDate);
    }
  }

  function handleAddFood(meal: MealType) {
    navigation.navigate('LogFood', { meal, date: selectedDate });
  }

  function handleSnapMeal() {
    const meals: MealType[] = ['breakfast', 'lunch', 'dinner', 'snacks'];
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: ['Cancel', 'Breakfast', 'Lunch', 'Dinner', 'Snacks'],
        cancelButtonIndex: 0,
      },
      (index) => {
        if (index === 0) return;
        navigation.navigate('MealPhoto', { meal: meals[index - 1], date: selectedDate });
      },
    );
  }

  const isToday = selectedDate === todayString();

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#F9FAFB" />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {/* Date Navigation */}
        <View style={styles.dateNav}>
          <TouchableOpacity onPress={() => goDay(-1)} style={styles.navBtn}>
            <Text style={styles.navArrow}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.dateLabel}>{displayDate(selectedDate)}</Text>
          <TouchableOpacity
            onPress={() => goDay(1)}
            style={[styles.navBtn, isToday && styles.navBtnDisabled]}
            disabled={isToday}
          >
            <Text style={[styles.navArrow, isToday && styles.navArrowDisabled]}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Calorie Summary */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Calories</Text>
          <CalorieSummary consumed={totals.calories} goal={goals.calories} />
        </View>

        {/* Macro Rings */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Macros</Text>
          <View style={styles.macroRow}>
            <MacroRing
              current={totals.protein}
              goal={goals.protein}
              label="Protein"
              color="#3B82F6"
            />
            <MacroRing
              current={totals.carbs}
              goal={goals.carbs}
              label="Carbs"
              color="#F59E0B"
            />
            <MacroRing
              current={totals.fat}
              goal={goals.fat}
              label="Fat"
              color="#EF4444"
            />
            <MacroRing
              current={totals.fiber ?? 0}
              goal={goals.fiber}
              label="Fiber"
              color="#8B5CF6"
            />
          </View>
        </View>

        {/* Water Tracker */}
        {showWaterTracker && (
          <View style={styles.card}>
            <View style={styles.waterHeader}>
              <Text style={styles.cardTitle}>💧 Water</Text>
              <Text style={styles.waterAmount}>
                {Math.round(water)} / {waterGoal} fl oz
              </Text>
            </View>

            {/* Progress bar */}
            <View style={styles.waterBarTrack}>
              <View style={[styles.waterBarFill, { width: `${waterPct}%` as any }]} />
            </View>
            <Text style={styles.waterPctText}>{waterPct}% of daily goal</Text>

            {/* Bubbles */}
            <View style={styles.waterDots}>
              {Array.from({ length: numBubbles }).map((_, i) => (
                <TouchableOpacity
                  key={i}
                  onPress={() => handleBubblePress(i)}
                  style={[styles.waterDot, i < filledBubbles && styles.waterDotFilled]}
                  activeOpacity={0.6}
                >
                  <Text style={styles.waterDotText}>💧</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.waterGoal}>
              Tap to fill {OZ_PER_BUBBLE} fl oz · tap the last drop again to undo
            </Text>
          </View>
        )}

        {/* Snap a Meal */}
        <TouchableOpacity style={styles.snapBtn} onPress={handleSnapMeal} activeOpacity={0.85}>
          <Text style={styles.snapIcon}>📸</Text>
          <View>
            <Text style={styles.snapTitle}>Snap a Meal</Text>
            <Text style={styles.snapSub}>AI identifies foods & estimates macros</Text>
          </View>
        </TouchableOpacity>

        {/* Meal Sections */}
        <View style={styles.mealsHeader}>
          <Text style={styles.mealsTitle}>Food Log</Text>
        </View>
        {(['breakfast', 'lunch', 'dinner', 'snacks'] as MealType[]).map((meal) => (
          <MealSection
            key={meal}
            meal={meal}
            date={selectedDate}
            onAddFood={handleAddFood}
          />
        ))}

        {dayWorkouts.length > 0 && (
          <View style={styles.workoutsSection}>
            <Text style={styles.workoutsTitle}>Workouts</Text>
            {dayWorkouts.map((w) => (
              <WorkoutHistoryItem
                key={w.id}
                session={w}
                showDate={false}
                onPress={() =>
                  navigation.navigate('WorkoutSummary', {
                    sessionId: w.id,
                    viewOnly: true,
                  })
                }
                onDelete={() => deleteWorkout(w.id)}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  dateNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    gap: 20,
  },
  navBtn: {
    padding: 8,
  },
  navBtnDisabled: {
    opacity: 0.3,
  },
  navArrow: {
    fontSize: 28,
    color: '#374151',
    fontWeight: '300',
  },
  navArrowDisabled: {
    color: '#D1D5DB',
  },
  dateLabel: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    minWidth: 120,
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 16,
  },
  macroRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  waterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  waterAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#3B82F6',
  },
  waterBarTrack: {
    height: 8,
    backgroundColor: '#EFF6FF',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 4,
  },
  waterBarFill: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#3B82F6',
  },
  waterPctText: {
    fontSize: 11,
    color: '#9CA3AF',
    marginBottom: 12,
  },
  waterDots: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  waterDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.3,
  },
  waterDotFilled: {
    opacity: 1,
    backgroundColor: '#DBEAFE',
  },
  waterDotText: {
    fontSize: 18,
  },
  waterGoal: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  snapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#0284C7',
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  snapIcon: {
    fontSize: 32,
  },
  snapTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  snapSub: {
    fontSize: 12,
    color: '#BAE6FD',
    marginTop: 2,
  },
  mealsHeader: {
    marginBottom: 8,
  },
  mealsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  workoutsSection: {
    marginTop: 8,
  },
  workoutsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 10,
  },
});
