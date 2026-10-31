import React, { useEffect, useRef, useState } from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

// A number that travels to its new value instead of cutting to it.
//
// Logging a food changes the headline figure, and a cut gives no sign that
// the tap landed — which is how a second tap and a duplicate entry happen.
// Counting is the receipt, so the screen needs no success dialog.
//
// Not a reanimated shared value: this drives text content, which has to cross
// to the JS side on every frame anyway. A timer at ~30fps for a third of a
// second is cheaper than a worklet plus a bridge hop per frame.

const DURATION_MS = 340;
const FRAME_MS = 32;

interface Props {
  value: number;
  style?: StyleProp<TextStyle>;
  /** Printed form of the number, e.g. adding a thousands separator. */
  format?: (n: number) => string;
}

export function CountUp({ value, style, format }: Props) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    // Honour the system setting, and skip the work on the first render so a
    // screen does not animate up from zero when it opens.
    if (reduceMotion || from.current === value) {
      from.current = value;
      setShown(value);
      return;
    }
    const start = Date.now();
    const begin = from.current;
    const delta = value - begin;
    const id = setInterval(() => {
      const t = Math.min(1, (Date.now() - start) / DURATION_MS);
      // Ease out: fast at first, settling at the end.
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(Math.round(begin + delta * eased));
      if (t >= 1) {
        clearInterval(id);
        from.current = value;
      }
    }, FRAME_MS);
    return () => {
      clearInterval(id);
      from.current = value;
    };
  }, [value, reduceMotion]);

  return <Text style={style}>{format ? format(shown) : shown}</Text>;
}
