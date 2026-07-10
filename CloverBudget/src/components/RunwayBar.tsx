// The signature element: total flexible spend vs total cap, with a vertical
// marker at today's position in the month. Green gradient when on pace, red
// when spending ahead of it. 26pt tall, 6pt radius, centered mono label.

import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { LinearGradient } from './LinearGradient';
import { AppText } from './ui';
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
  const gradient = pace.onPace ? [Colors.greenDark, Colors.green] : [Colors.redDark, Colors.red];

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
        <LinearGradient colors={gradient} style={StyleSheet.absoluteFill} />
      </Animated.View>
      <View style={styles.labelWrap} pointerEvents="none">
        <AppText mono style={styles.label} numberOfLines={1}>
          {fmtWhole(totalSpent)} of {fmtWhole(totalCap)} flexible spend
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    position: 'relative',
    height: Metrics.runwayHeight,
    backgroundColor: Colors.surface,
    borderRadius: Radii.runway,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  fillWrap: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
  },
  labelWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});
