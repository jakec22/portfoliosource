import React from 'react';
import Svg, { Rect, Line, Text as SvgText } from 'react-native-svg';

interface Props {
  /** Bar values, oldest → newest. */
  values: number[];
  /** Labels aligned with values; only the endpoints are drawn. */
  labels: string[];
  color: string;
  /** Optional dashed reference line (e.g. a calorie goal). */
  goal?: number;
  /** Dim bars whose value is 0 (e.g. days with no data). */
  dimEmpty?: boolean;
}

const W = 320;
const H = 150;
const PAD_L = 40;
const PAD_R = 12;
const PAD_T = 14;
const PAD_B = 22;

function fmt(v: number): string {
  if (v >= 10000) return `${(v / 1000).toFixed(1)}k`;
  if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
  return String(Math.round(v));
}

// A lightweight SVG bar chart, styled to match ProgressLineChart /
// HeartRateGraph. Bars are evenly spaced; an optional dashed goal line and Y
// gridlines give the values context.
export function MiniBarChart({ values, labels, color, goal, dimEmpty }: Props) {
  if (values.length === 0) return null;

  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;

  const dataMax = Math.max(...values, goal ?? 0, 1);
  const yMax = Math.ceil((dataMax * 1.1) / 1) || 1;
  const y = (v: number) => PAD_T + (1 - v / yMax) * plotH;

  const n = values.length;
  const slot = plotW / n;
  const barW = Math.max(3, slot * 0.62);

  const gridValues = [yMax, Math.round(yMax / 2), 0];

  return (
    <Svg viewBox={`0 0 ${W} ${H}`} width="100%" height={184}>
      {gridValues.map((v, idx) => (
        <React.Fragment key={`${v}-${idx}`}>
          <Line x1={PAD_L} y1={y(v)} x2={W - PAD_R} y2={y(v)} stroke="#F3F4F6" strokeWidth={1} />
          <SvgText x={4} y={y(v) + 3} fontSize={9} fill="#9CA3AF">
            {fmt(v)}
          </SvgText>
        </React.Fragment>
      ))}

      {values.map((v, i) => {
        const cx = PAD_L + slot * i + slot / 2;
        const top = y(Math.max(0, v));
        const h = Math.max(0, y(0) - top);
        const faded = dimEmpty && v <= 0;
        return (
          <Rect
            key={i}
            x={cx - barW / 2}
            y={top}
            width={barW}
            height={h}
            rx={2}
            fill={color}
            opacity={faded ? 0.15 : 1}
          />
        );
      })}

      {goal != null && goal > 0 && goal <= yMax && (
        <Line
          x1={PAD_L}
          y1={y(goal)}
          x2={W - PAD_R}
          y2={y(goal)}
          stroke="#9CA3AF"
          strokeWidth={1}
          strokeDasharray="4 3"
        />
      )}

      <SvgText x={PAD_L} y={H - 6} fontSize={9} fill="#9CA3AF">
        {labels[0] ?? ''}
      </SvgText>
      {labels.length > 1 && (
        <SvgText x={W - PAD_R} y={H - 6} fontSize={9} fill="#9CA3AF" textAnchor="end">
          {labels[labels.length - 1]}
        </SvgText>
      )}
    </Svg>
  );
}
