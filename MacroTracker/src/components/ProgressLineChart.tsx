import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Polyline, Line, Circle, Text as SvgText } from 'react-native-svg';
import { useTheme } from '../theme/useTheme';
import type { Theme } from '../theme';

interface Props {
  /** Y values, oldest → newest (left → right). */
  values: number[];
  /** Short labels aligned with values; only the endpoints are drawn. */
  labels: string[];
  color: string;
}

const W = 320; // viewBox width (scales to container)
const H = 150;
const PAD_L = 40;
const PAD_R = 12;
const PAD_T = 14;
const PAD_B = 22;

// Format a Y-axis value compactly: 12,500 → "12.5k", smaller numbers as-is.
function fmt(v: number): string {
  if (v >= 10000) return `${(v / 1000).toFixed(1)}k`;
  return String(Math.round(v));
}

// A lightweight SVG line chart for a per-session metric over time. Handles the
// single-point case (one dot + value) and a flat series (sensible Y padding).
export function ProgressLineChart({ values, labels, color }: Props) {
  const c = useTheme();
  if (values.length === 0) return null;

  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;

  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  // Pad the range so the line isn't glued to the top/bottom; guarantee a
  // non-zero span for flat series.
  const pad = Math.max(1, (rawMax - rawMin) * 0.15);
  const yMin = Math.max(0, Math.floor(rawMin - pad));
  const yMax = Math.ceil(rawMax + pad);
  const ySpan = Math.max(1, yMax - yMin);

  const n = values.length;
  const x = (i: number) => (n === 1 ? PAD_L + plotW / 2 : PAD_L + (i / (n - 1)) * plotW);
  const y = (v: number) => PAD_T + (1 - (v - yMin) / ySpan) * plotH;

  const points = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const gridValues = [yMax, Math.round((yMin + yMax) / 2), yMin];

  return (
    <Svg viewBox={`0 0 ${W} ${H}`} width="100%" height={184}>
      {gridValues.map((v, idx) => (
        <React.Fragment key={`${v}-${idx}`}>
          <Line x1={PAD_L} y1={y(v)} x2={W - PAD_R} y2={y(v)} stroke={c.border} strokeWidth={1} />
          <SvgText x={4} y={y(v) + 3} fontSize={9} fill={c.textFaint}>
            {fmt(v)}
          </SvgText>
        </React.Fragment>
      ))}

      {values.length > 1 && (
        <Polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      )}

      {values.map((v, i) => (
        <Circle key={i} cx={x(i)} cy={y(v)} r={n > 24 ? 1.6 : 3} fill={color} />
      ))}

      {/* X endpoints */}
      <SvgText x={PAD_L} y={H - 6} fontSize={9} fill={c.textFaint}>
        {labels[0] ?? ''}
      </SvgText>
      {labels.length > 1 && (
        <SvgText x={W - PAD_R} y={H - 6} fontSize={9} fill={c.textFaint} textAnchor="end">
          {labels[labels.length - 1]}
        </SvgText>
      )}
    </Svg>
  );
}

// Small helper kept here so screens can render a "no data" placeholder with a
// consistent look next to the chart.
export function ChartEmpty({ text }: { text: string }) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

const makeStyles = (c: Theme) => StyleSheet.create({
  empty: { paddingVertical: 32, alignItems: 'center' },
  emptyText: { fontSize: 13, color: c.textFaint },
});
