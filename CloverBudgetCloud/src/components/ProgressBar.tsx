// Thin category progress bar: 8pt tall, 4pt radius, dark track.
// Animates width changes ~0.4s unless Reduce Motion is on.

import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { useReducedMotion } from '../lib/useReducedMotion';
import { BAR_ANIM_MS, Colors, Metrics, Radii } from '../theme/theme';

export function ProgressBar({ fraction, color }: { fraction: number; color: string }) {
  const target = Math.min(Math.max(fraction, 0), 1);
  const reduceMotion = useReducedMotion();
  const anim = useRef(new Animated.Value(target)).current;

  useEffect(() => {
    if (reduceMotion) {
      anim.setValue(target);
      return;
    }
    Animated.timing(anim, {
      toValue: target,
      duration: BAR_ANIM_MS,
      useNativeDriver: false,
    }).start();
  }, [target, reduceMotion, anim]);

  const width = anim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <View style={styles.track}>
      <Animated.View style={[styles.fill, { width, backgroundColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: Metrics.progressHeight,
    backgroundColor: Colors.inputBg,
    borderRadius: Radii.bar,
    marginTop: 8,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: Radii.bar,
  },
});
