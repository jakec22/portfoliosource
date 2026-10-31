import React, { useMemo } from 'react';
import {
  InputAccessoryView,
  Keyboard,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme } from '../theme/useTheme';
import type { Theme } from '../theme';
import { space, type } from '../theme/tokens';

export const DONE_ACCESSORY_ID = 'keyboard-done-accessory';

// Renders a "Done" bar above the iOS number-pad keyboard.
// Attach to a TextInput via inputAccessoryViewID={DONE_ACCESSORY_ID}.
// Returns null on Android (which already has a dismiss key).
export function KeyboardDoneAccessory() {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  if (Platform.OS !== 'ios') return null;
  return (
    <InputAccessoryView nativeID={DONE_ACCESSORY_ID}>
      <View style={styles.bar}>
        <TouchableOpacity
          onPress={() => Keyboard.dismiss()}
          hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}
        >
          <Text style={styles.done}>Done</Text>
        </TouchableOpacity>
      </View>
    </InputAccessoryView>
  );
}

const makeStyles = (c: Theme) => StyleSheet.create({
  bar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    backgroundColor: c.cardMuted,
    borderTopWidth: 1,
    borderTopColor: c.border,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
  },
  done: {
    ...type.bodyStrong(c),
    color: c.primary,
    paddingHorizontal: space.sm,
    paddingVertical: space.xxs,
  },
});
