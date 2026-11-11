import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { View, StyleSheet, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS, useSharedValue } from 'react-native-reanimated';
import { useTheme } from '../theme/useTheme';
import type { Theme } from '../theme';
import { radius, space } from '../theme/tokens';

interface Props {
  /** 0–100, this macro's share of the calorie goal. */
  percent: number;
  color: string;
  /** Called with the new 0–100 share as the drag moves. */
  onChange: (percent: number) => void;
  accessibilityLabel: string;
}

/**
 * The drag half of a macro row. The gram field beside it is the other half.
 *
 * Built on react-native-gesture-handler rather than PanResponder, after two
 * attempts with the latter failed in different ways:
 *
 *  - The first claimed the gesture on touch-down, which inside a ScrollView
 *    means eating every touch that begins on the control, including the
 *    ones trying to scroll the page.
 *  - The second refused to claim on start and waited for 6pt of horizontal
 *    travel instead, which fixed scrolling and broke dragging. PanResponder
 *    cannot negotiate with a ScrollView's native scroll: by the time that
 *    threshold was crossed the ScrollView had already taken the responder.
 *    It also rebuilt itself on every render — its only dependency was an
 *    inline arrow from the parent — so each move swapped a fresh responder
 *    in underneath the gesture already in flight.
 *
 * activeOffsetX and failOffsetY are the thing neither attempt had. They are
 * declarations to the native gesture system rather than guesses made in JS:
 * claim once the finger has gone 6pt sideways, give up the moment it goes
 * 12pt down. The ScrollView and this slider then arbitrate natively, which
 * is the only place that decision can be made correctly.
 *
 * The gesture is built once. Its callback reaches the current onChange
 * through a ref, so a re-render mid-drag — and there is one on every
 * percent, since the parent rebalances the other two macros — cannot
 * replace the gesture that is running.
 */
export function MacroSlider({ percent, color, onChange, accessibilityLabel }: Props) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  const width = useSharedValue(0);
  const startPct = useSharedValue(0);
  // Last value handed to JS, so a drag across one percent does not fire a
  // state update for every frame it spends there.
  const lastSent = useSharedValue(-1);
  // The prop, readable from the UI thread at the moment a drag begins.
  // Mirrored in an effect rather than assigned during render, which
  // Reanimated warns about and which can land in the wrong frame.
  const live = useSharedValue(percent);
  useEffect(() => {
    live.value = percent;
  }, [percent, live]);

  const cb = useRef(onChange);
  cb.current = onChange;
  const emit = useCallback((v: number) => cb.current(v), []);

  const onLayout = useCallback(
    (e: LayoutChangeEvent) => {
      width.value = e.nativeEvent.layout.width;
    },
    [width]
  );

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-6, 6])
        .failOffsetY([-12, 12])
        .onBegin(() => {
          startPct.value = live.value;
          lastSent.value = -1;
        })
        .onUpdate((e) => {
          if (width.value <= 0) return;
          const next = startPct.value + (e.translationX / width.value) * 100;
          const rounded = Math.round(Math.max(0, Math.min(100, next)));
          if (rounded !== lastSent.value) {
            lastSent.value = rounded;
            runOnJS(emit)(rounded);
          }
        }),
    [emit, lastSent, live, startPct, width]
  );

  const clamped = Math.max(0, Math.min(100, percent));

  return (
    <GestureDetector gesture={pan}>
      <View
        style={styles.wrap}
        onLayout={onLayout}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={accessibilityLabel}
        accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped) }}
        // VoiceOver and TalkBack cannot drag, so they get the same control
        // through the actions every adjustable exposes.
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) => {
          if (e.nativeEvent.actionName === 'increment') onChange(Math.min(100, clamped + 1));
          if (e.nativeEvent.actionName === 'decrement') onChange(Math.max(0, clamped - 1));
        }}
      >
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${clamped}%` as any, backgroundColor: color }]} />
        </View>
        <View
          pointerEvents="none"
          style={[styles.knob, { borderColor: color, left: `${clamped}%` as any }]}
        />
      </View>
    </GestureDetector>
  );
}

const KNOB = 20;

const makeStyles = (c: Theme) =>
  StyleSheet.create({
    // 44 tall though the track is 6: the target is the row, not the line.
    wrap: { height: 44, justifyContent: 'center', marginTop: space.xs },
    track: {
      height: 6,
      borderRadius: radius.hairline,
      backgroundColor: c.borderStrong,
      overflow: 'hidden',
    },
    fill: { height: '100%', borderRadius: radius.hairline },
    knob: {
      position: 'absolute',
      width: KNOB,
      height: KNOB,
      // Percentage left with a half-width pull-back, so the knob tracks the
      // fill without needing the measured width in JS.
      marginLeft: -KNOB / 2,
      borderRadius: radius.pill,
      borderWidth: 3,
      backgroundColor: c.card,
    },
  });
