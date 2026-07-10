// Fast purchase entry: pick a category chip, type an amount (+ optional note),
// hit Add. Designed for 3 taps: chip, amount, Add.
//
// Layout is a vertical stack so nothing gets squeezed off the card edge on a
// phone: wrapping category chips (all visible), a full-width amount field, then
// an optional note beside the Add button.

import React, { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { AppText, Card, SectionLabel } from './ui';
import { Colors, Radii, Type } from '../theme/theme';
import { CATEGORIES } from '../data/seed';
import { parseDollarsToCents } from '../lib/money';
import type { SaveState } from '../store/useBudget';

interface LogPurchaseProps {
  saveState: SaveState;
  onAdd: (input: { categoryId: string; amount: number; note: string }) => void;
}

export function LogPurchase({ saveState, onAdd }: LogPurchaseProps) {
  const [categoryId, setCategoryId] = useState(CATEGORIES[0].id);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState(false);

  const submit = () => {
    const cents = parseDollarsToCents(amount);
    if (cents === null) {
      setError(true);
      return;
    }
    onAdd({ categoryId, amount: cents, note });
    setAmount('');
    setNote('');
    setError(false);
  };

  return (
    <Card style={styles.card}>
      <SectionLabel style={styles.heading}>Log a purchase</SectionLabel>

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
              <AppText
                style={[styles.chipText, active && styles.chipTextActive]}
                numberOfLines={1}
              >
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
        onSubmitEditing={submit}
        keyboardType="decimal-pad"
        placeholder="0.00"
        placeholderTextColor={Colors.textFaint}
        returnKeyType="done"
        style={[styles.input, styles.amountInput, error && styles.inputError]}
        accessibilityLabel="Amount in dollars"
      />

      <View style={styles.actionRow}>
        <TextInput
          value={note}
          onChangeText={setNote}
          onSubmitEditing={submit}
          placeholder="Note (optional)"
          placeholderTextColor={Colors.textFaint}
          returnKeyType="done"
          style={[styles.input, styles.noteInput]}
          accessibilityLabel="Note"
        />
        <Pressable onPress={submit} style={styles.addButton} accessibilityRole="button">
          <AppText style={styles.addText}>Add</AppText>
        </Pressable>
      </View>

      <AppText style={styles.status}>
        {error
          ? 'Enter an amount greater than 0'
          : saveState === 'saving'
            ? 'Saving…'
            : saveState === 'saved'
              ? 'Saved'
              : saveState === 'error'
                ? "Couldn't save — try again"
                : ''}
      </AppText>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    marginBottom: 24,
  },
  heading: {
    marginBottom: 12,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
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
  actionRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 8,
    marginTop: 8,
  },
  noteInput: {
    flex: 1,
    minWidth: 0,
    fontSize: 14,
  },
  inputError: {
    borderColor: Colors.warning,
  },
  addButton: {
    backgroundColor: Colors.accent,
    borderRadius: Radii.button,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  addText: {
    color: Colors.onAccent,
    fontWeight: Type.weightSemibold,
    fontSize: 14,
    letterSpacing: 0.3,
  },
  status: {
    fontSize: 11,
    color: Colors.textFaint,
    marginTop: 10,
    minHeight: 14,
  },
});
