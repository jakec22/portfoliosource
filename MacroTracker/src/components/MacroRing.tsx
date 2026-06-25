import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useTheme } from '../theme/useTheme';
import type { Theme } from '../theme';

interface Props {
  current: number;
  goal: number;
  label: string;
  color: string;
  unit?: string;
  size?: number;
  strokeWidth?: number;
}

export function MacroRing({
  current,
  goal,
  label,
  color,
  unit = 'g',
  size = 80,
  strokeWidth = 8,
}: Props) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(current / goal, 1);
  const strokeDashoffset = circumference * (1 - progress);
  const over = current > goal;

  return (
    <View style={[styles.container, { width: size, height: size + 30 }]}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={c.border}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={over ? c.danger : color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          rotation="-90"
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <View style={[styles.center, { width: size, height: size, top: 0 }]}>
        <Text style={[styles.value, { color: over ? c.danger : c.text }]}>
          {Math.round(current)}
        </Text>
        <Text style={styles.unit}>{unit}</Text>
      </View>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.goal}>/ {goal}{unit}</Text>
    </View>
  );
}

const makeStyles = (c: Theme) => StyleSheet.create({
  container: {
    alignItems: 'center',
    position: 'relative',
  },
  center: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  value: {
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 18,
  },
  unit: {
    fontSize: 10,
    color: c.textMuted,
    lineHeight: 12,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: c.gray700,
    marginTop: 4,
  },
  goal: {
    fontSize: 10,
    color: c.textFaint,
  },
});
