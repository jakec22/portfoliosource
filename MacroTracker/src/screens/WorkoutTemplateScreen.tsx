import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  ActionSheetIOS,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { useStore } from '../store/useStore';
import { TemplateExercise, TemplateSet, WorkoutTemplate, SetType } from '../types';

interface Props {
  route: { params?: { templateId?: string } };
  navigation: any;
}

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random()}`;
}

function blankSet(): TemplateSet {
  return { id: uid('ts'), weight: 0, reps: 0, type: undefined };
}

function blankExercise(): TemplateExercise {
  return { id: uid('te'), name: '', sets: [blankSet()] };
}

// Label + colors for the left-side set bubble (mirrors the active workout).
function setBadgeInfo(type: SetType | undefined, index: number) {
  switch (type) {
    case 'warmup':
      return { label: 'W', bubble: styles.badgeWarmup, text: styles.badgeWarmupText };
    case 'failure':
      return { label: 'F', bubble: styles.badgeFailure, text: styles.badgeFailureText };
    case 'dropset':
      return { label: 'D', bubble: styles.badgeDropset, text: styles.badgeDropsetText };
    default:
      return { label: String(index + 1), bubble: styles.badgeNormal, text: styles.badgeNormalText };
  }
}

export function WorkoutTemplateScreen({ route, navigation }: Props) {
  const templateId = route.params?.templateId;
  const templates = useStore((s) => s.workoutTemplates);
  const saveTemplate = useStore((s) => s.saveTemplate);

  const existing = templateId ? templates.find((t) => t.id === templateId) : undefined;

  const [name, setName] = useState(existing?.name ?? '');
  const [exercises, setExercises] = useState<TemplateExercise[]>(
    existing
      ? existing.exercises.map((e) => ({ ...e, sets: e.sets.map((s) => ({ ...s })) }))
      : [blankExercise()]
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

  function addSet(exId: string) {
    setExercises((prev) =>
      prev.map((e) => {
        if (e.id !== exId) return e;
        // New set inherits the previous set's weight/reps as a sensible default.
        const last = e.sets[e.sets.length - 1];
        return {
          ...e,
          sets: [
            ...e.sets,
            { id: uid('ts'), weight: last?.weight ?? 0, reps: last?.reps ?? 0, type: undefined },
          ],
        };
      })
    );
  }

  function updateSet(exId: string, setId: string, patch: Partial<TemplateSet>) {
    setExercises((prev) =>
      prev.map((e) =>
        e.id !== exId
          ? e
          : { ...e, sets: e.sets.map((s) => (s.id === setId ? { ...s, ...patch } : s)) }
      )
    );
  }

  function removeSet(exId: string, setId: string) {
    setExercises((prev) =>
      prev.map((e) =>
        e.id !== exId ? e : { ...e, sets: e.sets.filter((s) => s.id !== setId) }
      )
    );
  }

  function pickSetType(exId: string, setId: string) {
    const labels = ['Normal', 'Warm up', 'Failure', 'Drop set'];
    const types: SetType[] = ['normal', 'warmup', 'failure', 'dropset'];
    const apply = (i: number) => {
      if (i >= 0 && i < types.length) {
        // Store undefined for 'normal' to keep templates tidy.
        updateSet(exId, setId, { type: types[i] === 'normal' ? undefined : types[i] });
      }
    };
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { title: 'Set type', options: [...labels, 'Cancel'], cancelButtonIndex: labels.length },
        apply
      );
    } else {
      Alert.alert('Set type', undefined, [
        ...labels.map((label, i) => ({ text: label, onPress: () => apply(i) })),
        { text: 'Cancel', style: 'cancel' as const },
      ]);
    }
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

              {/* Column labels */}
              <View style={styles.setRowHead}>
                <Text style={[styles.colSet, styles.headText]}>Set</Text>
                <Text style={[styles.colNum, styles.headText]}>lbs</Text>
                <Text style={[styles.colNum, styles.headText]}>Reps</Text>
              </View>

              {e.sets.map((s, i) => (
                <ReanimatedSwipeable
                  key={s.id}
                  renderRightActions={() => (
                    <TouchableOpacity
                      style={styles.swipeDeleteAction}
                      onPress={() => removeSet(e.id, s.id)}
                    >
                      <Text style={styles.swipeDeleteText}>Delete</Text>
                    </TouchableOpacity>
                  )}
                  overshootRight={false}
                  friction={2}
                >
                  <View style={styles.setRow}>
                    <TouchableOpacity
                      style={styles.colSet}
                      onPress={() => pickSetType(e.id, s.id)}
                      activeOpacity={0.7}
                    >
                      {(() => {
                        const badge = setBadgeInfo(s.type, i);
                        return (
                          <View style={[styles.setBadge, badge.bubble]}>
                            <Text style={[styles.setBadgeText, badge.text]}>{badge.label}</Text>
                          </View>
                        );
                      })()}
                    </TouchableOpacity>
                    <TextInput
                      style={[styles.colNum, styles.setInput]}
                      value={s.weight === 0 ? '' : String(s.weight)}
                      onChangeText={(v) => {
                        const n = parseFloat(v.replace(/[^0-9.]/g, ''));
                        updateSet(e.id, s.id, { weight: Number.isNaN(n) ? 0 : n });
                      }}
                      keyboardType="numbers-and-punctuation"
                      returnKeyType="done"
                      placeholder="0"
                      placeholderTextColor="#D1D5DB"
                    />
                    <TextInput
                      style={[styles.colNum, styles.setInput]}
                      value={s.reps === 0 ? '' : String(s.reps)}
                      onChangeText={(v) => {
                        const n = parseInt(v.replace(/[^0-9]/g, ''), 10);
                        updateSet(e.id, s.id, { reps: Number.isNaN(n) ? 0 : n });
                      }}
                      keyboardType="numbers-and-punctuation"
                      returnKeyType="done"
                      placeholder="0"
                      placeholderTextColor="#D1D5DB"
                    />
                  </View>
                </ReanimatedSwipeable>
              ))}

              <TouchableOpacity
                style={styles.addSetBtn}
                onPress={() => addSet(e.id)}
                activeOpacity={0.8}
              >
                <Text style={styles.addSetText}>+ Add Set</Text>
              </TouchableOpacity>
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
  exTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
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

  setRowHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 6, paddingHorizontal: 2 },
  headText: { fontSize: 11, color: '#9CA3AF', fontWeight: '600' },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: '#fff',
  },
  colSet: { width: 40, textAlign: 'center', alignItems: 'center', justifyContent: 'center' },
  colNum: { flex: 1, marginHorizontal: 4 },
  setInput: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    paddingVertical: 8,
    fontSize: 15,
    color: '#111827',
    textAlign: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },

  // Left-side set-type bubble (tap to tag a set).
  setBadge: {
    minWidth: 28,
    height: 28,
    paddingHorizontal: 6,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  setBadgeText: { fontSize: 13, fontWeight: '800' },
  badgeNormal: { backgroundColor: '#F3F4F6', borderColor: '#E5E7EB' },
  badgeNormalText: { color: '#6B7280' },
  badgeWarmup: { backgroundColor: '#FEF3C7', borderColor: '#FCD34D' },
  badgeWarmupText: { color: '#D97706' },
  badgeFailure: { backgroundColor: '#FEE2E2', borderColor: '#FCA5A5' },
  badgeFailureText: { color: '#DC2626' },
  badgeDropset: { backgroundColor: '#EDE9FE', borderColor: '#C4B5FD' },
  badgeDropsetText: { color: '#7C3AED' },

  swipeDeleteAction: {
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    borderRadius: 10,
    marginVertical: 2,
    marginLeft: 8,
  },
  swipeDeleteText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  addSetBtn: { paddingVertical: 10, alignItems: 'center', marginTop: 4 },
  addSetText: { color: '#10B981', fontWeight: '600', fontSize: 14 },

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
