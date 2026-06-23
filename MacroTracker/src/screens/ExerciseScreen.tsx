import React from 'react';
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
import { useStore } from '../store/useStore';
import { WorkoutTemplate } from '../types';
import { displayDate } from '../utils/date';

interface Props {
  navigation: any;
}

export function ExerciseScreen({ navigation }: Props) {
  const templates = useStore((s) => s.workoutTemplates);
  const activeWorkout = useStore((s) => s.activeWorkout);
  const history = useStore((s) => s.workoutHistory);
  const startWorkout = useStore((s) => s.startWorkout);
  const deleteTemplate = useStore((s) => s.deleteTemplate);

  function handleStartEmpty() {
    if (activeWorkout) {
      navigation.navigate('ActiveWorkout');
      return;
    }
    startWorkout();
    navigation.navigate('ActiveWorkout');
  }

  function handleStartTemplate(t: WorkoutTemplate) {
    if (activeWorkout) {
      Alert.alert(
        'Workout in progress',
        'Finish or cancel your current workout before starting a new one.',
        [{ text: 'OK' }]
      );
      return;
    }
    startWorkout(t);
    navigation.navigate('ActiveWorkout');
  }

  function handleDeleteTemplate(t: WorkoutTemplate) {
    Alert.alert('Delete template', `Delete "${t.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteTemplate(t.id) },
    ]);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#F9FAFB" />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Text style={styles.screenTitle}>Exercise</Text>

        {/* Resume banner */}
        {activeWorkout && (
          <TouchableOpacity
            style={styles.resumeBanner}
            onPress={() => navigation.navigate('ActiveWorkout')}
            activeOpacity={0.85}
          >
            <View>
              <Text style={styles.resumeTitle}>Workout in progress</Text>
              <Text style={styles.resumeSub}>{activeWorkout.name} · tap to resume</Text>
            </View>
            <Text style={styles.resumeArrow}>›</Text>
          </TouchableOpacity>
        )}

        {/* Start a Workout */}
        <TouchableOpacity style={styles.startBtn} onPress={handleStartEmpty} activeOpacity={0.85}>
          <Text style={styles.startBtnIcon}>🏋️</Text>
          <View>
            <Text style={styles.startBtnTitle}>
              {activeWorkout ? 'Resume Workout' : 'Start a Workout'}
            </Text>
            <Text style={styles.startBtnSub}>
              {activeWorkout ? 'Continue where you left off' : 'Begin a blank session, add exercises as you go'}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Templates */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>My Workouts</Text>
          <TouchableOpacity onPress={() => navigation.navigate('WorkoutTemplate', {})}>
            <Text style={styles.createLink}>+ Create</Text>
          </TouchableOpacity>
        </View>

        {templates.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>
              No saved workouts yet. Tap “+ Create” to build a template with your
              go-to exercises, sets, and reps.
            </Text>
          </View>
        ) : (
          templates.map((t) => (
            <View key={t.id} style={styles.templateCard}>
              <TouchableOpacity
                style={styles.templateMain}
                onPress={() => handleStartTemplate(t)}
                activeOpacity={0.7}
              >
                <Text style={styles.templateName}>{t.name}</Text>
                <Text style={styles.templateMeta}>
                  {t.exercises.length} exercise{t.exercises.length === 1 ? '' : 's'}
                  {t.exercises.length > 0 && ` · ${t.exercises.map((e) => e.name).slice(0, 3).join(', ')}${t.exercises.length > 3 ? '…' : ''}`}
                </Text>
              </TouchableOpacity>
              <View style={styles.templateActions}>
                <TouchableOpacity
                  onPress={() => navigation.navigate('WorkoutTemplate', { templateId: t.id })}
                  style={styles.templateActionBtn}
                >
                  <Text style={styles.editText}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleDeleteTemplate(t)}
                  style={styles.templateActionBtn}
                >
                  <Text style={styles.deleteText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}

        {/* History */}
        {history.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recent</Text>
            </View>
            {history.slice(0, 8).map((h) => {
              const totalSets = h.exercises.reduce((n, e) => n + e.sets.length, 0);
              const doneSets = h.exercises.reduce(
                (n, e) => n + e.sets.filter((s) => s.completed).length,
                0
              );
              return (
                <View key={h.id} style={styles.historyCard}>
                  <View>
                    <Text style={styles.historyName}>{h.name}</Text>
                    <Text style={styles.historyMeta}>
                      {displayDate(h.date)} · {h.exercises.length} exercises · {doneSets}/{totalSets} sets done
                    </Text>
                  </View>
                </View>
              );
            })}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 32 },
  screenTitle: { fontSize: 28, fontWeight: '800', color: '#111827', marginBottom: 16 },

  resumeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  resumeTitle: { fontSize: 14, fontWeight: '700', color: '#065F46' },
  resumeSub: { fontSize: 12, color: '#047857', marginTop: 2 },
  resumeArrow: { fontSize: 28, color: '#10B981', fontWeight: '300' },

  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#10B981',
    borderRadius: 20,
    padding: 18,
    marginBottom: 24,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  startBtnIcon: { fontSize: 32 },
  startBtnTitle: { fontSize: 16, fontWeight: '700', color: '#fff' },
  startBtnSub: { fontSize: 12, color: '#D1FAE5', marginTop: 2, maxWidth: 240 },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    marginTop: 4,
  },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  createLink: { fontSize: 15, fontWeight: '700', color: '#10B981' },

  emptyCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  emptyText: { fontSize: 14, color: '#6B7280', lineHeight: 20 },

  templateCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  templateMain: {},
  templateName: { fontSize: 16, fontWeight: '700', color: '#111827' },
  templateMeta: { fontSize: 12, color: '#9CA3AF', marginTop: 4 },
  templateActions: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  templateActionBtn: {},
  editText: { fontSize: 13, fontWeight: '600', color: '#10B981' },
  deleteText: { fontSize: 13, fontWeight: '600', color: '#EF4444' },

  historyCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  historyName: { fontSize: 15, fontWeight: '600', color: '#111827' },
  historyMeta: { fontSize: 12, color: '#9CA3AF', marginTop: 3 },
});
