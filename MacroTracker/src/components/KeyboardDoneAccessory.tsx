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

// Shared id so any numeric TextInput can attach to this toolbar via
// inputAccessoryViewID={DONE_ACCESSORY_ID}.
export const DONE_ACCESSORY_ID = 'keyboard-done-accessory';

// iOS number-pad / decimal-pad keyboards have no return key, so there is no
// built-in way to dismiss them. This renders a small toolbar above the
// keyboard with a "Done" button that closes it. Render it once anywhere in a
// screen that uses numeric inputs; Android ignores InputAccessoryView so it
// renders nothing there (the keyboard already has a return/down key).
export function KeyboardDoneAccessory() {
  if (Platform.OS !== 'ios') return null;
  return (
    <InputAccessoryView nativeID={DONE_ACCESSORY_ID}>
      <View style={styles.bar}>
        <TouchableOpacity onPress={() => Keyboard.dismiss()} hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}>
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
