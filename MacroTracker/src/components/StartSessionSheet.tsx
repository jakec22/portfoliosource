import React, { useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  Platform,
  TouchableOpacity,
  Pressable,
} from 'react-native';
import { useStore } from '../store/useStore';
import { useSheetAnimation } from '../hooks/useSheetAnimation';
import { useTheme } from '../theme/useTheme';
import type { Theme } from '../theme';
import { radius, space, type } from '../theme/tokens';
import { formatDuration } from '../utils/duration';
import { Icon, type IconName } from './Icon';
import { templateRows, templateSubtitle } from '../utils/templateOrder';
import {
  RECOVERY_TYPES,
  WORKOUT_TYPES,
  type RecoveryKind,
} from '../utils/workoutTypes';

export type StartChoice =
  | { kind: 'workout'; hk: number }
  | { kind: 'template'; templateId: string }
  | { kind: 'recovery'; recovery: RecoveryKind }
  | { kind: 'library' };

interface Props {
  visible: boolean;
  onClose: () => void;
  onChoose: (choice: StartChoice) => void;
}

interface Row {
  key: string;
  icon: IconName;
  title: string;
  subtitle: string;
  tint: (c: Theme) => string;
  fill: (c: Theme) => string;
  choice: StartChoice;
}

const RECOVERY_BLURB: Record<RecoveryKind, string> = {
  sauna: 'Heat timer',
  plunge: 'Cold timer',
};

const RECOVERY_ICON: Record<RecoveryKind, IconName> = {
  sauna: 'sauna',
  plunge: 'plunge',
};

// Warm for heat, cold-blue for the plunge — the same pairing the heart-rate
// zones use, so the two colours already mean hot and cold elsewhere in the app.
const RECOVERY_TINT: Record<RecoveryKind, (c: Theme) => string> = {
  sauna: (c) => c.warning,
  plunge: (c) => c.hrZone1,
};

/**
 * The "what are you starting?" sheet.
 *
 * This was `ActionSheetIOS` — a stack of system-blue text rows, with an
 * `Alert` standing in for it on Android. That control can carry a label and
 * nothing else, which is too little here: Strength and a sauna lead to
 * completely different screens, and the two recovery kinds already have a
 * remembered target that is worth seeing *before* you commit to the timer.
 * A sheet of our own says all three things in one tap's worth of reading,
 * and looks like the rest of the app on both platforms.
 *
 * It now lists the saved workouts too, which is the larger change. "Strength"
 * used to sit here as though it were a choice; WORKOUT_TYPES has exactly one
 * entry, so it was a default wearing the costume of one, and it always began
 * an empty session. The workouts people actually do were not in this flow at
 * all — you dismissed the sheet and scrolled the tab to find them. They are
 * the first thing now, above a rule, with the three the app provides beneath
 * it: yours, then ours.
 *
 * The rule is also why the template list scrolls on its own. Sauna and Cold
 * Plunge must stay reachable without scrolling however many workouts someone
 * has saved, and capping the list instead would mean a newly created workout
 * never appearing — they are ordered by creation, so a cap would always cut
 * from the wrong end.
 */
export function StartSessionSheet({ visible, onClose, onChoose }: Props) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const sheetAnimation = useSheetAnimation();
  const presets = useStore((s) => s.recoveryPresets);
  const templates = useStore((s) => s.workoutTemplates);
  const history = useStore((s) => s.workoutHistory);
  const saved = useMemo(() => templateRows(templates, history), [templates, history]);

  // Close first, act after the sheet is really gone.
  //
  // Two of the three destinations are themselves presented modally, and UIKit
  // will not present one view controller while another is still dismissing —
  // choosing Sauna with the obvious `onChoose(); onClose();` closes the sheet
  // and lands on nothing. iOS tells us when the dismissal has finished via
  // `onDismiss`; Android has no such staging and fires straight away.
  const pending = useRef<StartChoice | null>(null);

  const flush = useCallback(() => {
    const choice = pending.current;
    pending.current = null;
    if (choice) onChoose(choice);
  }, [onChoose]);

  const pick = useCallback(
    (choice: StartChoice) => {
      pending.current = choice;
      onClose();
      if (Platform.OS !== 'ios') flush();
    },
    [onClose, flush]
  );

  const rows: Row[] = useMemo(() => {
    // One row, whatever WORKOUT_TYPES holds — and it holds one. Named for
    // what it does rather than for the Health category it files under.
    const training: Row[] = WORKOUT_TYPES.map((t) => ({
      key: `w-${t.hk}`,
      icon: 'plus' as IconName,
      title: 'Empty workout',
      subtitle: 'Add exercises as you go',
      tint: (c: Theme) => c.primary,
      fill: (c: Theme) => c.primarySoft,
      choice: { kind: 'workout', hk: t.hk } as StartChoice,
    }));

    const recovery: Row[] = RECOVERY_TYPES.map((r) => {
      const target = presets[r.kind]?.targetSeconds ?? r.defaultTargetSeconds;
      return {
        key: `r-${r.kind}`,
        icon: RECOVERY_ICON[r.kind],
        title: r.label,
        subtitle: `${RECOVERY_BLURB[r.kind]} · ${formatDuration(target)} target`,
        tint: RECOVERY_TINT[r.kind],
        // No `*Soft` token exists for the zone colours, so the tile fill is
        // the tint at low alpha — the same recipe the soft tokens use.
        fill: (c: Theme) => `${RECOVERY_TINT[r.kind](c)}26`,
        choice: { kind: 'recovery', recovery: r.kind } as StartChoice,
      };
    });

    return [...training, ...recovery];
  }, [presets]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType={sheetAnimation}
      onRequestClose={onClose}
      onDismiss={Platform.OS === 'ios' ? flush : undefined}
    >
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={onClose}
        accessibilityLabel="Dismiss"
      />
      <View style={styles.panel}>
        <View style={styles.grabber} />
        <Text style={styles.title}>What are you starting?</Text>

        {/* Yours. Scrolls on its own so that however many are saved, the
            three below the rule stay where they are. */}
        {saved.length > 0 && (
          <ScrollView
            style={styles.savedList}
            contentContainerStyle={styles.savedContent}
            showsVerticalScrollIndicator={false}
            // The list is short in the common case; bouncing an eight-row
            // sheet around inside a modal is motion for its own sake.
            bounces={saved.length > 3}
          >
            {saved.map(({ template, count, ...rest }) => (
              <Pressable
                key={template.id}
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                onPress={() => pick({ kind: 'template', templateId: template.id })}
                accessibilityRole="button"
                accessibilityLabel={`Start ${template.name}. ${count} exercises.`}
              >
                <View style={styles.numTile}>
                  <Text style={styles.num}>{count}</Text>
                </View>
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {template.name}
                  </Text>
                  <Text style={styles.rowSub} numberOfLines={1}>
                    {templateSubtitle({ template, count, ...rest })}
                  </Text>
                </View>
                <Icon name="forward" size="md" color={c.textFaint} />
              </Pressable>
            ))}
          </ScrollView>
        )}

        {/* Always present, whatever is saved. It is the only way to reach
            Create and Add from link now that the tab has no template
            section — without it a new user could never make one. */}
        <Pressable
          style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
          onPress={() => pick({ kind: 'library' })}
          accessibilityRole="button"
          accessibilityLabel="My workouts. Edit, share or create."
        >
          <View style={styles.numTile}>
            <Icon name="library" size="md" color={c.gray700} />
          </View>
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>My workouts</Text>
            <Text style={styles.rowSub}>
              {saved.length > 0
                ? `${saved.length} saved · edit, share or create`
                : 'Create your first'}
            </Text>
          </View>
          <Icon name="forward" size="md" color={c.textFaint} />
        </Pressable>

        <View style={styles.rule} />

        {rows.map((row) => (
          <Pressable
            key={row.key}
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            onPress={() => pick(row.choice)}
            accessibilityRole="button"
            accessibilityLabel={`${row.title}. ${row.subtitle}`}
          >
            <View style={[styles.tile, { backgroundColor: row.fill(c) }]}>
              <Icon name={row.icon} size="lg" color={row.tint(c)} />
            </View>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>{row.title}</Text>
              <Text style={styles.rowSub}>{row.subtitle}</Text>
            </View>
            <Icon name="forward" size="md" color={c.textFaint} />
          </Pressable>
        ))}

        <TouchableOpacity style={styles.cancel} onPress={onClose} accessibilityRole="button">
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
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
      elevation: 10,
    },
    grabber: {
      width: 36,
      height: 4,
      borderRadius: radius.pill,
      backgroundColor: c.border,
      alignSelf: 'center',
      marginBottom: space.lg,
    },
    title: { ...type.heading(c), color: c.text, marginBottom: space.md },

    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.md,
      backgroundColor: c.cardMuted,
      borderRadius: radius.card,
      padding: space.md,
      marginBottom: space.sm,
    },
    rowPressed: { opacity: 0.6 },
    tile: {
      width: 44,
      height: 44,
      borderRadius: radius.control,
      alignItems: 'center',
      justifyContent: 'center',
    },
    // Capped at three and a half rows, so a fourth peeks and says there is
    // more without the sheet growing to fill the screen.
    savedList: { maxHeight: 268 },
    savedContent: { paddingBottom: 0 },
    numTile: {
      width: 44,
      height: 44,
      borderRadius: radius.control,
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    num: { ...type.heading(c), color: c.text, lineHeight: 24 },
    rule: { height: 1, backgroundColor: c.border, marginVertical: space.md },
    rowText: { flex: 1 },
    rowTitle: { ...type.bodyStrong(c), color: c.text },
    rowSub: {
      ...type.caption(c),
      fontFamily: c.fontBody,
      color: c.textMuted,
      marginTop: space.xxs,
    },

    cancel: { paddingVertical: space.md, alignItems: 'center', marginTop: space.xs },
    cancelText: { ...type.body(c), fontFamily: c.fontBodySemi, color: c.textMuted },
  });
