import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from '../store/useStore';
import { useTheme } from '../theme/useTheme';
import type { Theme } from '../theme';
import { radius, space, type } from '../theme/tokens';
import { Icon } from '../components/Icon';
import { TemplateRow } from '../components/TemplateRow';
import { templateRows } from '../utils/templateOrder';
import { useTemplateActions } from '../hooks/useTemplateActions';

interface Props {
  navigation: any;
}

/**
 * The saved workouts, and everything you can do to them.
 *
 * This was a section on the Exercise tab, sitting between the start button
 * and the training charts. It did two jobs badly from there: it was the only
 * way to start a saved workout, which put the app's most common action below
 * a fold and outside the flow that the big "Start a Workout" button opens;
 * and it was the only way to create one, which meant the management of
 * templates and the starting of them were the same list.
 *
 * Starting moved into the sheet. What is left here is the library: the whole
 * list in creation order, the two ways to add to it, and — behind a swipe —
 * the three ways to change one. The Exercise tab is now charts and a start
 * button, which is what a training tab should be.
 */
export function WorkoutLibraryScreen({ navigation }: Props) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const templates = useStore((s) => s.workoutTemplates);
  const history = useStore((s) => s.workoutHistory);
  const rows = useMemo(() => templateRows(templates, history), [templates, history]);
  const { startTemplate, deleteTemplate, shareTemplate, importFromLink } =
    useTemplateActions(navigation);

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
        <Text style={styles.navTitle}>My Workouts</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.head}>
          <Text style={styles.count}>
            {rows.length > 0 ? `${rows.length} saved` : 'Nothing saved'}
          </Text>
          <View style={styles.headActions}>
            <TouchableOpacity onPress={importFromLink} accessibilityRole="button">
              <Text style={styles.importLink}>Add from link</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => navigation.navigate('WorkoutTemplate', {})}
              accessibilityRole="button"
            >
              <Text style={styles.createLink}>+ Create</Text>
            </TouchableOpacity>
          </View>
        </View>

        {rows.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>
              No saved workouts yet. Tap “+ Create” to build one with your go-to
              exercises, sets and reps — or add one from a link someone shared.
            </Text>
          </View>
        ) : (
          <>
            {rows.map((row) => (
              <TemplateRow
                key={row.template.id}
                row={row}
                onStart={() => startTemplate(row.template)}
                onEdit={() =>
                  navigation.navigate('WorkoutTemplate', { templateId: row.template.id })
                }
                onShare={() => shareTemplate(row.template)}
                onDelete={() => deleteTemplate(row.template)}
              />
            ))}
            <Text style={styles.hint}>
              Tap to start · swipe left to edit, share or delete
            </Text>
          </>
        )}
      </ScrollView>
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
      paddingBottom: space.md,
    },
    navTitle: { ...type.bodyStrong(c), flex: 1, textAlign: 'center', color: c.text },
    content: { padding: space.lg, paddingTop: space.sm, paddingBottom: space.xxl },

    head: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: space.md,
      gap: space.md,
    },
    count: { ...type.heading(c), color: c.text },
    headActions: { flexDirection: 'row', gap: space.lg },
    importLink: { ...type.bodyStrong(c), color: c.accent },
    createLink: { ...type.bodyStrong(c), color: c.primary },

    emptyCard: {
      backgroundColor: c.card,
      borderRadius: radius.card,
      padding: space.xl,
    },
    emptyText: { ...type.body(c), fontFamily: c.fontBody, color: c.textMuted },
    hint: {
      ...type.micro(c),
      color: c.textFaint,
      textAlign: 'center',
      marginTop: space.md,
    },
  });
