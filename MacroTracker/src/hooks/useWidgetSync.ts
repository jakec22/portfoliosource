import { useEffect } from 'react';
import { useStore, sumMacros } from '../store/useStore';
import { todayString } from '../utils/date';
import { updateMacroWidget } from '../services/widget';

// Mirrors today's calories and macros to the home screen widget whenever they
// change. One-way (app → widget); the widget is read-only.
export function useWidgetSync(): void {
  const logs = useStore((s) => s.logs);
  const goals = useStore((s) => s.goals);
  const themeMode = useStore((s) => s.themeMode);

  useEffect(() => {
    const today = todayString();
    const totals = sumMacros(logs[today] ?? []);
    updateMacroWidget(
      {
        date: today,
        calories: totals.calories,
        protein: totals.protein,
        carbs: totals.carbs,
        fat: totals.fat,
        fiber: totals.fiber ?? 0,
      },
      goals,
      themeMode
    );
    // themeMode is a dependency because the widget renders with the resolved
    // palette pushed here — switching packs has to repaint it.
  }, [logs, goals, themeMode]);
}
