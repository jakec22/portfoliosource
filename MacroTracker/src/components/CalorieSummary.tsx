import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useTheme } from '../theme/useTheme';
import type { Theme } from '../theme';
import { space, tabular, type } from '../theme/tokens';
import { CountUp } from './CountUp';

interface Props {
  consumed: number;
  goal: number;
  size?: number;
}

/**
 * The day's calories as a ring.
 *
 * It used to hold four numbers inside the ring — consumed, a divider, and
 * remaining — above a "Goal − Food = Left" strip. That was seven text
 * elements for four values, two of them printed twice, and the strip was the
 * ring written out in words. It also led with the wrong number: `consumed`
 * was the 28pt hero and `remaining` the 22pt afterthought, when remaining is
 * the one that answers "can I have this".
 *
 * So: one number in the ring, the one you act on, and a single quiet line of
 * context under it.
 */
export function CalorieSummary({ consumed, goal, size = 160 }: Props) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const strokeWidth = 14;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  // A goal of 0 would make every ratio below NaN and hand the arc an invalid
  // dash offset, so treat it as an empty ring rather than letting it render.
  const hasGoal = goal > 0;
  const over = hasGoal && consumed > goal;
  const remaining = goal - consumed;

  const firstLap = hasGoal ? Math.min(consumed / goal, 1) : 0;
  // Past the goal the ring starts a second lap rather than sitting full. The
  // old ring clamped at 1, so 2,340 of 2,000 drew exactly the same circle as
  // hitting 2,000 on the nose — only the numeral changed colour, and the one
  // state worth seeing at a glance was the one the ring couldn't show.
  const secondLap = over ? Math.min((consumed - goal) / goal, 1) : 0;

  const arcProps = {
    cx: size / 2,
    cy: size / 2,
    r: radius,
    strokeWidth,
    fill: 'none' as const,
    strokeLinecap: 'round' as const,
    strokeDasharray: circumference,
    rotation: '-90',
    origin: `${size / 2}, ${size / 2}`,
  };

  return (
    <View style={styles.wrapper}>
      <View style={[styles.container, { width: size, height: size }]}>
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={c.cardMuted}
            strokeWidth={strokeWidth}
            fill="none"
          />
          <Circle
            {...arcProps}
            stroke={over ? c.danger : c.primary}
            // The completed lap steps back so the overage on top of it reads
            // as the new information. strokeOpacity rather than a tinted
            // token: dangerSoft is tuned as a badge fill and nearly vanishes
            // at a 14pt stroke width.
            strokeOpacity={over ? 0.38 : 1}
            strokeDashoffset={circumference * (1 - firstLap)}
          />
          {over && (
            <Circle
              {...arcProps}
              stroke={c.danger}
              strokeDashoffset={circumference * (1 - secondLap)}
            />
          )}
        </Svg>
        <View style={[styles.center, { width: size, height: size }]}>
          <CountUp
            value={Math.abs(Math.round(remaining))}
            // Same separator as the line below it — one of these reading
            // "1420" next to the other reading "1,420" looks like a bug.
            format={(n) => n.toLocaleString()}
            style={[styles.heroValue, over && styles.overValue]}
          />
          <Text style={styles.heroLabel}>{over ? 'over' : 'left'}</Text>
        </View>
      </View>
      <Text style={styles.summary}>
        <Text style={styles.summaryNumber}>{Math.round(consumed).toLocaleString()}</Text>
        {' of '}
        <Text style={styles.summaryNumber}>{Math.round(goal).toLocaleString()}</Text>
        {' kcal'}
      </Text>
    </View>
  );
}

const makeStyles = (c: Theme) =>
  StyleSheet.create({
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
    heroValue: {
      ...type.hero(c),
      ...tabular,
      color: c.text,
    },
    heroLabel: {
      ...type.overline(c),
      color: c.textFaint,
      marginTop: space.xxs,
    },
    overValue: {
      color: c.danger,
    },
    summary: {
      ...type.caption(c),
      ...tabular,
      color: c.textMuted,
      marginTop: space.md,
    },
    summaryNumber: {
      fontFamily: c.fontDisplay,
      color: c.text,
    },
  });
