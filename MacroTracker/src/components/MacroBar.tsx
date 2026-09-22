import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme/useTheme';
import type { Theme } from '../theme';

interface Props {
  current: number;
  goal: number;
  label: string;
  color: string;
  unit?: string;
}

// One macro's progress as a labelled horizontal bar. Deliberately not a ring:
// the Home screen's calorie summary is the one circular hero, so the macros
// underneath read as a scannable list instead of competing with it.
export function MacroBar({ current, goal, label, color, unit = 'g' }: Props) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  // A goal of 0 (macro not set) would make the ratio NaN and produce an
  // invalid width, so fall back to an empty bar.
  const progress = goal > 0 ? Math.min(current / goal, 1) : 0;
  const over = goal > 0 && current > goal;
  const rounded = Math.round(current);

  return (
    <View style={styles.row}>
      <View style={styles.header}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.readout}>
          <Text style={[styles.current, over && styles.over]}>{rounded}</Text>
          <Text style={styles.goal}>
            {' / '}
            {goal}
            {unit}
          </Text>
        </Text>
      </View>
      <View style={styles.track}>
        <View
          style={[
            styles.fill,
            {
              width: `${progress * 100}%` as any,
              backgroundColor: over ? c.danger : color,
            },
          ]}
        />
      </View>
    </View>
  );
}

const makeStyles = (c: Theme) =>
  StyleSheet.create({
    row: { gap: 7 },
    header: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      gap: 12,
    },
    label: {
      fontSize: 14,
      fontWeight: '600',
      color: c.text,
    },
    readout: {
      // Keeps the numerals from shifting as values change width.
      fontVariant: ['tabular-nums'],
    },
    current: {
      fontSize: 15,
      fontWeight: '700',
      fontFamily: c.fontDisplay,
      color: c.text,
    },
    goal: {
      fontSize: 12,
      color: c.textFaint,
    },
    over: { color: c.danger },
    track: {
      height: 6,
      borderRadius: 3,
      backgroundColor: c.cardMuted,
      overflow: 'hidden',
    },
    fill: {
      height: '100%',
      borderRadius: 3,
    },
  });
