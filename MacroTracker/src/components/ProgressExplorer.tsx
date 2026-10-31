import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { ProgressLineChart } from './ProgressLineChart';
import type { ProgressHighlight } from '../utils/exerciseHistory';
import { formatDuration } from '../utils/duration';
import { useTheme } from '../theme/useTheme';
import type { Theme } from '../theme';
import { radius, space, type } from '../theme/tokens';

interface Props {
  highlights: ProgressHighlight[];
  onOpen?: (name: string) => void;
}

function fmtValue(h: ProgressHighlight, v: number): string {
  if (h.isTime) return formatDuration(v);
  return `${Math.round(v)}${h.unit ? ` ${h.unit}` : ''}`;
}

// One chart, one exercise at a time, with the notable lifts as chips above it.
// Replaces the old side-by-side "Recent PRs" and "Top movers" lists, which
// showed the same exercises twice — here a record is a badge on a chip, and
// the chart carries the detail for whichever lift you're looking at.
export function ProgressExplorer({ highlights, onOpen }: Props) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  // Fall back to the first highlight so there's always a chart, and recover if
  // the selected exercise drops out of the list after a new workout.
  const selected =
    highlights.find((h) => h.key === selectedKey) ?? highlights[0] ?? null;
  if (!selected) return null;

  const delta =
    selected.previous != null ? selected.latest - selected.previous : null;
  const up = (delta ?? 0) > 0;
  const labels = selected.values.map((_, i) =>
    i === 0 ? `${selected.values.length} sessions` : 'now'
  );

  return (
    <View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
      >
        {highlights.map((h) => {
          const active = h.key === selected.key;
          return (
            <TouchableOpacity
              key={h.key}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => setSelectedKey(h.key)}
              activeOpacity={0.7}
            >
              <Text
                style={[styles.chipText, active && styles.chipTextActive]}
                numberOfLines={1}
              >
                {h.name}
              </Text>
              {h.prLabel && <View style={[styles.prDot, active && styles.prDotActive]} />}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <TouchableOpacity
        activeOpacity={onOpen ? 0.7 : 1}
        onPress={() => onOpen?.(selected.name)}
      >
        <View style={styles.headline}>
          <View style={styles.headlineLeft}>
            <Text style={styles.metricLabel}>{selected.metricLabel}</Text>
            <Text style={styles.metricValue}>{fmtValue(selected, selected.latest)}</Text>
          </View>
          <View style={styles.headlineRight}>
            {selected.prLabel && (
              <View style={styles.prBadge}>
                <Text style={styles.prBadgeText}>{selected.prLabel} PR</Text>
              </View>
            )}
            {delta != null && delta !== 0 && (
              <Text style={[styles.delta, { color: up ? c.primaryDark : c.danger }]}>
                {up ? '+' : '−'}
                {fmtValue(selected, Math.abs(delta))}
              </Text>
            )}
          </View>
        </View>

        <ProgressLineChart
          values={selected.values}
          labels={labels}
          color={c.primary}
          markLast={!!selected.prLabel}
        />
      </TouchableOpacity>
    </View>
  );
}

const makeStyles = (c: Theme) =>
  StyleSheet.create({
    chips: { gap: space.sm, paddingBottom: space.lg, paddingRight: space.xs },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.xs,
      paddingVertical: space.sm,
      paddingHorizontal: space.md,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.cardMuted,
      maxWidth: 190,
    },
    chipActive: { backgroundColor: c.primary, borderColor: c.primary },
    chipText: { ...type.caption(c), fontFamily: c.fontBody, color: c.textMuted, flexShrink: 1 },
    chipTextActive: { color: c.onPrimary, fontFamily: c.fontBodyBold },
    // A dot rather than the word "PR" — the chip row stays scannable, and the
    // badge in the headline spells it out for whichever chip is selected.
    prDot: { width: 6, height: 6, borderRadius: radius.pill, backgroundColor: c.primary },
    prDotActive: { backgroundColor: c.onPrimary },

    headline: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      gap: space.md,
      marginBottom: space.xxs,
    },
    headlineLeft: { flexShrink: 1 },
    headlineRight: { alignItems: 'flex-end', gap: space.xs },
    metricLabel: { ...type.caption(c), fontFamily: c.fontBody, color: c.textMuted },
    metricValue: {
      ...type.title(c),
      color: c.text,
      fontVariant: ['tabular-nums'],
    },
    delta: { ...type.bodyStrong(c), fontVariant: ['tabular-nums'] },
    prBadge: {
      backgroundColor: c.primarySoft,
      borderRadius: radius.pill,
      paddingVertical: space.xs,
      paddingHorizontal: space.sm,
    },
    prBadgeText: { ...type.micro(c), fontFamily: c.fontBodyBold, color: c.primaryDark },
  });
