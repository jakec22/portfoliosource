import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { WorkoutSession } from '../types';
import { displayDate } from '../utils/date';

interface Props {
  session: WorkoutSession;
  onPress: () => void;
  onDelete: () => void;
  // Show the date in the meta line (History groups by day, so it hides it).
  showDate?: boolean;
}

// A single past-workout row: tap to open its summary, swipe left for a Delete
// button, or tap the ✕ (with confirmation) to remove it.
export function WorkoutHistoryItem({ session, onPress, onDelete, showDate = true }: Props) {
  const totalSets = session.exercises.reduce((n, e) => n + e.sets.length, 0);
  const doneSets = session.exercises.reduce(
    (n, e) => n + e.sets.filter((s) => s.completed).length,
    0
  );
  const exCount = session.exercises.length;

  function confirmDelete() {
    Alert.alert('Delete workout', `Delete "${session.name}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: onDelete },
    ]);
  }

  return (
    <ReanimatedSwipeable
      renderRightActions={() => (
        <TouchableOpacity style={styles.swipeDelete} onPress={onDelete}>
          <Text style={styles.swipeDeleteText}>Delete</Text>
        </TouchableOpacity>
      )}
      overshootRight={false}
      friction={2}
    >
      <View style={styles.row}>
        <TouchableOpacity style={styles.main} onPress={onPress} activeOpacity={0.7}>
          <Text style={styles.name} numberOfLines={1}>
            {session.name}
          </Text>
          <Text style={styles.meta} numberOfLines={1}>
            {showDate ? `${displayDate(session.date)} · ` : ''}
            {exCount} exercise{exCount === 1 ? '' : 's'} · {doneSets}/{totalSets} sets
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={confirmDelete}
          style={styles.xBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.xText}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.chevron}>›</Text>
      </View>
    </ReanimatedSwipeable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EEF0F2',
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  main: { flex: 1 },
  name: { fontSize: 15, fontWeight: '600', color: '#111827' },
  meta: { fontSize: 12, color: '#9CA3AF', marginTop: 3 },
  xBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  xText: { color: '#EF4444', fontSize: 12, fontWeight: '700' },
  chevron: { fontSize: 22, color: '#D1D5DB', fontWeight: '300', marginLeft: 6 },
  swipeDelete: {
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    borderRadius: 12,
    marginBottom: 10,
    marginLeft: 8,
  },
  swipeDeleteText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
