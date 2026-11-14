import React, { useMemo, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EXERCISE_CATALOG, type ExerciseCategory } from '../utils/exerciseList';
import { exerciseDemo, type ExerciseDemo } from '../data/exerciseDemos';
import { ExerciseDemoSheet } from './ExerciseDemoSheet';
import { Icon } from './Icon';
import { categoryForExercise } from '../utils/trainingSplit';
import { useStore } from '../store/useStore';
import { useSheetAnimation } from '../hooks/useSheetAnimation';
import { useTheme } from '../theme/useTheme';
import type { Theme } from '../theme';
import { radius, space, type } from '../theme/tokens';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelect: (name: string) => void;
}

/**
 * The line under an exercise's name: what you pick it up, and what it works.
 *
 * The muscle is dropped when it only repeats the group heading above it.
 * Inside Chest every row would otherwise read "… · Chest", which is a word
 * spent saying where you already are. Inside Legs the same field earns its
 * place — Quads, Hamstrings, Glutes, Calves and Adductors all live there,
 * and that is exactly the distinction you came to the list to make.
 */
function rowSubtitle(demo: ExerciseDemo, category: string): string {
  const muscle = demo.primary[0];
  const parts = [demo.equipment, muscle && muscle !== category ? muscle : null];
  return parts.filter(Boolean).join(' · ');
}

// Search + browse a curated exercise catalog, or type any name of your own —
// typing something that isn't in the catalog surfaces a "use as typed" row
// instead of blocking the free-text case the app has always supported.
export function ExercisePickerModal({ visible, onClose, onSelect }: Props) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const sheetAnimation = useSheetAnimation();
  const [query, setQuery] = useState('');

  // Which exercise's demo is open, if any. Separate from selection: looking
  // at how a movement is done is how you decide whether to pick it, so the
  // demo must not also choose it.
  const [demoFor, setDemoFor] = useState<string | null>(null);

  const customExercises = useStore((s) => s.customExercises);
  const addCustomExercise = useStore((s) => s.addCustomExercise);

  // Saved names are merged into the catalog rather than shown in a bin of
  // their own: a machine you named yourself is still a chest machine, and a
  // separate "Custom" group would put it furthest from where you look for it.
  const catalog = useMemo(() => {
    if (customExercises.length === 0) return EXERCISE_CATALOG;
    const groups = EXERCISE_CATALOG.map((g) => ({ ...g, exercises: [...g.exercises] }));
    const extra: ExerciseCategory[] = [];
    for (const name of customExercises) {
      const cat = categoryForExercise(name);
      const target = groups.find((g) => g.category === cat) ?? extra.find((g) => g.category === cat);
      if (target) target.exercises.push(name);
      else extra.push({ category: cat, exercises: [name] });
    }
    for (const g of groups) g.exercises.sort();
    return [...groups, ...extra];
  }, [customExercises]);

  const trimmed = query.trim();
  const filtered = useMemo(() => {
    if (!trimmed) return catalog;
    const q = trimmed.toLowerCase();
    return catalog.map((group) => ({
      category: group.category,
      exercises: group.exercises.filter((name) => name.toLowerCase().includes(q)),
    })).filter((group) => group.exercises.length > 0);
  }, [trimmed, catalog]);

  const exactMatch = useMemo(
    () =>
      trimmed.length > 0 &&
      catalog.some((group) =>
        group.exercises.some((name) => name.toLowerCase() === trimmed.toLowerCase())
      ),
    [trimmed, catalog]
  );

  // Which children of the ScrollView are group headings. They alternate with
  // their cards, after the optional "Use …" row, so: 0 or 1, then every
  // second child from there.
  const showCustomRow = trimmed.length > 0 && !exactMatch;
  const stickyHeadings = useMemo(() => {
    const first = showCustomRow ? 1 : 0;
    return filtered.map((_, i) => first + i * 2);
  }, [filtered, showCustomRow]);

  function handleSelect(name: string) {
    setQuery('');
    onSelect(name);
    onClose();
  }

  function handleClose() {
    setQuery('');
    onClose();
  }

  return (
    <Modal visible={visible} animationType={sheetAnimation} onRequestClose={handleClose}>
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose}>
            <Text style={styles.cancel}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Choose Exercise</Text>
          <View style={{ width: 50 }} />
        </View>

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.searchWrap}>
            <TextInput
              style={styles.searchInput}
              value={query}
              onChangeText={setQuery}
              placeholder="Search or type your own exercise"
              placeholderTextColor={c.textFaint}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={() => trimmed && handleSelect(trimmed)}
            />
          </View>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.content}
            // The headings stay put while their own group scrolls past. In a
            // list 153 exercises long, a heading that scrolls away leaves you
            // reading names with no idea which part of the body you are in.
            stickyHeaderIndices={stickyHeadings}
          >
            {showCustomRow && (
              <TouchableOpacity
                style={styles.customRow}
                onPress={() => {
                  // Saved on use, not behind a separate "save" step: the scene
                  // is one-handed between sets, and a name worth typing is a
                  // name worth keeping.
                  addCustomExercise(trimmed);
                  handleSelect(trimmed);
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.customRowText}>Use “{trimmed}”</Text>
                <Text style={styles.customRowHint}>
                  Saved to {categoryForExercise(trimmed)} for next time
                </Text>
              </TouchableOpacity>
            )}

            {filtered.length === 0 ? (
              <Text style={styles.emptyText}>No matches — tap “Use” above to keep it.</Text>
            ) : (
              filtered.flatMap((group) => [
                <Text key={`h-${group.category}`} style={styles.groupTitle}>
                  {group.category}
                </Text>,
                <View key={group.category} style={styles.group}>
                  <View style={styles.card}>
                    {group.exercises.map((name, i) => {
                      const demo = exerciseDemo(name);
                      return (
                        <View key={name} style={[styles.row, i > 0 && styles.rowDivided]}>
                          <TouchableOpacity
                            style={styles.rowMain}
                            onPress={() => handleSelect(name)}
                            activeOpacity={0.7}
                          >
                            <View style={styles.tile}>
                              {demo ? (
                                <Image
                                  source={demo.thumb}
                                  style={styles.thumb}
                                  resizeMode="contain"
                                  tintColor={c.text}
                                />
                              ) : (
                                <Icon name="workout" size="md" color={c.borderStrong} />
                              )}
                            </View>
                            <View style={styles.rowText}>
                              <Text style={styles.rowTitle} numberOfLines={1}>
                                {name}
                              </Text>
                              {demo && (
                                <Text style={styles.rowSub} numberOfLines={1}>
                                  {rowSubtitle(demo, group.category)}
                                </Text>
                              )}
                            </View>
                          </TouchableOpacity>
                          {/* Only where there is one. A button that opens an
                              apology is worse than no button. */}
                          {demo && (
                            <TouchableOpacity
                              onPress={() => setDemoFor(name)}
                              hitSlop={8}
                              accessibilityRole="button"
                              accessibilityLabel={`How to do ${name}`}
                            >
                              <Icon name="demo" size="md" color={c.textMuted} />
                            </TouchableOpacity>
                          )}
                        </View>
                      );
                    })}
                  </View>
                </View>,
              ])
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

      <ExerciseDemoSheet name={demoFor} onClose={() => setDemoFor(null)} />
    </Modal>
  );
}

const makeStyles = (c: Theme) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: space.lg,
      // Extra top clearance, not just SafeAreaView's edges=['top']: inside a
      // bare <Modal> that alone wasn't reliably clearing the status bar,
      // leaving Cancel rendered underneath the clock and unclickable —
      // same class of issue BarcodeScanner works around with a fixed offset.
      paddingTop: space.xxxl,
      paddingBottom: space.md,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
      backgroundColor: c.card,
    },
    cancel: { ...type.body(c), color: c.textMuted, width: 50 },
    title: { ...type.bodyStrong(c), color: c.text },

    searchWrap: { padding: space.lg, paddingBottom: space.sm },
    searchInput: {
      ...type.body(c),
      backgroundColor: c.input,
      borderRadius: radius.control,
      borderWidth: 1,
      borderColor: c.border,
      paddingHorizontal: space.lg,
      paddingVertical: space.md,
      color: c.text,
    },

    content: { paddingHorizontal: space.lg, paddingBottom: space.xxxl },

    customRow: {
      backgroundColor: c.primarySoft,
      borderRadius: radius.card,
      borderWidth: 1,
      borderColor: `${c.primary}66`,
      paddingVertical: space.lg,
      paddingHorizontal: space.lg,
      marginBottom: space.lg,
    },
    customRowText: { ...type.bodyStrong(c), color: c.primaryDark },
    customRowHint: { ...type.caption(c), color: c.textMuted, marginTop: space.xxs },

    emptyText: { ...type.body(c), color: c.textMuted, textAlign: 'center', marginTop: space.lg },

    group: { marginBottom: space.lg },
    groupTitle: {
      ...type.overline(c),
      color: c.textFaint,
      paddingLeft: space.xs,
      paddingTop: space.sm,
      paddingBottom: space.sm,
      // Sticky, so it is drawn over the rows passing beneath it and needs a
      // ground rather than inheriting the one it happens to be sitting on.
      backgroundColor: c.bg,
    },
    // One card per group, not one per exercise.
    //
    // Every exercise used to be its own bordered card, which is what a card
    // means everywhere else in this app: a thing with contents — a saved
    // workout, a meal, a chart. Wrapped around a single name, 153 times, it
    // was a wall of identical pills that belonged to no screen in particular.
    // The group is the object; the exercises are its contents, divided by
    // hairlines the way a settings list divides its rows.
    card: {
      backgroundColor: c.card,
      borderRadius: radius.card,
      borderWidth: 1,
      borderColor: c.border,
      overflow: 'hidden',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.md,
      paddingVertical: space.sm,
      paddingHorizontal: space.md,
    },
    rowDivided: { borderTopWidth: 1, borderTopColor: c.border },
    // The name and the drawing take the whole row minus the demo button, so
    // the tap target for choosing is the row rather than the text.
    rowMain: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.md,
      minWidth: 0,
    },
    // The same tinted tile TemplateRow and the start sheet open with, so a
    // row here reads as the same kind of thing as a row there.
    tile: {
      width: 40,
      height: 40,
      borderRadius: radius.control,
      backgroundColor: c.cardMuted,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 2,
    },
    thumb: { width: '100%', height: '100%' },
    rowText: { flex: 1, minWidth: 0 },
    rowTitle: { ...type.body(c), fontFamily: c.fontBody, color: c.text },
    rowSub: { ...type.caption(c), color: c.textFaint, marginTop: space.xxs },
  });
