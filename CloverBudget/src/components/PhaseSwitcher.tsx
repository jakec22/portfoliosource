// Segmented control to flip between Phase 1 (breakeven) and Phase 2
// (breakeven + $500). Caps update instantly; the selection is persisted.

import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText } from './ui';
import { Colors, Radii } from '../theme/theme';
import { fmtWhole } from '../lib/money';
import type { Phase } from '../types';

interface PhaseSwitcherProps {
  phase: Phase;
  onChange: (phase: Phase) => void;
  phase1Cap: number; // cents
  phase2Cap: number; // cents
}

export function PhaseSwitcher({ phase, onChange, phase1Cap, phase2Cap }: PhaseSwitcherProps) {
  return (
    <View style={styles.wrap} accessibilityRole="tablist">
      <Segment
        active={phase === 1}
        onPress={() => onChange(1)}
        title="Phase 1"
        subtitle={`Breakeven · ${fmtWhole(phase1Cap)}`}
      />
      <Segment
        active={phase === 2}
        onPress={() => onChange(2)}
        title="Phase 2"
        subtitle={`+$500 saved · ${fmtWhole(phase2Cap)}`}
      />
    </View>
  );
}

function Segment({
  active,
  onPress,
  title,
  subtitle,
}: {
  active: boolean;
  onPress: () => void;
  title: string;
  subtitle: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      style={[styles.segment, active && styles.segmentActive]}
    >
      <AppText style={[styles.title, active && styles.titleActive]} numberOfLines={1}>
        {title}
      </AppText>
      <AppText
        mono
        numberOfLines={1}
        adjustsFontSizeToFit
        style={[styles.subtitle, active && styles.subtitleActive]}
      >
        {subtitle}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    backgroundColor: Colors.inputBg,
    borderRadius: Radii.button,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    padding: 3,
    gap: 3,
  },
  segment: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: Radii.bar + 2,
    alignItems: 'center',
  },
  segmentActive: {
    backgroundColor: Colors.surface,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  titleActive: {
    color: Colors.green,
  },
  subtitle: {
    fontSize: 10.5,
    color: Colors.textFaint,
    marginTop: 2,
  },
  subtitleActive: {
    color: Colors.textSecondary,
  },
});
