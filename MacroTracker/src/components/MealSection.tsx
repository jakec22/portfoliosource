import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { FoodEntry, MealType } from '../types';
import { useStore, sumMacros } from '../store/useStore';
import { formatAmount } from '../utils/serving';

const MEAL_LABELS: Record<MealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snacks: 'Snacks',
};

interface Props {
  meal: MealType;
  date: string;
  onAddFood: (meal: MealType) => void;
}

export function MealSection({ meal, date, onAddFood }: Props) {
  const [expanded, setExpanded] = useState(true);
  const dateEntries = useStore((s) => s.logs[date]);
  const entries = useMemo(
    () => (dateEntries ?? []).filter((e) => e.meal === meal),
    [dateEntries, meal]
  );
  const removeEntry = useStore((s) => s.removeEntry);

  const totals = useMemo(() => sumMacros(entries), [entries]);

  function handleDelete(entry: FoodEntry) {
    Alert.alert(
      'Remove Food',
      `Remove ${entry.food.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => removeEntry(date, entry.id),
        },
      ]
    );
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.header}
        onPress={() => setExpanded((v) => !v)}
        activeOpacity={0.7}
      >
        <View style={styles.headerLeft}>
          <Text style={styles.mealName}>{MEAL_LABELS[meal]}</Text>
          <Text style={styles.mealMacros}>
            P {Math.round(totals.protein)}g · C {Math.round(totals.carbs)}g · F{' '}
            {Math.round(totals.fat)}g
          </Text>
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.mealCals}>{Math.round(totals.calories)} kcal</Text>
          <Text style={styles.chevron}>{expanded ? '▲' : '▼'}</Text>
        </View>
      </TouchableOpacity>

      {expanded && (
        <View style={styles.body}>
          {entries.length === 0 ? (
            <Text style={styles.empty}>No foods logged yet</Text>
          ) : (
            entries.map((entry) => (
              <TouchableOpacity
                key={entry.id}
                style={styles.entryRow}
                onLongPress={() => handleDelete(entry)}
                activeOpacity={0.7}
              >
                <View style={styles.entryLeft}>
                  <Text style={styles.entryName}>{entry.food.name}</Text>
                  <Text style={styles.entryDetail}>{formatAmount(entry)}</Text>
                </View>
                <View style={styles.entryMacros}>
                  <Text style={styles.entryCals}>
                    {Math.round(entry.food.macros.calories * entry.servings)} kcal
                  </Text>
                  <Text style={styles.entryMacroDetail}>
                    P:{Math.round(entry.food.macros.protein * entry.servings)}g
                    {'  '}C:{Math.round(entry.food.macros.carbs * entry.servings)}g
                    {'  '}F:{Math.round(entry.food.macros.fat * entry.servings)}g
                  </Text>
                </View>
              </TouchableOpacity>
            ))
          )}
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => onAddFood(meal)}
            activeOpacity={0.7}
          >
            <Text style={styles.addButtonText}>+ Add Food</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  headerLeft: {
    flex: 1,
  },
  mealName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  mealMacros: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mealCals: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  chevron: {
    fontSize: 10,
    color: '#9CA3AF',
  },
  body: {
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  empty: {
    textAlign: 'center',
    color: '#9CA3AF',
    fontSize: 13,
    paddingVertical: 12,
  },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F9FAFB',
  },
  entryLeft: {
    flex: 1,
  },
  entryName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1F2937',
  },
  entryDetail: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  entryMacros: {
    alignItems: 'flex-end',
  },
  entryCals: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  entryMacroDetail: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 2,
  },
  addButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10B981',
  },
});
