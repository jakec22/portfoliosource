import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { todayString } from '../utils/date';

/**
 * Today's date, kept current.
 *
 * `todayString()` read once in a component body or an effect is a value
 * frozen at mount, and nothing in React re-runs on the date changing. Every
 * surface that mirrors "today" was holding such a value: the watch and the
 * widget pushed on changes to `logs`, so between midnight and the first food
 * logged the next day — overnight plus a morning — they kept broadcasting
 * yesterday's totals as though they were current.
 *
 * Updates on two triggers, because neither alone is enough:
 *
 *  - A timer to the next local midnight, so an app left open rolls over.
 *    Scheduled rather than polled: it fires once a day, and `setInterval`
 *    with a short period to catch one instant a day is waste.
 *  - AppState becoming active, because timers do not fire reliably while
 *    the app is suspended, which is exactly where it spends the night.
 *
 * The timer re-arms from the real clock each time rather than adding 24h, so
 * a DST change or a timezone change lands on the right instant.
 */
export function useToday(): string {
  const [today, setToday] = useState(todayString);

  useEffect(() => {
    // Only set state when the day actually moved, so this never causes a
    // render on an ordinary foreground.
    const check = () => setToday((current) => {
      const now = todayString();
      return current === now ? current : now;
    });

    let timer: ReturnType<typeof setTimeout>;
    const armForMidnight = () => {
      const now = new Date();
      const midnight = new Date(now);
      midnight.setHours(24, 0, 0, 0);
      // A second past, so the clock has certainly crossed when it fires.
      timer = setTimeout(() => {
        check();
        armForMidnight();
      }, midnight.getTime() - now.getTime() + 1000);
    };
    armForMidnight();

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') check();
    });

    return () => {
      clearTimeout(timer);
      sub.remove();
    };
  }, []);

  return today;
}
