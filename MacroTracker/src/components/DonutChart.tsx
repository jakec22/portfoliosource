import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import type { SplitSlice } from '../utils/trainingSplit';
import { useTheme } from '../theme/useTheme';
import type { Theme } from '../theme';

interface Props {
  slices: SplitSlice[];
  /** Headline shown in the hole, e.g. the window the split covers. */
  centerValue: string;
  centerLabel: string;
  size?: number;
  strokeWidth?: number;
}

// A donut built from stroked circle arcs rather than paths: each slice is a
// full circle with a dash pattern sized to its share and rotated to start
// where the previous one ended, which avoids hand-computing arc sweep flags.
export function DonutChart({
  slices,
  centerValue,
  centerLabel,
  size = 132,
  strokeWidth = 18,
}: Props) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  // Running offset so each slice starts where the last finished.
  let rotation = -90; // start at 12 o'clock

  return (
    <View style={styles.wrap}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={c.cardMuted}
            strokeWidth={strokeWidth}
            fill="none"
          />
          {slices.map((slice) => {
            const dash = circumference * slice.share;
            // A hairline gap between slices reads as separation without a
            // visible seam when a slice is very small.
            const gap = slice.share > 0.02 ? 1.5 : 0;
            const element = (
              <G key={slice.category} rotation={rotation} origin={`${size / 2}, ${size / 2}`}>
                <Circle
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  stroke={slice.color}
                  strokeWidth={strokeWidth}
                  fill="none"
                  strokeDasharray={`${Math.max(0, dash - gap)} ${circumference}`}
                />
              </G>
            );
            rotation += slice.share * 360;
            return element;
          })}
        </Svg>
        <View style={[styles.center, { width: size, height: size }]}>
          <Text style={styles.centerValue}>{centerValue}</Text>
          <Text style={styles.centerLabel}>{centerLabel}</Text>
        </View>
      </View>

      <View style={styles.legend}>
        {slices.map((slice) => (
          <View key={slice.category} style={styles.legendRow}>
            <View style={[styles.dot, { backgroundColor: slice.color }]} />
            <Text style={styles.legendName} numberOfLines={1}>
              {slice.category}
            </Text>
            <Text style={styles.legendPct}>{Math.round(slice.share * 100)}%</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const makeStyles = (c: Theme) =>
  StyleSheet.create({
    wrap: { flexDirection: 'row', alignItems: 'center', gap: 18 },
    center: {
      position: 'absolute',
      alignItems: 'center',
      justifyContent: 'center',
    },
    centerValue: {
      fontSize: 20,
      fontWeight: '800',
      fontFamily: c.fontDisplay,
      color: c.text,
    },
    centerLabel: { fontSize: 10.5, color: c.textFaint, marginTop: 1 },

    legend: { flex: 1, gap: 6 },
    legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    dot: { width: 9, height: 9, borderRadius: 5 },
    legendName: { flex: 1, fontSize: 13, color: c.text, fontWeight: '500' },
    legendPct: {
      fontSize: 13,
      fontWeight: '700',
      color: c.textMuted,
      fontVariant: ['tabular-nums'],
    },
  });
