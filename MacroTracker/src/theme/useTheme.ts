import { useColorScheme } from 'react-native';
import { useStore } from '../store/useStore';
import { resolveTheme, type Theme } from './index';

// Resolves the active Theme from the user's saved preference, falling back to
// the OS color scheme when the preference is "system". Re-renders consumers
// whenever the preference or the OS scheme changes.
export function useTheme(): Theme {
  const mode = useStore((s) => s.themeMode);
  const systemScheme = useColorScheme();
  return resolveTheme(mode, systemScheme);
}
