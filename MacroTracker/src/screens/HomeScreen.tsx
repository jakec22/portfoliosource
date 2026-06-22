import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore, sumMacros } from '../store/useStore';
import { todayString, displayDate, formatDate } from '../utils/date';
import { CalorieSummary } from '../components/CalorieSummary';
import { MacroRing } from '../components/MacroRing';
import { MealSection } from '../components/MealSection';
import { MealType } from '../types';

interface Props {
  navigation: any;
}

export function HomeScreen({ navigation }: Props) {
  const [selectedDate, setSelectedDate] = useState(todayString());
  const goals = useStore((s) => s.goals);
  const dateEntries = useStore((s) => s.logs[selectedDate] ?? []);
  const waterIntake = useStore((s) => s.waterIntake);
  const setWater = useStore((s) => s.setWater);
  const waterGoal = useStore((s) => s.waterGoal);
  const setWaterGoal = useStore((s) => s.setWaterGoal);
  const bodyWeightLbs = useStore((s) => s.bodyWeightLbs);

  const totals = useMemo(() => sumMacros(dateEntries), [dateEntries]);
  const water = waterIntake[selectedDate] ?? 0;

  const OZ_PER_BUBBLE = 8;
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

  function handleAutoGoal() {
    if (!bodyWeightLbs) {
      Alert.alert(
        'Add your weight first',
        'Enter your weight in the Calculator tab, then tap Auto again to set an optimal hydration goal.'
      );
      return;
    }
    // Common guideline: ~0.5 fl oz per lb of body weight, rounded to a bubble.
    const optimal = Math.round((bodyWeightLbs * 0.5) / OZ_PER_BUBBLE) * OZ_PER_BUBBLE;
    setWaterGoal(optimal);
    Alert.alert('Hydration Goal Set', `Optimal daily goal: ${optimal} fl oz (based on ${bodyWeightLbs} lbs).`);
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

          {/* Goal adjuster */}
          <View style={styles.waterGoalRow}>
            <TouchableOpacity
              style={styles.waterGoalBtn}
              onPress={() => setWaterGoal(waterGoal - OZ_PER_BUBBLE)}
            >
              <Text style={styles.waterGoalBtnText}>−</Text>
            </TouchableOpacity>
            <View style={styles.waterGoalCenter}>
              <Text style={styles.waterGoalLabel}>Daily Goal</Text>
              <Text style={styles.waterGoalValue}>{waterGoal} fl oz</Text>
            </View>
            <TouchableOpacity
              style={styles.waterGoalBtn}
              onPress={() => setWaterGoal(waterGoal + OZ_PER_BUBBLE)}
            >
              <Text style={styles.waterGoalBtnText}>+</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.waterAutoBtn} onPress={handleAutoGoal}>
              <Text style={styles.waterAutoBtnText}>Auto</Text>
            </TouchableOpacity>
          </View>
        </View>

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
  waterGoalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  waterGoalBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  waterGoalBtnText: {
    fontSize: 24,
    fontWeight: '600',
    color: '#3B82F6',
    lineHeight: 28,
  },
  waterGoalCenter: {
    flex: 1,
    alignItems: 'center',
  },
  waterGoalLabel: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  waterGoalValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  waterAutoBtn: {
    paddingHorizontal: 14,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  waterAutoBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  mealsHeader: {
    marginBottom: 8,
  },
  mealsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
});
