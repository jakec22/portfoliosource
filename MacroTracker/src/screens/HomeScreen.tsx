import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { useStore } from '../store/useStore';
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
  const getTotals = useStore((s) => s.getTotalsForDate);
  const waterIntake = useStore((s) => s.waterIntake);
  const addWater = useStore((s) => s.addWater);

  const totals = getTotals(selectedDate);
  const water = waterIntake[selectedDate] ?? 0;

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
            <Text style={styles.waterAmount}>{(water / 1000).toFixed(1)}L</Text>
          </View>
          <View style={styles.waterDots}>
            {[250, 250, 250, 250, 250, 250, 250, 250].map((ml, i) => (
              <TouchableOpacity
                key={i}
                onPress={() => addWater(selectedDate, ml)}
                style={[
                  styles.waterDot,
                  water >= ml * (i + 1) && styles.waterDotFilled,
                ]}
              >
                <Text style={styles.waterDotText}>💧</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.waterGoal}>Goal: 2L · tap to add 250ml</Text>
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
    fontSize: 18,
    fontWeight: '700',
    color: '#3B82F6',
  },
  waterDots: {
    flexDirection: 'row',
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
  mealsHeader: {
    marginBottom: 8,
  },
  mealsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
});
