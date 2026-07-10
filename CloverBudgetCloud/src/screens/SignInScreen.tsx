// Deliberately simple: one shared login for the whole family (one email +
// password), not a multi-user household system. That's a prototype
// simplification — see CLAUDE.md.

import React, { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText, Card, Eyebrow } from '../components/ui';
import { Colors, Metrics, Radii, Type } from '../theme/theme';
import { useBudget } from '../store/useBudget';

export function SignInScreen() {
  const insets = useSafeAreaInsets();
  const { signIn, signUp, authError } = useBudget();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn');
  const [busy, setBusy] = useState(false);
  const [sentConfirm, setSentConfirm] = useState(false);

  const submit = async () => {
    setBusy(true);
    setSentConfirm(false);
    if (mode === 'signIn') {
      await signIn(email.trim(), password);
    } else {
      await signUp(email.trim(), password);
      setSentConfirm(true);
    }
    setBusy(false);
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 40 }]}>
      <View style={styles.inner}>
        <Eyebrow>Clover Budget Cloud</Eyebrow>
        <AppText style={styles.h1}>
          {mode === 'signIn' ? 'Sign in' : 'Create the family login'}
        </AppText>
        <AppText style={styles.sub}>
          One login for the whole household — share it the way you'd share a streaming account.
        </AppText>

        <Card style={styles.card}>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="Email"
            placeholderTextColor={Colors.textFaint}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            style={styles.input}
            accessibilityLabel="Email"
          />
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Password"
            placeholderTextColor={Colors.textFaint}
            secureTextEntry
            style={[styles.input, styles.passwordInput]}
            accessibilityLabel="Password"
          />

          {authError && <AppText style={styles.error}>{authError}</AppText>}
          {sentConfirm && !authError && (
            <AppText style={styles.notice}>Check your email to confirm the account, then sign in.</AppText>
          )}

          <Pressable
            onPress={submit}
            disabled={busy || !email || !password}
            style={[styles.submit, (busy || !email || !password) && styles.submitDisabled]}
            accessibilityRole="button"
          >
            <AppText style={styles.submitText}>
              {busy ? 'Working…' : mode === 'signIn' ? 'Sign in' : 'Create account'}
            </AppText>
          </Pressable>
        </Card>

        <Pressable
          onPress={() => setMode(mode === 'signIn' ? 'signUp' : 'signIn')}
          style={styles.switchMode}
          accessibilityRole="button"
        >
          <AppText style={styles.switchModeText}>
            {mode === 'signIn' ? "Don't have a login yet? Create one" : 'Already have a login? Sign in'}
          </AppText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.bg,
    paddingHorizontal: 20,
  },
  inner: {
    width: '100%',
    maxWidth: Metrics.maxWidth,
    alignSelf: 'center',
  },
  h1: {
    fontSize: 27,
    fontWeight: Type.weightLight,
    letterSpacing: Type.displayTracking,
    color: Colors.text,
    marginTop: 6,
  },
  sub: {
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 8,
    lineHeight: 19,
  },
  card: {
    padding: 16,
    marginTop: 24,
  },
  input: {
    backgroundColor: Colors.inputBg,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    borderRadius: Radii.button,
    color: Colors.text,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
  },
  passwordInput: {
    marginTop: 10,
  },
  error: {
    fontSize: 12,
    color: Colors.warning,
    marginTop: 10,
  },
  notice: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 10,
  },
  submit: {
    backgroundColor: Colors.accent,
    borderRadius: Radii.button,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 14,
  },
  submitDisabled: {
    opacity: 0.5,
  },
  submitText: {
    color: Colors.onAccent,
    fontWeight: Type.weightSemibold,
    fontSize: 14,
  },
  switchMode: {
    alignItems: 'center',
    marginTop: 18,
  },
  switchModeText: {
    fontSize: 12.5,
    color: Colors.textMuted,
  },
});
