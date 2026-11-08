import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../theme/useTheme';
import type { Theme } from '../theme';
import { radius, space, type } from '../theme/tokens';
import { Icon } from './Icon';

interface Props {
  onStart: () => void;
  onDismiss: () => void;
}

/**
 * Tells a new account that its targets are not its own yet.
 *
 * Nothing makes the goal wizard run. A new session lands straight on Home
 * (App.tsx renders the tabs the moment a session exists), and the only route
 * into the wizard is a button on the Calculator tab that nobody is obliged to
 * press. So the day-one experience is a calorie ring and four macro bars
 * filling toward 2,000 kcal and 150g of protein — numbers that look exactly
 * as authoritative as real ones and are derived from nothing about the
 * person.
 *
 * This is the nudge rather than a gate: a six-step flow standing between
 * someone and the app they just installed costs more than it collects, and
 * the targets do work in the meantime. It is dismissible, and the dismissal
 * sticks, because a person who has decided the defaults are fine should not
 * be asked twice.
 */
export function SetUpGoalsCard({ onStart, onDismiss }: Props) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>These targets aren't yours yet</Text>
        <TouchableOpacity
          onPress={onDismiss}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityLabel="Dismiss"
        >
          <Text style={styles.close}>×</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.body}>
        You're on the app's default calories and macros. The goal wizard works
        them out from your body, activity and pace — about a minute.
      </Text>

      <TouchableOpacity
        style={styles.action}
        onPress={onStart}
        activeOpacity={0.85}
        accessibilityLabel="Set up your goals"
      >
        <Text style={styles.actionText}>Set up goals</Text>
        <Icon name="forward" size="sm" color={c.onPrimary} />
      </TouchableOpacity>
    </View>
  );
}

const makeStyles = (c: Theme) =>
  StyleSheet.create({
    card: {
      backgroundColor: c.card,
      borderRadius: radius.card,
      padding: space.lg,
      marginBottom: space.lg,
      // A left edge in the accent rather than a tinted fill: the card sits
      // directly above the calorie ring it is talking about, and a filled
      // panel there competes with the thing it is pointing at.
      borderLeftWidth: 3,
      borderLeftColor: c.primary,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: space.md,
    },
    title: { ...type.bodyStrong(c), color: c.text, flex: 1 },
    close: { ...type.heading(c), color: c.textFaint, lineHeight: 22 },
    body: {
      ...type.caption(c),
      color: c.textMuted,
      marginTop: space.xs,
    },
    action: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: space.xs,
      backgroundColor: c.primary,
      borderRadius: radius.pill,
      paddingVertical: space.sm,
      marginTop: space.md,
    },
    actionText: { ...type.captionStrong(c), color: c.onPrimary },
  });
