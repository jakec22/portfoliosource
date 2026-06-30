import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Alert,
  Share,
  Platform,
  ActionSheetIOS,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from '../store/useStore';
import { WorkoutTemplate } from '../types';
import { WORKOUT_TYPES, DEFAULT_WORKOUT_HK } from '../utils/workoutTypes';
import { WorkoutHistoryItem } from '../components/WorkoutHistoryItem';
import { encodeTemplateLink, decodeTemplateLink } from '../utils/templateShare';
import { recentPRs, topMovers } from '../utils/exerciseHistory';
import { formatDuration as formatSetTime } from '../utils/duration';
import { ProgressCardRow } from '../components/ProgressCardRow';
import { useTheme } from '../theme/useTheme';
import type { Theme } from '../theme';

interface Props {
  navigation: any;
}

export function ExerciseScreen({ navigation }: Props) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const templates = useStore((s) => s.workoutTemplates);
  const activeWorkout = useStore((s) => s.activeWorkout);
  const history = useStore((s) => s.workoutHistory);
  const startWorkout = useStore((s) => s.startWorkout);
  const deleteTemplate = useStore((s) => s.deleteTemplate);
  const deleteWorkout = useStore((s) => s.deleteWorkout);
  const saveTemplate = useStore((s) => s.saveTemplate);

  // Compact progress highlights for the Exercise tab: recent PRs and the
  // exercises that improved most. Full browsing lives under Progress & Trends.
  const prs = useMemo(() => recentPRs(history), [history]);
  const movers = useMemo(() => topMovers(history), [history]);
  const hasProgress = prs.length > 0 || movers.length > 0;

  // Ask for the workout type (so Apple Health categorizes it), then start. On
  // Android there's no native action sheet, so just start with the default.
  function pickTypeThenStart(template?: WorkoutTemplate) {
    if (Platform.OS !== 'ios') {
      startWorkout(template, DEFAULT_WORKOUT_HK);
      navigation.navigate('ActiveWorkout');
      return;
    }
    const labels = WORKOUT_TYPES.map((t) => t.label);
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: 'Workout type',
        options: [...labels, 'Cancel'],
        cancelButtonIndex: labels.length,
      },
      (index) => {
        if (index < 0 || index >= WORKOUT_TYPES.length) return;
        startWorkout(template, WORKOUT_TYPES[index].hk);
        navigation.navigate('ActiveWorkout');
      }
    );
  }

  function handleStartEmpty() {
    if (activeWorkout) {
      navigation.navigate('ActiveWorkout');
      return;
    }
    pickTypeThenStart();
  }

  function handleStartTemplate(t: WorkoutTemplate) {
    if (activeWorkout) {
      Alert.alert(
        'Workout in progress',
        'Finish or cancel your current workout before starting a new one.',
        [{ text: 'OK' }]
      );
      return;
    }
    pickTypeThenStart(t);
  }

  function handleDeleteTemplate(t: WorkoutTemplate) {
    Alert.alert('Delete template', `Delete "${t.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteTemplate(t.id) },
    ]);
  }

  function handleShareTemplate(t: WorkoutTemplate) {
    const typeLabel: Record<string, string> = {
      warmup: ' (Warm-up)',
      failure: ' (Failure)',
      dropset: ' (Drop set)',
    };
    const lines: string[] = [`🏋️ ${t.name}`, ''];
    for (const ex of t.exercises) {
      lines.push(ex.name || 'Exercise');
      ex.sets.forEach((s, i) => {
        const weight = s.weight ? `${s.weight} lbs` : 'BW';
        const tag = s.type && s.type !== 'normal' ? typeLabel[s.type] ?? '' : '';
        let detail: string;
        if ((ex.mode ?? 'reps') === 'time') {
          const t = formatSetTime(s.durationSeconds ?? 0);
          detail = s.weight ? `${s.weight} lbs × ${t}` : t;
        } else {
          detail = `${weight} × ${s.reps} rep${s.reps === 1 ? '' : 's'}`;
        }
        lines.push(`  ${i + 1}. ${detail}${tag}`);
      });
      lines.push('');
    }
    // Append a deep link that imports the template into the recipient's app.
    lines.push('Open in HolyMacro to add this workout:');
    lines.push(encodeTemplateLink(t));
    Share.share({ message: lines.join('\n').trim() });
  }

  // Fallback for when tapping a shared link doesn't auto-open the app: let the
  // user paste the link text and import it manually.
  function handleImportFromLink() {
    Alert.prompt(
      'Add from link',
      'Paste a shared MacroTracker workout link.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Import',
          onPress: (value?: string) => {
            const text = (value ?? '').trim();
            if (!text) return;
            const template = decodeTemplateLink(text);
            if (!template) {
              Alert.alert(
                'Invalid link',
                "That doesn't look like a MacroTracker workout link. Copy the whole link and try again."
              );
              return;
            }
            saveTemplate(template);
            Alert.alert('Imported', `“${template.name}” was added to My Workouts.`);
          },
        },
      ],
      'plain-text'
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <StatusBar
        barStyle={c.scheme === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor={c.bg}
      />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Text style={styles.screenTitle}>Exercise</Text>

        {/* Resume banner */}
        {activeWorkout && (
          <TouchableOpacity
            style={styles.resumeBanner}
            onPress={() => navigation.navigate('ActiveWorkout')}
            activeOpacity={0.85}
          >
            <View>
              <Text style={styles.resumeTitle}>Workout in progress</Text>
              <Text style={styles.resumeSub}>{activeWorkout.name} · tap to resume</Text>
            </View>
            <Text style={styles.resumeArrow}>›</Text>
          </TouchableOpacity>
        )}

        {/* Start a Workout */}
        <TouchableOpacity style={styles.startBtn} onPress={handleStartEmpty} activeOpacity={0.85}>
          <Text style={styles.startBtnIcon}>🏋️</Text>
          <View>
            <Text style={styles.startBtnTitle}>
              {activeWorkout ? 'Resume Workout' : 'Start a Workout'}
            </Text>
            <Text style={styles.startBtnSub}>
              {activeWorkout ? 'Continue where you left off' : 'Begin a blank session, add exercises as you go'}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Templates */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>My Workouts</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity onPress={handleImportFromLink}>
              <Text style={styles.importLink}>Add from link</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.navigate('WorkoutTemplate', {})}>
              <Text style={styles.createLink}>+ Create</Text>
            </TouchableOpacity>
          </View>
        </View>

        {templates.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>
              No saved workouts yet. Tap “+ Create” to build a template with your
              go-to exercises, sets, and reps.
            </Text>
          </View>
        ) : (
          templates.map((t) => (
            <View key={t.id} style={styles.templateCard}>
              <TouchableOpacity
                style={styles.templateMain}
                onPress={() => handleStartTemplate(t)}
                activeOpacity={0.7}
              >
                <Text style={styles.templateName}>{t.name}</Text>
                <Text style={styles.templateMeta}>
                  {t.exercises.length} exercise{t.exercises.length === 1 ? '' : 's'}
                  {t.exercises.length > 0 && ` · ${t.exercises.map((e) => e.name).slice(0, 3).join(', ')}${t.exercises.length > 3 ? '…' : ''}`}
                </Text>
              </TouchableOpacity>
              <View style={styles.templateActions}>
                <TouchableOpacity
                  onPress={() => navigation.navigate('WorkoutTemplate', { templateId: t.id })}
                  style={styles.templateActionBtn}
                >
                  <Text style={styles.editText}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleShareTemplate(t)}
                  style={styles.templateActionBtn}
                >
                  <Text style={styles.shareText}>Share</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleDeleteTemplate(t)}
                  style={styles.templateActionBtn}
                >
                  <Text style={styles.deleteText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}

        {/* Progress highlights — recent PRs + top movers. Full browsing is in
            Progress & Trends. */}
        {hasProgress && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Progress</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Analytics')}>
                <Text style={styles.seeAll}>See all ›</Text>
              </TouchableOpacity>
            </View>

            {prs.length > 0 && (
              <View style={styles.prCard}>
                <Text style={styles.prHeader}>🏆 Recent PRs</Text>
                {prs.slice(0, 3).map((pr, i) => (
                  <View key={`${pr.name}-${i}`} style={styles.prRow}>
                    <Text style={styles.prName} numberOfLines={1}>
                      {pr.name}
                    </Text>
                    <Text style={styles.prValue}>
                      {pr.label} {pr.value}
                      <Text style={styles.prPrev}> (was {pr.prev})</Text>
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {movers.length > 0 && (
              <>
                <Text style={styles.subHeader}>Top movers</Text>
                {movers.map((card) => (
                  <ProgressCardRow
                    key={card.key}
                    card={card}
                    onPress={() => navigation.navigate('ExerciseProgress', { name: card.name })}
                  />
                ))}
              </>
            )}
          </>
        )}

        {/* History */}
        {history.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recent</Text>
            </View>
            {history.slice(0, 8).map((h) => (
              <WorkoutHistoryItem
                key={h.id}
                session={h}
                onPress={() =>
                  navigation.navigate('WorkoutSummary', { sessionId: h.id, viewOnly: true })
                }
                onDelete={() => deleteWorkout(h.id)}
              />
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (c: Theme) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 32 },
  screenTitle: { fontSize: 28, fontWeight: '800', color: c.text, marginBottom: 16 },

  resumeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: c.primarySoft,
    borderWidth: 1,
    borderColor: c.scheme === 'dark' ? 'rgba(16,185,129,0.4)' : '#A7F3D0',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  resumeTitle: { fontSize: 14, fontWeight: '700', color: c.scheme === 'dark' ? c.primary : '#065F46' },
  resumeSub: { fontSize: 12, color: c.scheme === 'dark' ? c.textMuted : '#047857', marginTop: 2 },
  resumeArrow: { fontSize: 28, color: c.primary, fontWeight: '300' },

  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#10B981',
    borderRadius: 20,
    padding: 18,
    marginBottom: 24,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  startBtnIcon: { fontSize: 32 },
  startBtnTitle: { fontSize: 16, fontWeight: '700', color: '#fff' },
  startBtnSub: { fontSize: 12, color: '#D1FAE5', marginTop: 2, maxWidth: 240 },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    marginTop: 4,
  },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: c.text },
  seeAll: { fontSize: 14, fontWeight: '600', color: c.primary },
  subHeader: { fontSize: 13, fontWeight: '600', color: c.textMuted, marginBottom: 8 },
  prCard: {
    backgroundColor: c.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: c.border,
    padding: 14,
    marginBottom: 14,
  },
  prHeader: { fontSize: 14, fontWeight: '700', color: c.text, marginBottom: 8 },
  prRow: { marginBottom: 6 },
  prName: { fontSize: 14, fontWeight: '600', color: c.text },
  prValue: { fontSize: 13, color: c.primaryDark, fontWeight: '600' },
  prPrev: { color: c.textFaint, fontWeight: '400' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  importLink: { fontSize: 15, fontWeight: '700', color: c.accent },
  createLink: { fontSize: 15, fontWeight: '700', color: c.primary },

  emptyCard: {
    backgroundColor: c.card,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  emptyText: { fontSize: 14, color: c.textMuted, lineHeight: 20 },

  templateCard: {
    backgroundColor: c.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: c.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  templateMain: {},
  templateName: { fontSize: 16, fontWeight: '700', color: c.text },
  templateMeta: { fontSize: 12, color: c.textFaint, marginTop: 4 },
  templateActions: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: c.border,
  },
  templateActionBtn: {},


  editText: { fontSize: 13, fontWeight: '600', color: c.primary },
  shareText: { fontSize: 13, fontWeight: '600', color: c.accent },
  deleteText: { fontSize: 13, fontWeight: '600', color: c.danger },
});
