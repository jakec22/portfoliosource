import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useSheetAnimation } from '../hooks/useSheetAnimation';
import { useTheme } from '../theme/useTheme';
import type { Theme } from '../theme';
import { radius, space, type } from '../theme/tokens';
import { Icon } from './Icon';
import type { Sex } from '../utils/tdee';
import type { DesignRequest, EquipmentAccess, TrainingGoal } from '../services/workoutDesign';

interface Props {
  visible: boolean;
  busy?: boolean;
  // From the profile, where the Goal Wizard has run. Prefills rather than
  // dictates — the control is still there to correct.
  defaultSex?: Sex;
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
const GOALS: { key: TrainingGoal; label: string; detail: string }[] = [
  { key: 'muscle', label: 'Build muscle', detail: 'Size and shape' },
  { key: 'strength', label: 'Get stronger', detail: 'Heavier lifts' },
  { key: 'fatloss', label: 'Lose fat', detail: 'Plus conditioning' },
  { key: 'fitness', label: 'General fitness', detail: 'A bit of everything' },
];
const SEXES: { key: Sex; label: string }[] = [
  { key: 'male', label: 'Male' },
  { key: 'female', label: 'Female' },
];

/**
 * A few questions, every one about their own life rather than about training.
 *
 * This is for somebody who does not know what to train, so nothing here asks
 * about splits, volume, rep ranges or periodization — if they could answer
 * those they would not be here. How many days, what is in the room, how long
 * they have, and now the one thing none of those imply: what the training is
 * meant to achieve.
 *
 * The goal leads, because it is the question the rest hang off. A program
 * cannot be assembled from availability alone, and until this existed the
 * function was inferring the point of the week from the user's calorie
 * target — which cannot tell training for size apart from training for
 * strength, and cannot tell either apart from eating at a deficit.
 *
 * Experience is still not asked. It is inferred from how much the app has
 * watched them do, which it already knows and they would only estimate.
 */
export function DesignWorkoutSheet({ visible, busy, defaultSex, onClose, onSubmit }: Props) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const sheetAnimation = useSheetAnimation();

  const [days, setDays] = useState<number>(3);
  const [minutes, setMinutes] = useState<number>(45);
  const [equipment, setEquipment] = useState<EquipmentAccess>('gym');
  const [goal, setGoal] = useState<TrainingGoal>('muscle');
  // The profile's answer stands until they tap a different one. Seeding state
  // from the prop instead would freeze whatever was known at mount, and this
  // Modal mounts once and stays mounted — a profile that loads a moment later
  // would never reach it.
  const [sexOverride, setSexOverride] = useState<Sex | undefined>();
  const sex = sexOverride ?? defaultSex;

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
          A few questions, then a week of workouts to start or edit.
        </Text>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollInner}
          // Shown, not hidden. On a small phone the equipment list is below
          // the fold, and the bar appearing the moment a finger lands is the
          // cheapest honest signal that there is more here.
          showsVerticalScrollIndicator
        >
        <Text style={styles.label}>What are you training for</Text>
        <View style={styles.grid}>
          {GOALS.map((g) => (
            <TouchableOpacity
              key={g.key}
              style={[styles.tile, goal === g.key && styles.tileOn]}
              onPress={() => setGoal(g.key)}
              accessibilityRole="button"
              accessibilityState={{ selected: goal === g.key }}
              accessibilityLabel={`${g.label}. ${g.detail}.`}
            >
              <Text style={[styles.tileLabel, goal === g.key && styles.tileLabelOn]}>
                {g.label}
              </Text>
              <Text style={styles.tileDetail}>{g.detail}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Second, so the two things that were missing are both reachable
            without scrolling. The three questions below this were already
            here and already found. */}
        <Text style={styles.label}>You</Text>
        <View style={styles.segment}>
          {SEXES.map((s) => (
            <TouchableOpacity
              key={s.key}
              style={[styles.seg, sex === s.key && styles.segOn]}
              onPress={() => setSexOverride(s.key)}
              accessibilityRole="button"
              accessibilityState={{ selected: sex === s.key }}
              accessibilityLabel={s.label}
            >
              <Text style={[styles.segText, sex === s.key && styles.segTextOn]}>{s.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {/* Says what it is for, because the honest use is narrow and the
            dishonest one is what people will assume. */}
        <Text style={styles.note}>Used only to pick starting variations.</Text>

        {/* Paired: both are short, both are about the shape of the week, and
            together they read as the sentence they are — three days of
            forty-five minutes. Apart they cost a whole row each, which is
            what pushed the equipment list off a small screen entirely. */}
        <View style={styles.pair}>
          <View style={styles.col}>
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
          </View>
          <View style={styles.col}>
            <Text style={styles.label}>Session</Text>
            <View style={styles.segment}>
              {MINUTES.map((m) => (
                <TouchableOpacity
                  key={m}
                  style={[styles.seg, minutes === m && styles.segOn]}
                  onPress={() => setMinutes(m)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: minutes === m }}
                  accessibilityLabel={`${m} minute sessions`}
                >
                  <Text style={[styles.segText, minutes === m && styles.segTextOn]}>{m}m</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
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

        </ScrollView>

        {/* Pinned, with a hairline, which is the scroll affordance: on a small
            phone the equipment list runs under this edge, and a rule with
            content disappearing behind it reads as "there is more" in a way a
            clean cut at a section boundary does not. Same pattern as the
            review screen's footer. */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.cta, busy && styles.ctaBusy]}
            onPress={() => onSubmit({ days, minutes, equipment, goal, sex })}
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
            Written by AI from the exercises in this app. Read it before you
            follow it, and change anything that doesn’t suit you.
          </Text>
        </View>
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
      // Five groups no longer fit a small phone. The cap keeps the backdrop
      // tappable and hands the overflow to the ScrollView rather than letting
      // the CTA slide off the bottom of the screen.
      maxHeight: '88%',
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

    // flexShrink lets the ScrollView give back space when the content is short
    // enough to fit, so a tall sheet is not reserved on every phone.
    scroll: { flexShrink: 1 },
    scrollInner: { paddingBottom: space.xs },

    label: { ...type.overline(c), color: c.textFaint, marginBottom: space.sm },

    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginBottom: space.lg },
    tile: {
      // Two per row: half the width, less the gap between them.
      width: '48%',
      flexGrow: 1,
      padding: space.md,
      borderRadius: radius.control,
      backgroundColor: c.cardMuted,
      borderWidth: 1,
      borderColor: 'transparent',
    },
    tileOn: { backgroundColor: c.primarySoft, borderColor: `${c.primary}66` },
    tileLabel: { ...type.bodyStrong(c), color: c.text },
    tileLabelOn: { color: c.primaryDark },
    tileDetail: {
      ...type.caption(c),
      fontFamily: c.fontBody,
      color: c.textMuted,
      marginTop: space.xxs,
    },

    note: {
      ...type.micro(c),
      color: c.textFaint,
      marginTop: -space.sm,
      marginBottom: space.lg,
    },

    segment: { flexDirection: 'row', gap: space.sm, marginBottom: space.lg },
    pair: { flexDirection: 'row', gap: space.md },
    col: { flex: 1, minWidth: 0 },
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

    footer: {
      borderTopWidth: 1,
      borderTopColor: c.border,
      paddingTop: space.md,
      flexShrink: 0,
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
