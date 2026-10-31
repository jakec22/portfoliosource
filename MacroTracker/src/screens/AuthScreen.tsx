import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as AppleAuthentication from 'expo-apple-authentication';
import {
  signInWithEmail,
  signUpWithEmail,
  signInWithGoogle,
  signInWithApple,
  resetPasswordForEmail,
} from '../services/auth';
import { useTheme } from '../theme/useTheme';
import type { Theme } from '../theme';
import { radius, space, type } from '../theme/tokens';

export function AuthScreen() {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const isSignup = mode === 'signup';

  async function handleEmailAuth() {
    if (!email.trim() || !password) {
      Alert.alert('Missing info', 'Enter your email and password.');
      return;
    }
    setBusy(true);
    try {
      const { error } = isSignup
        ? await signUpWithEmail(email, password)
        : await signInWithEmail(email, password);
      if (error) {
        Alert.alert('Sign-in failed', error.message);
      } else if (isSignup) {
        Alert.alert(
          'Check your email',
          'If email confirmation is enabled, confirm your address before signing in.'
        );
      }
    } finally {
      setBusy(false);
    }
  }

  function handleForgotPassword() {
    Alert.prompt(
      'Reset Password',
      'Enter the email address for your account.',
      async (input) => {
        if (!input?.trim()) return;
        const { error } = await resetPasswordForEmail(input);
        if (error) {
          Alert.alert('Error', error.message);
        } else {
          Alert.alert('Email sent', `Check ${input.trim()} for a password reset link.`);
        }
      },
      'plain-text',
      email,
      'email-address'
    );
  }

  async function handleGoogle() {
    setBusy(true);
    try {
      await signInWithGoogle();
    } catch (e: any) {
      Alert.alert('Google sign-in failed', e?.message ?? 'Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function handleApple() {
    setBusy(true);
    try {
      await signInWithApple();
    } catch (e: any) {
      Alert.alert('Apple sign-in failed', e?.message ?? 'Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.content}>
          <View style={styles.logoWrap}>
            <Image
              source={require('../../assets/logo-fish.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>
          <Text style={styles.title}>Holy Macro</Text>
          <Text style={styles.subtitle}>Health Simplified</Text>

          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={c.textFaint}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            editable={!busy}
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor={c.textFaint}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            editable={!busy}
          />

          {!isSignup && (
            <TouchableOpacity
              style={styles.forgotBtn}
              onPress={handleForgotPassword}
              disabled={busy}
            >
              <Text style={styles.forgotText}>Forgot password?</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.primaryBtn, busy && styles.btnDisabled]}
            onPress={handleEmailAuth}
            disabled={busy}
            activeOpacity={0.8}
          >
            {busy ? (
              <ActivityIndicator color={c.onPrimary} />
            ) : (
              <Text style={styles.primaryBtnText}>
                {isSignup ? 'Sign Up' : 'Sign In'}
              </Text>
            )}
          </TouchableOpacity>

          <View style={styles.dividerRow}>
            <View style={styles.divider} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.divider} />
          </View>

          {Platform.OS === 'ios' && (
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={
                AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN
              }
              buttonStyle={
                c.scheme === 'dark'
                  ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
                  : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
              }
              cornerRadius={12}
              style={styles.appleBtn}
              onPress={handleApple}
            />
          )}

          <TouchableOpacity
            style={[styles.googleBtn, busy && styles.btnDisabled]}
            onPress={handleGoogle}
            disabled={busy}
            activeOpacity={0.8}
          >
            <Text style={styles.googleG}>G</Text>
            <Text style={styles.googleBtnText}>Continue with Google</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.toggle}
            onPress={() => setMode(isSignup ? 'signin' : 'signup')}
            disabled={busy}
          >
            <Text style={styles.toggleText}>
              {isSignup
                ? 'Already have an account? Sign in'
                : "Don't have an account? Sign up"}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = (c: Theme) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg },
  flex: { flex: 1 },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: space.xxl,
  },
  logoWrap: { alignItems: 'center', marginBottom: space.xs },
  logo: { width: 112, height: 96 },
  title: {
    ...type.title(c),
    color: c.text,
    textAlign: 'center',
    marginTop: space.sm,
  },
  subtitle: {
    ...type.body(c),
    color: c.textMuted,
    textAlign: 'center',
    marginTop: space.xs,
    marginBottom: space.xl,
  },
  input: {
    ...type.body(c),
    backgroundColor: c.card,
    borderRadius: radius.control,
    paddingHorizontal: space.lg,
    paddingVertical: space.lg,
    color: c.text,
    borderWidth: 1,
    borderColor: c.border,
    marginBottom: space.md,
  },
  primaryBtn: {
    backgroundColor: c.primary,
    borderRadius: radius.control,
    paddingVertical: space.lg,
    alignItems: 'center',
    marginTop: space.xs,
  },
  primaryBtnText: { ...type.bodyStrong(c), color: c.onPrimary },
  btnDisabled: { opacity: 0.6 },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: space.lg,
    gap: space.md,
  },
  divider: { flex: 1, height: 1, backgroundColor: c.border },
  dividerText: { ...type.caption(c), color: c.textFaint },
  appleBtn: { height: 50, width: '100%', marginBottom: space.md },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    backgroundColor: c.card,
    borderRadius: radius.control,
    paddingVertical: space.lg,
    borderWidth: 1,
    borderColor: c.border,
  },
  googleG: {
    ...type.subhead(c),
    color: '#4285F4',
  },
  googleBtnText: { ...type.body(c), fontFamily: c.fontBodySemi, color: c.gray700 },
  toggle: { marginTop: space.xl, alignItems: 'center' },
  toggleText: { ...type.body(c), fontFamily: c.fontBodySemi, color: c.primary },
  forgotBtn: { alignItems: 'flex-end', marginTop: -4, marginBottom: space.md },
  forgotText: { ...type.caption(c), color: c.primary },
});
