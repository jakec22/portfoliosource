import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Polyline, Line, Text as SvgText } from 'react-native-svg';
import type { HeartRateSample } from '../types';
import { heartRateStats } from '../services/heartRate';
import { useTheme } from '../theme/useTheme';
import type { Theme } from '../theme';

interface Props {
  samples: HeartRateSample[];
  /** Workout start, so the X axis maps to elapsed time. */
  startMs: number;
  endMs: number;
}

const W = 320; // viewBox width (scales to container)
const H = 140; // viewBox height
const PAD_L = 34;
const PAD_R = 8;
const PAD_T = 12;
const PAD_B = 20;

// A lightweight SVG line chart of heart rate over the course of a workout.
export function HeartRateGraph({ samples, startMs, endMs }: Props) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const stats = heartRateStats(samples);
  if (!stats || samples.length < 2) return null;

  // Y range padded a little beyond the data for headroom.
  const yMin = Math.max(40, Math.floor((stats.low - 8) / 10) * 10);
  const yMax = Math.min(220, Math.ceil((stats.peak + 8) / 10) * 10);
  const span = Math.max(1, endMs - startMs);
  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;

  const x = (t: number) => PAD_L + ((t - startMs) / span) * plotW;
  const y = (bpm: number) => PAD_T + (1 - (bpm - yMin) / (yMax - yMin)) * plotH;

  const points = samples.map((s) => `${x(s.timestamp).toFixed(1)},${y(s.bpm).toFixed(1)}`).join(' ');

  // Gridlines at the low / avg / peak for reference.
  const gridValues = [yMin, stats.avg, yMax];
  const durationMin = Math.round((endMs - startMs) / 60000);

  return (
    <View>
      <View style={styles.statsRow}>
        <Stat label="Avg" value={stats.avg} color="#EF4444" />
        <Stat label="Peak" value={stats.peak} color="#DC2626" />
        <Stat label="Low" value={stats.low} color="#F87171" />
      </View>

      <Svg viewBox={`0 0 ${W} ${H}`} width="100%" height={170}>
        {gridValues.map((v) => (
          <React.Fragment key={v}>
            <Line
              x1={PAD_L}
              y1={y(v)}
              x2={W - PAD_R}
              y2={y(v)}
              stroke={c.border}
              strokeWidth={1}
            />
            <SvgText x={4} y={y(v) + 3} fontSize={9} fill={c.textFaint}>
              {v}
            </SvgText>
          </React.Fragment>
        ))}

        <Polyline
          points={points}
          fill="none"
          stroke="#EF4444"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* X axis end labels */}
        <SvgText x={PAD_L} y={H - 6} fontSize={9} fill={c.textFaint}>
          0min
        </SvgText>
        <SvgText x={W - PAD_R} y={H - 6} fontSize={9} fill={c.textFaint} textAnchor="end">
          {durationMin}min
        </SvgText>
      </Svg>
    </View>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label} bpm</Text>
    </View>
  );
}

const makeStyles = (c: Theme) => StyleSheet.create({
  statsRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 8 },
  stat: { alignItems: 'center' },
  statValue: { fontSize: 22, fontWeight: '800' },
  statLabel: { fontSize: 11, color: c.textFaint, marginTop: 2 },
});
