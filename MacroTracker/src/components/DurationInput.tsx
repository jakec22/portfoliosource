import React, { useEffect, useState } from 'react';
import { TextInput, StyleProp, TextStyle } from 'react-native';
import { formatDuration, parseDuration } from '../utils/duration';

interface Props {
  seconds: number;
  onChange: (seconds: number) => void;
  style?: StyleProp<TextStyle>;
  placeholder?: string;
  placeholderTextColor?: string;
  inputAccessoryViewID?: string;
}

/**
 * A time-entry field that displays/edits a duration as "m:ss" while storing a
 * raw seconds value. Keeps local text state so typing (e.g. "1:" then "30")
 * isn't clobbered by mid-edit reformatting; re-syncs from the prop when the
 * value changes externally and the field isn't focused.
 */
export function DurationInput({
  seconds,
  onChange,
  style,
  placeholder = '0:00',
  placeholderTextColor,
  inputAccessoryViewID,
}: Props) {
  const [text, setText] = useState(seconds > 0 ? formatDuration(seconds) : '');
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setText(seconds > 0 ? formatDuration(seconds) : '');
  }, [seconds, focused]);

  return (
    <TextInput
      style={style}
      value={text}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false);
        setText(seconds > 0 ? formatDuration(seconds) : '');
      }}
      onChangeText={(v) => {
        const cleaned = v.replace(/[^0-9:]/g, '');
        setText(cleaned);
        onChange(parseDuration(cleaned));
      }}
      keyboardType="numbers-and-punctuation"
      placeholder={placeholder}
      placeholderTextColor={placeholderTextColor}
      inputAccessoryViewID={inputAccessoryViewID}
    />
  );
}
