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
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
      backgroundColor: c.card,
    },
    cancel: { fontSize: 16, color: c.textMuted, width: 50 },
    title: { fontSize: 16, fontWeight: '700', color: c.text },

    searchWrap: { padding: 16, paddingBottom: 8 },
    searchInput: {
      backgroundColor: c.input,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.border,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 15,
      color: c.text,
    },

    content: { paddingHorizontal: 16, paddingBottom: 40 },

    customRow: {
      backgroundColor: c.primarySoft,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.scheme === 'dark' ? 'rgba(16,185,129,0.4)' : '#A7F3D0',
      paddingVertical: 14,
      paddingHorizontal: 14,
      marginBottom: 16,
    },
    customRowText: { fontSize: 15, fontWeight: '700', color: c.primaryDark },

    emptyText: { fontSize: 14, color: c.textMuted, textAlign: 'center', marginTop: 20 },

    group: { marginBottom: 18 },
    groupTitle: {
      fontSize: 12,
      fontWeight: '700',
      color: c.textFaint,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 8,
    },
    row: {
      backgroundColor: c.card,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: c.border,
      paddingVertical: 12,
      paddingHorizontal: 14,
      marginBottom: 8,
    },
    rowText: { fontSize: 15, color: c.text, fontWeight: '500' },
  });
