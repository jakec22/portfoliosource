// One flexible category: name + hint, spent / cap, progress bar, and the
// remaining-or-over line with the baseline (June) actual for context. Tapping
// the card expands a list of every purchase logged in that category this
// month; tapping a purchase opens it for editing (see EditEntryModal).

import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText, Card } from './ui';
import { ProgressBar } from './ProgressBar';
import { Colors, Type } from '../theme/theme';
import { fmtCents, fmtWhole } from '../lib/money';
import type { CategoryProgress } from '../lib/budget';
import { PLAN } from '../data/seed';
import type { Entry } from '../types';

// Status: grayscale by tone while under cap (dim → mid as it fills), then a
// muted terracotta once over the cap — the one place any hue appears.
const STATUS_COLOR = {
  ok: Colors.toneOk,
  near: Colors.toneNear,
  over: Colors.warning,
} as const;

interface CategoryRowProps {
  progress: CategoryProgress;
  entries: Entry[];
  expanded: boolean;
  onToggle: () => void;
  onSelectEntry: (entry: Entry) => void;
}

export function CategoryRow({ progress, entries, expanded, onToggle, onSelectEntry }: CategoryRowProps) {
  const { category, cap, spent, fraction, remaining, status } = progress;
  const barColor = STATUS_COLOR[status];
  const over = status === 'over';

  const pctOfCap = cap > 0 ? Math.round((spent / cap) * 100) : spent > 0 ? 100 : 0;
  const a11yLabel = `${category.name}, ${fmtCents(spent)} of ${fmtWhole(cap)} cap, ${pctOfCap} percent`;

  return (
    <Card style={styles.card}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityLabel={a11yLabel}
        accessibilityState={{ expanded }}
        style={styles.pressable}
      >
        <View style={styles.topRow}>
          <View style={styles.nameWrap}>
            <AppText style={styles.name} numberOfLines={1}>
              {category.name}
            </AppText>
            <AppText style={styles.hint} numberOfLines={1}>
              {category.hint}
            </AppText>
          </View>
          <View style={styles.amountWrap}>
            <AppText mono numberOfLines={1} style={[styles.amount, over && styles.amountOver]}>
              {fmtCents(spent)} <AppText mono style={styles.cap}>/ {fmtWhole(cap)}</AppText>
            </AppText>
            <AppText style={styles.chevron}>{expanded ? '⌃' : '⌄'}</AppText>
          </View>
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
      </Pressable>

      {expanded && (
        <View style={styles.entryList}>
          {entries.length === 0 ? (
            <AppText style={styles.empty}>No purchases logged in {category.name} yet.</AppText>
          ) : (
            entries.map((e, i) => (
              <Pressable
                key={e.id}
                onPress={() => onSelectEntry(e)}
                accessibilityRole="button"
                accessibilityLabel={`Edit ${e.note || category.name} purchase, ${fmtCents(e.amount)}`}
                style={[styles.entryRow, i > 0 && styles.entryDivider]}
              >
                <AppText mono style={styles.entryDate}>
                  {e.date.slice(5)}
                </AppText>
                <AppText style={styles.entryNote} numberOfLines={1}>
                  {e.note || category.name}
                </AppText>
                <AppText mono style={styles.entryAmount}>
                  {fmtCents(e.amount)}
                </AppText>
              </Pressable>
            ))
          )}
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 10,
  },
  pressable: {
    paddingHorizontal: 14,
    paddingVertical: 12,
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
  amountWrap: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    flexShrink: 0,
  },
  amount: {
    fontSize: 13,
    flexShrink: 0,
    color: Colors.textSecondary,
  },
  amountOver: {
    color: Colors.warning,
    fontWeight: Type.weightSemibold,
  },
  cap: {
    color: Colors.textFaint,
  },
  chevron: {
    fontSize: 12,
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
    color: Colors.warning,
  },
  entryList: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingHorizontal: 14,
  },
  empty: {
    fontSize: 12,
    color: Colors.textFaint,
    paddingVertical: 12,
  },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
  },
  entryDivider: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  entryDate: {
    fontSize: 11,
    color: Colors.textFaint,
    flexShrink: 0,
  },
  entryNote: {
    flex: 1,
    minWidth: 0,
    fontSize: 13,
    color: Colors.textSecondary,
  },
  entryAmount: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text,
    flexShrink: 0,
  },
});
