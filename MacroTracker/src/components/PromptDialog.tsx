import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { usePrompt } from '../store/usePrompt';
import { useTheme } from '../theme/useTheme';
import type { Theme } from '../theme';
import { radius, space, type } from '../theme/tokens';

/**
 * The one text prompt, mounted once beside the snackbar.
 *
 * See usePrompt for why this exists rather than Alert.prompt. What it adds
 * beyond working on Android:
 *
 *   - Submit stays disabled until there is something to submit. Every call
 *     site previously guarded with `if (!value?.trim()) return` — tapping
 *     Save on an empty field closed the dialog and did nothing, which reads
 *     as the feature being broken.
 *   - A rejected value keeps the dialog open with the text still in it, and
 *     says what was wrong underneath the field. The link importer used to
 *     close, raise a second alert, and lose what you had pasted.
 *   - Every field is capped, so a pasted wall of text cannot become a meal
 *     name that lays out past the edge of every card that shows it.
 */
export function PromptDialog() {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const request = usePrompt((s) => s.request);
  const dismiss = usePrompt((s) => s.dismiss);

  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Reset per request rather than on close, so the text does not visibly
  // empty itself during the dismiss animation.
  useEffect(() => {
    if (!request) return;
    setValue(request.defaultValue ?? '');
    setError(null);
  }, [request]);

  const trimmed = value.trim();
  const canSubmit = trimmed.length > 0;

  function handleSubmit() {
    if (!request || !canSubmit) return;
    const problem = request.validate?.(trimmed) ?? null;
    if (problem) {
      setError(problem);
      return;
    }
    // Close first: the callback may open an alert or navigate, and two
    // modals dismissing and presenting in the same tick is how iOS ends up
    // showing neither.
    const { onSubmit } = request;
    dismiss();
    onSubmit(trimmed);
  }

  return (
    <Modal
      visible={request != null}
      transparent
      animationType="fade"
      onRequestClose={dismiss}
    >
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={dismiss}
          accessibilityLabel="Dismiss"
        />
        {request && (
          <View style={styles.card}>
            <Text style={styles.title}>{request.title}</Text>
            {!!request.message && <Text style={styles.message}>{request.message}</Text>}

            <TextInput
              style={[styles.input, error != null && styles.inputError]}
              value={value}
              onChangeText={(v) => {
                setValue(v);
                // Clear on edit: an error about what was there a moment ago
                // reads as an error about what is there now.
                if (error) setError(null);
              }}
              placeholder={request.placeholder}
              // textMuted, not the textFaint the rest of the app uses for
              // placeholders: faint measures 3.4:1 on the input fill, and a
              // placeholder is the only text in an empty field.
              placeholderTextColor={c.textMuted}
              keyboardType={request.keyboardType}
              autoCapitalize={request.autoCapitalize ?? 'sentences'}
              autoCorrect={false}
              maxLength={request.maxLength}
              autoFocus
              selectTextOnFocus
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
              accessibilityLabel={request.title}
            />

            {!!error && (
              <Text style={styles.error} accessibilityLiveRegion="polite">
                {error}
              </Text>
            )}

            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.btn, styles.btnGhost]}
                onPress={dismiss}
                activeOpacity={0.8}
                accessibilityRole="button"
              >
                <Text style={styles.btnGhostText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, styles.btnPrimary, !canSubmit && styles.btnDisabled]}
                onPress={handleSubmit}
                disabled={!canSubmit}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityState={{ disabled: !canSubmit }}
              >
                <Text style={styles.btnPrimaryText}>{request.submitLabel ?? 'Save'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}

const makeStyles = (c: Theme) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: c.overlay,
      alignItems: 'center',
      justifyContent: 'center',
      padding: space.xl,
    },
    card: {
      width: '100%',
      maxWidth: 400,
      backgroundColor: c.card,
      borderRadius: radius.sheet,
      padding: space.xl,
      shadowColor: c.shadow,
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.18,
      shadowRadius: 24,
      elevation: 8,
    },
    title: { ...type.subhead(c), fontFamily: c.fontBodyBold, color: c.text },
    message: {
      ...type.caption(c),
      fontFamily: c.fontBody,
      color: c.textMuted,
      marginTop: space.xxs,
    },

    input: {
      ...type.body(c),
      backgroundColor: c.input,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: radius.control,
      paddingVertical: space.md,
      paddingHorizontal: space.lg,
      color: c.text,
      marginTop: space.lg,
    },
    inputError: { borderColor: c.danger },
    error: {
      ...type.caption(c),
      fontFamily: c.fontBody,
      color: c.danger,
      marginTop: space.sm,
    },

    actions: { flexDirection: 'row', gap: space.sm, marginTop: space.lg },
    btn: {
      flex: 1,
      borderRadius: radius.control,
      paddingVertical: space.md,
      alignItems: 'center',
    },
    btnGhost: { backgroundColor: c.cardMuted },
    btnGhostText: { ...type.bodyStrong(c), color: c.textMuted },
    btnPrimary: { backgroundColor: c.primary },
    btnPrimaryText: { ...type.bodyStrong(c), color: c.onPrimary },
    // The primary button dimmed, not a grey one. Rendering it as cardMuted
    // made it identical to Cancel sitting beside it, so the pair read as two
    // equal choices with no way to tell which was the action. Keeping its
    // colour at low opacity says "this button, not yet" instead.
    btnDisabled: { opacity: 0.4 },
  });
