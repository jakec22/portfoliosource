// Cloud-synced dashboard. Trimmed from the offline app's DashboardScreen:
// no import-a-statement button, no history rollover — this prototype only
// proves that the current month's entries + phase sync live across devices.
// See CLAUDE.md for the full scope cut.

import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText, Card, Eyebrow, SectionLabel } from '../components/ui';
import { RunwayBar } from '../components/RunwayBar';
import { PhaseSwitcher } from '../components/PhaseSwitcher';
import { LogPurchase } from '../components/LogPurchase';
import { CategoryRow } from '../components/CategoryRow';
import { Colors, Metrics, Type } from '../theme/theme';
import { CATEGORIES } from '../data/seed';
import {
  categoryProgress,
  computePace,
  totalCap as sumCap,
  totalSpent as sumSpent,
} from '../lib/budget';
import { fmtCents, fmtWhole } from '../lib/money';
import { monthPosition } from '../lib/dates';
import { useBudget } from '../store/useBudget';

export function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const { activePhase, entries, saveState, addEntry, removeEntry, setPhase, signOut } = useBudget();

  const pos = useMemo(() => monthPosition(new Date()), []);

  const totalCap = sumCap(CATEGORIES, activePhase);
  const totalSpent = sumSpent(entries, CATEGORIES);
  const remaining = totalCap - totalSpent;
  const pace = computePace(totalSpent, totalCap, pos.pct);

  const progress = useMemo(
    () => CATEGORIES.map((c) => categoryProgress(c, entries, activePhase)),
    [entries, activePhase],
  );

  const phase1Total = sumCap(CATEGORIES, 1);
  const phase2Total = sumCap(CATEGORIES, 2);

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
      keyboardShouldPersistTaps="handled"
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <View style={styles.headerInner}>
          <View style={styles.headerTop}>
            <View style={styles.headerTitle}>
              <Eyebrow>
                {activePhase === 1 ? 'Breakeven plan' : 'Breakeven + $500 plan'}
              </Eyebrow>
              <AppText style={styles.h1} numberOfLines={1}>
                {pos.label}
              </AppText>
            </View>
            <View style={styles.headerRight}>
              <AppText
                mono
                numberOfLines={1}
                style={[styles.remaining, remaining < 0 && styles.remainingOver]}
              >
                {fmtWhole(Math.abs(remaining))}
              </AppText>
              <AppText style={[styles.remainingLabel, remaining < 0 && styles.remainingLabelOver]}>
                {remaining >= 0 ? 'left this month' : 'over budget'}
              </AppText>
            </View>
          </View>

          <View style={styles.runwayWrap}>
            <View style={styles.runwayCaption}>
              <AppText mono style={styles.runwayFigure} numberOfLines={1}>
                {fmtWhole(totalSpent)}
                <AppText mono style={styles.runwayFigureMuted}> of {fmtWhole(totalCap)}</AppText>
              </AppText>
              <AppText style={styles.paceTag}>
                {pace.onPace ? 'On pace' : 'Ahead of pace'}
              </AppText>
            </View>
            <RunwayBar pace={pace} totalSpent={totalSpent} totalCap={totalCap} />
            <View style={styles.runwayFoot}>
              <AppText style={styles.runwayFootText}>
                Day {pos.day} of {pos.total}
              </AppText>
              <AppText mono style={styles.runwayFootText}>
                Pace target {fmtWhole(pace.paceTarget)}
              </AppText>
            </View>
          </View>

          <View style={styles.phaseWrap}>
            <PhaseSwitcher
              phase={activePhase}
              onChange={setPhase}
              phase1Cap={phase1Total}
              phase2Cap={phase2Total}
            />
          </View>
        </View>
      </View>

      {/* Body */}
      <View style={styles.body}>
        <LogPurchase saveState={saveState} onAdd={addEntry} />

        <SectionLabel>Flexible categories</SectionLabel>
        {progress.map((p) => (
          <CategoryRow key={p.category.id} progress={p} />
        ))}

        {/* Recent entries */}
        {entries.length > 0 && (
          <>
            <SectionLabel>Recent entries ({entries.length})</SectionLabel>
            <Card style={styles.entriesCard}>
              {entries.slice(0, 30).map((e, i) => {
                const cat = CATEGORIES.find((c) => c.id === e.categoryId);
                const last = i === Math.min(entries.length, 30) - 1;
                return (
                  <View key={e.id} style={[styles.entryRow, !last && styles.entryDivider]}>
                    <AppText mono style={styles.entryDate}>
                      {e.date.slice(5)}
                    </AppText>
                    <AppText style={styles.entryCat}>{cat?.name ?? e.categoryId}</AppText>
                    <AppText style={styles.entryNote} numberOfLines={1}>
                      {e.note}
                    </AppText>
                    <AppText mono style={styles.entryAmount}>
                      {fmtCents(e.amount)}
                    </AppText>
                    <Pressable
                      onPress={() => removeEntry(e.id)}
                      accessibilityRole="button"
                      accessibilityLabel={`Delete ${cat?.name ?? ''} entry`}
                      hitSlop={8}
                      style={styles.deleteBtn}
                    >
                      <AppText style={styles.deleteX}>×</AppText>
                    </Pressable>
                  </View>
                );
              })}
            </Card>
          </>
        )}

        <Pressable onPress={signOut} style={styles.signOutBtn} accessibilityRole="button">
          <AppText style={styles.signOutText}>Sign out</AppText>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  header: {
    backgroundColor: Colors.headerBg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  headerInner: {
    width: '100%',
    maxWidth: Metrics.maxWidth,
    alignSelf: 'center',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerTitle: {
    flexShrink: 1,
    minWidth: 0,
    paddingRight: 12,
  },
  h1: {
    fontSize: 27,
    fontWeight: Type.weightLight,
    letterSpacing: Type.displayTracking,
    color: Colors.text,
    marginTop: 6,
  },
  headerRight: {
    alignItems: 'flex-end',
    flexShrink: 0,
  },
  remaining: {
    fontSize: 30,
    fontWeight: Type.weightLight,
    letterSpacing: Type.displayTracking,
    color: Colors.text,
  },
  remainingOver: {
    fontWeight: Type.weightSemibold,
    color: Colors.warning,
  },
  remainingLabel: {
    fontSize: 10.5,
    letterSpacing: 0.3,
    color: Colors.textMuted,
    marginTop: 3,
  },
  remainingLabelOver: {
    color: Colors.warning,
  },
  runwayWrap: {
    marginTop: 22,
  },
  runwayCaption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 8,
  },
  runwayFigure: {
    fontSize: 14,
    fontWeight: Type.weightMedium,
    color: Colors.text,
  },
  runwayFigureMuted: {
    color: Colors.textMuted,
    fontWeight: Type.weightRegular,
  },
  paceTag: {
    fontSize: 10.5,
    letterSpacing: Type.eyebrowTracking,
    textTransform: 'uppercase',
    color: Colors.textSecondary,
    fontWeight: Type.weightSemibold,
  },
  runwayFoot: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 7,
  },
  runwayFootText: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  phaseWrap: {
    marginTop: 18,
  },
  body: {
    width: '100%',
    maxWidth: Metrics.maxWidth,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  entriesCard: {
    paddingHorizontal: 14,
    paddingVertical: 4,
    marginBottom: 24,
  },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 9,
  },
  entryDivider: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  entryDate: {
    fontSize: 11,
    color: Colors.textFaint,
    flexShrink: 0,
  },
  entryCat: {
    fontSize: 13,
    color: Colors.textSecondary,
    flexShrink: 0,
  },
  entryNote: {
    flex: 1,
    minWidth: 0,
    fontSize: 13,
    color: Colors.textFaint,
  },
  entryAmount: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text,
    flexShrink: 0,
  },
  deleteBtn: {
    paddingHorizontal: 4,
  },
  deleteX: {
    fontSize: 18,
    color: Colors.textFaint,
    lineHeight: 18,
  },
  signOutBtn: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  signOutText: {
    fontSize: 12,
    color: Colors.textMuted,
  },
});
