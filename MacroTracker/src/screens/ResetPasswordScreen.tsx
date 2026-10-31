import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { updatePassword } from '../services/auth';
import { useTheme } from '../theme/useTheme';
import type { Theme } from '../theme';
import { radius, space, type } from '../theme/tokens';
import { Icon } from '../components/Icon';

interface Props {
  onDone: () => void;
}

export function ResetPasswordScreen({ onDone }: Props) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit() {
    if (password.length < 6) {
      Alert.alert('Too short', 'Password must be at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      Alert.alert('Mismatch', 'Passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      const { error } = await updatePassword(password);
      if (error) {
        Alert.alert('Error', error.message);
      } else {
        Alert.alert('Password updated', "You're all set.", [{ text: 'OK', onPress: onDone }]);
      }
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
          <Icon name="key" size="hero" color={c.primary} style={styles.logo} />
          <Text style={styles.title}>Set new password</Text>
          <Text style={styles.subtitle}>
            Choose a password you haven't used before.
          </Text>

          <TextInput
            style={styles.input}
            placeholder="New password"
            placeholderTextColor={c.textFaint}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            editable={!busy}
            autoFocus
          />
          <TextInput
            style={styles.input}
            placeholder="Confirm password"
            placeholderTextColor={c.textFaint}
            secureTextEntry
            value={confirm}
            onChangeText={setConfirm}
            editable={!busy}
            onSubmitEditing={handleSubmit}
            returnKeyType="done"
          />

          <TouchableOpacity
            style={[styles.btn, busy && styles.btnDisabled]}
            onPress={handleSubmit}
            disabled={busy}
            activeOpacity={0.8}
          >
            {busy ? (
              <ActivityIndicator color={c.onPrimary} />
            ) : (
              <Text style={styles.btnText}>Update Password</Text>
            )}
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
  logo: { alignSelf: 'center' },
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
  btn: {
    backgroundColor: c.primary,
    borderRadius: radius.control,
    paddingVertical: space.lg,
    alignItems: 'center',
    marginTop: space.xs,
  },
  btnText: { ...type.bodyStrong(c), color: c.onPrimary },
  btnDisabled: { opacity: 0.6 },
});
