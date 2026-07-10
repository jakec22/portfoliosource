// One flexible category: name + hint, spent / cap, progress bar, and the
// remaining-or-over line with the baseline (June) actual for context.

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText, Card } from './ui';
import { ProgressBar } from './ProgressBar';
import { Colors, Type } from '../theme/theme';
import { fmtCents, fmtWhole } from '../lib/money';
import type { CategoryProgress } from '../lib/budget';
import { PLAN } from '../data/seed';

// Status by tone (grayscale): dim when there's room, brighter as the bar fills,
// full white when over the cap.
const STATUS_COLOR = {
  ok: Colors.toneOk,
  near: Colors.toneNear,
  over: Colors.toneOver,
} as const;

export function CategoryRow({ progress }: { progress: CategoryProgress }) {
  const { category, cap, spent, fraction, remaining, status } = progress;
  const barColor = STATUS_COLOR[status];
  const over = status === 'over';

  const pctOfCap = cap > 0 ? Math.round((spent / cap) * 100) : spent > 0 ? 100 : 0;
  const a11yLabel = `${category.name}, ${fmtCents(spent)} of ${fmtWhole(cap)} cap, ${pctOfCap} percent`;

  return (
    <Card style={styles.card} accessible accessibilityLabel={a11yLabel}>
      <View style={styles.topRow}>
        <View style={styles.nameWrap}>
          <AppText style={styles.name} numberOfLines={1}>
            {category.name}
          </AppText>
          <AppText style={styles.hint} numberOfLines={1}>
            {category.hint}
          </AppText>
        </View>
        <AppText
          mono
          numberOfLines={1}
          style={[styles.amount, over && styles.amountOver]}
        >
          {fmtCents(spent)} <AppText mono style={styles.cap}>/ {fmtWhole(cap)}</AppText>
        </AppText>
      </View>

      <ProgressBar fraction={fraction} color={barColor} />

      <View style={styles.bottomRow}>
        <AppText style={[styles.foot, over && styles.footOver]}>
          {over ? `${fmtCents(-remaining)} over cap` : `${fmtCents(remaining)} left`}
        </AppText>
        <AppText mono style={styles.foot}>
          {PLAN.baselineLabel} actual: {fmtWhole(category.baselineActual)}
        </AppText>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  nameWrap: {
    flexShrink: 1,
    minWidth: 0,
    paddingRight: 8,
  },
  name: {
    fontSize: 14,
    fontWeight: Type.weightMedium,
    letterSpacing: 0.1,
    color: Colors.text,
  },
  hint: {
    fontSize: 11,
    color: Colors.textFaint,
    marginTop: 3,
  },
  amount: {
    fontSize: 13,
    flexShrink: 0,
    color: Colors.textSecondary,
  },
  amountOver: {
    color: Colors.toneOver,
    fontWeight: Type.weightSemibold,
  },
  cap: {
    color: Colors.textFaint,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  foot: {
    fontSize: 10.5,
    color: Colors.textFaint,
  },
  footOver: {
    color: Colors.textSecondary,
  },
});
