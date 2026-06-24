import React from 'react';
import {
  InputAccessoryView,
  Keyboard,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

export const DONE_ACCESSORY_ID = 'keyboard-done-accessory';

// Renders a "Done" bar above the iOS number-pad keyboard.
// Attach to a TextInput via inputAccessoryViewID={DONE_ACCESSORY_ID}.
// Returns null on Android (which already has a dismiss key).
export function KeyboardDoneAccessory() {
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

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  done: {
    fontSize: 16,
    fontWeight: '700',
    color: '#10B981',
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
});
