// Shown instead of crashing when no Supabase project is wired up yet.
// See README.md for the one-time setup steps that make this screen go away.

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText, Card, Eyebrow } from '../components/ui';
import { Colors, Metrics, Type } from '../theme/theme';

export function NotConfiguredScreen() {
  return (
    <View style={styles.root}>
      <View style={styles.inner}>
        <Eyebrow>Clover Budget Cloud</Eyebrow>
        <AppText style={styles.h1}>Not connected yet</AppText>
        <Card style={styles.card}>
          <AppText style={styles.body}>
            This prototype needs a Supabase project before it can sync anything. Follow the
            steps in <AppText style={styles.mono}>README.md</AppText> to create a free project,
            run <AppText style={styles.mono}>supabase/schema.sql</AppText>, and copy your project
            URL + anon key into a <AppText style={styles.mono}>.env</AppText> file. Then restart
            the app.
          </AppText>
        </Card>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.bg,
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  inner: {
    width: '100%',
    maxWidth: Metrics.maxWidth,
    alignSelf: 'center',
  },
  h1: {
    fontSize: 24,
    fontWeight: Type.weightLight,
    letterSpacing: Type.displayTracking,
    color: Colors.text,
    marginTop: 6,
  },
  card: {
    padding: 18,
    marginTop: 20,
  },
  body: {
    fontSize: 14,
    lineHeight: 22,
    color: Colors.textSecondary,
  },
  mono: {
    fontVariant: ['tabular-nums'],
    color: Colors.text,
    fontWeight: Type.weightSemibold,
  },
});
