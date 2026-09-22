import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import type { ConsistencyStats } from '../utils/trainingSplit';
import { useTheme } from '../theme/useTheme';
import type { Theme } from '../theme';

interface Props {
  stats: ConsistencyStats;
  /** Sessions per week the ring fills toward. */
  target?: number;
}

const SIZE = 104;
const STROKE = 11;

// This week's training at a glance: a progress ring against a weekly target,
// with the week streak and all-time count beside it. Gives the Exercise tab a
// headline stat the way the calorie ring anchors Home.
export function ConsistencyRing({ stats, target = 4 }: Props) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  const radius = (SIZE - STROKE) / 2;
  const circumference = 2 * Math.PI * radius;
  const safeTarget = target > 0 ? target : 1;
  const progress = Math.min(stats.thisWeek / safeTarget, 1);
  const hit = stats.thisWeek >= safeTarget;

  return (
    <View style={styles.wrap}>
      <View style={{ width: SIZE, height: SIZE }}>
        <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
          <Circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={radius}
            stroke={c.cardMuted}
            strokeWidth={STROKE}
            fill="none"
          />
          <Circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={radius}
            stroke={hit ? c.primary : c.hrZone3}
            strokeWidth={STROKE}
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - progress)}
            strokeLinecap="round"
            rotation="-90"
            origin={`${SIZE / 2}, ${SIZE / 2}`}
          />
        </Svg>
        <View style={[styles.center, { width: SIZE, height: SIZE }]}>
          <Text style={styles.count}>{stats.thisWeek}</Text>
          <Text style={styles.of}>of {safeTarget}</Text>
        </View>
      </View>

      <View style={styles.side}>
        <Text style={styles.headline}>
          {hit ? 'Weekly target hit' : `${safeTarget - stats.thisWeek} to go this week`}
        </Text>
        <View style={styles.metaRow}>
          <Text style={styles.metaValue}>{stats.weekStreak}</Text>
          <Text style={styles.metaLabel}>
            week{stats.weekStreak === 1 ? '' : 's'} in a row
          </Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.metaValue}>{stats.totalSessions}</Text>
          <Text style={styles.metaLabel}>
            session{stats.totalSessions === 1 ? '' : 's'} all-time
          </Text>
        </View>
      </View>
    </View>
  );
}

const makeStyles = (c: Theme) =>
  StyleSheet.create({
    wrap: { flexDirection: 'row', alignItems: 'center', gap: 18 },
    center: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
    count: {
      fontSize: 28,
      fontFamily: c.fontDisplay,
      color: c.text,
      lineHeight: 30,
    },
    of: { fontSize: 11, color: c.textFaint },

    side: { flex: 1, gap: 7 },
    headline: { fontSize: 14, fontWeight: '700', color: c.text },
    metaRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
    metaValue: {
      fontSize: 16,
      fontWeight: '700',
      color: c.primary,
      fontVariant: ['tabular-nums'],
    },
    metaLabel: { fontSize: 12.5, color: c.textMuted },
  });
