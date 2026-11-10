import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  ActionSheetIOS,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore, sumMacros } from '../store/useStore';
import { todayString, displayDate, formatDate } from '../utils/date';
import { useToday } from '../hooks/useToday';
import { MealSection } from '../components/MealSection';
import { MealType } from '../types';
import { useTheme } from '../theme/useTheme';
import type { Theme } from '../theme';
import { radius, space, tabular, type } from '../theme/tokens';
import { Icon } from '../components/Icon';

interface Props {
  navigation: any;
}

const MEALS: MealType[] = ['breakfast', 'lunch', 'dinner', 'snacks'];

// How full a bar should be. A goal of 0 would make this NaN and hand the bar
// an invalid width, so it reads as empty — the same guard MacroBar carries.
const ratio = (value: number, goal: number) => (goal > 0 ? Math.min(value / goal, 1) : 0);

// The food log, on its own tab.
//
// This was the lower two thirds of Home. Home answers "where do I stand", which
// is a glance; this answers "what did I eat", which is a task — and the two
// want opposite things from a screen. Keeping them together meant the day's
// answer sat on top of a list that grew all day and pushed it out of view.
//
// The date lives here rather than on Home: picking a day is only ever in
// service of logging to it or reading what was logged. Home is always today.
export function FoodScreen({ navigation }: Props) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const today = useToday();
  const [selectedDate, setSelectedDate] = useState(today);

  // Notice midnight. `selectedDate` is state on a tab screen that stays
  // mounted for the life of the app, so without this it holds whatever day
  // the screen first appeared and a snack logged at 00:05 lands on yesterday.
  //
  // `shownAsToday` is the day `selectedDate` means "today" for: when the real
  // day moves past it, a date still sitting on the old today follows, while a
  // day the user stepped back to deliberately stays where they put it.
  const shownAsToday = useRef(selectedDate);
  useEffect(() => {
    if (today === shownAsToday.current) return;
    setSelectedDate((d) => (d === shownAsToday.current ? today : d));
    shownAsToday.current = today;
  }, [today]);

  const goals = useStore((s) => s.goals);
  const dateEntries = useStore((s) => s.logs[selectedDate]);
  const totals = useMemo(() => sumMacros(dateEntries ?? []), [dateEntries]);

  const isToday = selectedDate === today;
  const remaining = Math.round(goals.calories - totals.calories);
  const over = remaining < 0;

  const caloriePct = ratio(totals.calories, goals.calories);

  const macroColumns = useMemo(
    () =>
      (
        [
          ['Protein', totals.protein, goals.protein, c.macroProtein],
          ['Carbs', totals.carbs, goals.carbs, c.macroCarbs],
          ['Fat', totals.fat, goals.fat, c.macroFat],
          ['Fiber', totals.fiber ?? 0, goals.fiber, c.macroFiber],
        ] as const
      ).map(([label, value, goal, color]) => ({
        label,
        value,
        goal,
        color,
        pct: ratio(value, goal),
        over: goal > 0 && value > goal,
      })),
    [totals, goals, c]
  );

  function goDay(offset: number) {
    const current = new Date(selectedDate + 'T12:00:00');
    current.setDate(current.getDate() + offset);
    const next = formatDate(current);
    if (next <= todayString()) setSelectedDate(next);
  }

  function handleAddFood(meal: MealType) {
    navigation.navigate('LogFood', { meal, date: selectedDate });
  }

  function handleSnapMeal() {
    const labels = ['Breakfast', 'Lunch', 'Dinner', 'Snacks'];
    const go = (i: number) =>
      navigation.navigate('MealPhoto', { meal: MEALS[i], date: selectedDate });

    // ActionSheetIOS is iOS-only; on Android the equivalent is an alert with
    // one button per choice, which is what the workout-type picker already does.
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ['Cancel', ...labels], cancelButtonIndex: 0 },
        (index) => {
          if (index > 0) go(index - 1);
        }
      );
    } else {
      Alert.alert('Add to which meal?', undefined, [
        ...labels.map((label, i) => ({ text: label, onPress: () => go(i) })),
        { text: 'Cancel', style: 'cancel' as const },
      ]);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <StatusBar
        barStyle={c.scheme === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor={c.bg}
      />

      {/* Date and what is left stay put while the log scrolls, because both
          are what you check between adding one food and the next. */}
      <View style={styles.header}>
        <View style={styles.dateNav}>
          <TouchableOpacity
            onPress={() => goDay(-1)}
            style={styles.navBtn}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Previous day"
          >
            <Icon name="back" size="lg" color={c.gray700} />
          </TouchableOpacity>
          <Text style={styles.dateLabel}>{displayDate(selectedDate)}</Text>
          <TouchableOpacity
            onPress={() => goDay(1)}
            style={[styles.navBtn, isToday && styles.navBtnDisabled]}
            disabled={isToday}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Next day"
            accessibilityState={{ disabled: isToday }}
          >
            <Icon name="forward" size="lg" color={isToday ? c.textFaint : c.gray700} />
          </TouchableOpacity>
        </View>

        <View style={styles.remainingRow}>
          <Text style={[styles.remainingNum, over && styles.remainingOver]}>
            {Math.abs(remaining).toLocaleString()}
          </Text>
          <Text style={styles.remainingLabel}>{over ? 'kcal over' : 'kcal left'}</Text>
          <View style={{ flex: 1 }} />
          <Text style={styles.calTotals}>
            {Math.round(totals.calories).toLocaleString()} /{' '}
            {Math.round(goals.calories).toLocaleString()}
          </Text>
        </View>

        {/* The day's four macros, in the same colours and against the same
            goals Home uses.
            This was "128p · 96c · 51f" — 13px, in the faintest colour the
            theme has, with no targets, so none of the three numbers meant
            anything on its own, and fiber was dropped entirely. A bar answers
            "what still needs filling" without reading any of them, which is
            the question you actually have between logging one food and the
            next. */}
        <View style={styles.calTrack}>
          <View
            style={[
              styles.barFill,
              { width: `${caloriePct * 100}%` as any },
              { backgroundColor: over ? c.danger : c.primary },
            ]}
          />
        </View>

        <View style={styles.macroGrid}>
          {macroColumns.map((m) => (
            <View key={m.label} style={styles.macroCol}>
              <Text style={styles.macroName}>{m.label}</Text>
              <Text style={styles.macroReadout}>
                <Text style={[styles.macroValue, m.over && styles.remainingOver]}>
                  {Math.round(m.value)}
                </Text>
                <Text style={styles.macroGoal}>/{m.goal}</Text>
              </Text>
              <View style={styles.macroTrack}>
                <View
                  style={[
                    styles.barFill,
                    { width: `${m.pct * 100}%` as any },
                    { backgroundColor: m.over ? c.danger : m.color },
                  ]}
                />
              </View>
            </View>
          ))}
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <TouchableOpacity style={styles.snapBtn} onPress={handleSnapMeal} activeOpacity={0.85}>
          <Icon name="aiEstimate" size="lg" color={c.onPrimary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.snapTitle}>AI Meal Logger</Text>
            <Text style={styles.snapSub}>Snap a photo or describe your meal in words</Text>
          </View>
        </TouchableOpacity>

        {MEALS.map((meal) => (
          <MealSection key={meal} meal={meal} date={selectedDate} onAddFood={handleAddFood} />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (c: Theme) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    scroll: { flex: 1 },
    content: { padding: space.lg, paddingTop: space.md, paddingBottom: space.xxl },

    header: {
      paddingHorizontal: space.lg,
      paddingTop: space.sm,
      paddingBottom: space.md,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
      backgroundColor: c.bg,
    },
    dateNav: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: space.lg,
    },
    navBtn: { padding: space.sm },
    navBtnDisabled: { opacity: 0.3 },
    dateLabel: {
      ...type.heading(c),
      color: c.text,
      minWidth: 120,
      textAlign: 'center',
    },

    remainingRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: space.xs,
      marginTop: space.sm,
    },
    remainingNum: { ...type.title(c), ...tabular, color: c.text },
    remainingOver: { color: c.danger },
    remainingLabel: { ...type.caption(c), color: c.textMuted },
    calTotals: { ...type.caption(c), ...tabular, color: c.textFaint },

    // Both tracks share barFill, and both use MacroBar's geometry — 6pt on
    // borderStrong — so a macro bar means the same thing here as on Home.
    calTrack: {
      height: 6,
      borderRadius: radius.hairline,
      backgroundColor: c.borderStrong,
      overflow: 'hidden',
      marginTop: space.sm,
    },
    barFill: { height: '100%', borderRadius: radius.hairline },

    macroGrid: { flexDirection: 'row', gap: space.sm, marginTop: space.md },
    macroCol: { flex: 1 },
    // The label sits above the value rather than beside it: four columns in
    // 358pt leave ~83pt each, and "PROTEIN" plus its number does not fit on
    // one line.
    macroName: { ...type.overline(c), color: c.textFaint },
    macroReadout: { ...tabular, marginTop: space.xxs },
    macroValue: { ...type.body(c), fontFamily: c.fontDisplay, color: c.text },
    macroGoal: { ...type.caption(c), fontFamily: c.fontDisplay, color: c.textFaint },
    macroTrack: {
      height: 6,
      borderRadius: radius.hairline,
      backgroundColor: c.borderStrong,
      overflow: 'hidden',
      marginTop: space.xs,
    },

    snapBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.md,
      backgroundColor: c.primary,
      borderRadius: radius.card,
      padding: space.lg,
      marginBottom: space.lg,
      shadowColor: c.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 4,
    },
    snapTitle: { ...type.bodyStrong(c), color: c.onPrimary },
    snapSub: { ...type.caption(c), color: c.onPrimary, opacity: 0.85, marginTop: space.xxs },
  });
