import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useSheetAnimation } from '../hooks/useSheetAnimation';
import { useTheme } from '../theme/useTheme';
import type { Theme } from '../theme';
import { radius, space, type } from '../theme/tokens';
import { Icon } from './Icon';
import type { DesignRequest, EquipmentAccess } from '../services/workoutDesign';

interface Props {
  visible: boolean;
  busy?: boolean;
  onClose: () => void;
  onSubmit: (req: Omit<DesignRequest, 'experience'>) => void;
}

const DAYS = [2, 3, 4, 5] as const;
const MINUTES = [30, 45, 60] as const;
const EQUIPMENT: { key: EquipmentAccess; label: string; detail: string }[] = [
  { key: 'gym', label: 'A gym', detail: 'Barbells, machines, cables' },
  { key: 'home', label: 'Dumbbells', detail: 'At home, plus bodyweight' },
  { key: 'bodyweight', label: 'Just me', detail: 'No equipment at all' },
];

/**
 * The three questions, and only three.
 *
 * This is for somebody who does not know what to train, so every question is
 * one they can answer about their own life rather than about training: how
 * many days, what is in the room, how long they have. Nothing about splits,
 * volume, rep ranges or periodization — if they could answer those they would
 * not be here.
 *
 * Experience is not asked. It is inferred from how much the app has watched
 * them do, which it already knows and they would only estimate.
 */
export function DesignWorkoutSheet({ visible, busy, onClose, onSubmit }: Props) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const sheetAnimation = useSheetAnimation();

  const [days, setDays] = useState<number>(3);
  const [minutes, setMinutes] = useState<number>(45);
  const [equipment, setEquipment] = useState<EquipmentAccess>('gym');

  return (
    <Modal visible={visible} transparent animationType={sheetAnimation} onRequestClose={onClose}>
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={busy ? undefined : onClose}
        accessibilityLabel="Dismiss"
      />
      <View style={styles.panel}>
        <View style={styles.grabber} />
        <Text style={styles.title}>Build me a program</Text>
        <Text style={styles.lede}>
          Three questions, then a week of workouts you can start, edit or throw
          away.
        </Text>

        <Text style={styles.label}>Days a week</Text>
        <View style={styles.segment}>
          {DAYS.map((d) => (
            <TouchableOpacity
              key={d}
              style={[styles.seg, days === d && styles.segOn]}
              onPress={() => setDays(d)}
              accessibilityRole="button"
              accessibilityState={{ selected: days === d }}
              accessibilityLabel={`${d} days a week`}
            >
              <Text style={[styles.segText, days === d && styles.segTextOn]}>{d}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>What do you have</Text>
        <View style={styles.stack}>
          {EQUIPMENT.map((e) => (
            <TouchableOpacity
              key={e.key}
              style={[styles.option, equipment === e.key && styles.optionOn]}
              onPress={() => setEquipment(e.key)}
              accessibilityRole="button"
              accessibilityState={{ selected: equipment === e.key }}
              accessibilityLabel={`${e.label}. ${e.detail}.`}
            >
              <View style={styles.optionText}>
                <Text style={[styles.optionLabel, equipment === e.key && styles.optionLabelOn]}>
                  {e.label}
                </Text>
                <Text style={styles.optionDetail}>{e.detail}</Text>
              </View>
              {equipment === e.key && <Icon name="check" size="md" color={c.primary} />}
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>How long a session</Text>
        <View style={styles.segment}>
          {MINUTES.map((m) => (
            <TouchableOpacity
              key={m}
              style={[styles.seg, minutes === m && styles.segOn]}
              onPress={() => setMinutes(m)}
              accessibilityRole="button"
              accessibilityState={{ selected: minutes === m }}
              accessibilityLabel={`${m} minutes`}
            >
              <Text style={[styles.segText, minutes === m && styles.segTextOn]}>{m}m</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.cta, busy && styles.ctaBusy]}
          onPress={() => onSubmit({ days, minutes, equipment })}
          disabled={busy}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Build the workouts"
        >
          {busy ? (
            <ActivityIndicator color={c.onPrimary} />
          ) : (
            <Text style={styles.ctaText}>Build it</Text>
          )}
        </TouchableOpacity>

        {/* Said before they commit, not after. */}
        <Text style={styles.disclaimer}>
          Written by AI from the exercises in this app. Read it before you follow
          it, and change anything that doesn’t suit you.
        </Text>
      </View>
    </Modal>
  );
}

const makeStyles = (c: Theme) =>
  StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: c.overlay },
    panel: {
      backgroundColor: c.card,
      borderTopLeftRadius: radius.sheet,
      borderTopRightRadius: radius.sheet,
      paddingHorizontal: space.lg,
      paddingTop: space.sm,
      paddingBottom: space.xxl,
      shadowColor: c.shadow,
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.1,
      shadowRadius: 12,
      elevation: 12,
    },
    grabber: {
      width: 36,
      height: 4,
      borderRadius: radius.pill,
      backgroundColor: c.border,
      alignSelf: 'center',
      marginBottom: space.lg,
    },
    title: { ...type.heading(c), color: c.text },
    lede: {
      ...type.caption(c),
      fontFamily: c.fontBody,
      color: c.textMuted,
      marginTop: space.xs,
      marginBottom: space.lg,
    },

    label: { ...type.overline(c), color: c.textFaint, marginBottom: space.sm },

    segment: { flexDirection: 'row', gap: space.sm, marginBottom: space.lg },
    seg: {
      flex: 1,
      paddingVertical: space.md,
      borderRadius: radius.control,
      backgroundColor: c.cardMuted,
      alignItems: 'center',
    },
    segOn: { backgroundColor: c.primarySoft },
    segText: { ...type.bodyStrong(c), color: c.textMuted },
    segTextOn: { color: c.primaryDark },

    stack: { gap: space.sm, marginBottom: space.lg },
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.md,
      padding: space.md,
      borderRadius: radius.control,
      backgroundColor: c.cardMuted,
      borderWidth: 1,
      borderColor: 'transparent',
    },
    optionOn: { backgroundColor: c.primarySoft, borderColor: `${c.primary}66` },
    optionText: { flex: 1, minWidth: 0 },
    optionLabel: { ...type.bodyStrong(c), color: c.text },
    optionLabelOn: { color: c.primaryDark },
    optionDetail: {
      ...type.caption(c),
      fontFamily: c.fontBody,
      color: c.textMuted,
      marginTop: space.xxs,
    },

    cta: {
      backgroundColor: c.primary,
      borderRadius: radius.card,
      paddingVertical: space.lg,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 56,
    },
    ctaBusy: { opacity: 0.8 },
    ctaText: { ...type.subhead(c), fontFamily: c.fontBodyBold, color: c.onPrimary },

    disclaimer: {
      ...type.micro(c),
      color: c.textFaint,
      textAlign: 'center',
      marginTop: space.md,
    },
  });
