import React, { useCallback, useMemo, useRef, useState } from 'react';
import { View, PanResponder, StyleSheet, type LayoutChangeEvent } from 'react-native';
import { useTheme } from '../theme/useTheme';
import type { Theme } from '../theme';
import { radius, space } from '../theme/tokens';

interface Props {
  /** 0–100, this macro's share of the macro calories. */
  percent: number;
  color: string;
  /** Called continuously during the drag with the new 0–100 share. */
  onChange: (percent: number) => void;
  accessibilityLabel: string;
}

/**
 * The drag half of a macro row. The gram field beside it is the other half.
 *
 * There was a version of this before, and it was removed for three reasons
 * (see 7ef08ed). All three were in the wiring rather than the idea, so this
 * is the same idea wired differently:
 *
 *  1. It kept its own percentage state next to the gram fields, so the same
 *     number existed twice and the two could disagree. This one holds
 *     nothing. The percentage comes from the grams and the drag writes the
 *     grams back; there is one value and both controls are views onto it.
 *
 *  2. onStartShouldSetPanResponder returned true, which claims the gesture
 *     the instant a finger lands. Inside a ScrollView that means the slider
 *     eats every touch that happens to begin on it, including the ones that
 *     were trying to scroll the page. This one never claims on start and
 *     claims on move only once the finger has travelled further across than
 *     down — a vertical drag scrolls, a horizontal drag slides, and the
 *     decision is made from the gesture rather than from where it started.
 *
 *     The cost is that a tap on the track does nothing. That is the right
 *     trade: a tap that jumps the value is worth less than a page that
 *     scrolls wherever you put your finger.
 *
 *  3. It rebalanced the two macros you were not touching, silently. It still
 *     rebalances — that is the point of a split — but during a drag all
 *     three rows move together under your finger, which is the difference
 *     between a thing that is explained and a thing that is hidden.
 */
export function MacroSlider({ percent, color, onChange, accessibilityLabel }: Props) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  const [width, setWidth] = useState(0);
  // Read inside the responder callbacks, which are created once and would
  // otherwise close over the first render's values forever.
  const widthRef = useRef(0);
  const startPct = useRef(0);
  const pctRef = useRef(percent);
  pctRef.current = percent;

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    widthRef.current = e.nativeEvent.layout.width;
    setWidth(e.nativeEvent.layout.width);
  }, []);

  const responder = useMemo(
    () =>
      PanResponder.create({
        // Never on start. See the note above: this is the whole reason the
        // page scrolls normally with a slider under the finger.
        onStartShouldSetPanResponder: () => false,
        onStartShouldSetPanResponderCapture: () => false,
        onMoveShouldSetPanResponder: (_, gs) =>
          Math.abs(gs.dx) > 6 && Math.abs(gs.dx) > Math.abs(gs.dy),
        onMoveShouldSetPanResponderCapture: (_, gs) =>
          Math.abs(gs.dx) > 6 && Math.abs(gs.dx) > Math.abs(gs.dy),
        onPanResponderGrant: () => {
          startPct.current = pctRef.current;
        },
        onPanResponderMove: (_, gs) => {
          const w = widthRef.current;
          if (w <= 0) return;
          // Relative to where the drag began rather than absolute to the
          // finger: the gesture is only claimed after 6pt of travel, so an
          // absolute reading would jump the value by that much the moment
          // it engaged.
          const next = startPct.current + (gs.dx / w) * 100;
          onChange(Math.max(0, Math.min(100, Math.round(next))));
        },
        // The parent owns the value, so there is nothing to settle here.
        onPanResponderTerminationRequest: () => false,
      }),
    [onChange]
  );

  const clamped = Math.max(0, Math.min(100, percent));

  return (
    <View
      style={styles.wrap}
      onLayout={onLayout}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped) }}
      // VoiceOver and TalkBack cannot drag, so they get the same control
      // through the increment/decrement actions every adjustable exposes.
      onAccessibilityAction={(e) => {
        if (e.nativeEvent.actionName === 'increment') onChange(Math.min(100, clamped + 1));
        if (e.nativeEvent.actionName === 'decrement') onChange(Math.max(0, clamped - 1));
      }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      {...responder.panHandlers}
    >
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${clamped}%` as any, backgroundColor: color }]} />
      </View>
      {width > 0 && (
        <View
          pointerEvents="none"
          style={[
            styles.knob,
            { borderColor: color, left: (clamped / 100) * width - KNOB / 2 },
          ]}
        />
      )}
    </View>
  );
}

const KNOB = 18;

const makeStyles = (c: Theme) =>
  StyleSheet.create({
    // 44 tall even though the track is 6: the touch target is the row, not
    // the line, and a 6pt drag target is unusable.
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
      borderRadius: radius.pill,
      borderWidth: 3,
      backgroundColor: c.card,
    },
  });
