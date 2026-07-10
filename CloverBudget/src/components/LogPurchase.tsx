// Fast purchase entry: pick a category chip, type an amount (+ optional note),
// hit Add. Designed for 3 taps: chip, amount, Add.

import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
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

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
      >
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
              <AppText style={[styles.chipText, active && styles.chipTextActive]}>{c.name}</AppText>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.inputs}>
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
        <TextInput
          value={note}
          onChangeText={setNote}
          onSubmitEditing={submit}
          placeholder="Note (e.g. Kona Loa)"
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
    marginBottom: 10,
  },
  chips: {
    gap: 8,
    paddingBottom: 2,
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
  inputs: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  input: {
    backgroundColor: Colors.inputBg,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    borderRadius: Radii.button,
    color: Colors.text,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  amountInput: {
    flex: 1,
  },
  noteInput: {
    flex: 2,
  },
  inputError: {
    borderColor: Colors.toneOver,
  },
  addButton: {
    backgroundColor: Colors.accent,
    borderRadius: Radii.button,
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  addText: {
    color: Colors.onAccent,
    fontWeight: Type.weightSemibold,
    fontSize: 14,
    letterSpacing: 0.2,
  },
  status: {
    fontSize: 11,
    color: Colors.textFaint,
    marginTop: 8,
    minHeight: 14,
  },
});
