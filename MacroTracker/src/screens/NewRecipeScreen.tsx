import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { analyzeRecipe, looksLikeUrl } from '../services/recipeImport';
import { useTheme } from '../theme/useTheme';
import type { Theme } from '../theme';

interface Props {
  navigation: any;
}

export function NewRecipeScreen({ navigation }: Props) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const isUrl = looksLikeUrl(input);

  async function handleImport() {
    const trimmed = input.trim();
    if (!trimmed) return;
    setLoading(true);
    try {
      const parsed = await analyzeRecipe(isUrl ? { url: trimmed } : { text: trimmed });
      navigation.navigate('RecipeReview', {
        parsed,
        sourceUrl: isUrl ? trimmed : undefined,
      });
      setInput('');
    } catch (e: any) {
      Alert.alert('Could not import recipe', e?.message ?? 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.cancel}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.title}>New Recipe</Text>
        <View style={{ width: 50 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.label}>Paste a recipe link, or paste the recipe text</Text>
          <Text style={styles.hint}>
            Website links (e.g. a food blog) are fetched automatically. Instagram blocks
            automatic fetching, so for an Instagram post, paste the caption or recipe text
            instead of the link.
          </Text>

          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="https://example.com/recipe  —  or paste recipe text"
            placeholderTextColor={c.textFaint}
            multiline
            autoCapitalize="none"
            autoCorrect={false}
            editable={!loading}
          />

          <TouchableOpacity
            style={[styles.importBtn, (!input.trim() || loading) && styles.importBtnDisabled]}
            onPress={handleImport}
            disabled={!input.trim() || loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color={c.onPrimary} />
            ) : (
              <Text style={styles.importBtnText}>
                {isUrl ? 'Import from Link' : 'Import from Text'}
              </Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = (c: Theme) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
    backgroundColor: c.card,
  },
  cancel: { fontSize: 16, color: c.danger, width: 50 },
  title: { fontSize: 16, fontWeight: '700', color: c.text },
  content: { padding: 16, paddingBottom: 40 },

  label: { fontSize: 15, fontWeight: '700', color: c.text, marginBottom: 4 },
  hint: { fontSize: 13, color: c.textMuted, lineHeight: 18, marginBottom: 14 },

  input: {
    backgroundColor: c.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: c.border,
    padding: 14,
    fontSize: 15,
    color: c.text,
    minHeight: 140,
    textAlignVertical: 'top',
  },

  importBtn: {
    backgroundColor: c.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  importBtnDisabled: { opacity: 0.5 },
  importBtnText: { color: c.onPrimary, fontWeight: '700', fontSize: 16 },
});
