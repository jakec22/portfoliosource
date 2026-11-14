import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from '../store/useStore';
import { useSnackbar } from '../store/useSnackbar';
import { useTheme } from '../theme/useTheme';
import type { Theme } from '../theme';
import { radius, space, type } from '../theme/tokens';
import { Icon } from '../components/Icon';
import { ExerciseDemoSheet } from '../components/ExerciseDemoSheet';
import { planDayToTemplate, type DesignedPlan, type PlannedDay } from '../services/workoutDesign';

interface Props {
  navigation: any;
  route: { params: { plan: DesignedPlan } };
}

/** "3 × 10" or "3 × 0:45" — how a planned set reads before anything is lifted. */
function prescription(ex: PlannedDay['exercises'][number]): string {
  if (ex.seconds != null && ex.reps == null) {
    const m = Math.floor(ex.seconds / 60);
    const s = ex.seconds % 60;
    return `${ex.sets} × ${m}:${String(s).padStart(2, '0')}`;
  }
  return `${ex.sets} × ${ex.reps ?? 10}`;
}

/**
 * What the model came back with, before any of it is saved.
 *
 * A generated programme does not go straight into My Workouts. Someone who
 * does not know what to train is exactly the person least able to tell when
 * the answer is wrong, so the least this screen can do is put the whole thing
 * in front of them, let them open any exercise and see how it is done, and
 * let them throw out anything they do not like — before it becomes a row in
 * their library alongside the workouts they wrote themselves.
 *
 * Removal only. Swapping one exercise for another is the template editor's
 * job, it already exists, and every day saved from here is an ordinary
 * WorkoutTemplate that opens in it. Building a second editor inside a review
 * screen would be the same screen twice.
 */
export function WorkoutPlanReviewScreen({ navigation, route }: Props) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const saveTemplate = useStore((s) => s.saveTemplate);
  const history = useStore((s) => s.workoutHistory);
  const showSnackbar = useSnackbar((s) => s.show);

  const [plan, setPlan] = useState<DesignedPlan>(route.params.plan);
  const [demoFor, setDemoFor] = useState<string | null>(null);

  const total = plan.days.reduce((n, d) => n + d.exercises.length, 0);

  function removeExercise(dayIdx: number, exIdx: number) {
    setPlan((p) => ({
      ...p,
      days: p.days
        .map((d, i) =>
          i === dayIdx ? { ...d, exercises: d.exercises.filter((_, j) => j !== exIdx) } : d
        )
        // A day emptied of exercises is not a workout; drop it rather than
        // saving a template with nothing in it.
        .filter((d) => d.exercises.length > 0),
    }));
  }

  function removeDay(dayIdx: number) {
    setPlan((p) => ({ ...p, days: p.days.filter((_, i) => i !== dayIdx) }));
  }

  function handleSave() {
    // One timestamp for the set, incremented per day, so they land in the
    // library in the order they were written rather than all at once —
    // templateRows sorts by createdAt.
    const base = Date.now();
    plan.days.forEach((day, i) => {
      saveTemplate(planDayToTemplate(day, history, base + i));
    });
    showSnackbar(
      `Saved ${plan.days.length} workout${plan.days.length === 1 ? '' : 's'}`
    );
    navigation.goBack();
  }

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
          accessibilityLabel="Discard and go back"
        >
          <Icon name="close" size="lg" color={c.gray700} />
        </TouchableOpacity>
        <Text style={styles.navTitle}>Your programme</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.planName}>{plan.name}</Text>
        {plan.note ? <Text style={styles.note}>{plan.note}</Text> : null}

        {plan.days.length === 0 ? (
          <Text style={styles.empty}>
            You’ve removed everything. Go back and ask again, or build a workout
            yourself.
          </Text>
        ) : (
          plan.days.map((day, di) => (
            <View key={`${day.name}-${di}`} style={styles.dayCard}>
              <View style={styles.dayHead}>
                <Text style={styles.dayName} numberOfLines={1}>
                  {day.name}
                </Text>
                <TouchableOpacity
                  onPress={() => removeDay(di)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${day.name}`}
                >
                  <Text style={styles.removeDay}>Remove</Text>
                </TouchableOpacity>
              </View>

              {day.exercises.map((ex, ei) => (
                <View key={`${ex.name}-${ei}`} style={styles.exRow}>
                  <TouchableOpacity
                    style={styles.exMain}
                    onPress={() => setDemoFor(ex.name)}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={`How to do ${ex.name}`}
                  >
                    <Text style={styles.exName} numberOfLines={1}>
                      {ex.name}
                    </Text>
                    <Text style={styles.exSets}>{prescription(ex)}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => removeExercise(di, ei)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${ex.name}`}
                  >
                    <Icon name="close" size="sm" color={c.textFaint} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          ))
        )}

        {plan.days.length > 0 && (
          <Text style={styles.hint}>
            Tap an exercise to see how it’s done. Weights are left blank except
            where you’ve lifted it before — fill them in as you go.
          </Text>
        )}
      </ScrollView>

      {plan.days.length > 0 && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.save}
            onPress={handleSave}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={`Save ${plan.days.length} workouts, ${total} exercises`}
          >
            <Text style={styles.saveText}>
              Save {plan.days.length} workout{plan.days.length === 1 ? '' : 's'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

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
    content: { padding: space.lg, paddingTop: space.xs, paddingBottom: space.xxl },

    planName: { ...type.title(c), color: c.text },
    note: {
      ...type.body(c),
      fontFamily: c.fontBody,
      color: c.textMuted,
      marginTop: space.sm,
      marginBottom: space.lg,
    },

    dayCard: {
      backgroundColor: c.card,
      borderRadius: radius.card,
      borderWidth: 1,
      borderColor: c.border,
      padding: space.md,
      marginBottom: space.md,
    },
    dayHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: space.md,
      marginBottom: space.sm,
    },
    dayName: { ...type.subhead(c), fontFamily: c.fontBodyBold, color: c.text, flex: 1 },
    removeDay: { ...type.caption(c), color: c.textFaint },

    exRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.md,
      paddingVertical: space.sm,
      borderTopWidth: 1,
      borderTopColor: c.border,
    },
    exMain: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: space.md,
      minWidth: 0,
    },
    exName: { ...type.body(c), fontFamily: c.fontBody, color: c.text, flex: 1 },
    exSets: { ...type.caption(c), color: c.textMuted, fontVariant: ['tabular-nums'] },

    empty: {
      ...type.body(c),
      fontFamily: c.fontBody,
      color: c.textMuted,
      textAlign: 'center',
      marginTop: space.xl,
    },
    hint: {
      ...type.micro(c),
      color: c.textFaint,
      textAlign: 'center',
      marginTop: space.sm,
    },

    footer: {
      paddingHorizontal: space.lg,
      paddingTop: space.sm,
      paddingBottom: space.lg,
      borderTopWidth: 1,
      borderTopColor: c.border,
      backgroundColor: c.bg,
    },
    save: {
      backgroundColor: c.primary,
      borderRadius: radius.card,
      paddingVertical: space.lg,
      alignItems: 'center',
    },
    saveText: { ...type.subhead(c), fontFamily: c.fontBodyBold, color: c.onPrimary },
  });
