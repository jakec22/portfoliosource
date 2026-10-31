import React, { useMemo, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EXERCISE_CATALOG } from '../utils/exerciseList';
import { useTheme } from '../theme/useTheme';
import type { Theme } from '../theme';
import { radius, space, type } from '../theme/tokens';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelect: (name: string) => void;
}

// Search + browse a curated exercise catalog, or type any name of your own —
// typing something that isn't in the catalog surfaces a "use as typed" row
// instead of blocking the free-text case the app has always supported.
export function ExercisePickerModal({ visible, onClose, onSelect }: Props) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [query, setQuery] = useState('');

  const trimmed = query.trim();
  const filtered = useMemo(() => {
    if (!trimmed) return EXERCISE_CATALOG;
    const q = trimmed.toLowerCase();
    return EXERCISE_CATALOG.map((group) => ({
      category: group.category,
      exercises: group.exercises.filter((name) => name.toLowerCase().includes(q)),
    })).filter((group) => group.exercises.length > 0);
  }, [trimmed]);

  const exactMatch = useMemo(
    () =>
      trimmed.length > 0 &&
      EXERCISE_CATALOG.some((group) =>
        group.exercises.some((name) => name.toLowerCase() === trimmed.toLowerCase())
      ),
    [trimmed]
  );

  function handleSelect(name: string) {
    setQuery('');
    onSelect(name);
    onClose();
  }

  function handleClose() {
    setQuery('');
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose}>
            <Text style={styles.cancel}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Choose Exercise</Text>
          <View style={{ width: 50 }} />
        </View>

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.searchWrap}>
            <TextInput
              style={styles.searchInput}
              value={query}
              onChangeText={setQuery}
              placeholder="Search or type your own exercise"
              placeholderTextColor={c.textFaint}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={() => trimmed && handleSelect(trimmed)}
            />
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
            {trimmed.length > 0 && !exactMatch && (
              <TouchableOpacity
                style={styles.customRow}
                onPress={() => handleSelect(trimmed)}
                activeOpacity={0.7}
              >
                <Text style={styles.customRowText}>Use “{trimmed}”</Text>
              </TouchableOpacity>
            )}

            {filtered.length === 0 ? (
              <Text style={styles.emptyText}>No matches — tap “Use” above to add it as typed.</Text>
            ) : (
              filtered.map((group) => (
                <View key={group.category} style={styles.group}>
                  <Text style={styles.groupTitle}>{group.category}</Text>
                  {group.exercises.map((name) => (
                    <TouchableOpacity
                      key={name}
                      style={styles.row}
                      onPress={() => handleSelect(name)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.rowText}>{name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ))
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const makeStyles = (c: Theme) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: space.lg,
      // Extra top clearance, not just SafeAreaView's edges=['top']: inside a
      // bare <Modal> that alone wasn't reliably clearing the status bar,
      // leaving Cancel rendered underneath the clock and unclickable —
      // same class of issue BarcodeScanner works around with a fixed offset.
      paddingTop: space.xxxl,
      paddingBottom: space.md,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
      backgroundColor: c.card,
    },
    cancel: { ...type.body(c), color: c.textMuted, width: 50 },
    title: { ...type.bodyStrong(c), color: c.text },

    searchWrap: { padding: space.lg, paddingBottom: space.sm },
    searchInput: {
      ...type.body(c),
      backgroundColor: c.input,
      borderRadius: radius.control,
      borderWidth: 1,
      borderColor: c.border,
      paddingHorizontal: space.lg,
      paddingVertical: space.md,
      color: c.text,
    },

    content: { paddingHorizontal: space.lg, paddingBottom: space.xxxl },

    customRow: {
      backgroundColor: c.primarySoft,
      borderRadius: radius.card,
      borderWidth: 1,
      borderColor: `${c.primary}66`,
      paddingVertical: space.lg,
      paddingHorizontal: space.lg,
      marginBottom: space.lg,
    },
    customRowText: { ...type.bodyStrong(c), color: c.primaryDark },

    emptyText: { ...type.body(c), color: c.textMuted, textAlign: 'center', marginTop: space.lg },

    group: { marginBottom: space.lg },
    groupTitle: {
      ...type.overline(c),
      color: c.textFaint,
      marginBottom: space.sm,
    },
    row: {
      backgroundColor: c.card,
      borderRadius: radius.card,
      borderWidth: 1,
      borderColor: c.border,
      paddingVertical: space.md,
      paddingHorizontal: space.lg,
      marginBottom: space.sm,
    },
    rowText: { ...type.body(c), color: c.text },
  });
