import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme/useTheme';
import type { Theme } from '../theme';
import { radius, space, tabular, type } from '../theme/tokens';
import { Icon } from './Icon';
import { totalLabel, weekLabel, type RecoverySummary } from '../utils/recovery';

interface Props {
  summary: RecoverySummary;
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
 * No target and no ring, deliberately. The app knows a weekly workout goal
 * because the user set one; it has never asked for a sauna target, and a
 * ring drawn against a number nobody chose is an invented judgement. The
 * bars answer the real question anyway — more or less than usual — without
 * claiming to know what usual should be.
 */
export function RecoveryTrend({ summary }: Props) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  const { thisWeek, lastWeek, weeks } = summary;
  const tint = summary.kind === 'sauna' ? c.warning : c.hrZone1;

  // Scaled to the busiest week in the window, so the bars describe this
  // user's own range rather than an absolute anyone would have to learn.
  const peak = Math.max(...weeks.map((w) => w.ms), 0);

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
        <Text style={styles.value}>{totalLabel(thisWeek.ms)}</Text>
        <Text style={styles.unit}>
          this week
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
                      height: `${Math.max((w.ms / Math.max(peak, 1)) * 100, w.sessions > 0 ? 8 : 0)}%` as any,
                      backgroundColor: current ? tint : c.borderStrong,
                    },
                  ]}
                />
              </View>
            </View>
          );
        })}
      </View>

      {/* The bars have no axis and cannot have one at this width, so the
          caption carries both things they otherwise leave unsaid: what one
          bar is, and what full height means. Without the second, eight
          columns scaled to their own peak are a shape with no units —
          readable as a trend and useless as a quantity. */}
      <Text style={styles.caption}>
        {peak > 0
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
    barCol: { flex: 1 },
    barTrack: {
      width: '100%',
      // 56, the same as Home's week strip. At 40 the difference between a
      // thirty-minute week and a seventy-minute one compressed into about
      // fifteen points and the row read as eight identical blocks.
      height: 56,
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
