// The signature element: total flexible spend vs total cap, rendered as a
// single tonal bar. Calm/dim graphite when on pace, bright when spending ahead
// of the month. Numeric captions live around the bar (see DashboardScreen) so
// the fill can go full-white without swallowing an overlaid label.

import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { LinearGradient } from './LinearGradient';
import { useReducedMotion } from '../lib/useReducedMotion';
import { BAR_ANIM_MS, Colors, Metrics, Radii } from '../theme/theme';
import { fmtWhole } from '../lib/money';
import type { Pace } from '../lib/budget';

interface RunwayBarProps {
  pace: Pace;
  totalSpent: number; // cents
  totalCap: number; // cents
}

export function RunwayBar({ pace, totalSpent, totalCap }: RunwayBarProps) {
  const reduceMotion = useReducedMotion();
  const anim = useRef(new Animated.Value(pace.spendFraction)).current;

  useEffect(() => {
    if (reduceMotion) {
      anim.setValue(pace.spendFraction);
      return;
    }
    Animated.timing(anim, {
      toValue: pace.spendFraction,
      duration: BAR_ANIM_MS,
      useNativeDriver: false,
    }).start();
  }, [pace.spendFraction, reduceMotion, anim]);

  const width = anim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  const gradient = pace.onPace ? Colors.runwayOnPace : Colors.runwayAhead;

  const a11y = `${fmtWhole(totalSpent)} spent of ${fmtWhole(totalCap)} flexible cap, ${
    pace.onPace ? 'on pace' : 'ahead of pace'
  }`;

  return (
    <View
      style={styles.track}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={a11y}
    >
      <Animated.View style={[styles.fillWrap, { width }]}>
        <LinearGradient colors={[...gradient]} style={StyleSheet.absoluteFill} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    position: 'relative',
    height: Metrics.runwayHeight,
    backgroundColor: Colors.surface,
    borderRadius: Radii.runway,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    overflow: 'hidden',
  },
  fillWrap: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
  },
});
