// "Import a bank statement" flow. Steps: enter a Claude API key (once) ->
// pick a PDF/CSV/text file -> Claude extracts + categorizes every purchase ->
// review screen (transactions already logged this month are pre-unchecked
// and labeled, so re-uploading a fuller statement later in the month only
// adds what's new) -> confirm to log the selected rows.
//
// Calls the Claude API directly from the device with the user's own key —
// there is no backend. See lib/claudeImport.ts and lib/importDedupe.ts for
// the extraction and dedupe logic; this file is presentation + wiring only.

import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { AppText, Card, Eyebrow } from './ui';
import { Colors, Metrics, Radii, Type } from '../theme/theme';
import { CATEGORIES } from '../data/seed';
import { fmtCents } from '../lib/money';
import { getApiKey, setApiKey as saveApiKey } from '../lib/apiKey';
import { parseStatement, ImportError, type ParsedTransaction } from '../lib/claudeImport';
import { isAlreadyImported } from '../lib/importDedupe';
import { useBudget } from '../store/useBudget';

interface ReviewRow extends ParsedTransaction {
  id: string;
  included: boolean;
  isDuplicate: boolean;
}

type Step =
  | { kind: 'key' }
  | { kind: 'pick' }
  | { kind: 'loading' }
  | { kind: 'review'; rows: ReviewRow[] }
  | { kind: 'error'; message: string };

function categoryName(id: string): string {
  return CATEGORIES.find((c) => c.id === id)?.name ?? id;
}

export function ImportStatementModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const { state, addEntry } = useBudget();
  const [step, setStep] = useState<Step>({ kind: 'pick' });
  const [keyInput, setKeyInput] = useState('');
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setExpandedRowId(null);
    (async () => {
      try {
        const key = await getApiKey();
        setStep(key ? { kind: 'pick' } : { kind: 'key' });
      } catch {
        // Keychain access can fail transiently on-device too — fall back to
        // asking for the key again rather than leaving the modal stuck.
        setStep({ kind: 'key' });
      }
    })();
  }, [visible]);

  const saveKeyAndContinue = async () => {
    const trimmed = keyInput.trim();
    if (!trimmed) return;
    try {
      await saveApiKey(trimmed);
    } catch {
      setStep({ kind: 'error', message: "Couldn't save that key on this device — try again." });
      return;
    }
    setKeyInput('');
    setStep({ kind: 'pick' });
  };

  const pickFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'text/csv', 'text/comma-separated-values', 'text/plain'],
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    const isPdf = asset.mimeType === 'application/pdf' || asset.name.toLowerCase().endsWith('.pdf');

    setStep({ kind: 'loading' });
    try {
      const apiKey = await getApiKey();
      if (!apiKey) {
        setStep({ kind: 'key' });
        return;
      }
      const content = await FileSystem.readAsStringAsync(asset.uri, {
        encoding: isPdf ? 'base64' : 'utf8',
      });
      const transactions = await parseStatement({ apiKey, content, isPdf });
      if (transactions.length === 0) {
        setStep({ kind: 'error', message: 'No purchases found in that file.' });
        return;
      }
      const rows: ReviewRow[] = transactions.map((t, i) => {
        const duplicate = isAlreadyImported(t, state.entries);
        return { ...t, id: `${i}-${t.date}-${t.amountCents}`, included: !duplicate, isDuplicate: duplicate };
      });
      setStep({ kind: 'review', rows });
    } catch (e) {
      const message = e instanceof ImportError ? e.message : 'Something went wrong reading that file.';
      setStep({ kind: 'error', message });
    }
  };

  const toggleIncluded = (id: string) => {
    if (step.kind !== 'review') return;
    setStep({ kind: 'review', rows: step.rows.map((r) => (r.id === id ? { ...r, included: !r.included } : r)) });
  };

  const setRowCategory = (id: string, categoryId: string) => {
    if (step.kind !== 'review') return;
    setStep({ kind: 'review', rows: step.rows.map((r) => (r.id === id ? { ...r, categoryId } : r)) });
    setExpandedRowId(null);
  };

  const confirmImport = () => {
    if (step.kind !== 'review') return;
    for (const row of step.rows) {
      if (!row.included) continue;
      addEntry({ categoryId: row.categoryId, amount: row.amountCents, note: row.merchant, date: row.date });
    }
    onClose();
  };

  const changeApiKey = () => {
    setKeyInput('');
    setStep({ kind: 'key' });
  };

  const includedCount = step.kind === 'review' ? step.rows.filter((r) => r.included).length : 0;
  const newCount = step.kind === 'review' ? step.rows.filter((r) => !r.isDuplicate).length : 0;
  const dupCount = step.kind === 'review' ? step.rows.length - newCount : 0;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.root, { paddingTop: insets.top + 16 }]}>
        <View style={styles.header}>
          <Eyebrow>Import statement</Eyebrow>
          {step.kind !== 'key' && (
            <Pressable onPress={changeApiKey} hitSlop={8}>
              <AppText style={styles.headerLink}>Change API key</AppText>
            </Pressable>
          )}
          <Pressable onPress={onClose} hitSlop={8} style={styles.closeBtn}>
            <AppText style={styles.closeX}>×</AppText>
          </Pressable>
        </View>

        {step.kind === 'key' && (
          <View style={styles.body}>
            <AppText style={styles.h1}>Your Claude API key</AppText>
            <AppText style={styles.intro}>
              Statement imports call the Claude API directly from this device using your own key —
              there's no account and no server in between. Get a key at platform.claude.com and paste
              it below; it's stored securely on this device only.
            </AppText>
            <TextInput
              value={keyInput}
              onChangeText={setKeyInput}
              placeholder="sk-ant-..."
              placeholderTextColor={Colors.textFaint}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
              style={styles.input}
            />
            <Pressable onPress={saveKeyAndContinue} style={styles.primaryButton} accessibilityRole="button">
              <AppText style={styles.primaryButtonText}>Save key</AppText>
            </Pressable>
          </View>
        )}

        {step.kind === 'pick' && (
          <View style={styles.body}>
            <AppText style={styles.h1}>Upload a statement</AppText>
            <AppText style={styles.intro}>
              Choose a PDF or CSV/text export of your bank or credit card statement. Claude reads it and
              suggests a category for each purchase — you'll review everything before anything is added.
            </AppText>
            <Pressable onPress={pickFile} style={styles.primaryButton} accessibilityRole="button">
              <AppText style={styles.primaryButtonText}>Choose a file</AppText>
            </Pressable>
          </View>
        )}

        {step.kind === 'loading' && (
          <View style={[styles.body, styles.centered]}>
            <ActivityIndicator color={Colors.text} />
            <AppText style={styles.loadingText}>Reading your statement…</AppText>
          </View>
        )}

        {step.kind === 'error' && (
          <View style={styles.body}>
            <AppText style={styles.h1}>Couldn't import that</AppText>
            <AppText style={styles.intro}>{step.message}</AppText>
            <Pressable onPress={() => setStep({ kind: 'pick' })} style={styles.primaryButton} accessibilityRole="button">
              <AppText style={styles.primaryButtonText}>Try again</AppText>
            </Pressable>
          </View>
        )}

        {step.kind === 'review' && (
          <>
            <View style={styles.summaryRow}>
              <AppText style={styles.summaryText}>
                {step.rows.length} found — {newCount} new
                {dupCount > 0 ? `, ${dupCount} already imported` : ''}
              </AppText>
            </View>
            <ScrollView style={styles.reviewScroll} contentContainerStyle={styles.reviewContent}>
              <Card style={styles.reviewCard}>
                {step.rows.map((row, i) => (
                  <View key={row.id}>
                    <Pressable
                      onPress={() => toggleIncluded(row.id)}
                      style={[styles.row, i < step.rows.length - 1 && styles.rowDivider, row.isDuplicate && styles.rowDim]}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: row.included }}
                    >
                      <View style={[styles.checkbox, row.included && styles.checkboxChecked]}>
                        {row.included && <AppText style={styles.checkMark}>✓</AppText>}
                      </View>
                      <View style={styles.rowInfo}>
                        <AppText style={styles.rowMerchant} numberOfLines={1}>
                          {row.merchant}
                        </AppText>
                        <AppText style={styles.rowMeta} numberOfLines={1}>
                          {row.date}
                          {row.isDuplicate ? ' · Already imported' : ''}
                        </AppText>
                      </View>
                      <AppText mono style={styles.rowAmount}>
                        {fmtCents(row.amountCents)}
                      </AppText>
                    </Pressable>
                    <Pressable
                      onPress={() => setExpandedRowId(expandedRowId === row.id ? null : row.id)}
                      style={styles.categoryPill}
                      accessibilityRole="button"
                    >
                      <AppText style={styles.categoryPillText}>{categoryName(row.categoryId)}</AppText>
                    </Pressable>
                    {expandedRowId === row.id && (
                      <View style={styles.chipWrap}>
                        {CATEGORIES.map((c) => (
                          <Pressable
                            key={c.id}
                            onPress={() => setRowCategory(row.id, c.id)}
                            style={[styles.chip, c.id === row.categoryId && styles.chipActive]}
                          >
                            <AppText
                              style={[styles.chipText, c.id === row.categoryId && styles.chipTextActive]}
                              numberOfLines={1}
                            >
                              {c.name}
                            </AppText>
                          </Pressable>
                        ))}
                      </View>
                    )}
                  </View>
                ))}
              </Card>
            </ScrollView>
            <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
              <Pressable
                onPress={confirmImport}
                disabled={includedCount === 0}
                style={[styles.primaryButton, includedCount === 0 && styles.primaryButtonDisabled]}
                accessibilityRole="button"
              >
                <AppText style={styles.primaryButtonText}>
                  {includedCount === 0 ? 'Nothing selected' : `Add ${includedCount} transaction${includedCount === 1 ? '' : 's'}`}
                </AppText>
              </Pressable>
            </View>
          </>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerLink: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  closeBtn: {
    paddingHorizontal: 4,
  },
  closeX: {
    fontSize: 22,
    color: Colors.textFaint,
    lineHeight: 22,
  },
  body: {
    width: '100%',
    maxWidth: Metrics.maxWidth,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  centered: {
    alignItems: 'center',
  },
  h1: {
    fontSize: 22,
    fontWeight: Type.weightLight,
    letterSpacing: Type.displayTracking,
    color: Colors.text,
  },
  intro: {
    fontSize: 14,
    lineHeight: 21,
    color: Colors.textMuted,
    marginTop: 12,
  },
  loadingText: {
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 16,
  },
  input: {
    backgroundColor: Colors.inputBg,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    borderRadius: Radii.button,
    color: Colors.text,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    marginTop: 20,
  },
  primaryButton: {
    backgroundColor: Colors.accent,
    borderRadius: Radii.button,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  primaryButtonDisabled: {
    opacity: 0.4,
  },
  primaryButtonText: {
    color: Colors.onAccent,
    fontWeight: Type.weightSemibold,
    fontSize: 14,
    letterSpacing: 0.3,
  },
  summaryRow: {
    paddingHorizontal: 20,
    paddingTop: 16,
    width: '100%',
    maxWidth: Metrics.maxWidth,
    alignSelf: 'center',
  },
  summaryText: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  reviewScroll: {
    flex: 1,
  },
  reviewContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
  },
  reviewCard: {
    width: '100%',
    maxWidth: Metrics.maxWidth,
    alignSelf: 'center',
    paddingHorizontal: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  rowDim: {
    opacity: 0.55,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  checkboxChecked: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  checkMark: {
    fontSize: 12,
    color: Colors.onAccent,
    fontWeight: Type.weightSemibold,
    lineHeight: 14,
  },
  rowInfo: {
    flex: 1,
    minWidth: 0,
  },
  rowMerchant: {
    fontSize: 14,
    color: Colors.text,
  },
  rowMeta: {
    fontSize: 11,
    color: Colors.textFaint,
    marginTop: 2,
  },
  rowAmount: {
    fontSize: 13,
    color: Colors.textSecondary,
    flexShrink: 0,
  },
  categoryPill: {
    alignSelf: 'flex-start',
    marginLeft: 30,
    marginBottom: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radii.bar + 2,
    backgroundColor: Colors.inputBg,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
  },
  categoryPillText: {
    fontSize: 11,
    color: Colors.textSecondary,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginLeft: 30,
    marginBottom: 12,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radii.button,
    backgroundColor: Colors.inputBg,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
  },
  chipActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  chipText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  chipTextActive: {
    color: Colors.onAccent,
    fontWeight: Type.weightSemibold,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    width: '100%',
    maxWidth: Metrics.maxWidth,
    alignSelf: 'center',
  },
});
