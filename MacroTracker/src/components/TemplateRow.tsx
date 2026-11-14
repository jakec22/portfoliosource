import React, { useCallback, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Pressable } from 'react-native';
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';
import { useTheme } from '../theme/useTheme';
import type { Theme } from '../theme';
import { radius, space, type } from '../theme/tokens';
import { Icon } from './Icon';
import { templateSubtitle, type TemplateRow as Row } from '../utils/templateOrder';

// One action, and the whole tray the three of them make. Both are needed as
// numbers rather than only as styles: the tray's width is what the gesture
// has to be tuned against (see `friction` below), and getting that wrong is
// invisible in the stylesheet.
const ACTION_W = 72;
const TRAY_W = space.sm + ACTION_W * 3 + space.sm * 2; // 240

interface Props {
  row: Row;
  onStart: () => void;
  onEdit: () => void;
  onShare: () => void;
  onDelete: () => void;
  /** Called with this row's handle as it opens, so the list can close the last one. */
  onOpen?: (methods: SwipeableMethods) => void;
}

/**
 * A saved workout in the library: tap to start, swipe left to manage.
 *
 * The same anatomy as the start sheet's rows — tinted tile, name, a line of
 * detail, chevron — so a saved workout reads as the same kind of thing as
 * the Empty workout and the two timers it sits beside there.
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
 *
 * ## The gesture
 *
 * Swipeable divides the drag by `friction`, so the row moves half as far as
 * the finger at the 2 the rest of the app uses. That is fine behind an 80pt
 * Delete — 160pt of travel reveals it — and wrong behind this tray: at 240pt
 * it would want 480pt of finger to show the three actions, which is wider
 * than any iPhone. The row tracked sluggishly, refused to open on a normal
 * swipe, and jumped the rest of the way on release. So this row tracks the
 * finger 1:1, and opens from a third of the tray rather than Swipeable's
 * default half.
 *
 * Tapping an open row closes it instead of starting the workout. Without
 * that, a swipe you have changed your mind about has no undo and the nearest
 * thing to one — tapping the row that is still half visible — launches a
 * session.
 */
export function TemplateRow({ row, onStart, onEdit, onShare, onDelete, onOpen }: Props) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { template, count } = row;

  const swipe = useRef<SwipeableMethods>(null);
  const isOpen = useRef(false);

  // The tray's actions are reachable while it is open, so they do not go
  // through this; only the row itself does.
  const handlePress = useCallback(() => {
    if (isOpen.current) {
      swipe.current?.close();
      return;
    }
    onStart();
  }, [onStart]);

  // Close before acting: the screen these push to can come back to a list
  // where this row is still sitting open behind its own actions.
  const act = useCallback((fn: () => void) => () => {
    swipe.current?.close();
    fn();
  }, []);

  return (
    <ReanimatedSwipeable
      ref={swipe}
      friction={1}
      rightThreshold={TRAY_W / 3}
      onSwipeableWillOpen={() => {
        isOpen.current = true;
        if (swipe.current) onOpen?.(swipe.current);
      }}
      onSwipeableWillClose={() => {
        isOpen.current = false;
      }}
      renderRightActions={() => (
        <View style={styles.tray}>
          <TouchableOpacity
            style={[styles.act, { backgroundColor: c.primary }]}
            onPress={act(onEdit)}
            accessibilityRole="button"
            accessibilityLabel={`Edit ${template.name}`}
          >
            <Icon name="edit" size="md" color={c.onPrimary} />
            <Text style={[styles.actText, { color: c.onPrimary }]}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.act, { backgroundColor: c.accent }]}
            onPress={act(onShare)}
            accessibilityRole="button"
            accessibilityLabel={`Share ${template.name}`}
          >
            <Icon name="share" size="md" color={c.onAccent} />
            <Text style={[styles.actText, { color: c.onAccent }]}>Share</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.act, { backgroundColor: c.danger }]}
            onPress={act(onDelete)}
            accessibilityRole="button"
            accessibilityLabel={`Delete ${template.name}`}
          >
            <Icon name="delete" size="md" color={c.onDanger} />
            <Text style={[styles.actText, { color: c.onDanger }]}>Delete</Text>
          </TouchableOpacity>
        </View>
      )}
      overshootRight={false}
    >
      <Pressable
        style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityLabel={`Start ${template.name}. ${count} exercises.`}
      >
        <View style={styles.tile}>
          <Icon name="workout" size="lg" color={c.primary} />
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
    // The same tinted tile the sheet's Empty workout row uses, so a saved
    // workout and a new one read as the same kind of thing.
    tile: {
      width: 44,
      height: 44,
      borderRadius: radius.control,
      backgroundColor: c.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
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
      width: ACTION_W,
      borderRadius: radius.control,
      marginBottom: space.sm,
      alignItems: 'center',
      justifyContent: 'center',
      gap: space.xs,
    },
    actText: { ...type.micro(c), fontFamily: c.fontBodyBold },
  });
