import React, { useState, useMemo } from 'react';
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
import { DEFAULT_WORKOUT_HK } from '../utils/workoutTypes';
import { DurationInput } from '../components/DurationInput';
import { KeyboardDoneAccessory, DONE_ACCESSORY_ID } from '../components/KeyboardDoneAccessory';
import { ExercisePickerModal } from '../components/ExercisePickerModal';
import { useTheme } from '../theme/useTheme';
import type { Theme } from '../theme';
import { radius, space, type } from '../theme/tokens';
import { Icon } from '../components/Icon';

type TemplateStyles = ReturnType<typeof makeStyles>;

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
function setBadgeInfo(type: SetType | undefined, index: number, styles: TemplateStyles) {
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
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const templateId = route.params?.templateId;
  const templates = useStore((s) => s.workoutTemplates);
  const saveTemplate = useStore((s) => s.saveTemplate);

  const existing = templateId ? templates.find((t) => t.id === templateId) : undefined;

  const [name, setName] = useState(existing?.name ?? '');
  // Templates are strength; the picker that set this is gone with the other
  // workout types. Kept as a stored field rather than dropped so an existing
  // template's value survives, and so re-adding a type later does not need a
  // data migration. Recovery sessions are not templated — they are a timer.
  const activityType = existing?.activityType ?? DEFAULT_WORKOUT_HK;
  const [exercises, setExercises] = useState<TemplateExercise[]>(
    existing
      ? existing.exercises.map((e) => ({ ...e, sets: e.sets.map((s) => ({ ...s })) }))
      : [blankExercise()]
  );
  // Which exercise card the picker modal is currently filling in, if any.
  const [pickerExId, setPickerExId] = useState<string | null>(null);

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
      activityType,
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
            placeholderTextColor={c.textFaint}
          />

          <Text style={[styles.label, { marginTop: space.lg }]}>Exercises</Text>
          {exercises.map((e, idx) => (
            <View key={e.id} style={styles.exCard}>
              <View style={styles.exTop}>
                <TextInput
                  style={styles.exNameInput}
                  value={e.name}
                  onChangeText={(v) => updateExercise(e.id, { name: v })}
                  placeholder={`Exercise ${idx + 1}`}
                  placeholderTextColor={c.textFaint}
                />
                <TouchableOpacity onPress={() => setPickerExId(e.id)} style={styles.exListBtn} hitSlop={8}>
                  <Text style={styles.exListBtnText}>List</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => removeExercise(e.id)} style={styles.exRemove}>
                  <Icon name="close" size="sm" color={c.danger} />
                </TouchableOpacity>
              </View>

              {/* Reps vs. time-based logging for this exercise. */}
              <View style={styles.modeToggle}>
                {(['reps', 'time'] as const).map((m) => {
                  const active = (e.mode ?? 'reps') === m;
                  return (
                    <TouchableOpacity
                      key={m}
                      style={[styles.modeBtn, active && styles.modeBtnActive]}
                      onPress={() => updateExercise(e.id, { mode: m })}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.modeBtnText, active && styles.modeBtnTextActive]}>
                        {m === 'reps' ? 'Reps' : 'Time'}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Column labels */}
              <View style={styles.setRowHead}>
                <Text style={[styles.colSet, styles.headText]}>Set</Text>
                <Text style={[styles.colNum, styles.headText]}>lbs</Text>
                <Text style={[styles.colNum, styles.headText]}>
                  {(e.mode ?? 'reps') === 'time' ? 'Time' : 'Reps'}
                </Text>
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
                        const badge = setBadgeInfo(s.type, i, styles);
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
                      keyboardType="decimal-pad"
                      inputAccessoryViewID={DONE_ACCESSORY_ID}
                      placeholder="0"
                      placeholderTextColor={c.textFaint}
                    />
                    {(e.mode ?? 'reps') === 'time' ? (
                      <DurationInput
                        style={[styles.colNum, styles.setInput]}
                        seconds={s.durationSeconds ?? 0}
                        onChange={(secs) => updateSet(e.id, s.id, { durationSeconds: secs })}
                        inputAccessoryViewID={DONE_ACCESSORY_ID}
                        placeholder="0:00"
                        placeholderTextColor={c.textFaint}
                      />
                    ) : (
                      <TextInput
                        style={[styles.colNum, styles.setInput]}
                        value={s.reps === 0 ? '' : String(s.reps)}
                        onChangeText={(v) => {
                          const n = parseInt(v.replace(/[^0-9]/g, ''), 10);
                          updateSet(e.id, s.id, { reps: Number.isNaN(n) ? 0 : n });
                        }}
                        keyboardType="number-pad"
                        inputAccessoryViewID={DONE_ACCESSORY_ID}
                        placeholder="0"
                        placeholderTextColor={c.textFaint}
                      />
                    )}
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
      <KeyboardDoneAccessory />
      <ExercisePickerModal
        visible={pickerExId !== null}
        onClose={() => setPickerExId(null)}
        onSelect={(name) => {
          if (pickerExId) updateExercise(pickerExId, { name });
        }}
      />
    </SafeAreaView>
  );
}

const makeStyles = (c: Theme) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingVertical: space.lg,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
    backgroundColor: c.card,
  },
  cancel: { ...type.body(c), color: c.textMuted },
  save: { ...type.bodyStrong(c), color: c.primary },
  title: { ...type.subhead(c), color: c.text },
  content: { padding: space.lg, paddingBottom: space.xxxl },
  label: { ...type.captionStrong(c), color: c.textMuted, marginBottom: space.sm },
  nameInput: {
    ...type.body(c),
    backgroundColor: c.card,
    borderRadius: radius.control,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    color: c.text,
    borderWidth: 1,
    borderColor: c.border,
  },
  exCard: {
    backgroundColor: c.card,
    borderRadius: radius.card,
    padding: space.lg,
    marginBottom: space.md,
    borderWidth: 1,
    borderColor: c.border,
  },
  exTop: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: space.xs },
  exNameInput: {
    ...type.body(c),
    fontFamily: c.fontBodySemi,
    flex: 1,
    color: c.text,
    paddingVertical: space.sm,
  },
  exListBtn: {
    paddingHorizontal: space.md,
    height: 28,
    borderRadius: radius.control,
    backgroundColor: c.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exListBtnText: { ...type.captionStrong(c), color: c.primaryDark },
  exRemove: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    backgroundColor: c.dangerSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },

  setRowHead: { flexDirection: 'row', alignItems: 'center', marginBottom: space.xs, paddingHorizontal: space.xxs },
  headText: { ...type.micro(c), fontFamily: c.fontBodySemi, color: c.textFaint },
  modeToggle: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    backgroundColor: c.bg,
    borderRadius: radius.control,
    padding: space.xxs,
    marginTop: space.sm,
    marginBottom: space.md,
  },
  modeBtn: { paddingVertical: space.xs, paddingHorizontal: space.lg, borderRadius: radius.control },
  modeBtnActive: { backgroundColor: c.card, borderWidth: 1, borderColor: c.border },
  modeBtnText: { ...type.captionStrong(c), color: c.textFaint },
  modeBtnTextActive: { color: c.primary },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: space.sm,
    borderRadius: radius.card,
    backgroundColor: c.card,
  },
  colSet: { width: 40, textAlign: 'center', alignItems: 'center', justifyContent: 'center' },
  colNum: { flex: 1, marginHorizontal: space.xs },
  setInput: {
    ...type.body(c),
    backgroundColor: c.input,
    borderRadius: radius.control,
    paddingVertical: space.sm,
    color: c.text,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: c.border,
  },

  // Left-side set-type bubble (tap to tag a set).
  setBadge: {
    minWidth: 28,
    height: 28,
    paddingHorizontal: space.sm,
    borderRadius: radius.control,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  setBadgeText: { ...type.captionStrong(c) },
  badgeNormal: { backgroundColor: c.cardMuted, borderColor: c.border },
  badgeNormalText: { color: c.textMuted },
  badgeWarmup: { backgroundColor: c.warningSoft, borderColor: `${c.warning}80` },
  badgeWarmupText: { color: c.warning },
  badgeFailure: { backgroundColor: c.dangerSoft, borderColor: `${c.danger}80` },
  badgeFailureText: { color: c.danger },
  badgeDropset: { backgroundColor: c.accentSoft, borderColor: `${c.accent}80` },
  badgeDropsetText: { color: c.accent },

  swipeDeleteAction: {
    backgroundColor: c.danger,
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    borderRadius: radius.control,
    marginVertical: space.xxs,
    marginLeft: space.sm,
  },
  swipeDeleteText: { ...type.bodyStrong(c), color: '#fff' },

  addSetBtn: { paddingVertical: space.md, alignItems: 'center', marginTop: space.xs },
  addSetText: { ...type.body(c), fontFamily: c.fontBodySemi, color: c.primary },

  addExBtn: {
    backgroundColor: c.primarySoft,
    borderRadius: radius.control,
    paddingVertical: space.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: `${c.primary}66`,
    marginTop: space.xs,
  },
  addExText: { ...type.bodyStrong(c), color: c.primaryDark },
});
