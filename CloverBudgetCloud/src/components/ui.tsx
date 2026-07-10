// Base UI primitives. Colors and type live here and in theme.ts only.

import React from 'react';
import { StyleSheet, Text, TextProps, View, ViewProps } from 'react-native';
import { Colors, Metrics, Radii, Type } from '../theme/theme';

// UI face: the platform system grotesk (SF Pro on iOS) — sharp, neutral, and
// executive. Numbers reuse the same face with tabular lining figures so every
// amount stays column-aligned, without a typewriter/mono look.

interface AppTextProps extends TextProps {
  /** Render figures with tabular (column-aligned) lining numerals. */
  mono?: boolean;
}

export function AppText({ mono, style, ...rest }: AppTextProps) {
  return (
    <Text
      {...rest}
      style={[
        { color: Colors.text },
        mono && { fontVariant: ['tabular-nums'] as const },
        style,
      ]}
    />
  );
}

/** Uppercase, wide-tracked, muted eyebrow label. */
export function Eyebrow({ children, style }: { children: React.ReactNode; style?: TextProps['style'] }) {
  return <AppText style={[styles.eyebrow, style]}>{children}</AppText>;
}

/** Standard card surface: rounded, hairline border, graphite surface. */
export function Card({ style, ...rest }: ViewProps) {
  return <View {...rest} style={[styles.card, style]} />;
}

/** Small section heading above a group of cards. */
export function SectionLabel({ children, style }: { children: React.ReactNode; style?: TextProps['style'] }) {
  return <AppText style={[styles.sectionLabel, style]}>{children}</AppText>;
}

const styles = StyleSheet.create({
  eyebrow: {
    fontSize: 10.5,
    letterSpacing: Type.eyebrowTracking,
    textTransform: 'uppercase',
    color: Colors.textMuted,
    fontWeight: Type.weightSemibold,
  },
  card: {
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
    borderWidth: Metrics.cardBorder,
    borderRadius: Radii.card,
    // Clip any child content to the rounded card edge (belt-and-braces against
    // long text spilling past the border on web).
    overflow: 'hidden',
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: Type.weightSemibold,
    letterSpacing: Type.eyebrowTracking,
    textTransform: 'uppercase',
    color: Colors.textMuted,
    marginBottom: 12,
  },
});
