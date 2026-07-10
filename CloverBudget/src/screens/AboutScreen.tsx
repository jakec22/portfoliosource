import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText, Card, Eyebrow, SectionLabel } from '../components/ui';
import { Colors, Metrics } from '../theme/theme';
import { fmtCents, fmtWhole } from '../lib/money';
import {
  EXCLUDED_FROM_PLAN,
  FIXED_COSTS,
  PHASE_RULE,
  RECURRING_INCOME,
  SUBSCRIPTIONS,
} from '../data/seed';
import type { NamedAmount } from '../types';

function AmountList({ items, cents = false }: { items: NamedAmount[]; cents?: boolean }) {
  return (
    <Card style={styles.listCard}>
      {items.map((f, i) => (
        <View
          key={f.name}
          style={[styles.listRow, i < items.length - 1 && styles.listDivider]}
        >
          <AppText style={styles.listName} numberOfLines={1}>
            {f.name}
          </AppText>
          <AppText mono style={styles.listAmount} numberOfLines={1}>
            {cents ? fmtCents(f.amount) : fmtWhole(f.amount)}
          </AppText>
        </View>
      ))}
    </Card>
  );
}

export function AboutScreen() {
  const insets = useSafeAreaInsets();
  const subsTotal = SUBSCRIPTIONS.reduce((s, x) => s + x.monthlyCost, 0);
  const fixedTotal = FIXED_COSTS.reduce((s, x) => s + x.amount, 0);
  const incomeTotal = RECURRING_INCOME.reduce((s, x) => s + x.amount, 0);

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{
        paddingTop: insets.top + 20,
        paddingBottom: insets.bottom + 40,
        paddingHorizontal: 20,
      }}
    >
      <View style={styles.inner}>
        <View style={styles.headerBlock}>
          <Eyebrow>About the plan</Eyebrow>
          <AppText style={styles.h1}>The Clover budget</AppText>
          <AppText style={styles.intro}>
            Two phases toward the same goal. Phase 1 holds spending to breakeven; Phase 2 tightens
            the caps by $500 so the month ends with $500 saved. Fixed costs and income below are for
            reference — they aren’t tracked in the app.
          </AppText>
        </View>

        <View style={styles.calloutRow}>
          <Card style={styles.calloutCard}>
            <AppText style={styles.calloutLabel}>Income (avg / mo)</AppText>
            <AppText mono style={styles.calloutValue}>
              {fmtWhole(incomeTotal)}
            </AppText>
          </Card>
          <Card style={styles.calloutCard}>
            <AppText style={styles.calloutLabel}>Fixed costs</AppText>
            <AppText mono style={styles.calloutValue}>
              {fmtWhole(fixedTotal)}
            </AppText>
          </Card>
        </View>

        <SectionLabel style={styles.section}>Fixed costs (not tracked)</SectionLabel>
        <AmountList items={FIXED_COSTS} />

        <SectionLabel style={styles.section}>Recurring income</SectionLabel>
        <AmountList items={RECURRING_INCOME} />

        <View style={styles.subsHeader}>
          <SectionLabel style={styles.section}>Subscriptions</SectionLabel>
          <AppText mono style={styles.subsTotal}>
            {fmtCents(subsTotal)}/mo
          </AppText>
        </View>
        <AmountList
          items={SUBSCRIPTIONS.map((s) => ({ name: s.name, amount: s.monthlyCost }))}
          cents
        />

        <SectionLabel style={styles.section}>When to switch phases</SectionLabel>
        <Card style={styles.noteCard}>
          <AppText style={styles.noteText}>{PHASE_RULE}</AppText>
        </Card>

        <SectionLabel style={styles.section}>Not part of the plan</SectionLabel>
        <Card style={styles.noteCard}>
          {EXCLUDED_FROM_PLAN.map((line, i) => (
            <View key={line} style={[styles.excludedRow, i < EXCLUDED_FROM_PLAN.length - 1 && styles.listDivider]}>
              <AppText style={styles.excludedText}>{line}</AppText>
            </View>
          ))}
        </Card>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  inner: {
    width: '100%',
    maxWidth: Metrics.maxWidth,
    alignSelf: 'center',
  },
  headerBlock: {
    marginBottom: 16,
  },
  h1: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.text,
    marginTop: 4,
  },
  intro: {
    fontSize: 14,
    lineHeight: 21,
    color: Colors.textMuted,
    marginTop: 10,
  },
  calloutRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
  },
  calloutCard: {
    flex: 1,
    padding: 14,
  },
  calloutLabel: {
    fontSize: 11,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  calloutValue: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
    marginTop: 6,
  },
  section: {
    marginTop: 22,
  },
  listCard: {
    paddingHorizontal: 14,
    paddingVertical: 2,
  },
  listRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  listDivider: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  listName: {
    fontSize: 13,
    color: Colors.textSecondary,
    flexShrink: 1,
    minWidth: 0,
    paddingRight: 10,
  },
  listAmount: {
    fontSize: 13,
    color: Colors.textMuted,
    flexShrink: 0,
  },
  subsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  subsTotal: {
    fontSize: 12,
    color: Colors.green,
    marginTop: 22,
  },
  noteCard: {
    padding: 14,
  },
  noteText: {
    fontSize: 13,
    lineHeight: 20,
    color: Colors.textSecondary,
  },
  excludedRow: {
    paddingVertical: 9,
  },
  excludedText: {
    fontSize: 13,
    color: Colors.textMuted,
  },
});
