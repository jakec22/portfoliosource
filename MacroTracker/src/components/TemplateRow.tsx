import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Pressable } from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { useTheme } from '../theme/useTheme';
import type { Theme } from '../theme';
import { radius, space, type } from '../theme/tokens';
import { Icon } from './Icon';
import { templateSubtitle, type TemplateRow as Row } from '../utils/templateOrder';

interface Props {
  row: Row;
  onStart: () => void;
  onEdit: () => void;
  onShare: () => void;
  onDelete: () => void;
}

/**
 * A saved workout in the library: tap to start, swipe left to manage.
 *
 * Deliberately the same anatomy as the start sheet's rows — count tile, name,
 * when it was last done, chevron — because it is the same thing. A workout
 * should not look like one object in the sheet and a different one here.
 *
 * Which is also why tapping starts it rather than opening it for editing.
 * The row looks like a thing you start, so it is; editing moved behind the
 * swipe with the other two, where the app already puts row actions (see
 * WorkoutHistoryItem and MealSection).
 *
 * The row slides out from under the three actions, so its name goes with it.
 * That is simply what swipe-to-reveal does at any tray width worth having —
 * narrowing the actions to keep the name on screen only costs the labels and
 * still loses the name. It is not a problem to solve: one row opens at a
 * time, and it is the row the finger is on.
 */
export function TemplateRow({ row, onStart, onEdit, onShare, onDelete }: Props) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { template, count } = row;

  return (
    <ReanimatedSwipeable
      renderRightActions={() => (
        <View style={styles.tray}>
          <TouchableOpacity
            style={[styles.act, { backgroundColor: c.primary }]}
            onPress={onEdit}
            accessibilityRole="button"
            accessibilityLabel={`Edit ${template.name}`}
          >
            <Icon name="edit" size="md" color={c.onPrimary} />
            <Text style={[styles.actText, { color: c.onPrimary }]}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.act, { backgroundColor: c.accent }]}
            onPress={onShare}
            accessibilityRole="button"
            accessibilityLabel={`Share ${template.name}`}
          >
            <Icon name="share" size="md" color={c.onAccent} />
            <Text style={[styles.actText, { color: c.onAccent }]}>Share</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.act, { backgroundColor: c.danger }]}
            onPress={onDelete}
            accessibilityRole="button"
            accessibilityLabel={`Delete ${template.name}`}
          >
            <Icon name="delete" size="md" color={c.onDanger} />
            <Text style={[styles.actText, { color: c.onDanger }]}>Delete</Text>
          </TouchableOpacity>
        </View>
      )}
      overshootRight={false}
      friction={2}
    >
      <Pressable
        style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
        onPress={onStart}
        accessibilityRole="button"
        accessibilityLabel={`Start ${template.name}. ${count} exercises.`}
      >
        <View style={styles.numTile}>
          <Text style={styles.num}>{count}</Text>
        </View>
        <View style={styles.rowText}>
          <Text style={styles.rowTitle} numberOfLines={1}>
            {template.name}
          </Text>
          <Text style={styles.rowSub} numberOfLines={1}>
            {templateSubtitle(row)}
          </Text>
        </View>
        <Icon name="forward" size="md" color={c.textFaint} />
      </Pressable>
    </ReanimatedSwipeable>
  );
}

const makeStyles = (c: Theme) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.md,
      backgroundColor: c.cardMuted,
      borderRadius: radius.card,
      padding: space.md,
      marginBottom: space.sm,
    },
    rowPressed: { opacity: 0.6 },
    numTile: {
      width: 44,
      height: 44,
      borderRadius: radius.control,
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    num: { ...type.heading(c), color: c.text, lineHeight: 24 },
    rowText: { flex: 1, minWidth: 0 },
    rowTitle: { ...type.bodyStrong(c), color: c.text },
    rowSub: {
      ...type.caption(c),
      fontFamily: c.fontBody,
      color: c.textMuted,
      marginTop: space.xxs,
    },

    tray: { flexDirection: 'row', gap: space.sm, paddingLeft: space.sm },
    act: {
      width: 72,
      borderRadius: radius.control,
      marginBottom: space.sm,
      alignItems: 'center',
      justifyContent: 'center',
      gap: space.xs,
    },
    actText: { ...type.micro(c), fontFamily: c.fontBodyBold },
  });
