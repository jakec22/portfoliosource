import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from '../store/useStore';
import { TemplateExercise, WorkoutTemplate } from '../types';

interface Props {
  route: { params?: { templateId?: string } };
  navigation: any;
}

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random()}`;
}

function blankExercise(): TemplateExercise {
  return { id: uid('te'), name: '', targetSets: 3, targetReps: 10, targetWeight: 0 };
}

export function WorkoutTemplateScreen({ route, navigation }: Props) {
  const templateId = route.params?.templateId;
  const templates = useStore((s) => s.workoutTemplates);
  const saveTemplate = useStore((s) => s.saveTemplate);

  const existing = templateId ? templates.find((t) => t.id === templateId) : undefined;

  const [name, setName] = useState(existing?.name ?? '');
  const [exercises, setExercises] = useState<TemplateExercise[]>(
    existing ? existing.exercises.map((e) => ({ ...e })) : [blankExercise()]
  );

  function updateExercise(id: string, patch: Partial<TemplateExercise>) {
    setExercises((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  }

  function addExercise() {
    setExercises((prev) => [...prev, blankExercise()]);
  }

  function removeExercise(id: string) {
    setExercises((prev) => prev.filter((e) => e.id !== id));
  }

  function handleSave() {
    const trimmedName = name.trim();
    if (!trimmedName) {
      Alert.alert('Name required', 'Give your workout a name.');
      return;
    }
    const cleaned = exercises
      .map((e) => ({ ...e, name: e.name.trim() }))
      .filter((e) => e.name.length > 0);
    if (cleaned.length === 0) {
      Alert.alert('Add an exercise', 'Add at least one exercise with a name.');
      return;
    }
    const template: WorkoutTemplate = {
      id: existing?.id ?? uid('tpl'),
      name: trimmedName,
      exercises: cleaned,
      createdAt: existing?.createdAt ?? Date.now(),
    };
    saveTemplate(template);
    navigation.goBack();
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.cancel}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{existing ? 'Edit Workout' : 'New Workout'}</Text>
        <TouchableOpacity onPress={handleSave}>
          <Text style={styles.save}>Save</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.label}>Workout Name</Text>
          <TextInput
            style={styles.nameInput}
            value={name}
            onChangeText={setName}
            placeholder="e.g. Push Day, Leg Day"
            placeholderTextColor="#9CA3AF"
          />

          <Text style={[styles.label, { marginTop: 20 }]}>Exercises</Text>
          {exercises.map((e, idx) => (
            <View key={e.id} style={styles.exCard}>
              <View style={styles.exTop}>
                <TextInput
                  style={styles.exNameInput}
                  value={e.name}
                  onChangeText={(v) => updateExercise(e.id, { name: v })}
                  placeholder={`Exercise ${idx + 1}`}
                  placeholderTextColor="#9CA3AF"
                />
                <TouchableOpacity onPress={() => removeExercise(e.id)} style={styles.exRemove}>
                  <Text style={styles.exRemoveText}>✕</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.exFields}>
                <NumField
                  label="Sets"
                  value={e.targetSets}
                  onChange={(n) => updateExercise(e.id, { targetSets: n })}
                />
                <NumField
                  label="Weight (lb)"
                  value={e.targetWeight}
                  onChange={(n) => updateExercise(e.id, { targetWeight: n })}
                />
                <NumField
                  label="Reps"
                  value={e.targetReps}
                  onChange={(n) => updateExercise(e.id, { targetReps: n })}
                />
              </View>
            </View>
          ))}

          <TouchableOpacity style={styles.addExBtn} onPress={addExercise} activeOpacity={0.8}>
            <Text style={styles.addExText}>+ Add Exercise</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function NumField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <View style={styles.numField}>
      <Text style={styles.numLabel}>{label}</Text>
      <TextInput
        style={styles.numInput}
        value={value === 0 ? '' : String(value)}
        onChangeText={(v) => {
          const n = parseInt(v.replace(/[^0-9]/g, ''), 10);
          onChange(Number.isNaN(n) ? 0 : n);
        }}
        keyboardType="number-pad"
        placeholder="0"
        placeholderTextColor="#D1D5DB"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    backgroundColor: '#fff',
  },
  cancel: { fontSize: 16, color: '#6B7280' },
  save: { fontSize: 16, color: '#10B981', fontWeight: '700' },
  title: { fontSize: 17, fontWeight: '700', color: '#111827' },
  content: { padding: 16, paddingBottom: 40 },
  label: { fontSize: 13, fontWeight: '700', color: '#6B7280', marginBottom: 8 },
  nameInput: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111827',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  exCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  exTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  exNameInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    paddingVertical: 6,
  },
  exRemove: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  exRemoveText: { color: '#EF4444', fontSize: 13, fontWeight: '700' },
  exFields: { flexDirection: 'row', gap: 10, marginTop: 10 },
  numField: { flex: 1 },
  numLabel: { fontSize: 11, color: '#9CA3AF', marginBottom: 4 },
  numInput: {
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 15,
    color: '#111827',
    textAlign: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  addExBtn: {
    backgroundColor: '#ECFDF5',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    marginTop: 4,
  },
  addExText: { color: '#059669', fontWeight: '700', fontSize: 15 },
});
