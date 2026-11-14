import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EXERCISE_CATALOG, type ExerciseCategory } from '../utils/exerciseList';
import { categoryForExercise } from '../utils/trainingSplit';
import { exerciseDemo } from '../data/exerciseDemos';
import { useStore } from '../store/useStore';
import { useTheme } from '../theme/useTheme';
import type { Theme } from '../theme';
import { radius, space, type } from '../theme/tokens';
import { Icon } from '../components/Icon';
import { ExerciseRow, exerciseListStyles } from '../components/ExerciseRow';
import { ExerciseDemoSheet } from '../components/ExerciseDemoSheet';

interface Props {
  navigation: any;
}

/**
 * The exercise catalog, to read rather than to pick from.
 *
 * The same names and the same rows as the picker, reached differently and
 * answering a different question. The picker answers "which one am I adding
 * to this workout", and you only ever see it with a workout half-built. This
 * answers "what is there, and how is it done" — which is the question you
 * have *before* you start, and until now the app had nowhere to ask it. The
 * demos, the drawings and the cues were all reachable only by someone who had
 * already decided what they were doing.
 *
 * So the two sit beside each other rather than one replacing the other. They
 * share `ExerciseRow`, which is what stops them drifting: the difference
 * between them is one line each — what a tap does. Here it opens the demo,
 * because reading is the entire point; there it selects.
 *
 * Which is also why there is no "use as typed" row. Typing a name you own
 * means something when you are adding it to a workout. Here it would offer to
 * invent a library entry about an exercise the app knows nothing about.
 */
export function ExerciseLibraryScreen({ navigation }: Props) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const list = useMemo(() => exerciseListStyles(c), [c]);
  const [query, setQuery] = useState('');
  const [demoFor, setDemoFor] = useState<string | null>(null);

  const customExercises = useStore((s) => s.customExercises);

  // The names somebody typed are part of their library too, filed where the
  // picker files them. Most have no drawing, which the row already handles.
  const catalog = useMemo(() => {
    if (customExercises.length === 0) return EXERCISE_CATALOG;
    const groups = EXERCISE_CATALOG.map((g) => ({ ...g, exercises: [...g.exercises] }));
    const extra: ExerciseCategory[] = [];
    for (const name of customExercises) {
      const cat = categoryForExercise(name);
      const target =
        groups.find((g) => g.category === cat) ?? extra.find((g) => g.category === cat);
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
    return catalog
      .map((group) => ({
        category: group.category,
        exercises: group.exercises.filter((name) => name.toLowerCase().includes(q)),
      }))
      .filter((group) => group.exercises.length > 0);
  }, [trimmed, catalog]);

  const total = useMemo(
    () => catalog.reduce((n, g) => n + g.exercises.length, 0),
    [catalog]
  );
  const shown = useMemo(
    () => filtered.reduce((n, g) => n + g.exercises.length, 0),
    [filtered]
  );
  const withDemo = useMemo(
    () => catalog.reduce((n, g) => n + g.exercises.filter((e) => exerciseDemo(e)).length, 0),
    [catalog]
  );

  // The headings alternate with their cards, so: 0, then every second child.
  const stickyHeadings = useMemo(() => filtered.map((_, i) => i * 2), [filtered]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <StatusBar
        barStyle={c.scheme === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor={c.bg}
      />
      <View style={styles.nav}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Icon name="back" size="lg" color={c.gray700} />
        </TouchableOpacity>
        <Text style={styles.navTitle}>Exercises</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.searchWrap}>
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="Search exercises"
          placeholderTextColor={c.textFaint}
          returnKeyType="search"
          clearButtonMode="while-editing"
          autoCorrect={false}
        />
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
        stickyHeaderIndices={stickyHeadings}
      >
        {filtered.length === 0 ? (
          <Text style={styles.empty}>
            Nothing matches “{trimmed}”. The library holds the exercises the app
            knows; anything else you can still type when you build a workout.
          </Text>
        ) : (
          filtered.flatMap((group) => [
            <Text key={`h-${group.category}`} style={list.groupTitle}>
              {group.category}
            </Text>,
            <View key={group.category} style={list.group}>
              <View style={list.card}>
                {group.exercises.map((name, i) => (
                  <ExerciseRow
                    key={name}
                    name={name}
                    category={group.category}
                    divided={i > 0}
                    onPress={() => setDemoFor(name)}
                    accessibilityLabel={`How to do ${name}`}
                    accessory={
                      exerciseDemo(name) ? (
                        <Icon name="forward" size="md" color={c.textFaint} />
                      ) : null
                    }
                  />
                ))}
              </View>
            </View>,
          ])
        )}

        {/* Said once, at the bottom, rather than as a badge on every row that
            lacks one. Twenty exercises have no drawing and the row already
            shows that by not having one. */}
        {filtered.length > 0 && (
          <Text style={styles.footnote}>
            {trimmed ? `${shown} of ${total} exercises` : `${total} exercises`}
            {withDemo < total ? ` · ${total - withDemo} without a demo yet` : ''}
          </Text>
        )}
      </ScrollView>

      <ExerciseDemoSheet name={demoFor} onClose={() => setDemoFor(null)} />
    </SafeAreaView>
  );
}

const makeStyles = (c: Theme) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    nav: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: space.lg,
      paddingBottom: space.sm,
    },
    navTitle: { ...type.bodyStrong(c), flex: 1, textAlign: 'center', color: c.text },

    searchWrap: { paddingHorizontal: space.lg, paddingBottom: space.sm },
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

    content: { paddingHorizontal: space.lg, paddingBottom: space.xxl },
    empty: {
      ...type.body(c),
      fontFamily: c.fontBody,
      color: c.textMuted,
      marginTop: space.xl,
      textAlign: 'center',
    },
    footnote: {
      ...type.micro(c),
      color: c.textFaint,
      textAlign: 'center',
      marginTop: space.xs,
    },
  });
