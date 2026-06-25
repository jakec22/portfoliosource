import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { WorkoutSession } from '../types';
import { displayDate } from '../utils/date';
import { useTheme } from '../theme/useTheme';
import type { Theme } from '../theme';

interface Props {
  session: WorkoutSession;
  onPress: () => void;
  onDelete: () => void;
  // Show the date in the meta line (History groups by day, so it hides it).
  showDate?: boolean;
}

// A single past-workout row: tap to open its summary, or swipe left to reveal
// a Delete button.
export function WorkoutHistoryItem({ session, onPress, onDelete, showDate = true }: Props) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const totalSets = session.exercises.reduce((n, e) => n + e.sets.length, 0);
  const doneSets = session.exercises.reduce(
    (n, e) => n + e.sets.filter((s) => s.completed).length,
    0
  );
  const exCount = session.exercises.length;

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
        <Text style={styles.chevron}>›</Text>
      </View>
    </ReanimatedSwipeable>
  );
}

const makeStyles = (c: Theme) => StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: c.border,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  main: { flex: 1 },
  name: { fontSize: 15, fontWeight: '600', color: c.text },
  meta: { fontSize: 12, color: c.textFaint, marginTop: 3 },
  chevron: { fontSize: 22, color: c.textFaint, fontWeight: '300', marginLeft: 6 },
  swipeDelete: {
    backgroundColor: c.danger,
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    borderRadius: 12,
    marginBottom: 10,
    marginLeft: 8,
  },
  swipeDeleteText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
