import React, { useEffect, useState } from 'react';
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
import { formatDuration } from '../utils/date';
import { RestTimer } from '../components/RestTimer';

interface Props {
  navigation: any;
}

export function ActiveWorkoutScreen({ navigation }: Props) {
  const workout = useStore((s) => s.activeWorkout);
  const addWorkoutExercise = useStore((s) => s.addWorkoutExercise);
  const removeWorkoutExercise = useStore((s) => s.removeWorkoutExercise);
  const addWorkoutSet = useStore((s) => s.addWorkoutSet);
  const updateWorkoutSet = useStore((s) => s.updateWorkoutSet);
  const toggleWorkoutSet = useStore((s) => s.toggleWorkoutSet);
  const removeWorkoutSet = useStore((s) => s.removeWorkoutSet);
  const reorderWorkoutExercise = useStore((s) => s.reorderWorkoutExercise);
  const finishWorkout = useStore((s) => s.finishWorkout);
  const cancelWorkout = useStore((s) => s.cancelWorkout);

  // Elapsed workout timer, ticking every second from the session start.
  const startedAt = workout?.startedAt;
  const [elapsed, setElapsed] = useState(startedAt ? Date.now() - startedAt : 0);
  useEffect(() => {
    if (!startedAt) return;
    const id = setInterval(() => setElapsed(Date.now() - startedAt), 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  if (!workout) {
    // Nothing in progress (e.g. just finished) — bounce back to the list.
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No active workout.</Text>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.save}>Go back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const totalSets = workout.exercises.reduce((n, e) => n + e.sets.length, 0);
  const doneSets = workout.exercises.reduce(
    (n, e) => n + e.sets.filter((s) => s.completed).length,
    0
  );

  function promptAddExercise() {
    Alert.prompt(
      'Add Exercise',
      'Name of the exercise',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Add',
          onPress: (name?: string) => {
            if (name && name.trim()) addWorkoutExercise(name.trim());
          },
        },
      ],
      'plain-text'
    );
  }

  function handleFinish() {
    Alert.alert('Finish workout', 'Save this workout and end the session?', [
      { text: 'Keep going', style: 'cancel' },
      {
        text: 'Finish',
        onPress: () => {
          const id = workout?.id;
          finishWorkout();
          if (id) navigation.replace('WorkoutSummary', { sessionId: id });
          else navigation.goBack();
        },
      },
    ]);
  }

  function handleCancel() {
    Alert.alert('Cancel workout', 'Discard this workout? This cannot be undone.', [
      { text: 'Keep going', style: 'cancel' },
      {
        text: 'Discard',
        style: 'destructive',
        onPress: () => {
          cancelWorkout();
          navigation.goBack();
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleCancel}>
          <Text style={styles.cancel}>Cancel</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.timer}>{formatDuration(elapsed)}</Text>
          <Text style={styles.progress}>
            {doneSets}/{totalSets} sets · {workout.name}
          </Text>
        </View>
        <TouchableOpacity onPress={handleFinish}>
          <Text style={styles.save}>Finish</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={8}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {workout.exercises.length === 0 && (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyCardText}>
                No exercises yet. Tap “+ Add Exercise” to start logging sets.
              </Text>
            </View>
          )}

          {workout.exercises.map((ex, exIdx) => (
            <View key={ex.id} style={styles.exCard}>
              <View style={styles.exHeader}>
                <Text style={styles.exName} numberOfLines={1}>
                  {ex.name}
                </Text>
                <View style={styles.exHeaderActions}>
                  <TouchableOpacity
                    onPress={() => reorderWorkoutExercise(ex.id, 'up')}
                    disabled={exIdx === 0}
                    style={styles.reorderBtn}
                  >
                    <Text style={[styles.reorderText, exIdx === 0 && styles.reorderDisabled]}>↑</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => reorderWorkoutExercise(ex.id, 'down')}
                    disabled={exIdx === workout.exercises.length - 1}
                    style={styles.reorderBtn}
                  >
                    <Text
                      style={[
                        styles.reorderText,
                        exIdx === workout.exercises.length - 1 && styles.reorderDisabled,
                      ]}
                    >
                      ↓
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => removeWorkoutExercise(ex.id)}>
                    <Text style={styles.exRemove}>Remove</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Column labels */}
              <View style={styles.setRowHead}>
                <Text style={[styles.colSet, styles.headText]}>Set</Text>
                <Text style={[styles.colNum, styles.headText]}>lbs</Text>
                <Text style={[styles.colNum, styles.headText]}>Reps</Text>
                <Text style={[styles.colCheck, styles.headText]}>Done</Text>
                <View style={styles.colDel} />
              </View>

              {ex.sets.map((set, i) => (
                <View
                  key={set.id}
                  style={[styles.setRow, set.completed && styles.setRowDone]}
                >
                  <Text style={styles.colSet}>{i + 1}</Text>
                  <TextInput
                    style={[styles.colNum, styles.setInput]}
                    value={set.weight === 0 ? '' : String(set.weight)}
                    onChangeText={(v) => {
                      const n = parseFloat(v.replace(/[^0-9.]/g, ''));
                      updateWorkoutSet(ex.id, set.id, { weight: Number.isNaN(n) ? 0 : n });
                    }}
                    keyboardType="decimal-pad"
                    placeholder="0"
                    placeholderTextColor="#D1D5DB"
                  />
                  <TextInput
                    style={[styles.colNum, styles.setInput]}
                    value={set.reps === 0 ? '' : String(set.reps)}
                    onChangeText={(v) => {
                      const n = parseInt(v.replace(/[^0-9]/g, ''), 10);
                      updateWorkoutSet(ex.id, set.id, { reps: Number.isNaN(n) ? 0 : n });
                    }}
                    keyboardType="number-pad"
                    placeholder="0"
                    placeholderTextColor="#D1D5DB"
                  />
                  <TouchableOpacity
                    style={styles.colCheck}
                    onPress={() => toggleWorkoutSet(ex.id, set.id)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.checkbox, set.completed && styles.checkboxOn]}>
                      {set.completed && <Text style={styles.checkmark}>✓</Text>}
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.colDel}
                    onPress={() => removeWorkoutSet(ex.id, set.id)}
                  >
                    <Text style={styles.delText}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}

              <TouchableOpacity
                style={styles.addSetBtn}
                onPress={() => addWorkoutSet(ex.id)}
                activeOpacity={0.8}
              >
                <Text style={styles.addSetText}>+ Add Set</Text>
              </TouchableOpacity>
            </View>
          ))}

          <TouchableOpacity style={styles.addExBtn} onPress={promptAddExercise} activeOpacity={0.85}>
            <Text style={styles.addExText}>+ Add Exercise</Text>
          </TouchableOpacity>
        </ScrollView>
        <RestTimer />
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
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    backgroundColor: '#fff',
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  cancel: { fontSize: 16, color: '#EF4444' },
  save: { fontSize: 16, color: '#10B981', fontWeight: '700' },
  title: { fontSize: 16, fontWeight: '700', color: '#111827', maxWidth: 180 },
  timer: { fontSize: 18, fontWeight: '800', color: '#111827', fontVariant: ['tabular-nums'] },
  progress: { fontSize: 12, color: '#9CA3AF', marginTop: 1, maxWidth: 220 },
  content: { padding: 16, paddingBottom: 40 },

  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyText: { fontSize: 16, color: '#6B7280' },
  emptyCard: { backgroundColor: '#fff', borderRadius: 14, padding: 20, marginBottom: 16 },
  emptyCardText: { fontSize: 14, color: '#6B7280', lineHeight: 20, textAlign: 'center' },

  exCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  exHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  exName: { fontSize: 16, fontWeight: '700', color: '#111827', flex: 1 },
  exHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  reorderBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reorderText: { fontSize: 16, fontWeight: '800', color: '#6B7280' },
  reorderDisabled: { color: '#D1D5DB' },
  exRemove: { fontSize: 13, color: '#EF4444', fontWeight: '600' },

  setRowHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 6, paddingHorizontal: 2 },
  headText: { fontSize: 11, color: '#9CA3AF', fontWeight: '600' },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderRadius: 10,
  },
  setRowDone: { backgroundColor: '#F0FDF4' },
  colSet: { width: 34, textAlign: 'center', fontSize: 14, color: '#374151', fontWeight: '600' },
  colNum: { flex: 1, marginHorizontal: 4 },
  colCheck: { width: 52, alignItems: 'center' },
  colDel: { width: 32, alignItems: 'center' },
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
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: '#10B981', borderColor: '#10B981' },
  checkmark: { color: '#fff', fontSize: 15, fontWeight: '800' },
  delText: { color: '#D1D5DB', fontSize: 14, fontWeight: '700' },

  addSetBtn: { paddingVertical: 10, alignItems: 'center', marginTop: 4 },
  addSetText: { color: '#10B981', fontWeight: '600', fontSize: 14 },

  addExBtn: {
    backgroundColor: '#10B981',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  addExText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
