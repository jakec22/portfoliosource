import { EXERCISE_CATALOG } from './exerciseList';

/**
 * The exercise names a shared link may refer to by number.
 *
 * A shared workout is a URL carrying the whole template, and exercise names
 * are most of its length — "Overhead Triceps Extension" is twenty-six
 * characters of a link somebody has to paste into a message. Sending the
 * position in this list instead makes it two.
 *
 * ## This list is append-only. It is not a copy of the catalog.
 *
 * It starts as one, and the temptation is to derive it from EXERCISE_CATALOG
 * so the two can never disagree. That would be a bug with a long fuse: the
 * catalog is grouped for browsing and will be reordered, renamed and pruned
 * as the app grows, and a link sent last month decodes against whatever the
 * list says *today*. Move one entry and an old link quietly turns somebody's
 * Lat Pulldown into a Leg Press — not an error, not a failed import, just the
 * wrong workout.
 *
 * So: add to the end, never insert, never reorder, never delete. An entry
 * whose exercise has left the catalog stays here as a tombstone, because
 * links containing its index are still out in the world. The cost of keeping
 * a dead string is nothing; the cost of reusing its index is silent.
 *
 * `missingFromShareDict` below is the reminder — it logs in development when
 * the catalog has a name this list does not, which means: append it.
 */
export const SHARE_DICT: readonly string[] = Object.freeze([
  'Barbell Bench Press',
  'Incline Barbell Bench Press',
  'Decline Bench Press',
  'Smith Machine Bench Press',
  'Dumbbell Bench Press',
  'Incline Dumbbell Press',
  'Decline Dumbbell Press',
  'Chest Press',
  'Incline Chest Press',
  'Decline Chest Press',
  'Pec Deck',
  'Chest Fly',
  'Incline Dumbbell Fly',
  'Cable Crossover',
  'High Cable Fly',
  'Low Cable Fly',
  'Push-up',
  'Incline Push-up',
  'Dip',
  'Weighted Dip',
  'Landmine Press',
  'Svend Press',
  'Deadlift',
  'Rack Pull',
  'Barbell Row',
  'Pendlay Row',
  'Dumbbell Row',
  'Chest Supported Row',
  'T-Bar Row',
  'Seated Cable Row',
  'Machine Row',
  'Lat Pulldown',
  'Wide-Grip Pulldown',
  'Close-Grip Pulldown',
  'Neutral-Grip Pulldown',
  'Straight-Arm Pulldown',
  'Pull-up',
  'Chin-up',
  'Assisted Pull-up',
  'Shrug',
  'Dumbbell Shrug',
  'Face Pull',
  'Reverse Pec Deck',
  'Back Extension',
  'Good Morning',
  'Pullover',
  'Back Squat',
  'Front Squat',
  'Hack Squat',
  'Pendulum Squat',
  'Belt Squat',
  'Smith Machine Squat',
  'Goblet Squat',
  'Bulgarian Split Squat',
  'Split Squat',
  'Leg Press',
  'Single-Leg Press',
  'Leg Extension',
  'Lying Leg Curl',
  'Seated Leg Curl',
  'Romanian Deadlift',
  'Stiff-Leg Deadlift',
  'Sumo Deadlift',
  'Walking Lunge',
  'Reverse Lunge',
  'Step-up',
  'Hip Thrust',
  'Glute Bridge',
  'Glute Kickback',
  'Hip Abduction',
  'Hip Adduction',
  'Standing Calf Raise',
  'Seated Calf Raise',
  'Leg Press Calf Raise',
  'Sissy Squat',
  'Nordic Curl',
  'Overhead Press',
  'Seated Dumbbell Press',
  'Arnold Press',
  'Machine Shoulder Press',
  'Push Press',
  'Lateral Raise',
  'Cable Lateral Raise',
  'Machine Lateral Raise',
  'Front Raise',
  'Rear Delt Fly',
  'Cable Rear Delt Fly',
  'Upright Row',
  'Shoulder Press',
  'Barbell Curl',
  'EZ-Bar Curl',
  'Dumbbell Curl',
  'Hammer Curl',
  'Incline Dumbbell Curl',
  'Preacher Curl',
  'Concentration Curl',
  'Cable Curl',
  'Spider Curl',
  'Reverse Curl',
  'Wrist Curl',
  'Triceps Pushdown',
  'Rope Pushdown',
  'Overhead Triceps Extension',
  'Skull Crusher',
  'Close-Grip Bench Press',
  'Triceps Dip',
  'Triceps Kickback',
  'Machine Triceps Extension',
  'Plank',
  'Side Plank',
  'Crunch',
  'Cable Crunch',
  'Machine Crunch',
  'Sit-up',
  'Hanging Leg Raise',
  'Lying Leg Raise',
  'Captain\'s Chair Leg Raise',
  'Russian Twist',
  'Ab Wheel Rollout',
  'Dead Bug',
  'Mountain Climber',
  'Pallof Press',
  'Cable Woodchop',
  'Hollow Hold',
  'V-up',
  'Bicycle Crunch',
  'Treadmill',
  'Running',
  'Walking',
  'Incline Walk',
  'Cycling',
  'Stationary Bike',
  'Assault Bike',
  'Rowing Machine',
  'Elliptical',
  'Stair Climber',
  'Jump Rope',
  'Swimming',
  'Sled Push',
  'Sled Pull',
  'Battle Ropes',
  'Ski Erg',
  'Jacobs Ladder',
  'Clean',
  'Power Clean',
  'Clean and Jerk',
  'Snatch',
  'Thruster',
  'Burpee',
  'Kettlebell Swing',
  'Turkish Get-up',
  'Farmer\'s Carry',
  'Devil\'s Press',
  'Wall Ball',
  'Box Jump',
  'Man Maker',
]);

/** name -> index, built once. */
const INDEX = new Map(SHARE_DICT.map((n, i) => [n, i]));

/** The dictionary position of a catalog exercise, or -1 for a custom name. */
export function shareDictIndex(name: string): number {
  const i = INDEX.get(name);
  return i === undefined ? -1 : i;
}

/** The name at a dictionary position, or null if the link is from the future. */
export function shareDictName(index: number): string | null {
  return SHARE_DICT[index] ?? null;
}

/**
 * Catalog names absent from the dictionary. Should always be empty; anything
 * here needs appending to SHARE_DICT before those exercises can travel in a
 * link by number rather than in full.
 */
export function missingFromShareDict(): string[] {
  const out: string[] = [];
  for (const group of EXERCISE_CATALOG) {
    for (const name of group.exercises) {
      if (!INDEX.has(name)) out.push(name);
    }
  }
  return out;
}

if (__DEV__) {
  const missing = missingFromShareDict();
  if (missing.length > 0) {
    console.warn(
      `[templateShareDict] ${missing.length} catalog exercise(s) are not in ` +
        `SHARE_DICT and will travel in shared links by full name. Append them ` +
        `to the END of the list: ${missing.join(', ')}`
    );
  }
}
