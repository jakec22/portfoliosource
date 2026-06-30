import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Sparkline } from './Sparkline';
import { formatDuration } from '../utils/duration';
import type { ProgressCard } from '../utils/exerciseHistory';
import { useTheme } from '../theme/useTheme';
import type { Theme } from '../theme';

function fmt(card: ProgressCard, v: number): string {
  return card.isTime
    ? formatDuration(v)
    : `${Math.round(v)}${card.unit ? ` ${card.unit}` : ''}`;
}

// One exercise's progress at a glance: headline metric, change since last
// session, and an inline sparkline. Tappable to open the full progress chart.
export function ProgressCardRow({
  card,
  onPress,
}: {
  card: ProgressCard;
  onPress: () => void;
}) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  const delta = card.previous != null ? card.latest - card.previous : 0;
  const showDelta = card.previous != null && delta !== 0;
  const up = delta > 0;
  const deltaStr =
    (up ? '+' : '−') +
    (card.isTime
      ? formatDuration(Math.abs(delta))
      : `${Math.round(Math.abs(delta))}${card.unit ? ` ${card.unit}` : ''}`);

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.left}>
        <Text style={styles.name} numberOfLines={1}>
          {card.name}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {card.metricLabel} · {fmt(card, card.latest)}
          {showDelta && (
            <Text style={{ color: up ? c.primaryDark : c.danger }}>{`   ${deltaStr}`}</Text>
          )}
        </Text>
      </View>
      <Sparkline values={card.values} color={c.primary} />
      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
  );
}

const makeStyles = (c: Theme) =>
  StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.border,
      paddingVertical: 12,
      paddingHorizontal: 14,
      marginBottom: 8,
      gap: 10,
    },
    left: { flex: 1 },
    name: { fontSize: 15, fontWeight: '700', color: c.text },
    meta: { fontSize: 12.5, color: c.textMuted, marginTop: 2 },
    chevron: { fontSize: 22, color: c.textFaint, marginLeft: 2 },
  });
