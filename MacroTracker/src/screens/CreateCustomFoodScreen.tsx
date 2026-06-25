import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from '../store/useStore';
import type { Food } from '../types';
import { KeyboardDoneAccessory, DONE_ACCESSORY_ID } from '../components/KeyboardDoneAccessory';

interface Props {
  navigation: any;
}

export function CreateCustomFoodScreen({ navigation }: Props) {
  const addCustomFood = useStore((s) => s.addCustomFood);

  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [servingSize, setServingSize] = useState('1');
  const [servingUnit, setServingUnit] = useState('serving');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('0');
  const [carbs, setCarbs] = useState('0');
  const [fat, setFat] = useState('0');
  const [fiber, setFiber] = useState('');

  function handleSave() {
    const trimName = name.trim();
    if (!trimName) {
      Alert.alert('Name required', 'Please enter a food name.');
      return;
    }
    const cal = parseFloat(calories);
    if (!calories || isNaN(cal)) {
      Alert.alert('Calories required', 'Please enter the calories per serving.');
      return;
    }
    const food: Food = {
      id: `custom-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name: trimName,
      brand: brand.trim() || undefined,
      serving_size: parseFloat(servingSize) || 1,
      serving_unit: servingUnit.trim() || 'serving',
      macros: {
        calories: Math.round(cal),
        protein: Math.round(parseFloat(protein) || 0),
        carbs: Math.round(parseFloat(carbs) || 0),
        fat: Math.round(parseFloat(fat) || 0),
        fiber: fiber.trim() ? Math.round(parseFloat(fiber)) : undefined,
      },
    };
    addCustomFood(food);
    navigation.goBack();
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.sideBtn}>
            <Text style={styles.backText}>‹ Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Create Food</Text>
          <TouchableOpacity onPress={handleSave} style={styles.sideBtn}>
            <Text style={styles.saveText}>Save</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.sectionLabel}>Food Details</Text>
          <Field label="Name *" value={name} onChangeText={setName} placeholder="e.g. Greek Yogurt" />
          <Field label="Brand" value={brand} onChangeText={setBrand} placeholder="optional" />
          <View style={styles.row}>
            <View style={styles.halfField}>
              <Field
                label="Serving size"
                value={servingSize}
                onChangeText={setServingSize}
                keyboardType="decimal-pad"
                placeholder="1"
              />
            </View>
            <View style={styles.gap} />
            <View style={styles.halfField}>
              <Field
                label="Serving unit"
                value={servingUnit}
                onChangeText={setServingUnit}
                placeholder="serving, g, oz…"
              />
            </View>
          </View>

          <Text style={styles.sectionLabel}>Nutrition (per serving)</Text>
          <Field
            label="Calories *"
            value={calories}
            onChangeText={setCalories}
            keyboardType="decimal-pad"
            placeholder="0"
          />
          <View style={styles.row}>
            <View style={styles.halfField}>
              <Field
                label="Protein (g)"
                value={protein}
                onChangeText={setProtein}
                keyboardType="decimal-pad"
                placeholder="0"
              />
            </View>
            <View style={styles.gap} />
            <View style={styles.halfField}>
              <Field
                label="Carbs (g)"
                value={carbs}
                onChangeText={setCarbs}
                keyboardType="decimal-pad"
                placeholder="0"
              />
            </View>
          </View>
          <View style={styles.row}>
            <View style={styles.halfField}>
              <Field
                label="Fat (g)"
                value={fat}
                onChangeText={setFat}
                keyboardType="decimal-pad"
                placeholder="0"
              />
            </View>
            <View style={styles.gap} />
            <View style={styles.halfField}>
              <Field
                label="Fiber (g)"
                value={fiber}
                onChangeText={setFiber}
                keyboardType="decimal-pad"
                placeholder="0 (optional)"
              />
            </View>
          </View>

          <TouchableOpacity style={styles.createBtn} onPress={handleSave} activeOpacity={0.85}>
            <Text style={styles.createBtnText}>Create Food</Text>
          </TouchableOpacity>
        </ScrollView>
        <KeyboardDoneAccessory />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({
  label,
  value,
  onChangeText,
  keyboardType = 'default' as any,
  placeholder,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  keyboardType?: any;
  placeholder?: string;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.fieldInput}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        placeholder={placeholder}
        placeholderTextColor="#9CA3AF"
        inputAccessoryViewID={
          keyboardType === 'decimal-pad' ? DONE_ACCESSORY_ID : undefined
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  sideBtn: { width: 64 },
  backText: { fontSize: 16, color: '#10B981', fontWeight: '600' },
  saveText: {
    fontSize: 16,
    color: '#10B981',
    fontWeight: '700',
    textAlign: 'right',
  },
  title: { fontSize: 17, fontWeight: '700', color: '#111827' },
  content: { padding: 16, paddingBottom: 40 },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 16,
    marginBottom: 10,
  },
  field: { marginBottom: 12 },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
  },
  fieldInput: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111827',
  },
  row: { flexDirection: 'row' },
  gap: { width: 12 },
  halfField: { flex: 1 },
  createBtn: {
    backgroundColor: '#10B981',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  createBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
