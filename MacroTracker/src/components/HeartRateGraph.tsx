import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Polyline, Line, Text as SvgText } from 'react-native-svg';
import type { HeartRateSample } from '../types';
import { heartRateStats } from '../services/heartRate';
import { useStore } from '../store/useStore';
import {
  HR_ZONES,
  maxHeartRate,
  timeInZones,
  zoneBounds,
  zoneColor,
  zoneForBpm,
} from '../utils/heartRateZones';
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

// An SVG line chart of heart rate over a workout, colored by training zone —
// the line changes color as the effort moves between zones, and a breakdown
// underneath shows how long was spent in each.
export function HeartRateGraph({ samples, startMs, endMs }: Props) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const profile = useStore((s) => s.profile);
  const maxHr = maxHeartRate(profile);
  const stats = heartRateStats(samples);

  // Zone runs, time-in-zone, and the y-scale all derive from the same samples;
  // computed together so the chart only walks them once per render.
  const chart = useMemo(() => {
    if (!stats || samples.length < 2) return null;

    const yMin = Math.max(40, Math.floor((stats.low - 8) / 10) * 10);
    const yMax = Math.min(220, Math.ceil((stats.peak + 8) / 10) * 10);
    const span = Math.max(1, endMs - startMs);
    const plotW = W - PAD_L - PAD_R;
    const plotH = H - PAD_T - PAD_B;

    const x = (t: number) => PAD_L + ((t - startMs) / span) * plotW;
    const y = (bpm: number) => PAD_T + (1 - (bpm - yMin) / (yMax - yMin)) * plotH;

    // Split the line into runs of consecutive same-zone samples. Each run is
    // its own polyline so the stroke can change color mid-line; the sample at
    // a zone change belongs to both runs so they join without a gap.
    type Run = { zoneIndex: number; points: string[] };
    const runs: Run[] = [];
    let current: Run | null = null;
    for (const s of samples) {
      const zoneIndex = zoneForBpm(s.bpm, maxHr).index;
      const pt = `${x(s.timestamp).toFixed(1)},${y(s.bpm).toFixed(1)}`;
      if (!current || current.zoneIndex !== zoneIndex) {
        if (current) current.points.push(pt);
        current = { zoneIndex, points: [pt] };
        runs.push(current);
      } else {
        current.points.push(pt);
      }
    }

    return {
      yMin,
      yMax,
      y,
      runs: runs.filter((r) => r.points.length >= 2),
      zoneMs: timeInZones(samples, maxHr),
    };
  }, [samples, startMs, endMs, maxHr, stats]);

  if (!stats || !chart) return null;

  const durationMin = Math.round((endMs - startMs) / 60000);
  const gridValues = [chart.yMin, stats.avg, chart.yMax];
  const totalZoneMs = chart.zoneMs.reduce((n, v) => n + v, 0);

  return (
    <View>
      <View style={styles.statsRow}>
        <Stat label="Avg" value={stats.avg} color={c.primary} />
        <Stat label="Peak" value={stats.peak} color={c.danger} />
        <Stat label="Low" value={stats.low} color={c.info} />
      </View>

      <Svg viewBox={`0 0 ${W} ${H}`} width="100%" height={170}>
        {gridValues.map((v) => (
          <React.Fragment key={v}>
            <Line
              x1={PAD_L}
              y1={chart.y(v)}
              x2={W - PAD_R}
              y2={chart.y(v)}
              stroke={c.border}
              strokeWidth={1}
            />
            <SvgText x={4} y={chart.y(v) + 3} fontSize={9} fill={c.textFaint}>
              {v}
            </SvgText>
          </React.Fragment>
        ))}

        {chart.runs.map((run, i) => (
          <Polyline
            key={i}
            points={run.points.join(' ')}
            fill="none"
            stroke={zoneColor(HR_ZONES[run.zoneIndex - 1], c)}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}

        {/* X axis end labels */}
        <SvgText x={PAD_L} y={H - 6} fontSize={9} fill={c.textFaint}>
          0min
        </SvgText>
        <SvgText x={W - PAD_R} y={H - 6} fontSize={9} fill={c.textFaint} textAnchor="end">
          {durationMin}min
        </SvgText>
      </Svg>

      {totalZoneMs > 0 && (
        <View style={styles.zoneBlock}>
          <View style={styles.zoneBar}>
            {HR_ZONES.map((z, i) => {
              const share = chart.zoneMs[i] / totalZoneMs;
              if (share <= 0) return null;
              return (
                <View
                  key={z.index}
                  style={{
                    flex: share,
                    backgroundColor: zoneColor(z, c),
                  }}
                />
              );
            })}
          </View>

          {HR_ZONES.map((z, i) => {
            const ms = chart.zoneMs[i];
            if (ms <= 0) return null;
            const bounds = zoneBounds(z, maxHr);
            return (
              <View key={z.index} style={styles.legendRow}>
                <View style={[styles.legendDot, { backgroundColor: zoneColor(z, c) }]} />
                <Text style={styles.legendName}>{z.name}</Text>
                <Text style={styles.legendRange}>
                  {bounds.hi == null ? `${bounds.lo}+` : `${bounds.lo}–${bounds.hi}`} bpm
                </Text>
                <Text style={styles.legendTime}>{formatZoneTime(ms)}</Text>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

// "4m" / "1h 12m" — zone totals are coarse, so seconds would be noise.
function formatZoneTime(ms: number): string {
  const totalMin = Math.round(ms / 60000);
  if (totalMin < 1) return '<1m';
  if (totalMin < 60) return `${totalMin}m`;
  return `${Math.floor(totalMin / 60)}h ${totalMin % 60}m`;
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
  statValue: {
    fontSize: 22,
    fontFamily: c.fontDisplay,
    fontVariant: ['tabular-nums'],
  },
  statLabel: { fontSize: 11, color: c.textMuted, marginTop: 2, fontFamily: c.fontBody },

  zoneBlock: { marginTop: 10, gap: 7 },
  zoneBar: {
    flexDirection: 'row',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: c.cardMuted,
  },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendName: { fontSize: 12.5, fontFamily: c.fontBodyBold, color: c.text, width: 72 },
  legendRange: { fontSize: 11.5, fontFamily: c.fontBody, color: c.textFaint, flex: 1 },
  legendTime: {
    fontSize: 12.5,
    fontFamily: c.fontBodyBold,
    color: c.textMuted,
    fontVariant: ['tabular-nums'],
  },
});
