import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

interface Props {
  consumed: number;
  goal: number;
  size?: number;
}

export function CalorieSummary({ consumed, goal, size = 160 }: Props) {
  const strokeWidth = 14;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(consumed / goal, 1);
  const offset = circumference * (1 - progress);
  const remaining = goal - consumed;
  const over = consumed > goal;

  return (
    <View style={styles.wrapper}>
      <View style={[styles.container, { width: size, height: size }]}>
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="#F3F4F6"
            strokeWidth={strokeWidth}
            fill="none"
          />
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={over ? '#EF4444' : '#10B981'}
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            rotation="-90"
            origin={`${size / 2}, ${size / 2}`}
          />
        </Svg>
        <View style={[styles.center, { width: size, height: size }]}>
          <Text style={[styles.consumedValue, over && styles.overValue]}>
            {Math.round(consumed)}
          </Text>
          <Text style={styles.consumedLabel}>consumed</Text>
          <View style={styles.divider} />
          <Text style={[styles.remainingValue, over && styles.overValue]}>
            {Math.abs(Math.round(remaining))}
          </Text>
          <Text style={styles.remainingLabel}>
            {over ? 'over' : 'remaining'}
          </Text>
        </View>
      </View>
      <View style={styles.stats}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{goal}</Text>
          <Text style={styles.statLabel}>Goal</Text>
        </View>
        <Text style={styles.minus}>−</Text>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{Math.round(consumed)}</Text>
          <Text style={styles.statLabel}>Food</Text>
        </View>
        <Text style={styles.equals}>=</Text>
        <View style={styles.stat}>
          <Text style={[styles.statValue, over && styles.overValue]}>
            {Math.abs(Math.round(remaining))}
          </Text>
          <Text style={styles.statLabel}>{over ? 'Over' : 'Left'}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
  },
  container: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  consumedValue: {
    fontSize: 32,
    fontWeight: '800',
    color: '#111827',
    lineHeight: 36,
  },
  consumedLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 4,
  },
  divider: {
    width: 40,
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 6,
  },
  remainingValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#10B981',
    lineHeight: 24,
  },
  remainingLabel: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  overValue: {
    color: '#EF4444',
  },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    gap: 12,
  },
  stat: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  statLabel: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  minus: {
    fontSize: 18,
    color: '#D1D5DB',
    fontWeight: '300',
  },
  equals: {
    fontSize: 18,
    color: '#D1D5DB',
    fontWeight: '300',
  },
});
