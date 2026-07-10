// A user-editable list of name+amount rows for the "About the plan" screen
// (fixed costs, recurring income, subscriptions). Each row can be deleted;
// the form at the bottom adds a new one. Layout mirrors LogPurchase: full-width
// name field, then amount + Add on their own row, so nothing gets clipped at
// phone widths.

import React, { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { AppText, Card } from './ui';
import { Colors, Radii, Type } from '../theme/theme';
import { fmtCents, fmtWhole, parseDollarsToCents } from '../lib/money';
import type { PlanItem } from '../types';

interface EditablePlanListProps {
  items: PlanItem[];
  /** Display amounts with cents (subscriptions) instead of whole dollars. */
  cents?: boolean;
  namePlaceholder?: string;
  onAdd: (input: { name: string; amount: number }) => void;
  onRemove: (id: string) => void;
}

export function EditablePlanList({
  items,
  cents = false,
  namePlaceholder = 'Name',
  onAdd,
  onRemove,
}: EditablePlanListProps) {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState(false);

  const nameInvalid = error && name.trim() === '';
  const amountInvalid = error && parseDollarsToCents(amount) === null;

  const submit = () => {
    const trimmed = name.trim();
    const parsedCents = parseDollarsToCents(amount);
    if (!trimmed || parsedCents === null) {
      setError(true);
      return;
    }
    onAdd({ name: trimmed, amount: parsedCents });
    setName('');
    setAmount('');
    setError(false);
  };

  return (
    <Card style={styles.card}>
      {items.map((item, i) => (
        <View key={item.id} style={[styles.row, i < items.length - 1 && styles.rowDivider]}>
          <AppText style={styles.name} numberOfLines={1}>
            {item.name}
          </AppText>
          <AppText mono style={styles.amount} numberOfLines={1}>
            {cents ? fmtCents(item.amount) : fmtWhole(item.amount)}
          </AppText>
          <Pressable
            onPress={() => onRemove(item.id)}
            accessibilityRole="button"
            accessibilityLabel={`Delete ${item.name}`}
            hitSlop={8}
            style={styles.deleteBtn}
          >
            <AppText style={styles.deleteX}>×</AppText>
          </Pressable>
        </View>
      ))}

      <View style={[styles.addSection, items.length > 0 && styles.addSectionDivider]}>
        <TextInput
          value={name}
          onChangeText={(t) => {
            setName(t);
            if (error) setError(false);
          }}
          onSubmitEditing={submit}
          placeholder={namePlaceholder}
          placeholderTextColor={Colors.textFaint}
          returnKeyType="next"
          style={[styles.input, nameInvalid && styles.inputError]}
        />
        <View style={styles.addRow}>
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
            style={[styles.input, styles.amountInput, amountInvalid && styles.inputError]}
          />
          <Pressable onPress={submit} style={styles.addButton} accessibilityRole="button">
            <AppText style={styles.addText}>Add</AppText>
          </Pressable>
        </View>
        {error && (
          <AppText style={styles.errorText}>Enter a name and an amount greater than 0</AppText>
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingHorizontal: 14,
    paddingTop: 2,
    paddingBottom: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  name: {
    flex: 1,
    minWidth: 0,
    fontSize: 13,
    color: Colors.textSecondary,
  },
  amount: {
    fontSize: 13,
    color: Colors.textMuted,
    flexShrink: 0,
  },
  deleteBtn: {
    paddingHorizontal: 4,
    flexShrink: 0,
  },
  deleteX: {
    fontSize: 18,
    color: Colors.textFaint,
    lineHeight: 18,
  },
  addSection: {
    paddingTop: 12,
  },
  addSectionDivider: {
    marginTop: 2,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
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
  inputError: {
    borderColor: Colors.warning,
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 8,
    marginTop: 8,
  },
  amountInput: {
    flex: 1,
    minWidth: 0,
  },
  addButton: {
    backgroundColor: Colors.accent,
    borderRadius: Radii.button,
    paddingHorizontal: 22,
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
  errorText: {
    fontSize: 11,
    color: Colors.warning,
    marginTop: 8,
  },
});
