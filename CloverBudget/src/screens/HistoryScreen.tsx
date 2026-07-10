import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText, Card, Eyebrow } from '../components/ui';
import { Colors, Metrics, Type } from '../theme/theme';
import { fmtCents, fmtWhole } from '../lib/money';
import { monthLabel } from '../lib/dates';
import { useBudget } from '../store/useBudget';
import type { MonthRecord } from '../types';

export function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const { state } = useBudget();
  const { history } = state;

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{
        paddingTop: insets.top + 20,
        paddingBottom: insets.bottom + 40,
        paddingHorizontal: 20,
      }}
    >
      <View style={styles.headerBlock}>
        <Eyebrow>History</Eyebrow>
        <AppText style={styles.h1}>Past months</AppText>
      </View>

      {history.length === 0 ? (
        <Card style={styles.empty}>
          <AppText style={styles.emptyText}>
            No months rolled over yet. When you tap “Start new month” on the dashboard, the finished
            month lands here with its totals and savings.
          </AppText>
        </Card>
      ) : (
        history.map((m) => <HistoryRow key={m.month} record={m} />)
      )}
    </ScrollView>
  );
}

function HistoryRow({ record }: { record: MonthRecord }) {
  const over = record.totalSpent > record.totalCap;
  const diff = record.totalCap - record.totalSpent; // positive = under
  const savedPositive = record.savings >= 0;

  return (
    <Card style={styles.card}>
      <View style={styles.cardTop}>
        <AppText style={styles.month}>{monthLabel(record.month)}</AppText>
        <View style={styles.phasePill}>
          <AppText style={styles.phasePillText}>Phase {record.phase}</AppText>
        </View>
      </View>

      <View style={styles.statRow}>
        <AppText style={styles.statLabel}>Spent</AppText>
        <AppText mono style={styles.statValue}>
          {fmtCents(record.totalSpent)} <AppText mono style={styles.statCap}>/ {fmtWhole(record.totalCap)}</AppText>
        </AppText>
      </View>

      <View style={styles.statRow}>
        <AppText style={styles.statLabel}>{over ? 'Over cap' : 'Under cap'}</AppText>
        <AppText mono style={[styles.statValue, over && styles.statValueStrong]}>
          {over ? '−' : '+'}
          {fmtCents(Math.abs(diff))}
        </AppText>
      </View>

      <View style={[styles.statRow, styles.savingsRow]}>
        <AppText style={styles.savingsLabel}>Savings achieved</AppText>
        <AppText mono style={[styles.savingsValue, !savedPositive && styles.savingsValueNegative]}>
          {savedPositive ? '' : '−'}
          {fmtCents(Math.abs(record.savings))}
        </AppText>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  headerBlock: {
    width: '100%',
    maxWidth: Metrics.maxWidth,
    alignSelf: 'center',
    marginBottom: 16,
  },
  h1: {
    fontSize: 27,
    fontWeight: Type.weightLight,
    letterSpacing: Type.displayTracking,
    color: Colors.text,
    marginTop: 6,
  },
  empty: {
    padding: 16,
    maxWidth: Metrics.maxWidth,
    alignSelf: 'center',
    width: '100%',
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 21,
    color: Colors.textMuted,
  },
  card: {
    padding: 16,
    marginBottom: 12,
    width: '100%',
    maxWidth: Metrics.maxWidth,
    alignSelf: 'center',
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  month: {
    fontSize: 17,
    fontWeight: Type.weightMedium,
    letterSpacing: 0.1,
    color: Colors.text,
  },
  phasePill: {
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    borderRadius: 6,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  phasePillText: {
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: Colors.textMuted,
    fontWeight: Type.weightSemibold,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingVertical: 5,
  },
  statLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  statValue: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  statValueStrong: {
    color: Colors.warning,
    fontWeight: Type.weightSemibold,
  },
  statCap: {
    color: Colors.textFaint,
  },
  savingsRow: {
    marginTop: 6,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  savingsLabel: {
    fontSize: 11,
    letterSpacing: Type.eyebrowTracking,
    textTransform: 'uppercase',
    fontWeight: Type.weightSemibold,
    color: Colors.textMuted,
  },
  savingsValue: {
    fontSize: 19,
    fontWeight: Type.weightLight,
    letterSpacing: Type.displayTracking,
    color: Colors.text,
  },
  savingsValueNegative: {
    color: Colors.warning,
  },
});
