import { useStore } from '../store/useStore';
import { resolveTheme, type Theme } from './index';

// Resolves the active Theme from the user's saved theme-pack preference.
// Re-renders consumers whenever the preference changes.
export function useTheme(): Theme {
  const pack = useStore((s) => s.themeMode);
  return resolveTheme(pack);
}
