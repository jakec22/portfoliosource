import React, { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/useTheme';
import type { Theme } from '../theme';
import { radius, space, type } from '../theme/tokens';
import { SNACKBAR_MS, useSnackbar } from '../store/useSnackbar';

// Mounted once at the app root, above the tab bar. Shows the result of an
// action and, for a destructive one, the way back from it.
export function Snackbar() {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const insets = useSafeAreaInsets();

  const message = useSnackbar((s) => s.message);
  const actionLabel = useSnackbar((s) => s.actionLabel);
  const token = useSnackbar((s) => s.token);
  const runAction = useSnackbar((s) => s.runAction);
  const dismiss = useSnackbar((s) => s.dismiss);

  useEffect(() => {
    if (!message) return;
    // Closes over this snackbar's token, so replacing it mid-countdown does
    // not let the old timer dismiss the new one.
    const t = setTimeout(() => dismiss(token), SNACKBAR_MS);
    return () => clearTimeout(t);
  }, [message, token, dismiss]);

  if (!message) return null;

  return (
    <Animated.View
      entering={FadeInDown.duration(180)}
      exiting={FadeOutDown.duration(140)}
      // Clears the tab bar rather than sitting under it.
      style={[styles.wrap, { bottom: insets.bottom + 64 }]}
      pointerEvents="box-none"
    >
      <View style={styles.bar}>
        <Text style={styles.text} numberOfLines={2}>
          {message}
        </Text>
        {actionLabel ? (
          <TouchableOpacity
            onPress={runAction}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            activeOpacity={0.7}
          >
            <Text style={styles.action}>{actionLabel}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </Animated.View>
  );
}

const makeStyles = (c: Theme) =>
  StyleSheet.create({
    wrap: {
      position: 'absolute',
      left: space.lg,
      right: space.lg,
    },
    bar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.md,
      // text/bg is the one pair every pack guarantees contrast on, and it
      // inverts with the pack by itself. The gray ramp does not: gray900 is
      // the darkest ink on a light pack and the lightest on a dark one.
      backgroundColor: c.text,
      borderRadius: radius.control,
      paddingVertical: space.md,
      paddingHorizontal: space.lg,
      shadowColor: c.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 12,
      elevation: 8,
    },
    text: {
      ...type.caption(c),
      color: c.bg,
      flex: 1,
    },
    action: {
      // Separated from the message by weight and case, not hue: the pack
      // accents are tuned against the app ground, and several of them fail
      // against this bar.
      ...type.captionStrong(c),
      color: c.bg,
      textTransform: 'uppercase',
      letterSpacing: 0.9,
    },
  });
