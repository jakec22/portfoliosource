import React, { useEffect } from 'react';
import { TextStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  cancelAnimation,
  Easing,
} from 'react-native-reanimated';

interface Props {
  /** Current BPM — drives the pulse speed. Null/0 falls back to a calm 60bpm. */
  bpm: number | null;
  size?: number;
}

// A ❤️ that beats in time with the heart rate: a quick squeeze up then a
// slower relax down, once per beat. The interval is derived from BPM so a
// higher heart rate visibly pulses faster.
export function AnimatedHeart({ bpm, size = 22 }: Props) {
  const scale = useSharedValue(1);

  useEffect(() => {
    const safeBpm = bpm && bpm > 0 ? bpm : 60;
    // ms per beat, clamped so extremes stay watchable.
    const beatMs = Math.min(1400, Math.max(320, 60000 / safeBpm));
    scale.value = withRepeat(
      withSequence(
        withTiming(1.32, { duration: beatMs * 0.26, easing: Easing.out(Easing.quad) }),
        withTiming(1.0, { duration: beatMs * 0.74, easing: Easing.in(Easing.quad) })
      ),
      -1, // infinite
      false
    );
    return () => cancelAnimation(scale);
  }, [bpm, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const textStyle: TextStyle = { fontSize: size };

  return <Animated.Text style={[textStyle, animatedStyle]}>❤️</Animated.Text>;
}
