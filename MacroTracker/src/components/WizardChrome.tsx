import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useTheme } from '../theme/useTheme';
import type { Theme } from '../theme';
import { radius, space, type } from '../theme/tokens';
import { Icon } from './Icon';

// The frame both step flows wear. The program builder was asked to look
// "just like" the Goal Wizard; sharing this makes that true by construction
// rather than by copy-paste. Content and the styles that genuinely differ
// stay with each screen.
export function WizardHeader({
  step,
  total,
  onClose,
  disabled,
}: {
  step: number; // zero-based
  total: number;
  onClose: () => void;
  disabled?: boolean;
}) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={onClose}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel="Close"
          disabled={disabled}
        >
          <Icon name="close" size="md" color={c.textFaint} />
        </TouchableOpacity>
        <Text style={styles.stepCount}>
          Step {step + 1} of {total}
        </Text>
        <View style={{ width: 20 }} />
      </View>
      <View style={styles.progressTrack}>
        <View
          style={[styles.progressFill, { width: `${((step + 1) / total) * 100}%` as any }]}
        />
      </View>
    </>
  );
}

export function WizardFooter({
  backLabel,
  nextLabel,
  onBack,
  onNext,
  nextDisabled,
  busy,
}: {
  backLabel: string;
  nextLabel: string;
  onBack: () => void;
  onNext: () => void;
  nextDisabled?: boolean;
  busy?: boolean; // spinner in place of the label, both buttons locked
}) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <View style={styles.footer}>
      <TouchableOpacity
        style={styles.backBtn}
        onPress={onBack}
        activeOpacity={0.7}
        disabled={busy}
        accessibilityRole="button"
      >
        <Text style={styles.backBtnText}>{backLabel}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.nextBtn, (nextDisabled || busy) && styles.nextBtnDisabled]}
        onPress={onNext}
        activeOpacity={0.85}
        disabled={nextDisabled || busy}
        accessibilityRole="button"
        accessibilityLabel={nextLabel}
      >
        {busy ? (
          <ActivityIndicator color={c.onPrimary} />
        ) : (
          <Text style={styles.nextBtnText}>{nextLabel}</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const makeStyles = (c: Theme) =>
  StyleSheet.create({
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: space.xl,
      paddingTop: space.sm,
      paddingBottom: space.md,
    },
    stepCount: { ...type.captionStrong(c), color: c.textFaint },
    progressTrack: {
      height: 4,
      backgroundColor: c.cardMuted,
      marginHorizontal: space.lg,
      borderRadius: radius.hairline,
      overflow: 'hidden',
    },
    progressFill: { height: 4, backgroundColor: c.primary, borderRadius: radius.hairline },

    footer: {
      flexDirection: 'row',
      gap: space.md,
      paddingHorizontal: space.xl,
      paddingTop: space.md,
      paddingBottom: space.sm,
      borderTopWidth: 1,
      borderTopColor: c.border,
    },
    backBtn: {
      paddingVertical: space.lg,
      paddingHorizontal: space.xl,
      borderRadius: radius.control,
      backgroundColor: c.cardMuted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    backBtnText: { ...type.bodyStrong(c), color: c.textMuted },
    nextBtn: {
      flex: 1,
      paddingVertical: space.lg,
      borderRadius: radius.control,
      backgroundColor: c.primary,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 56,
      shadowColor: c.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
    },
    nextBtnDisabled: { backgroundColor: c.borderStrong, shadowOpacity: 0 },
    nextBtnText: { ...type.subhead(c), color: c.onPrimary },
  });
