import { Alert, Share } from 'react-native';
import { useStore } from '../store/useStore';
import { useSnackbar } from '../store/useSnackbar';
import { showPrompt } from '../store/usePrompt';
import { encodeTemplateLink, decodeTemplateLink } from '../utils/templateShare';
import { formatDuration as formatSetTime } from '../utils/duration';
import { DEFAULT_WORKOUT_HK, recoveryType } from '../utils/workoutTypes';
import type { WorkoutTemplate } from '../types';

/**
 * Everything you can do to a saved workout, from wherever you are.
 *
 * These four lived in ExerciseScreen because that screen owned the only list
 * of templates. The list has moved to WorkoutLibraryScreen and starting one
 * now happens from the sheet, so three screens need them and none of them
 * should own them. Share in particular is forty lines of formatting that
 * must not exist twice.
 */
export function useTemplateActions(navigation: any) {
  const startWorkout = useStore((s) => s.startWorkout);
  const saveTemplate = useStore((s) => s.saveTemplate);
  const deleteTemplate = useStore((s) => s.deleteTemplate);
  const restoreTemplate = useStore((s) => s.restoreTemplate);
  const activeWorkout = useStore((s) => s.activeWorkout);
  const activeRecovery = useStore((s) => s.activeRecovery);
  const showSnackbar = useSnackbar((s) => s.show);

  function handleStartTemplate(t: WorkoutTemplate) {
    if (activeRecovery) {
      Alert.alert(
        `${recoveryType(activeRecovery.kind).label} in progress`,
        'Finish it first — your watch can only track one session at a time.',
        [{ text: 'OK' }]
      );
      return;
    }
    if (activeWorkout) {
      Alert.alert(
        'Workout in progress',
        'Finish or cancel your current workout before starting a new one.',
        [{ text: 'OK' }]
      );
      return;
    }
    // The template already carries its workout type — start straight away.
    startWorkout(t, t.activityType ?? DEFAULT_WORKOUT_HK);
    navigation.navigate('ActiveWorkout');
  }

  function handleDeleteTemplate(t: WorkoutTemplate) {
    deleteTemplate(t.id);
    showSnackbar(`Deleted ${t.name}`, { label: 'Undo', onPress: () => restoreTemplate(t) });
  }

  function handleShareTemplate(t: WorkoutTemplate) {
    const typeLabel: Record<string, string> = {
      warmup: ' (Warm-up)',
      failure: ' (Failure)',
      dropset: ' (Drop set)',
    };
    const lines: string[] = [t.name, ''];
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
    showPrompt({
      title: 'Add from link',
      message: 'Paste a shared HolyMacro workout link.',
      placeholder: 'https://…',
      submitLabel: 'Import',
      autoCapitalize: 'none',
      // A link carries the whole template, so this is the one field here that
      // is legitimately long. Generous, but still bounded.
      maxLength: 4000,
      // Decoded before the dialog closes. It used to close, raise a second
      // alert, and leave the user to find and paste the link again — the
      // worst possible place to throw away what someone pasted.
      validate: (v) =>
        decodeTemplateLink(v)
          ? null
          : 'That isn’t a HolyMacro workout link. Copy the whole link and try again.',
      onSubmit: (text) => {
        const template = decodeTemplateLink(text);
        // Validated a moment ago; this is the type guard, not a second check.
        if (!template) return;
        saveTemplate(template);
        Alert.alert('Imported', `“${template.name}” was added to My Workouts.`);
      },
    });
  }

  return {
    startTemplate: handleStartTemplate,
    deleteTemplate: handleDeleteTemplate,
    shareTemplate: handleShareTemplate,
    importFromLink: handleImportFromLink,
  };
}
