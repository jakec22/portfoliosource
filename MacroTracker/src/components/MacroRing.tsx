import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

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
          stroke="#E5E7EB"
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={over ? '#EF4444' : color}
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
        <Text style={[styles.value, { color: over ? '#EF4444' : '#111827' }]}>
          {Math.round(current)}
        </Text>
        <Text style={styles.unit}>{unit}</Text>
      </View>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.goal}>/ {goal}{unit}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
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
    color: '#6B7280',
    lineHeight: 12,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    marginTop: 4,
  },
  goal: {
    fontSize: 10,
    color: '#9CA3AF',
  },
});
