import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { TrainingCalendar as CalendarData } from '../utils/trainingSplit';
import { useTheme } from '../theme/useTheme';
import type { Theme } from '../theme';

interface Props {
  calendar: CalendarData;
}

const DAY_LABELS = ['M', '', 'W', '', 'F', '', ''];

// Cell size and row gap. 12 columns at this pitch fit a phone's card width.
const CELL = 14;
const CELL_GAP = 3;

// Two-digit hex alpha for a 0–1 opacity.
function alphaHex(a: number): string {
  return Math.round(Math.max(0, Math.min(1, a)) * 255)
    .toString(16)
    .padStart(2, '0');
}

// A contribution-style grid of training volume: weeks as columns, Mon→Sun as
// rows. Shows rhythm and gaps over months — what the consistency ring (one
// week) and the split (totals, no time) can't.
export function TrainingCalendar({ calendar }: Props) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  const cellColor = (intensity: number, future: boolean): string => {
    if (future) return 'transparent';
    if (intensity <= 0) return c.cardMuted;
    // Floor the alpha so a light day is still clearly "trained" rather than
    // fading into the untrained cells.
    return `${c.primary}${alphaHex(0.3 + 0.7 * intensity)}`;
  };

  return (
    <View>
      <View style={styles.gridRow}>
        <View style={styles.dayLabels}>
          {DAY_LABELS.map((d, i) => (
            <View key={i} style={styles.dayLabelCell}>
              <Text style={styles.dayLabel}>{d}</Text>
            </View>
          ))}
        </View>

        <View style={styles.weeks}>
          {calendar.weeks.map((week, wi) => (
            <View key={wi} style={styles.week}>
              {week.map((day) => (
                <View
                  key={day.date}
                  style={[
                    styles.cell,
                    { backgroundColor: cellColor(day.intensity, day.future) },
                  ]}
                />
              ))}
            </View>
          ))}
        </View>
      </View>

      <View style={styles.monthRow}>
        <View style={styles.dayLabelSpacer} />
        {calendar.monthLabels.map((m, i) => (
          <View key={i} style={styles.monthCell}>
            <Text style={styles.monthLabel}>{m}</Text>
          </View>
        ))}
      </View>

      <View style={styles.footer}>
        <Text style={styles.summary}>
          <Text style={styles.summaryValue}>{calendar.sessions}</Text> session
          {calendar.sessions === 1 ? '' : 's'}
          {calendar.longestGapDays > 1 && (
            <Text>
              {'  ·  longest gap '}
              <Text style={styles.summaryValue}>{calendar.longestGapDays}</Text> days
            </Text>
          )}
        </Text>

        <View style={styles.legend}>
          <Text style={styles.legendText}>Less</Text>
          {[0, 0.35, 0.7, 1].map((v) => (
            <View
              key={v}
              style={[styles.legendCell, { backgroundColor: cellColor(v, false) }]}
            />
          ))}
          <Text style={styles.legendText}>More</Text>
        </View>
      </View>
    </View>
  );
}

const makeStyles = (c: Theme) =>
  StyleSheet.create({
    // Row rhythm is set by an explicit gap rather than space-between: the
    // label column and the cell column are different heights, so distributing
    // the difference would make the grid's spacing depend on the font metrics.
    gridRow: { flexDirection: 'row', gap: 5 },
    dayLabels: { gap: CELL_GAP },
    dayLabelCell: { height: CELL, justifyContent: 'center' },
    dayLabel: { fontSize: 9, color: c.textFaint, fontFamily: c.fontBody, width: 9 },
    dayLabelSpacer: { width: 14 },

    weeks: { flex: 1, flexDirection: 'row', justifyContent: 'space-between' },
    week: { gap: CELL_GAP },
    cell: { width: CELL, height: CELL, borderRadius: 3 },

    monthRow: { flexDirection: 'row', gap: 4, marginTop: 5 },
    monthCell: { flex: 1, alignItems: 'flex-start' },
    monthLabel: { fontSize: 9.5, color: c.textFaint, fontFamily: c.fontBody },

    footer: {
      marginTop: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: 8,
    },
    summary: { fontSize: 12, color: c.textMuted, fontFamily: c.fontBody },
    summaryValue: { color: c.text, fontFamily: c.fontBodyBold },

    legend: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    legendText: { fontSize: 10, color: c.textFaint, fontFamily: c.fontBody },
    legendCell: { width: 10, height: 10, borderRadius: 2.5 },
  });
