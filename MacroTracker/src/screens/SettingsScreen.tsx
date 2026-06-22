import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  Alert,
} from 'react-native';
import { useStore } from '../store/useStore';
import { DailyGoals } from '../types';

type Preset = {
  label: string;
  description: string;
  goals: DailyGoals;
};

const PRESETS: Preset[] = [
  {
    label: 'Weight Loss',
    description: '1500 kcal · High protein',
    goals: { calories: 1500, protein: 150, carbs: 130, fat: 50, fiber: 30 },
  },
  {
    label: 'Maintenance',
    description: '2000 kcal · Balanced',
    goals: { calories: 2000, protein: 150, carbs: 200, fat: 67, fiber: 30 },
  },
  {
    label: 'Muscle Gain',
    description: '2500 kcal · High protein & carbs',
    goals: { calories: 2500, protein: 200, carbs: 280, fat: 70, fiber: 35 },
  },
  {
    label: 'Keto',
    description: '1800 kcal · Low carb, high fat',
    goals: { calories: 1800, protein: 140, carbs: 30, fat: 140, fiber: 20 },
  },
];

export function SettingsScreen() {
  const goals = useStore((s) => s.goals);
  const setGoals = useStore((s) => s.setGoals);

  const [form, setForm] = useState({
    calories: String(goals.calories),
    protein: String(goals.protein),
    carbs: String(goals.carbs),
    fat: String(goals.fat),
    fiber: String(goals.fiber),
  });

  function handleSave() {
    const parsed = {
      calories: parseInt(form.calories),
      protein: parseInt(form.protein),
      carbs: parseInt(form.carbs),
      fat: parseInt(form.fat),
      fiber: parseInt(form.fiber),
    };
    if (Object.values(parsed).some((v) => isNaN(v) || v <= 0)) {
      Alert.alert('Invalid values', 'All fields must be positive numbers.');
      return;
    }
    setGoals(parsed);
    Alert.alert('Saved', 'Your goals have been updated!');
  }

  function applyPreset(preset: Preset) {
    setForm({
      calories: String(preset.goals.calories),
      protein: String(preset.goals.protein),
      carbs: String(preset.goals.carbs),
      fat: String(preset.goals.fat),
      fiber: String(preset.goals.fiber),
    });
  }

  function GoalField({
    label,
    field,
    unit,
    color,
  }: {
    label: string;
    field: keyof typeof form;
    unit: string;
    color: string;
  }) {
    return (
      <View style={styles.fieldRow}>
        <View style={[styles.fieldDot, { backgroundColor: color }]} />
        <Text style={styles.fieldLabel}>{label}</Text>
        <View style={styles.fieldInputWrap}>
          <TextInput
            style={styles.fieldInput}
            value={form[field]}
            onChangeText={(v) => setForm((f) => ({ ...f, [field]: v }))}
            keyboardType="number-pad"
            selectTextOnFocus
          />
          <Text style={styles.fieldUnit}>{unit}</Text>
        </View>
      </View>
    );
  }

  const totalCalsFromMacros =
    parseInt(form.protein || '0') * 4 +
    parseInt(form.carbs || '0') * 4 +
    parseInt(form.fat || '0') * 9;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.pageTitle}>Goals</Text>
        <Text style={styles.subtitle}>Customize your daily targets</Text>

        {/* Presets */}
        <Text style={styles.sectionTitle}>Quick Presets</Text>
        <View style={styles.presetsGrid}>
          {PRESETS.map((preset) => (
            <TouchableOpacity
              key={preset.label}
              style={styles.presetCard}
              onPress={() => applyPreset(preset)}
              activeOpacity={0.7}
            >
              <Text style={styles.presetLabel}>{preset.label}</Text>
              <Text style={styles.presetDesc}>{preset.description}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Custom Goals */}
        <Text style={styles.sectionTitle}>Custom Goals</Text>
        <View style={styles.card}>
          <GoalField label="Calories" field="calories" unit="kcal" color="#10B981" />
          <GoalField label="Protein" field="protein" unit="g" color="#3B82F6" />
          <GoalField label="Carbs" field="carbs" unit="g" color="#F59E0B" />
          <GoalField label="Fat" field="fat" unit="g" color="#EF4444" />
          <GoalField label="Fiber" field="fiber" unit="g" color="#8B5CF6" />

          <View style={styles.calCalc}>
            <Text style={styles.calCalcLabel}>Calories from macros:</Text>
            <Text
              style={[
                styles.calCalcValue,
                Math.abs(totalCalsFromMacros - parseInt(form.calories || '0')) > 50 &&
                  styles.calCalcMismatch,
              ]}
            >
              {totalCalsFromMacros} kcal
            </Text>
          </View>

          <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
            <Text style={styles.saveBtnText}>Save Goals</Text>
          </TouchableOpacity>
        </View>

        {/* Macro distribution */}
        <Text style={styles.sectionTitle}>Macro Distribution</Text>
        <View style={styles.card}>
          {[
            {
              label: 'Protein',
              cals: parseInt(form.protein || '0') * 4,
              color: '#3B82F6',
            },
            {
              label: 'Carbs',
              cals: parseInt(form.carbs || '0') * 4,
              color: '#F59E0B',
            },
            {
              label: 'Fat',
              cals: parseInt(form.fat || '0') * 9,
              color: '#EF4444',
            },
          ].map(({ label, cals, color }) => {
            const pct = totalCalsFromMacros
              ? Math.round((cals / totalCalsFromMacros) * 100)
              : 0;
            return (
              <View key={label} style={styles.distRow}>
                <Text style={[styles.distLabel, { color }]}>{label}</Text>
                <View style={styles.distBarTrack}>
                  <View
                    style={[
                      styles.distBarFill,
                      { width: `${pct}%` as any, backgroundColor: color },
                    ]}
                  />
                </View>
                <Text style={styles.distPct}>{pct}%</Text>
              </View>
            );
          })}
        </View>

        <Text style={styles.hint}>
          Tip: 1g protein = 4 kcal · 1g carbs = 4 kcal · 1g fat = 9 kcal
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  content: {
    padding: 16,
    paddingBottom: 48,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#9CA3AF',
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
    marginTop: 8,
  },
  presetsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 24,
  },
  presetCard: {
    width: '47%',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  presetLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  presetDesc: {
    fontSize: 12,
    color: '#6B7280',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F9FAFB',
  },
  fieldDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 12,
  },
  fieldLabel: {
    flex: 1,
    fontSize: 16,
    color: '#374151',
    fontWeight: '500',
  },
  fieldInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  fieldInput: {
    width: 80,
    height: 40,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  fieldUnit: {
    fontSize: 13,
    color: '#9CA3AF',
    width: 32,
  },
  calCalc: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  calCalcLabel: {
    fontSize: 13,
    color: '#6B7280',
  },
  calCalcValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#10B981',
  },
  calCalcMismatch: {
    color: '#F59E0B',
  },
  saveBtn: {
    backgroundColor: '#10B981',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  distRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 12,
  },
  distLabel: {
    width: 56,
    fontSize: 13,
    fontWeight: '600',
  },
  distBarTrack: {
    flex: 1,
    height: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 4,
    overflow: 'hidden',
  },
  distBarFill: {
    height: 8,
    borderRadius: 4,
  },
  distPct: {
    width: 36,
    textAlign: 'right',
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  hint: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 18,
  },
});
