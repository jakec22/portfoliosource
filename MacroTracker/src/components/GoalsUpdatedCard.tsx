import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { GoalsUpdateNotice } from '../types';
import { useTheme } from '../theme/useTheme';
import type { Theme } from '../theme';

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
      borderRadius: 16,
      borderWidth: 1,
      borderColor: `${c.primary}55`,
      padding: 16,
      marginBottom: 16,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    title: { fontSize: 16, fontFamily: c.fontDisplay, color: c.primaryDark },
    close: { fontSize: 22, color: c.primaryDark, lineHeight: 24 },

    body: {
      fontSize: 13,
      lineHeight: 19,
      color: c.text,
      fontFamily: c.fontBody,
      marginTop: 4,
    },

    rows: { marginTop: 12, gap: 6 },
    row: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
    rowLabel: { fontSize: 13, color: c.textMuted, fontFamily: c.fontBody },
    rowValue: {
      fontSize: 14,
      color: c.text,
      fontFamily: c.fontBodyBold,
      fontVariant: ['tabular-nums'],
    },
    rowDelta: { color: c.primaryDark, fontFamily: c.fontBody },

    turnOff: {
      marginTop: 14,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: `${c.primary}33`,
    },
    turnOffText: { fontSize: 13, color: c.primaryDark, fontFamily: c.fontBodyBold },
  });
