import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText, Card, Eyebrow, SectionLabel } from '../components/ui';
import { EditablePlanList } from '../components/EditablePlanList';
import { Colors, Metrics, Type } from '../theme/theme';
import { fmtCents, fmtWhole } from '../lib/money';
import { EXCLUDED_FROM_PLAN, PHASE_RULE } from '../data/seed';
import { useBudget } from '../store/useBudget';

export function AboutScreen() {
  const insets = useSafeAreaInsets();
  const { state, addPlanItem, removePlanItem } = useBudget();
  const { fixedCosts, recurringIncome, subscriptions } = state;

  const subsTotal = subscriptions.reduce((s, x) => s + x.amount, 0);
  const fixedTotal = fixedCosts.reduce((s, x) => s + x.amount, 0);
  const incomeTotal = recurringIncome.reduce((s, x) => s + x.amount, 0);

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
            the caps by $500 so the month ends with $500 saved. Fixed costs, income, and
            subscriptions below are reference only — not tracked against your caps — and are
            yours to edit, so this plan works for any family, not just one.
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
        <EditablePlanList
          items={fixedCosts}
          namePlaceholder="Fixed cost name"
          onAdd={(input) => addPlanItem('fixedCosts', input)}
          onRemove={(id) => removePlanItem('fixedCosts', id)}
        />

        <SectionLabel style={styles.section}>Recurring income</SectionLabel>
        <EditablePlanList
          items={recurringIncome}
          namePlaceholder="Income source"
          onAdd={(input) => addPlanItem('recurringIncome', input)}
          onRemove={(id) => removePlanItem('recurringIncome', id)}
        />

        <View style={styles.subsHeader}>
          <SectionLabel style={styles.section}>Subscriptions</SectionLabel>
          <AppText mono style={styles.subsTotal}>
            {fmtCents(subsTotal)}/mo
          </AppText>
        </View>
        <EditablePlanList
          items={subscriptions}
          cents
          namePlaceholder="Subscription name"
          onAdd={(input) => addPlanItem('subscriptions', input)}
          onRemove={(id) => removePlanItem('subscriptions', id)}
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
    fontSize: 27,
    fontWeight: Type.weightLight,
    letterSpacing: Type.displayTracking,
    color: Colors.text,
    marginTop: 6,
  },
  intro: {
    fontSize: 14,
    lineHeight: 22,
    color: Colors.textMuted,
    marginTop: 12,
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
    fontSize: 10,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    fontWeight: Type.weightSemibold,
  },
  calloutValue: {
    fontSize: 23,
    fontWeight: Type.weightLight,
    letterSpacing: Type.displayTracking,
    color: Colors.text,
    marginTop: 8,
  },
  section: {
    marginTop: 22,
  },
  listDivider: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  subsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  subsTotal: {
    fontSize: 12,
    color: Colors.textSecondary,
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
