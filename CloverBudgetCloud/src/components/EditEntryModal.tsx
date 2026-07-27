// Full-screen modal for editing (or deleting) a single logged purchase:
// category, amount, and note. Opened by tapping a purchase inside an
// expanded CategoryRow.

import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { AppText, SectionLabel } from './ui';
import { Colors, Metrics, Radii, Type } from '../theme/theme';
import { CATEGORIES } from '../data/seed';
import { parseDollarsToCents } from '../lib/money';
import type { Entry } from '../types';

interface EditEntryModalProps {
  entry: Entry | null;
  onClose: () => void;
  onSave: (id: string, patch: { categoryId: string; amount: number; note: string }) => void;
  onDelete: (id: string) => void;
}

export function EditEntryModal({ entry, onClose, onSave, onDelete }: EditEntryModalProps) {
  const [categoryId, setCategoryId] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (entry) {
      setCategoryId(entry.categoryId);
      setAmount((entry.amount / 100).toFixed(2));
      setNote(entry.note);
      setError(false);
      setConfirmDelete(false);
    }
  }, [entry]);

  if (!entry) return null;

  const save = () => {
    const cents = parseDollarsToCents(amount);
    if (cents === null) {
      setError(true);
      return;
    }
    onSave(entry.id, { categoryId, amount: cents, note: note.trim() });
    onClose();
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
        <View style={styles.sheet}>
          <SectionLabel>Edit purchase</SectionLabel>

          <View style={styles.chips}>
            {CATEGORIES.map((c) => {
              const active = c.id === categoryId;
              return (
                <Pressable
                  key={c.id}
                  onPress={() => setCategoryId(c.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <AppText style={[styles.chipText, active && styles.chipTextActive]} numberOfLines={1}>
                    {c.name}
                  </AppText>
                </Pressable>
              );
            })}
          </View>

          <TextInput
            value={amount}
            onChangeText={(t) => {
              setAmount(t);
              if (error) setError(false);
            }}
            keyboardType="decimal-pad"
            placeholder="0.00"
            placeholderTextColor={Colors.textFaint}
            returnKeyType="done"
            style={[styles.input, styles.amountInput, error && styles.inputError]}
            accessibilityLabel="Amount in dollars"
          />

          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="Note (optional)"
            placeholderTextColor={Colors.textFaint}
            returnKeyType="done"
            style={[styles.input, styles.noteInput]}
            accessibilityLabel="Note"
          />

          {error && <AppText style={styles.errorText}>Enter an amount greater than 0</AppText>}

          <View style={styles.actionRow}>
            <Pressable onPress={save} style={styles.saveButton} accessibilityRole="button">
              <AppText style={styles.saveText}>Save</AppText>
            </Pressable>
            <Pressable onPress={onClose} style={styles.cancelButton} accessibilityRole="button">
              <AppText style={styles.cancelText}>Cancel</AppText>
            </Pressable>
          </View>

          {confirmDelete ? (
            <View style={styles.confirmRow}>
              <AppText style={styles.confirmText}>Delete this purchase?</AppText>
              <View style={styles.confirmButtons}>
                <Pressable
                  onPress={() => {
                    onDelete(entry.id);
                    onClose();
                  }}
                  style={styles.deleteConfirmButton}
                  accessibilityRole="button"
                >
                  <AppText style={styles.deleteConfirmText}>Yes, delete</AppText>
                </Pressable>
                <Pressable
                  onPress={() => setConfirmDelete(false)}
                  style={styles.cancelButton}
                  accessibilityRole="button"
                >
                  <AppText style={styles.cancelText}>Keep it</AppText>
                </Pressable>
              </View>
            </View>
          ) : (
            <Pressable onPress={() => setConfirmDelete(true)} style={styles.deleteButton} accessibilityRole="button">
              <AppText style={styles.deleteText}>Delete purchase</AppText>
            </Pressable>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(7,10,14,0.72)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  sheet: {
    width: '100%',
    maxWidth: Metrics.maxWidth,
    alignSelf: 'center',
    backgroundColor: Colors.surfaceRaised,
    borderRadius: Radii.card,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    padding: 18,
    // The backdrop's absoluteFill Pressable is a CSS-positioned sibling, which
    // paints above this in-flow sheet on web unless given its own stacking
    // context — without this, taps on the sheet's own controls (chips,
    // inputs, Save) are swallowed by the backdrop's close-on-tap catcher.
    position: 'relative',
    zIndex: 1,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  chip: {
    paddingHorizontal: 13,
    paddingVertical: 8,
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
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: Type.weightMedium,
  },
  chipTextActive: {
    color: Colors.onAccent,
    fontWeight: Type.weightSemibold,
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
  amountInput: {
    marginTop: 14,
    letterSpacing: 0.3,
  },
  noteInput: {
    marginTop: 8,
  },
  inputError: {
    borderColor: Colors.warning,
  },
  errorText: {
    fontSize: 11,
    color: Colors.warning,
    marginTop: 8,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
  },
  saveButton: {
    flex: 1,
    backgroundColor: Colors.accent,
    borderRadius: Radii.button,
    paddingVertical: 12,
    alignItems: 'center',
  },
  saveText: {
    color: Colors.onAccent,
    fontWeight: Type.weightSemibold,
    fontSize: 14,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: Colors.border,
    borderRadius: Radii.button,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelText: {
    color: Colors.textSecondary,
    fontSize: 14,
  },
  deleteButton: {
    alignItems: 'center',
    marginTop: 14,
  },
  deleteText: {
    fontSize: 12.5,
    color: Colors.textMuted,
  },
  confirmRow: {
    alignItems: 'center',
    marginTop: 14,
    gap: 10,
  },
  confirmText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  confirmButtons: {
    flexDirection: 'row',
    gap: 8,
    width: '100%',
  },
  deleteConfirmButton: {
    flex: 1,
    backgroundColor: Colors.warning,
    borderRadius: Radii.button,
    paddingVertical: 12,
    alignItems: 'center',
  },
  deleteConfirmText: {
    color: Colors.onAccent,
    fontWeight: Type.weightSemibold,
    fontSize: 13,
  },
});
