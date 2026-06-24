import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Vibration } from 'react-native';
import { formatDuration } from '../utils/date';
import { useStore } from '../store/useStore';
import { AnimatedHeart } from './AnimatedHeart';

interface Props {
  /** Live BPM from the heart-rate monitor, or null when unavailable. */
  bpm: number | null;
}

// Color the readout by intensity zone.
function zoneColor(bpm: number): string {
  if (bpm >= 160) return '#EF4444'; // high
  if (bpm >= 120) return '#F59E0B'; // moderate
  return '#10B981'; // easy
}

// The sticky bottom bar during an active workout. Left: live heart rate with a
// pulsing heart. Right: the rest countdown — auto-starts when a set is checked
// off (using the Profile default rest length), with +30s / Skip while running,
// or a manual "Rest" button when idle.
export function WorkoutStatusBar({ bpm }: Props) {
  const [endAt, setEndAt] = useState<number | null>(null);
  const [remaining, setRemaining] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const restTrigger = useStore((s) => s.restTrigger);
  const defaultRest = useStore((s) => s.defaultRestSeconds);
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
    setEndAt(Date.now() + defaultRest * 1000);
  }, [restTrigger, defaultRest]);

  const running = endAt != null;
  const hasHeart = bpm != null;

  return (
    <View style={[styles.bar, running && styles.barRunning]}>
      {/* Heart rate */}
      <View style={styles.hrSide}>
        {hasHeart ? (
          <>
            <AnimatedHeart bpm={bpm} size={22} />
            <View style={styles.hrText}>
              <Text style={[styles.hrValue, { color: zoneColor(bpm!) }]}>
                {bpm}
                <Text style={styles.hrUnit}> bpm</Text>
              </Text>
              <Text style={styles.hrLabel}>Heart rate</Text>
            </View>
          </>
        ) : (
          <View style={styles.hrText}>
            <Text style={styles.hrIdle}>♡ ‑‑ bpm</Text>
            <Text style={styles.hrLabel}>No Watch data</Text>
          </View>
        )}
      </View>

      {/* Rest timer */}
      <View style={styles.restSide}>
        {running ? (
          <>
            <Text style={styles.countdown}>{formatDuration(remaining)}</Text>
            <TouchableOpacity
              style={styles.addBtn}
              onPress={() => setEndAt((p) => (p ?? Date.now()) + 30 * 1000)}
            >
              <Text style={styles.addText}>+30s</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.skipBtn}
              onPress={() => {
                setEndAt(null);
                setRemaining(0);
              }}
            >
              <Text style={styles.skipText}>Skip</Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity
            style={styles.restBtn}
            onPress={() => setEndAt(Date.now() + defaultRest * 1000)}
          >
            <Text style={styles.restBtnText}>Rest {formatDuration(defaultRest * 1000)}</Text>
          </TouchableOpacity>
        )}
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

  // Heart rate (left)
  hrSide: { flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 110 },
  hrText: { justifyContent: 'center' },
  hrValue: { fontSize: 20, fontWeight: '800', fontVariant: ['tabular-nums'] },
  hrUnit: { fontSize: 12, fontWeight: '600', color: '#9CA3AF' },
  hrLabel: { fontSize: 10, color: '#9CA3AF', marginTop: 1 },
  hrIdle: { fontSize: 18, fontWeight: '700', color: '#D1D5DB' },

  // Rest (right)
  restSide: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  countdown: { fontSize: 22, fontWeight: '800', color: '#065F46', fontVariant: ['tabular-nums'] },
  addBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: '#D1FAE5' },
  addText: { fontSize: 14, fontWeight: '700', color: '#059669' },
  skipBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: '#10B981' },
  skipText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  restBtn: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  restBtnText: { fontSize: 14, fontWeight: '700', color: '#059669' },
});
