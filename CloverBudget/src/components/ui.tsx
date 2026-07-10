// Base UI primitives. Colors and type live here and in theme.ts only.

import React from 'react';
import { Platform, StyleSheet, Text, TextProps, View, ViewProps } from 'react-native';
import { Colors, Metrics, Radii } from '../theme/theme';

// UI face: SF Pro Rounded on iOS (the SF Pro Rounded family name), platform
// system font elsewhere. Numbers use a monospaced face + tabular figures so
// every amount stays column-aligned, matching the web app's IBM Plex Mono.
const UI_FONT = Platform.select({ ios: 'SF Pro Rounded', default: undefined });
const MONO_FONT = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' });

interface AppTextProps extends TextProps {
  /** Render as a monospaced, tabular figure (for any amount/number). */
  mono?: boolean;
}

export function AppText({ mono, style, ...rest }: AppTextProps) {
  return (
    <Text
      {...rest}
      style={[
        { color: Colors.text, fontFamily: mono ? MONO_FONT : UI_FONT },
        mono && { fontVariant: ['tabular-nums'] as const },
        style,
      ]}
    />
  );
}

/** Uppercase, letter-spaced green eyebrow label. */
export function Eyebrow({ children, style }: { children: React.ReactNode; style?: TextProps['style'] }) {
  return <AppText style={[styles.eyebrow, style]}>{children}</AppText>;
}

/** Standard card surface: 10pt radius, 1pt border, surface background. */
export function Card({ style, ...rest }: ViewProps) {
  return <View {...rest} style={[styles.card, style]} />;
}

/** Small section heading above a group of cards. */
export function SectionLabel({ children, style }: { children: React.ReactNode; style?: TextProps['style'] }) {
  return <AppText style={[styles.sectionLabel, style]}>{children}</AppText>;
}

const styles = StyleSheet.create({
  eyebrow: {
    fontSize: 11,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: Colors.green,
    fontWeight: '600',
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
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 10,
  },
});
