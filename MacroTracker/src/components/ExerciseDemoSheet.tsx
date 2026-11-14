import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Image,
  Animated,
  ScrollView,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { useSheetAnimation } from '../hooks/useSheetAnimation';
import { useTheme } from '../theme/useTheme';
import type { Theme } from '../theme';
import { radius, space, type } from '../theme/tokens';
import { Icon } from './Icon';
import { exerciseDemo } from '../data/exerciseDemos';

interface Props {
  /** The exercise to show, or null for closed. A name with no demo is also closed. */
  name: string | null;
  onClose: () => void;
}

// How long each frame holds, and how long the crossfade between them takes.
// 1.1s is slow enough to read a position and fast enough to read as one
// movement rather than two photographs taking turns.
const HOLD_MS = 1100;
const FADE_MS = 220;

/** "middle back" -> "Middle back". The dataset stores them lowercase. */
function sentenceCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * The dataset's equipment string, as a chip — or null for no chip at all.
 *
 * Its vocabulary is its own and some of it says nothing: "other" is the bin
 * it puts a pull-up bar and a captain's chair in, and a chip reading "Other"
 * is a label that costs a line to tell you nothing. Two more read as data
 * rather than English. Done here rather than in the generated file so the
 * data stays a faithful copy of the source.
 */
function equipmentLabel(raw: string | null): string | null {
  if (!raw || raw === 'other') return null;
  if (raw === 'body only') return 'Bodyweight';
  if (raw === 'e-z curl bar') return 'EZ-bar';
  return sentenceCase(raw);
}

/**
 * How to do an exercise: the movement, and the steps.
 *
 * Two photographs — the start of the movement and the end — alternating in
 * place. That is deliberately not a video. This gets opened standing at a
 * machine, one-handed, often on gym wifi or none at all, and two bundled
 * JPEGs start instantly and work in a basement. A loop also happens to be
 * the right length: the question being asked is "where do my hands go and
 * how far does it travel", not "teach me this lift".
 *
 * Under Reduce Motion the frames stop alternating and sit side by side
 * instead. The loop is the one piece of motion here and it runs forever, so
 * leaving it going would be the kind of thing the setting exists to stop —
 * but the two positions are the content, so they have to stay visible.
 *
 * Not every exercise has one: 16 in the catalog have no honest match in the
 * dataset, and anything typed by hand never will. Callers ask
 * `exerciseDemo(name)` first and do not render the affordance at all when it
 * comes back null, rather than offering a button that opens an apology.
 */
export function ExerciseDemoSheet({ name, onClose }: Props) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const sheetAnimation = useSheetAnimation();
  const reduceMotion = useReducedMotion();
  const { height } = useWindowDimensions();

  const demo = name ? exerciseDemo(name) : null;
  const open = demo !== null;

  // Opacity of the second frame, over the first.
  const fade = useRef(new Animated.Value(0)).current;
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    if (!open || reduceMotion) return;
    let to = 0;
    const tick = () => {
      to = to === 0 ? 1 : 0;
      setPhase(to);
      Animated.timing(fade, {
        toValue: to,
        duration: FADE_MS,
        useNativeDriver: true,
      }).start();
    };
    const id = setInterval(tick, HOLD_MS);
    return () => {
      clearInterval(id);
      fade.setValue(0);
      setPhase(0);
    };
  }, [open, reduceMotion, fade, name]);

  if (!demo || !name) return null;

  // The secondary muscles are a sentence rather than more chips. As chips
  // they were four more green pills beside the one that matters, so a squat
  // advertised Calves and Lower back at the same weight as Quadriceps.
  const alsoWorks = demo.secondary.length > 0
    ? `Also works ${demo.secondary.join(', ')}.`
    : null;
  const equipment = equipmentLabel(demo.equipment);

  return (
    <Modal visible transparent animationType={sheetAnimation} onRequestClose={onClose}>
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={onClose}
        accessibilityLabel="Dismiss"
      />
      <View style={[styles.panel, { maxHeight: height * 0.88 }]}>
        <View style={styles.grabber} />

        <View style={styles.head}>
          <Text style={styles.title} numberOfLines={2}>
            {name}
          </Text>
          <TouchableOpacity
            onPress={onClose}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <Icon name="close" size="lg" color={c.textMuted} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          {reduceMotion ? (
            // Both positions at once, since the loop that would show them in
            // sequence is the thing being switched off.
            <View style={styles.stillRow}>
              {demo.frames.map((frame, i) => (
                <View key={i} style={styles.still}>
                  <Image source={frame} style={styles.image} resizeMode="contain" />
                  <Text style={styles.stillLabel}>{i === 0 ? 'Start' : 'Finish'}</Text>
                </View>
              ))}
            </View>
          ) : (
            <>
              <View
                style={styles.stage}
                accessible
                accessibilityRole="image"
                accessibilityLabel={`${name}: the start and finish positions, alternating`}
              >
                <Image source={demo.frames[0]} style={styles.image} resizeMode="contain" />
                <Animated.Image
                  source={demo.frames[1]}
                  style={[styles.image, styles.overlay, { opacity: fade }]}
                  resizeMode="contain"
                />
              </View>
              <View style={styles.dots}>
                {[0, 1].map((i) => (
                  <View key={i} style={[styles.dot, phase === i && styles.dotOn]} />
                ))}
              </View>
            </>
          )}

          {(equipment || demo.primary.length > 0) && (
            <View style={styles.meta}>
              {equipment && (
                <View style={styles.chip}>
                  <Text style={styles.chipText}>{equipment}</Text>
                </View>
              )}
              {demo.primary.map((m) => (
                <View key={m} style={[styles.chip, styles.chipMuscle]}>
                  <Text style={[styles.chipText, styles.chipMuscleText]}>{sentenceCase(m)}</Text>
                </View>
              ))}
            </View>
          )}

          {alsoWorks && <Text style={styles.also}>{alsoWorks}</Text>}

          {demo.steps.length > 0 && (
            <View style={styles.steps}>
              {demo.steps.map((s, i) => (
                <View key={i} style={styles.step}>
                  <Text style={styles.stepNum}>{i + 1}</Text>
                  <Text style={styles.stepText}>{s}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Said plainly rather than buried in a settings screen: these are
              someone else's photographs and someone else's words. */}
          <Text style={styles.credit}>
            Photographs and steps from the free-exercise-db dataset.
          </Text>
        </ScrollView>
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
      paddingBottom: space.xl,
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
      marginBottom: space.md,
    },
    head: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: space.md,
      marginBottom: space.md,
    },
    title: { ...type.heading(c), color: c.text, flex: 1 },
    body: { paddingBottom: space.lg },

    // 3:2, which is what nearly every frame in the set is. The handful of
    // portrait ones letterbox rather than crop — losing the top of a pull-up
    // to fill a box is worse than a margin.
    stage: {
      width: '100%',
      aspectRatio: 3 / 2,
      borderRadius: radius.card,
      overflow: 'hidden',
      backgroundColor: c.cardMuted,
    },
    image: { width: '100%', height: '100%' },
    overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },

    dots: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: space.xs,
      marginTop: space.sm,
    },
    dot: {
      width: 6,
      height: 6,
      borderRadius: radius.pill,
      backgroundColor: c.border,
    },
    dotOn: { backgroundColor: c.primary },

    stillRow: { flexDirection: 'row', gap: space.sm },
    still: { flex: 1 },
    stillLabel: {
      ...type.micro(c),
      color: c.textMuted,
      textAlign: 'center',
      marginTop: space.xs,
    },

    meta: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: space.xs,
      marginTop: space.lg,
    },
    chip: {
      backgroundColor: c.cardMuted,
      borderRadius: radius.control,
      paddingHorizontal: space.sm,
      paddingVertical: space.xxs,
    },
    chipText: { ...type.caption(c), fontFamily: c.fontBody, color: c.textMuted },
    chipMuscle: { backgroundColor: c.primarySoft },
    chipMuscleText: { color: c.primaryDark },
    also: { ...type.caption(c), color: c.textFaint, marginTop: space.sm },

    steps: { marginTop: space.lg, gap: space.md },
    step: { flexDirection: 'row', gap: space.sm },
    stepNum: {
      ...type.caption(c),
      fontFamily: c.fontBodyBold,
      color: c.primary,
      minWidth: 16,
      textAlign: 'right',
    },
    stepText: { ...type.body(c), fontFamily: c.fontBody, color: c.text, flex: 1 },

    credit: {
      ...type.micro(c),
      color: c.textFaint,
      marginTop: space.xl,
      textAlign: 'center',
    },
  });
