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

// The three frames are the start, middle and end of one repetition, so the
// loop runs out and back — 0,1,2,1 — rather than cutting from the end to the
// start. A rep returns to where it began; playing it as a cycle of three
// would show the bar teleporting back to the rack every 1.3 seconds.
const SEQUENCE = [0, 1, 2, 1];
// 420ms a frame puts a rep at about 1.7s, which is roughly the tempo of the
// thing being drawn. The crossfade is short because these are positions in a
// movement, not a dissolve between pictures: linger on it and the two frames
// read as a double exposure.
const HOLD_MS = 420;
const FADE_MS = 140;

/**
 * How to do an exercise: the movement, and the steps.
 *
 * Three drawn frames cycling in place. Deliberately not video. This gets
 * opened standing at a machine, one-handed, often on gym wifi or none at
 * all, and bundled line art starts instantly and works in a basement. The
 * loop is also the right length for the question being asked, which is where
 * the hands go and how far it travels, not teach me this lift.
 *
 * Line art rather than photographs, which is what this showed first. The
 * photographs were a man in a red-walled gym — somebody else's app dropped
 * into the middle of this one. These are white strokes on transparency, so
 * they sit on the card in either pack and tint with the text they sit under.
 *
 * Under Reduce Motion the loop stops and the two end positions sit side by
 * side instead. The loop is the one piece of motion here and it runs
 * forever, so leaving it going is exactly what the setting exists to stop —
 * but the positions are the content, so they stay visible.
 *
 * Not every exercise has one: 20 in the catalog have no honest match in the
 * illustration set, and anything typed by hand never will. Callers ask
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

  // One opacity per frame rather than a single value crossfading a pair: the
  // sequence revisits the middle frame on the way back, so "which frame is
  // showing" is not a number this can interpolate between.
  const fades = useRef([0, 1, 2].map((i) => new Animated.Value(i === 0 ? 1 : 0))).current;
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    if (!open || reduceMotion) return;
    let step = 0;
    const id = setInterval(() => {
      step = (step + 1) % SEQUENCE.length;
      const next = SEQUENCE[step];
      setFrame(next);
      fades.forEach((v, i) =>
        Animated.timing(v, {
          toValue: i === next ? 1 : 0,
          duration: FADE_MS,
          useNativeDriver: true,
        }).start()
      );
    }, HOLD_MS);
    return () => {
      clearInterval(id);
      fades.forEach((v, i) => v.setValue(i === 0 ? 1 : 0));
      setFrame(0);
    };
  }, [open, reduceMotion, fades, name]);

  if (!demo || !name) return null;

  // The secondary muscles are a sentence rather than more chips. As chips
  // they were four more green pills beside the one that matters, so a squat
  // advertised Calves and Lower back at the same weight as Quadriceps.
  const alsoWorks = demo.secondary.length > 0
    ? `Also works ${demo.secondary.join(', ').toLowerCase()}.`
    : null;

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
            // All three laid out instead of cycling, since the cycle is the
            // thing being switched off.
            //
            // All three, not the two ends. The set does not say what its
            // frames mean and it is not consistent: a bench press runs
            // lockout, middle, chest, while a lateral raise runs down, up,
            // down — a whole repetition. Showing the first and last of that
            // second kind is two pictures of a man standing still.
            <>
              <View style={styles.stillRow}>
                {demo.frames.map((src, i) => (
                  <View key={i} style={styles.stillBox}>
                    <Image
                      source={src}
                      style={styles.image}
                      resizeMode="contain"
                      tintColor={c.text}
                    />
                  </View>
                ))}
              </View>
              <Text style={styles.stillLabel}>Three positions through the movement</Text>
            </>
          ) : (
            <>
              <View
                style={styles.stage}
                accessible
                accessibilityRole="image"
                accessibilityLabel={`${name}: one repetition, drawn`}
              >
                {demo.frames.map((src, i) => (
                  <Animated.Image
                    key={i}
                    source={src}
                    style={[styles.image, i > 0 && styles.overlay, { opacity: fades[i] }]}
                    resizeMode="contain"
                    // The art is a white line drawing on transparency, so it
                    // takes the pack's ink rather than staying whatever white
                    // it was drawn in.
                    tintColor={c.text}
                  />
                ))}
              </View>
              <View style={styles.dots}>
                {[0, 1, 2].map((i) => (
                  <View key={i} style={[styles.dot, frame === i && styles.dotOn]} />
                ))}
              </View>
            </>
          )}

          {(demo.equipment || demo.primary.length > 0) && (
            <View style={styles.meta}>
              {demo.equipment && (
                <View style={styles.chip}>
                  <Text style={styles.chipText}>{demo.equipment}</Text>
                </View>
              )}
              {demo.primary.map((m) => (
                <View key={m} style={[styles.chip, styles.chipMuscle]}>
                  <Text style={[styles.chipText, styles.chipMuscleText]}>{m}</Text>
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

          {/* Said plainly rather than buried in a settings screen. The
              licence on the drawings asks for the credit and the link; the
              step text comes from somewhere else entirely and is named
              separately rather than folded in under one vague "sources". */}
          <Text style={styles.credit}>
            Illustrations by Bryl Lim and Everkinetic, CC BY-SA 4.0.
            {demo.steps.length > 0 ? ' Steps from free-exercise-db.' : ''}
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

    // The frames are square and the figure is drawn inside a margin of its
    // own, so 4:3 crops nothing and buys back the vertical space a square
    // box would spend on that margin.
    stage: {
      width: '100%',
      aspectRatio: 4 / 3,
      borderRadius: radius.card,
      overflow: 'hidden',
      backgroundColor: c.cardMuted,
      padding: space.sm,
    },
    image: { width: '100%', height: '100%' },
    // Frames 2 and 3 sit on top of frame 1, which holds the box's height.
    overlay: { position: 'absolute', top: space.sm, left: space.sm, right: space.sm, bottom: space.sm },

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
    stillBox: {
      flex: 1,
      aspectRatio: 1,
      borderRadius: radius.card,
      backgroundColor: c.cardMuted,
      padding: space.xs,
    },
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
