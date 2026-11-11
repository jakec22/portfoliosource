import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../theme/useTheme';
import type { Theme } from '../theme';
import { radius, space, tabular, type } from '../theme/tokens';
import { Icon } from './Icon';

export type GoalSourceMode =
  /** Built from the profile and still tracking the user's weight. */
  | 'computed'
  /** Typed, or edited since. Automatic updates are off. */
  | 'hand'
  /** No profile, so there is nothing to compute from yet. */
  | 'none';

interface Props {
  mode: GoalSourceMode;
  /** Weight the stored goals were built on. Shown in 'computed' only. */
  basisWeightLbs?: number;
  /** Rebuild from the profile at the current weight. */
  onRecalculate: () => void;
  /** Open the wizard, for a user who has no profile to rebuild from. */
  onRunWizard: () => void;
}

/**
 * Where the daily goals came from, and the way back to computed ones.
 *
 * The app has three writers for one set of numbers — the wizard, this card,
 * and the automatic rebuild that follows a weigh-in — and until now none of
 * them was visible. Typing a single digit into the calorie field clears
 * `goalsBasisWeightLbs`, which permanently stops the third one, and nothing
 * said so before, during or after. Two identical-looking cards could be a
 * plan that tracks your body and a number you typed in March.
 *
 * So the state is stated, and the state is also the warning: edit a field
 * and this flips from "From your profile" to "Set by hand" as you type.
 * That is deliberately the whole of it. The first draft put a separate
 * amber block under the fields, which rendered as a five-line box shoving
 * the card down and reading like an error — for the entirely legitimate act
 * of editing your own goals. A banner that simply tells the truth about the
 * current state costs no height, never moves, and shows cause and effect
 * instead of lecturing about it.
 *
 * Recalculate is the piece that makes the wizard stop feeling like a second
 * editor. It was the only route back to computed goals, so changing one
 * number meant a seven-step flow re-asking your age to undo it. One tap
 * does the same arithmetic against your current weight.
 */
export function GoalSource({ mode, basisWeightLbs, onRecalculate, onRunWizard }: Props) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  const computed = mode === 'computed';
  const action = computed || mode === 'hand' ? onRecalculate : onRunWizard;

  return (
    <View style={[styles.wrap, computed ? styles.on : styles.off]}>
      <View style={styles.top}>
        <Text style={[styles.title, !computed && styles.titleHand]}>
          {computed ? 'From your profile' : 'Set by hand'}
        </Text>
        <TouchableOpacity
          onPress={action}
          hitSlop={8}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={
            mode === 'none'
              ? 'Open the goal wizard'
              : 'Recalculate these goals from your profile'
          }
        >
          <View style={styles.action}>
            <Icon name={mode === 'none' ? 'goal' : 'refresh'} size="sm" color={c.primary} />
            <Text style={styles.actionText}>
              {mode === 'none' ? 'Goal wizard' : 'Recalculate'}
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      <Text style={styles.sub}>
        {mode === 'computed'
          ? `Built at ${basisWeightLbs} lb · updating as you weigh in`
          : mode === 'hand'
            ? 'Not updating as you weigh in'
            : 'Set up a profile to have these track your weight'}
      </Text>
    </View>
  );
}

const makeStyles = (c: Theme) =>
  StyleSheet.create({
    wrap: {
      borderRadius: radius.control,
      paddingHorizontal: space.md,
      paddingVertical: space.md,
      marginBottom: space.sm,
    },
    // Tinted while the goals are live and tracking; plain once they are
    // just numbers. The quiet state is the one that wants no colour: it is
    // a statement of fact, not a problem to be fixed.
    on: { backgroundColor: c.primarySoft },
    off: { backgroundColor: c.cardMuted },

    top: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: space.sm,
    },
    title: { ...type.captionStrong(c), color: c.primary },
    titleHand: { color: c.warning },
    action: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
    actionText: { ...type.captionStrong(c), color: c.primary },
    sub: { ...type.caption(c), ...tabular, color: c.textFaint, marginTop: space.xxs },
  });
