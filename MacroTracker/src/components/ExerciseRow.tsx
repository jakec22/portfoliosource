import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { useTheme } from '../theme/useTheme';
import type { Theme } from '../theme';
import { radius, space, type } from '../theme/tokens';
import { Icon } from './Icon';
import { exerciseDemo, type ExerciseDemo } from '../data/exerciseDemos';

interface Props {
  name: string;
  /** The heading this row sits under, so the subtitle can avoid repeating it. */
  category: string;
  onPress: () => void;
  /** Drawn at the trailing edge, with its own tap target. */
  accessory?: React.ReactNode;
  /** True for every row but the first in a group. */
  divided?: boolean;
  /** Spoken instead of the default, which is the name and its detail line. */
  accessibilityLabel?: string;
}

/**
 * The line under an exercise's name: what you pick it up with, and what it works.
 *
 * The muscle is dropped where it only repeats the group heading above it.
 * Inside Chest every row would otherwise read "… · Chest", a word spent
 * saying where you already are. Inside Legs the same field earns its place —
 * Quads, Hamstrings, Glutes, Calves and Adductors all live there, and that is
 * exactly the distinction you came to the list to make.
 */
export function exerciseSubtitle(demo: ExerciseDemo, category: string): string {
  const muscle = demo.primary[0];
  return [demo.equipment, muscle && muscle !== category ? muscle : null]
    .filter(Boolean)
    .join(' · ');
}

/**
 * One exercise, in a list of them.
 *
 * Shared by the picker and the library because they show the same rows for
 * different reasons — one to choose, one to read — and two copies of this
 * would have drifted within a month. What differs is the press: the picker
 * selects, the library opens the demo. So the row does not decide; the caller
 * passes it in, along with whatever belongs at the trailing edge.
 *
 * The tile is the same one TemplateRow and the start sheet open with, except
 * it holds that exercise's own drawing. That is the one thing that tells
 * Chest Press from Incline Chest Press from Decline Chest Press at a glance,
 * and it is why these rows are worth two lines.
 *
 * The thumbnail is a 128px file rather than a demo frame scaled down. Lists
 * of these run to 153 rows inside a plain ScrollView, which does not
 * virtualize, so every row mounts at once — see the generator for the
 * arithmetic that makes the small copy necessary rather than merely tidy.
 */
export function ExerciseRow({
  name,
  category,
  onPress,
  accessory,
  divided,
  accessibilityLabel,
}: Props) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const demo = exerciseDemo(name);
  const subtitle = demo ? exerciseSubtitle(demo, category) : null;

  return (
    <View style={[styles.row, divided && styles.divided]}>
      <TouchableOpacity
        style={styles.main}
        onPress={onPress}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? (subtitle ? `${name}. ${subtitle}.` : name)}
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
            // No drawing for this one — the twenty the illustration set does
            // not cover, and every name somebody typed themselves. The tile
            // stays so the list keeps an even left edge and an even height.
            <Icon name="workout" size="md" color={c.borderStrong} />
          )}
        </View>
        <View style={styles.text}>
          <Text style={styles.title} numberOfLines={1}>
            {name}
          </Text>
          {subtitle ? (
            <Text style={styles.sub} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      </TouchableOpacity>
      {accessory}
    </View>
  );
}

const makeStyles = (c: Theme) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.md,
      paddingVertical: space.sm,
      paddingHorizontal: space.md,
    },
    divided: { borderTopWidth: 1, borderTopColor: c.border },
    main: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.md,
      minWidth: 0,
    },
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
    text: { flex: 1, minWidth: 0 },
    title: { ...type.body(c), fontFamily: c.fontBody, color: c.text },
    sub: { ...type.caption(c), color: c.textFaint, marginTop: space.xxs },
  });

/**
 * The card a group of rows sits in, and its heading.
 *
 * One card per group, not one per exercise. A card means a thing with
 * contents everywhere else in this app — a saved workout, a meal, a chart —
 * and wrapped around a single name, 153 times, it was a wall of identical
 * pills. The group is the object; the exercises are its contents, divided by
 * hairlines the way a settings list divides its rows.
 */
export const exerciseListStyles = (c: Theme) =>
  StyleSheet.create({
    group: { marginBottom: space.lg },
    groupTitle: {
      ...type.overline(c),
      color: c.textFaint,
      paddingLeft: space.xs,
      paddingTop: space.sm,
      paddingBottom: space.sm,
      // Sticky, so it is drawn over the rows passing beneath it and needs a
      // ground rather than inheriting the one it happens to sit on.
      backgroundColor: c.bg,
    },
    card: {
      backgroundColor: c.card,
      borderRadius: radius.card,
      borderWidth: 1,
      borderColor: c.border,
      overflow: 'hidden',
    },
  });
