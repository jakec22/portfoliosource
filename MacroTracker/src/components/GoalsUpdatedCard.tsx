import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { GoalsUpdateNotice } from '../types';
import { useTheme } from '../theme/useTheme';
import type { Theme } from '../theme';
import { radius, space, type } from '../theme/tokens';

interface Props {
  notice: GoalsUpdateNotice;
  onDismiss: () => void;
  onTurnOff: () => void;
}

function delta(from: number, to: number): string {
  const d = to - from;
  if (d === 0) return 'unchanged';
  return `${d > 0 ? '+' : '−'}${Math.abs(d)}`;
}

// Explains an automatic goal change. Goals tracking body weight is only a good
// idea if the user is never left wondering why their target moved, so this
// says what changed, why, and how to stop it.
export function GoalsUpdatedCard({ notice, onDismiss, onTurnOff }: Props) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  const lost = notice.toWeightLbs < notice.fromWeightLbs;
  const diff = Math.abs(notice.toWeightLbs - notice.fromWeightLbs).toFixed(1);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>Goals updated</Text>
        <TouchableOpacity
          onPress={onDismiss}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={styles.close}>×</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.body}>
        You're {lost ? 'down' : 'up'} {diff} lb since these targets were set, so
        they've been recalculated to keep you on plan.
      </Text>

      <View style={styles.rows}>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Calories</Text>
          <Text style={styles.rowValue}>
            {notice.previousCalories} → {notice.calories}
            <Text style={styles.rowDelta}>
              {'  '}
              {delta(notice.previousCalories, notice.calories)}
            </Text>
          </Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Protein</Text>
          <Text style={styles.rowValue}>
            {notice.previousProtein} → {notice.protein} g
            <Text style={styles.rowDelta}>
              {'  '}
              {delta(notice.previousProtein, notice.protein)}
            </Text>
          </Text>
        </View>
      </View>

      <TouchableOpacity onPress={onTurnOff} style={styles.turnOff}>
        <Text style={styles.turnOffText}>Turn off auto-update</Text>
      </TouchableOpacity>
    </View>
  );
}

const makeStyles = (c: Theme) =>
  StyleSheet.create({
    card: {
      backgroundColor: c.primarySoft,
      borderRadius: radius.card,
      borderWidth: 1,
      borderColor: `${c.primary}55`,
      padding: space.lg,
      marginBottom: space.lg,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    title: { ...type.bodyStrong(c), fontFamily: c.fontDisplay, color: c.primaryDark },
    close: { ...type.heading(c), color: c.primaryDark },

    body: {
      ...type.caption(c),
      fontFamily: c.fontBody,
      color: c.text,
      marginTop: space.xs,
    },

    rows: { marginTop: space.md, gap: space.xs },
    row: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
    rowLabel: { ...type.caption(c), fontFamily: c.fontBody, color: c.textMuted },
    rowValue: {
      ...type.bodyStrong(c),
      color: c.text,
      fontVariant: ['tabular-nums'],
    },
    rowDelta: { color: c.primaryDark, fontFamily: c.fontBody },

    turnOff: {
      marginTop: space.md,
      paddingTop: space.md,
      borderTopWidth: 1,
      borderTopColor: `${c.primary}33`,
    },
    turnOffText: { ...type.captionStrong(c), fontFamily: c.fontBodyBold, color: c.primaryDark },
  });
