import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Vibration } from 'react-native';
import { formatDuration } from '../utils/date';
import { useStore } from '../store/useStore';

const PRESETS = [60, 90, 120, 180]; // seconds

// A sticky rest-timer bar. Collapsed it shows quick-start presets; running it
// counts down with +30s and Skip, and buzzes when it hits zero. Auto-starts
// (using the last-used duration) when a set is completed, if enabled in Profile.
export function RestTimer() {
  const [endAt, setEndAt] = useState<number | null>(null);
  const [remaining, setRemaining] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const restTrigger = useStore((s) => s.restTrigger);
  const restDuration = useStore((s) => s.restDurationSeconds);
  const setRestDuration = useStore((s) => s.setRestDuration);
  // Ignore the trigger value present at mount; only react to later bumps.
  const lastTrigger = useRef(restTrigger);

  useEffect(() => {
    if (endAt == null) return;
    const tick = () => {
      const left = endAt - Date.now();
      if (left <= 0) {
        setRemaining(0);
        setEndAt(null);
        Vibration.vibrate(400);
      } else {
        setRemaining(left);
      }
    };
    tick();
    intervalRef.current = setInterval(tick, 250);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [endAt]);

  // Auto-start when a set is completed (store bumps restTrigger).
  useEffect(() => {
    if (restTrigger === lastTrigger.current) return;
    lastTrigger.current = restTrigger;
    setEndAt(Date.now() + restDuration * 1000);
  }, [restTrigger, restDuration]);

  function start(seconds: number) {
    setRestDuration(seconds); // remember this length for the next auto-start
    setEndAt(Date.now() + seconds * 1000);
  }

  function addTime(seconds: number) {
    setEndAt((prev) => (prev ?? Date.now()) + seconds * 1000);
  }

  function skip() {
    setEndAt(null);
    setRemaining(0);
  }

  if (endAt == null) {
    return (
      <View style={styles.bar}>
        <Text style={styles.restLabel}>Rest</Text>
        <View style={styles.presets}>
          {PRESETS.map((p) => (
            <TouchableOpacity key={p} style={styles.presetBtn} onPress={() => start(p)}>
              <Text style={styles.presetText}>{formatDuration(p * 1000)}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.bar, styles.barRunning]}>
      <Text style={styles.countdown}>{formatDuration(remaining)}</Text>
      <View style={styles.runningActions}>
        <TouchableOpacity style={styles.addBtn} onPress={() => addTime(30)}>
          <Text style={styles.addText}>+30s</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.skipBtn} onPress={skip}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  barRunning: { backgroundColor: '#ECFDF5' },
  restLabel: { fontSize: 14, fontWeight: '700', color: '#6B7280' },
  presets: { flexDirection: 'row', gap: 8 },
  presetBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  presetText: { fontSize: 13, fontWeight: '700', color: '#059669' },
  countdown: { fontSize: 22, fontWeight: '800', color: '#065F46', fontVariant: ['tabular-nums'] },
  runningActions: { flexDirection: 'row', gap: 10 },
  addBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#D1FAE5',
  },
  addText: { fontSize: 14, fontWeight: '700', color: '#059669' },
  skipBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#10B981',
  },
  skipText: { fontSize: 14, fontWeight: '700', color: '#fff' },
});
