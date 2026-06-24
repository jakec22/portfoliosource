import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  TextInput,
  Platform,
  Modal,
  KeyboardAvoidingView,
  ScrollView,
  Keyboard,
} from 'react-native';
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';
import Reanimated, {
  type SharedValue,
  useAnimatedStyle,
} from 'react-native-reanimated';
import { FoodEntry, MealType, ServingUnit } from '../types';
import { useStore, sumMacros } from '../store/useStore';
import { availableUnits, defaultAmount, formatAmount, toMultiplier } from '../utils/serving';

const ACTION_WIDTH = 72;

function RightDeleteAction({
  drag,
  onDelete,
}: {
  drag: SharedValue<number>;
  onDelete: () => void;
}) {
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: drag.value + ACTION_WIDTH }],
  }));
  return (
    <Reanimated.View style={[styles.deleteAction, animatedStyle]}>
      <TouchableOpacity
        style={styles.deleteActionInner}
        onPress={onDelete}
        activeOpacity={0.7}
      >
        <Text style={styles.deleteActionText}>✕</Text>
      </TouchableOpacity>
    </Reanimated.View>
  );
}

const MEAL_LABELS: Record<MealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snacks: 'Snacks',
};

interface EditState {
  entry: FoodEntry;
  unit: ServingUnit;
  amount: string;
}

interface Props {
  meal: MealType;
  date: string;
  onAddFood: (meal: MealType) => void;
}

export function MealSection({ meal, date, onAddFood }: Props) {
  const [expanded, setExpanded] = useState(true);
  const [editing, setEditing] = useState<EditState | null>(null);
  const [amountFocused, setAmountFocused] = useState(false);
  const dateEntries = useStore((s) => s.logs[date]);
  const entries = useMemo(
    () => (dateEntries ?? []).filter((e) => e.meal === meal),
    [dateEntries, meal]
  );
  const removeEntry = useStore((s) => s.removeEntry);
  const updateEntry = useStore((s) => s.updateEntry);

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

  function openEdit(entry: FoodEntry) {
    const unit: ServingUnit = entry.unit ?? 'serving';
    const amount =
      entry.amount != null
        ? String(entry.amount)
        : String(entry.servings);
    setEditing({ entry, unit, amount });
  }

  function handleUnitChange(newUnit: ServingUnit) {
    if (!editing) return;
    setEditing({
      ...editing,
      unit: newUnit,
      amount: String(defaultAmount(editing.entry.food, newUnit)),
    });
  }

  function adjustAmount(delta: number) {
    if (!editing) return;
    const { unit, entry } = editing;
    const step =
      unit === 'serving'
        ? 0.5
        : Math.max(1, Math.round(defaultAmount(entry.food, unit) * 0.25));
    const next = Math.max(
      step,
      Math.round(((parseFloat(editing.amount) || 0) + delta * step) * 10) / 10
    );
    setEditing({ ...editing, amount: String(next) });
  }

  function handleSave() {
    if (!editing) return;
    const { entry, unit, amount } = editing;
    const parsed = parseFloat(amount);
    if (!parsed || parsed <= 0) {
      Alert.alert('Invalid amount', 'Please enter a valid amount.');
      return;
    }
    const servings = toMultiplier(entry.food, parsed, unit);
    if (servings <= 0) {
      Alert.alert('Invalid amount', 'Please enter a valid amount.');
      return;
    }
    updateEntry(date, entry.id, { servings, amount: parsed, unit });
    setEditing(null);
  }

  const editPreview = useMemo(() => {
    if (!editing) return null;
    const m = toMultiplier(editing.entry.food, parseFloat(editing.amount) || 0, editing.unit);
    const f = editing.entry.food.macros;
    return {
      calories: Math.round(f.calories * m),
      protein: Math.round(f.protein * m),
      carbs: Math.round(f.carbs * m),
      fat: Math.round(f.fat * m),
    };
  }, [editing]);

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
              <ReanimatedSwipeable
                key={entry.id}
                friction={2}
                rightThreshold={ACTION_WIDTH / 2}
                renderRightActions={(
                  _progress: SharedValue<number>,
                  drag: SharedValue<number>,
                  _methods: SwipeableMethods
                ) => <RightDeleteAction drag={drag} onDelete={() => handleDelete(entry)} />}
              >
                <TouchableOpacity
                  style={styles.entryRow}
                  onPress={() => openEdit(entry)}
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
                  <Text style={styles.editChevron}>›</Text>
                </TouchableOpacity>
              </ReanimatedSwipeable>
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

      {/* Edit modal */}
      <Modal
        visible={editing !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setEditing(null)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setEditing(null)}
        />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalKAV}
        >
          {editing && (
            <View style={styles.editPanel}>
              {/* Header */}
              <View style={styles.editHeader}>
                <TouchableOpacity onPress={() => setEditing(null)}>
                  <Text style={styles.editCancel}>Cancel</Text>
                </TouchableOpacity>
                <Text style={styles.editTitle} numberOfLines={1}>
                  {editing.entry.food.name}
                </Text>
                <TouchableOpacity onPress={handleSave}>
                  <Text style={styles.editSave}>Save</Text>
                </TouchableOpacity>
              </View>

              {/* Macro preview */}
              {editPreview && (
                <View style={styles.previewRow}>
                  <View style={styles.previewItem}>
                    <Text style={styles.previewValue}>{editPreview.calories}</Text>
                    <Text style={styles.previewLabel}>kcal</Text>
                  </View>
                  <View style={styles.previewItem}>
                    <Text style={[styles.previewValue, { color: '#3B82F6' }]}>
                      {editPreview.protein}g
                    </Text>
                    <Text style={styles.previewLabel}>protein</Text>
                  </View>
                  <View style={styles.previewItem}>
                    <Text style={[styles.previewValue, { color: '#F59E0B' }]}>
                      {editPreview.carbs}g
                    </Text>
                    <Text style={styles.previewLabel}>carbs</Text>
                  </View>
                  <View style={styles.previewItem}>
                    <Text style={[styles.previewValue, { color: '#EF4444' }]}>
                      {editPreview.fat}g
                    </Text>
                    <Text style={styles.previewLabel}>fat</Text>
                  </View>
                </View>
              )}

              {/* Unit selector */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.unitRow}
              >
                {availableUnits(editing.entry.food).map((u) => (
                  <TouchableOpacity
                    key={u}
                    style={[styles.unitBtn, editing.unit === u && styles.unitBtnActive]}
                    onPress={() => handleUnitChange(u)}
                  >
                    <Text
                      style={[
                        styles.unitBtnText,
                        editing.unit === u && styles.unitBtnTextActive,
                      ]}
                    >
                      {u === 'serving' ? 'Serving' : u}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Amount stepper */}
              <View style={styles.servingsRow}>
                <Text style={styles.servingsLabel}>
                  {editing.unit === 'serving'
                    ? `Amount (${editing.entry.food.serving_size}${editing.entry.food.serving_unit} each)`
                    : `Amount in ${editing.unit}`}
                </Text>
                <View style={styles.servingsControl}>
                  <TouchableOpacity style={styles.servingsBtn} onPress={() => adjustAmount(-1)}>
                    <Text style={styles.servingsBtnText}>−</Text>
                  </TouchableOpacity>
                  <TextInput
                    style={styles.servingsInput}
                    value={editing.amount}
                    onChangeText={(v) => setEditing({ ...editing, amount: v })}
                    keyboardType="decimal-pad"
                    onFocus={() => setAmountFocused(true)}
                    onBlur={() => setAmountFocused(false)}
                    selectTextOnFocus
                  />
                  <TouchableOpacity style={styles.servingsBtn} onPress={() => adjustAmount(1)}>
                    <Text style={styles.servingsBtnText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
              {amountFocused && (
                <TouchableOpacity
                  style={styles.inlineDoneBtn}
                  onPress={() => { Keyboard.dismiss(); setAmountFocused(false); }}
                >
                  <Text style={styles.inlineDoneText}>Done</Text>
                </TouchableOpacity>
              )}

              {/* Delete */}
              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={() => {
                  setEditing(null);
                  // Small delay so the modal finishes closing before the Alert.
                  setTimeout(() => handleDelete(editing.entry), 300);
                }}
              >
                <Text style={styles.deleteBtnText}>Remove from log</Text>
              </TouchableOpacity>
            </View>
          )}
        </KeyboardAvoidingView>
      </Modal>
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
  headerLeft: { flex: 1 },
  mealName: { fontSize: 16, fontWeight: '600', color: '#111827' },
  mealMacros: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  mealCals: { fontSize: 14, color: '#6B7280', fontWeight: '500' },
  chevron: { fontSize: 10, color: '#9CA3AF' },
  body: { borderTopWidth: 1, borderTopColor: '#F3F4F6' },
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
    backgroundColor: '#F9FAFB',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  entryLeft: { flex: 1 },
  entryName: { fontSize: 14, fontWeight: '500', color: '#1F2937' },
  entryDetail: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  entryMacros: { alignItems: 'flex-end', marginRight: 6 },
  entryCals: { fontSize: 14, fontWeight: '600', color: '#111827' },
  entryMacroDetail: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  editChevron: { fontSize: 20, color: '#D1D5DB', fontWeight: '300' },
  deleteAction: {
    width: ACTION_WIDTH,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#EF4444',
  },
  deleteActionInner: {
    flex: 1,
    width: ACTION_WIDTH,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteActionText: { fontSize: 20, fontWeight: '700', color: '#fff' },
  addButton: { paddingVertical: 12, alignItems: 'center' },
  addButtonText: { fontSize: 14, fontWeight: '600', color: '#10B981' },

  // Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  modalKAV: {
    justifyContent: 'flex-end',
  },
  editPanel: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 36,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 10,
  },
  editHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  editCancel: { fontSize: 15, color: '#6B7280', fontWeight: '500', width: 60 },
  editTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 8,
  },
  editSave: { fontSize: 15, color: '#10B981', fontWeight: '700', width: 60, textAlign: 'right' },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  previewItem: { alignItems: 'center' },
  previewValue: { fontSize: 18, fontWeight: '700', color: '#111827' },
  previewLabel: { fontSize: 11, color: '#9CA3AF' },
  unitRow: { gap: 8, marginBottom: 16, paddingRight: 4 },
  unitBtn: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 10,
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
  },
  unitBtnActive: { backgroundColor: '#ECFDF5', borderColor: '#10B981' },
  unitBtnText: { fontSize: 14, fontWeight: '600', color: '#6B7280' },
  unitBtnTextActive: { color: '#10B981' },
  servingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  servingsLabel: { fontSize: 13, color: '#6B7280', flex: 1 },
  servingsControl: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  servingsBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  servingsBtnText: { fontSize: 20, fontWeight: '300', color: '#374151' },
  servingsInput: {
    width: 60,
    height: 36,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  deleteBtn: {
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
  },
  deleteBtnText: { fontSize: 15, fontWeight: '600', color: '#EF4444' },
  inlineDoneBtn: {
    alignSelf: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 6,
    marginBottom: 8,
    backgroundColor: '#ECFDF5',
    borderRadius: 10,
  },
  inlineDoneText: { fontSize: 14, fontWeight: '700', color: '#10B981' },
});
