import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme/useTheme';
import type { Theme } from '../theme';
import { radius, space, tabular, type } from '../theme/tokens';
import { Icon } from './Icon';
import { totalLabel, weekLabel, type RecoverySummary } from '../utils/recovery';

// Bar height. 56, the same as Home's week strip: at 40 the difference
// between a thirty-minute week and a seventy-minute one compressed into
// about fifteen points and the row read as eight identical blocks.
const BAR_HEIGHT = 56;

interface Props {
  summary: RecoverySummary;
  /** Minutes a week the user is aiming at. 0 or undefined means no target. */
  goalMinutes?: number;
}

/**
 * One recovery kind's week, with the weeks behind it.
 *
 * Minutes lead, not sessions. Lifting is counted in sessions because a
 * session is the thing you did or didn't do; heat and cold are counted in
 * time, because the time *is* the dose. The session count stays as a
 * footnote on the headline rather than a figure of its own — "62 min across
 * 4" is one fact, and splitting it into two stat cards would imply they are
 * two things to aim at.
 *
 * A target is shown only once the user sets one, and the card is complete
 * without it. The app knows a weekly workout goal because the wizard asks
 * for it; nothing asks for this, so a number drawn here by default would be
 * an invented judgement. The bars answer the real question regardless —
 * more or less than usual — without claiming to know what usual should be.
 *
 * Set, it draws as a line across the bars rather than a ring, because the
 * useful question about a target you have had for eight weeks is not only
 * whether this week clears it but how often any week did. A ring can only
 * ever answer for today.
 */
export function RecoveryTrend({ summary, goalMinutes = 0 }: Props) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  const { thisWeek, lastWeek, weeks } = summary;
  const tint = summary.kind === 'sauna' ? c.warning : c.hrZone1;
  const goalMs = Math.max(0, goalMinutes) * 60000;
  const hasGoal = goalMs > 0;

  // The busiest week in the window. Reported as "best" when there is no
  // target, and never includes the target itself — a number you are aiming
  // at is not something you have done.
  const peak = Math.max(...weeks.map((w) => w.ms), 0);
  const met = hasGoal && thisWeek.ms >= goalMs;

  // What full height means. Without a target this is simply the best week,
  // so the bars describe the user's own range rather than an absolute
  // anyone would have to learn.
  //
  // With one it is the larger of the two, plus a tenth. The target has to be
  // included or a goal nobody has reached yet would sit off the top of the
  // chart; the headroom is because a line sitting exactly on the top edge
  // stops reading as a threshold and starts reading as a rule above the
  // chart — which is what 90 minutes against a 71-minute best looked like.
  const scale = hasGoal ? Math.max(peak, goalMs) * 1.1 : Math.max(peak, 1);

  const deltaMin = lastWeek ? Math.round((thisWeek.ms - lastWeek.ms) / 60000) : 0;
  // Withheld in the first week of a kind and when nothing moved: "+0 min on
  // last week" is noise, and so is a comparison against a week that is only
  // empty because the user had not started yet.
  const showDelta = lastWeek != null && deltaMin !== 0 && (lastWeek.ms > 0 || thisWeek.ms > 0);

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <View style={styles.titleRow}>
          <Icon name={summary.kind === 'sauna' ? 'sauna' : 'plunge'} size="sm" color={tint} />
          <Text style={styles.title}>{summary.label}</Text>
        </View>
        {showDelta && (
          <Text style={[styles.delta, { color: deltaMin > 0 ? c.primary : c.textFaint }]}>
            {deltaMin > 0 ? '+' : '−'}
            {Math.abs(deltaMin)} min on last week
          </Text>
        )}
      </View>

      <View style={styles.readout}>
        <Text style={[styles.value, met && { color: c.primary }]}>{totalLabel(thisWeek.ms)}</Text>
        <Text style={styles.unit}>
          {hasGoal ? `of ${totalLabel(goalMs)} this week` : 'this week'}
          {thisWeek.sessions > 0 &&
            ` · ${thisWeek.sessions} session${thisWeek.sessions === 1 ? '' : 's'}`}
        </Text>
      </View>

      <View style={styles.bars}>
        {weeks.map((w, i) => {
          const current = i === weeks.length - 1;
          return (
            <View
              key={w.startMs}
              style={styles.barCol}
              accessible
              accessibilityRole="image"
              accessibilityLabel={`${weekLabel(w.startMs)}: ${totalLabel(w.ms)}`}
            >
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.barFill,
                    {
                      // A week with a session in it never draws as nothing:
                      // a two-minute plunge against a forty-minute peak
                      // rounds to an empty column, which reads as a week off.
                      height: `${Math.max((w.ms / scale) * 100, w.sessions > 0 ? 8 : 0)}%` as any,
                      backgroundColor: current ? tint : c.borderStrong,
                    },
                  ]}
                />
              </View>
            </View>
          );
        })}

        {/* The target, drawn over the whole row rather than per bar: one
            line the eye can run along is what makes eight weeks readable at
            a glance.
            After the bars, not before — siblings stack in order, so drawn
            first it would sit behind every bar that crosses it, which is
            precisely the set of bars it exists to mark. Non-interactive, so
            it never eats a bar's touch. */}
        {hasGoal && (
          <View pointerEvents="none" style={styles.goalLayer}>
            <View
              style={[
                styles.goalLine,
                // scale carries the headroom, so this already sits inside
                // the chart. The clamp is a guard, not the mechanism.
                { bottom: Math.min((goalMs / scale) * BAR_HEIGHT, BAR_HEIGHT - 1) },
              ]}
            />
          </View>
        )}
      </View>

      {/* The bars have no axis and cannot have one at this width, so the
          caption carries both things they otherwise leave unsaid: what one
          bar is, and what full height means. Without the second, eight
          columns scaled to their own peak are a shape with no units —
          readable as a trend and useless as a quantity. */}
      <Text style={styles.caption}>
        {hasGoal
          ? // With a target the line is the scale, so the caption spends its
            // room on the thing the bars can show and the headline cannot:
            // how often this has actually been managed.
            `${weeks.filter((w) => w.ms >= goalMs).length} of ${weeks.length} weeks hit the target`
          : peak > 0
            ? `Each bar is a week · best ${totalLabel(peak)}`
            : // The kind is on screen because it has been logged at some
              // point — recoverySummaries only lists kinds with a history —
              // but none of it falls inside the window. "best 0 min" under
              // eight empty bars is not a statistic, it is a rounding error
              // with a label.
              `Nothing in the last ${weeks.length} weeks`}
      </Text>
    </View>
  );
}

const makeStyles = (c: Theme) =>
  StyleSheet.create({
    card: {
      backgroundColor: c.card,
      borderRadius: radius.card,
      padding: space.lg,
      marginBottom: space.md,
    },
    head: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: space.sm,
    },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
    title: { ...type.bodyStrong(c), color: c.gray700 },
    delta: { ...type.caption(c), ...tabular },

    readout: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm, marginTop: space.md },
    value: { ...type.title(c), ...tabular, color: c.text },
    unit: { ...type.caption(c), color: c.textMuted, flex: 1 },

    bars: { flexDirection: 'row', gap: space.xs, marginTop: space.lg },
    // Overlaid on the row, which is exactly as tall as one track.
    goalLayer: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
    goalLine: {
      position: 'absolute',
      left: 0,
      right: 0,
      height: 1,
      backgroundColor: c.textFaint,
    },
    barCol: { flex: 1 },
    barTrack: {
      width: '100%',
      height: BAR_HEIGHT,
      borderRadius: radius.hairline,
      backgroundColor: c.cardMuted,
      justifyContent: 'flex-end',
      overflow: 'hidden',
    },
    barFill: { width: '100%', borderRadius: radius.hairline },
    caption: {
      ...type.micro(c),
      color: c.textFaint,
      textAlign: 'center',
      marginTop: space.md,
    },
  });
