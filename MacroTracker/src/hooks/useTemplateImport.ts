import { useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import * as Linking from 'expo-linking';
import { useStore } from '../store/useStore';
import { decodeTemplateLink } from '../utils/templateShare';

/**
 * Listens for incoming `import-template` deep links (including the URL the app
 * was cold-launched with) and prompts the user to add the shared workout to
 * My Workouts. Mount once inside the authenticated app.
 */
export function useTemplateImport() {
  const url = Linking.useURL();
  const saveTemplate = useStore((s) => s.saveTemplate);
  const lastHandled = useRef<string | null>(null);

  useEffect(() => {
    if (!url || lastHandled.current === url) return;
    const template = decodeTemplateLink(url);
    if (!template) return;

    lastHandled.current = url;
    const exCount = template.exercises.length;
    Alert.alert(
      'Import workout?',
      `“${template.name}” · ${exCount} exercise${exCount === 1 ? '' : 's'}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Add to My Workouts',
          onPress: () => {
            saveTemplate(template);
            Alert.alert('Imported', `“${template.name}” was added to My Workouts.`);
          },
        },
      ]
    );
  }, [url, saveTemplate]);
}
