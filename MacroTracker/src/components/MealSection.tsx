import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
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
import { useSnackbar } from '../store/useSnackbar';
import { availableUnits, defaultAmount, formatAmount, toMultiplier } from '../utils/serving';
import { useTheme } from '../theme/useTheme';
import type { Theme } from '../theme';
import { radius, space, type } from '../theme/tokens';
import { Icon } from './Icon';

const ACTION_WIDTH = 72;

function RightDeleteAction({
  drag,
  onDelete,
}: {
  drag: SharedValue<number>;
  onDelete: () => void;
}) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
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
        <Icon name="close" size="md" color={c.onPrimary} />
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
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
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
  const addEntry = useStore((s) => s.addEntry);
  const showSnackbar = useSnackbar((s) => s.show);

  // Removes straight away and offers the way back, rather than asking first.
  // The swipe is already a deliberate gesture, so a confirmation on top of it
  // taxes every intended delete to guard the rare accidental one.
  function handleDelete(entry: FoodEntry) {
    removeEntry(date, entry.id);
    showSnackbar(`Removed ${entry.food.name}`, {
      label: 'Undo',
      onPress: () => addEntry(entry),
    });
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

  // Derived, not stored: the message shows under the field as the user types
  // instead of interrupting them with a modal after they commit. Null means
  // the amount is good.
  const amountError = useMemo(() => {
    if (!editing) return null;
    const parsed = parseFloat(editing.amount);
    if (!editing.amount.trim()) return 'Enter an amount.';
    if (!Number.isFinite(parsed) || parsed <= 0) return 'Amount must be more than 0.';
    if (toMultiplier(editing.entry.food, parsed, editing.unit) <= 0) {
      return `That is not a usable amount in ${editing.unit}.`;
    }
    return null;
  }, [editing]);

  function handleSave() {
    if (!editing || amountError) return;
    const { entry, unit, amount } = editing;
    updateEntry(date, entry.id, {
      servings: toMultiplier(entry.food, parseFloat(amount), unit),
      amount: parseFloat(amount),
      unit,
    });
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
          <Icon name={expanded ? 'up' : 'down'} size="sm" color={c.textFaint} />
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
                  <Icon name="forward" size="md" color={c.textFaint} />
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
                <TouchableOpacity onPress={handleSave} disabled={!!amountError}>
                  <Text style={[styles.editSave, amountError && styles.editSaveDisabled]}>
                    Save
                  </Text>
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
                    <Text style={[styles.previewValue, { color: c.info }]}>
                      {editPreview.protein}g
                    </Text>
                    <Text style={styles.previewLabel}>protein</Text>
                  </View>
                  <View style={styles.previewItem}>
                    <Text style={[styles.previewValue, { color: c.warning }]}>
                      {editPreview.carbs}g
                    </Text>
                    <Text style={styles.previewLabel}>carbs</Text>
                  </View>
                  <View style={styles.previewItem}>
                    <Text style={[styles.previewValue, { color: c.danger }]}>
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
                    style={[styles.servingsInput, amountError && styles.servingsInputError]}
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
              {amountError ? <Text style={styles.fieldError}>{amountError}</Text> : null}
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
                  const entry = editing.entry;
                  setEditing(null);
                  handleDelete(entry);
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

const makeStyles = (c: Theme) => StyleSheet.create({
  container: {
    backgroundColor: c.card,
    borderRadius: radius.card,
    marginBottom: space.md,
    overflow: 'hidden',
    shadowColor: c.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingVertical: space.lg,
  },
  headerLeft: { flex: 1 },
  mealName: { ...type.body(c), fontFamily: c.fontBodySemi, color: c.text },
  mealMacros: { ...type.caption(c), color: c.textFaint, marginTop: space.xxs },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  mealCals: { ...type.body(c), color: c.textMuted },
  chevron: { ...type.micro(c), color: c.textFaint },
  body: { borderTopWidth: 1, borderTopColor: c.border },
  empty: {
    ...type.caption(c),
    textAlign: 'center',
    color: c.textFaint,
    paddingVertical: space.md,
  },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    backgroundColor: c.cardMuted,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  entryLeft: { flex: 1 },
  entryName: { ...type.body(c), color: c.text },
  entryDetail: { ...type.caption(c), color: c.textFaint, marginTop: space.xxs },
  entryMacros: { alignItems: 'flex-end', marginRight: space.xs },
  entryCals: { ...type.body(c), fontFamily: c.fontBodySemi, color: c.text },
  entryMacroDetail: { ...type.micro(c), color: c.textFaint, marginTop: space.xxs },
  deleteAction: {
    width: ACTION_WIDTH,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: c.danger,
  },
  deleteActionInner: {
    flex: 1,
    width: ACTION_WIDTH,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButton: { paddingVertical: space.md, alignItems: 'center' },
  addButtonText: { ...type.body(c), fontFamily: c.fontBodySemi, color: c.primary },

  // Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: c.overlay,
  },
  modalKAV: {
    justifyContent: 'flex-end',
  },
  editPanel: {
    backgroundColor: c.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: space.xl,
    paddingBottom: space.xxl,
    shadowColor: c.shadow,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 10,
  },
  editHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: space.lg,
  },
  editCancel: { ...type.body(c), color: c.textMuted, width: 60 },
  editTitle: {
    ...type.bodyStrong(c),
    color: c.text,
    flex: 1,
    textAlign: 'center',
    marginHorizontal: space.sm,
  },
  editSave: { ...type.bodyStrong(c), color: c.primary, width: 60, textAlign: 'right' },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: c.cardMuted,
    borderRadius: radius.card,
    padding: space.md,
    marginBottom: space.lg,
  },
  previewItem: { alignItems: 'center' },
  previewValue: { ...type.subhead(c), color: c.text },
  previewLabel: { ...type.micro(c), color: c.textFaint },
  unitRow: { gap: space.sm, marginBottom: space.lg, paddingRight: space.xs },
  unitBtn: {
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    borderRadius: radius.control,
    backgroundColor: c.cardMuted,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: c.border,
  },
  unitBtnActive: { backgroundColor: c.primarySoft, borderColor: c.primary },
  unitBtnText: { ...type.body(c), fontFamily: c.fontBodySemi, color: c.textMuted },
  unitBtnTextActive: { color: c.primary },
  servingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: space.lg,
  },
  servingsLabel: { ...type.caption(c), color: c.textMuted, flex: 1 },
  servingsControl: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  servingsBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: c.cardMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  servingsBtnText: { ...type.heading(c), color: c.gray700 },
  editSaveDisabled: { color: c.textFaint },
  servingsInputError: { borderColor: c.danger },
  fieldError: {
    ...type.caption(c),
    color: c.danger,
    marginTop: space.xs,
    textAlign: 'center',
  },
  servingsInput: {
    ...type.body(c),
    fontFamily: c.fontBodySemi,
    width: 60,
    height: 36,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radius.control,
    textAlign: 'center',
    color: c.text,
    backgroundColor: c.input,
  },
  deleteBtn: {
    paddingVertical: space.lg,
    borderRadius: radius.control,
    backgroundColor: c.dangerSoft,
    alignItems: 'center',
  },
  deleteBtnText: { ...type.body(c), fontFamily: c.fontBodySemi, color: c.danger },
  inlineDoneBtn: {
    alignSelf: 'flex-end',
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    marginBottom: space.sm,
    backgroundColor: c.primarySoft,
    borderRadius: radius.control,
  },
  inlineDoneText: { ...type.bodyStrong(c), color: c.primary },
});
