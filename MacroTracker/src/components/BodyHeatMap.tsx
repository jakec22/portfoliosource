import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, Ellipse, Rect, G } from 'react-native-svg';
import type { SplitSlice } from '../utils/trainingSplit';
import { useTheme } from '../theme/useTheme';
import type { Theme } from '../theme';

interface Props {
  slices: SplitSlice[];
  /** Window the split covers, for the caption. */
  days: number;
}

// Regions the figure can actually show. Categories outside this set (Cardio,
// Full Body, Other) have no single place on the body, so they're surfaced as a
// note under the figure rather than silently dropped.
const BODY_CATEGORIES = ['Chest', 'Back', 'Shoulders', 'Arms', 'Core', 'Legs'] as const;
type BodyCategory = (typeof BODY_CATEGORIES)[number];

const VB_W = 104;
const VB_H = 208;

// Two-digit hex alpha for a 0–1 opacity.
function alphaHex(a: number): string {
  return Math.round(Math.max(0, Math.min(1, a)) * 255)
    .toString(16)
    .padStart(2, '0');
}

// Training volume as a body map: each muscle group is tinted by how much of
// the window's volume went to it, so neglected areas read at a glance in a way
// a donut's legend never does.
export function BodyHeatMap({ slices, days }: Props) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  const { fillFor, ranked, unplaced } = useMemo(() => {
    const byCat = new Map<string, number>();
    for (const s of slices) byCat.set(s.category, s.share);

    const placed = BODY_CATEGORIES.map((cat) => ({ cat, share: byCat.get(cat) ?? 0 }));
    const max = Math.max(...placed.map((p) => p.share), 0);

    // Intensity is relative to the most-trained group, not to 100% — an even
    // split would otherwise render as uniformly faint.
    const fill = (cat: BodyCategory): string => {
      const share = byCat.get(cat) ?? 0;
      if (share <= 0 || max <= 0) return c.cardMuted;
      return `${c.primary}${alphaHex(0.18 + 0.82 * (share / max))}`;
    };

    return {
      fillFor: fill,
      ranked: [...placed].filter((p) => p.share > 0).sort((a, b) => b.share - a.share),
      unplaced: slices.filter((s) => !BODY_CATEGORIES.includes(s.category as BodyCategory)),
    };
  }, [slices, c]);

  const untrained = BODY_CATEGORIES.filter((cat) => !ranked.some((r) => r.cat === cat));
  const neutral = c.borderStrong;

  return (
    <View>
      <View style={styles.figures}>
        {/* ── Front ── */}
        <View style={styles.figureWrap}>
          <Svg width="100%" height={168} viewBox={`0 0 ${VB_W} ${VB_H}`}>
            <G>
              <Circle cx={52} cy={17} r={11} fill={neutral} />
              <Rect x={47} y={27} width={10} height={7} fill={neutral} />

              {/* Shoulders */}
              <Ellipse cx={28} cy={45} rx={11} ry={8.5} fill={fillFor('Shoulders')} />
              <Ellipse cx={76} cy={45} rx={11} ry={8.5} fill={fillFor('Shoulders')} />

              {/* Chest */}
              <Rect x={34} y={37} width={17} height={22} rx={6} fill={fillFor('Chest')} />
              <Rect x={53} y={37} width={17} height={22} rx={6} fill={fillFor('Chest')} />

              {/* Arms (biceps/forearms) */}
              <Rect x={17} y={53} width={11} height={44} rx={5.5} fill={fillFor('Arms')} />
              <Rect x={76} y={53} width={11} height={44} rx={5.5} fill={fillFor('Arms')} />

              {/* Core */}
              <Rect x={36} y={61} width={32} height={36} rx={7} fill={fillFor('Core')} />

              {/* Legs */}
              <Rect x={35} y={100} width={15} height={68} rx={7} fill={fillFor('Legs')} />
              <Rect x={54} y={100} width={15} height={68} rx={7} fill={fillFor('Legs')} />
              <Rect x={36} y={171} width={13} height={26} rx={6} fill={fillFor('Legs')} />
              <Rect x={55} y={171} width={13} height={26} rx={6} fill={fillFor('Legs')} />
            </G>
          </Svg>
          <Text style={styles.figureLabel}>Front</Text>
        </View>

        {/* ── Back ── */}
        <View style={styles.figureWrap}>
          <Svg width="100%" height={168} viewBox={`0 0 ${VB_W} ${VB_H}`}>
            <G>
              <Circle cx={52} cy={17} r={11} fill={neutral} />
              <Rect x={47} y={27} width={10} height={7} fill={neutral} />

              {/* Rear delts */}
              <Ellipse cx={28} cy={45} rx={11} ry={8.5} fill={fillFor('Shoulders')} />
              <Ellipse cx={76} cy={45} rx={11} ry={8.5} fill={fillFor('Shoulders')} />

              {/* Traps + lats */}
              <Rect x={36} y={35} width={32} height={16} rx={6} fill={fillFor('Back')} />
              <Rect x={34} y={49} width={36} height={30} rx={8} fill={fillFor('Back')} />

              {/* Triceps */}
              <Rect x={17} y={53} width={11} height={44} rx={5.5} fill={fillFor('Arms')} />
              <Rect x={76} y={53} width={11} height={44} rx={5.5} fill={fillFor('Arms')} />

              {/* Lower back */}
              <Rect x={38} y={80} width={28} height={17} rx={6} fill={fillFor('Core')} />

              {/* Glutes + hamstrings + calves */}
              <Rect x={35} y={99} width={33} height={20} rx={8} fill={fillFor('Legs')} />
              <Rect x={35} y={121} width={15} height={47} rx={7} fill={fillFor('Legs')} />
              <Rect x={54} y={121} width={15} height={47} rx={7} fill={fillFor('Legs')} />
              <Rect x={36} y={171} width={13} height={26} rx={6} fill={fillFor('Legs')} />
              <Rect x={55} y={171} width={13} height={26} rx={6} fill={fillFor('Legs')} />
            </G>
          </Svg>
          <Text style={styles.figureLabel}>Back</Text>
        </View>

        {/* Ranked list beside the figures — the figure shows where, this says
            how much, so neither has to carry both jobs. */}
        <View style={styles.rankList}>
          {ranked.map((r) => (
            <View key={r.cat} style={styles.rankRow}>
              <View
                style={[styles.swatch, { backgroundColor: fillFor(r.cat as BodyCategory) }]}
              />
              <Text style={styles.rankName} numberOfLines={1}>
                {r.cat}
              </Text>
              <Text style={styles.rankPct}>{Math.round(r.share * 100)}%</Text>
            </View>
          ))}
          {untrained.length > 0 && (
            <Text style={styles.untrained}>
              Untrained: {untrained.join(', ')}
            </Text>
          )}
        </View>
      </View>

      <Text style={styles.caption}>
        Share of the last {days} days' volume
        {unplaced.length > 0 &&
          ` · ${unplaced.map((u) => u.category).join(', ')} not shown on the figure`}
      </Text>
    </View>
  );
}

const makeStyles = (c: Theme) =>
  StyleSheet.create({
    figures: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
    figureWrap: { width: 72, alignItems: 'center' },
    figureLabel: {
      fontSize: 10.5,
      color: c.textFaint,
      marginTop: 2,
      fontFamily: c.fontBody,
    },

    rankList: { flex: 1, gap: 5, paddingTop: 4, paddingLeft: 4 },
    rankRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
    swatch: {
      width: 10,
      height: 10,
      borderRadius: 3,
      borderWidth: 1,
      borderColor: c.border,
    },
    rankName: { flex: 1, fontSize: 12.5, color: c.text, fontFamily: c.fontBody },
    rankPct: {
      fontSize: 12.5,
      color: c.textMuted,
      fontFamily: c.fontBodyBold,
      fontVariant: ['tabular-nums'],
    },
    untrained: {
      fontSize: 11,
      color: c.textFaint,
      marginTop: 4,
      lineHeight: 15,
      fontFamily: c.fontBody,
    },

    caption: {
      fontSize: 11,
      color: c.textFaint,
      marginTop: 10,
      lineHeight: 15,
      fontFamily: c.fontBody,
    },
  });
