import React from 'react';
import Svg, { Polyline, Circle } from 'react-native-svg';

interface Props {
  values: number[]; // oldest → newest
  color: string;
  width?: number;
  height?: number;
}

// A tiny axis-less trend line for inline progress cards. Renders a flat midline
// dot when there's only one data point.
export function Sparkline({ values, color, width = 76, height = 30 }: Props) {
  const pad = 3;
  const w = width - pad * 2;
  const h = height - pad * 2;

  if (values.length === 0) return <Svg width={width} height={height} />;

  if (values.length === 1) {
    return (
      <Svg width={width} height={height}>
        <Circle cx={width / 2} cy={height / 2} r={2.5} fill={color} />
      </Svg>
    );
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;

  const points = values
    .map((v, i) => {
      const x = pad + (i / (values.length - 1)) * w;
      const y = pad + (1 - (v - min) / span) * h;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  // Highlight the most recent point.
  const lastX = pad + w;
  const lastY = pad + (1 - (values[values.length - 1] - min) / span) * h;

  return (
    <Svg width={width} height={height}>
      <Polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <Circle cx={lastX} cy={lastY} r={2.5} fill={color} />
    </Svg>
  );
}
