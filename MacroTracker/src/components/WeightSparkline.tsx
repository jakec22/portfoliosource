import React, { useMemo } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import type { WeightSummary } from '../utils/analytics';
import { parseDate } from '../utils/date';
import { useTheme } from '../theme/useTheme';

interface Props {
  summary: WeightSummary;
  /** Days the x-axis spans, so gaps in logging show as gaps. */
  days: number;
  height?: number;
}

const VIEW_W = 326;
const PAD_Y = 6;

/**
 * The month's weight trend, small enough to sit inside the Profile card.
 *
 * Two marks doing different jobs. The line is the trailing seven-day mean —
 * the signal, and the figure the adaptive goals already act on. The dots are
 * the raw readings, kept because leaving them out would be a chart that
 * claims more certainty than the scale has: the spread of the dots around the
 * line is the point, not noise to be tidied away.
 *
 * Positioned by date rather than by index, so a week with two weigh-ins takes
 * up a week of width. Spacing readings evenly would draw a gap in logging as
 * a steady decline.
 *
 * Deliberately not ProgressLineChart: that one is 150pt with axis labels and
 * a y-scale, which is right for the full-screen trends view and far too much
 * inside a card that also holds an input and a button.
 */
export function WeightSparkline({ summary, days, height = 64 }: Props) {
  const c = useTheme();
  const { points, smoothed } = summary;

  const geom = useMemo(() => {
    const dayOf = (d: string) => parseDate(d).getTime() / 86400000;
    const lastDay = dayOf(points[points.length - 1].date);
    const firstDay = lastDay - (days - 1);
    const span = Math.max(1, lastDay - firstDay);

    // One flat series decides the y-scale, so the dots and the line cannot
    // drift apart: a dot outside the line's range would otherwise clip.
    const all = [...points.map((p) => p.lbs), ...smoothed];
    const min = Math.min(...all);
    const max = Math.max(...all);
    const range = max - min || 1;

    const x = (d: string) => ((dayOf(d) - firstDay) / span) * VIEW_W;
    const y = (v: number) => height - PAD_Y - ((v - min) / range) * (height - PAD_Y * 2);

    const line = smoothed
      .map((v, i) => `${i ? 'L' : 'M'}${x(points[i].date).toFixed(1)},${y(v).toFixed(1)}`)
      .join('');

    return {
      line,
      dots: points.map((p, i) => ({ cx: x(p.date), cy: y(p.lbs), key: `${p.date}-${i}` })),
      endX: x(points[points.length - 1].date),
      endY: y(smoothed[smoothed.length - 1]),
    };
  }, [points, smoothed, days, height]);

  return (
    <View style={{ height }}>
      <Svg width="100%" height={height} viewBox={`0 0 ${VIEW_W} ${height}`}>
        {geom.dots.map((d) => (
          <Circle key={d.key} cx={d.cx} cy={d.cy} r={2} fill={c.textFaint} />
        ))}
        {/* One reading draws no line — there is no trend yet to draw. */}
        {points.length > 1 && (
          <Path
            d={geom.line}
            fill="none"
            stroke={c.info}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
        <Circle cx={geom.endX} cy={geom.endY} r={4} fill={c.info} />
      </Svg>
    </View>
  );
}
