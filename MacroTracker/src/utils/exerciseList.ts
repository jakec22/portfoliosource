// A curated catalog of common gym exercises, grouped by body part, used to
// populate the exercise picker. Users can always type a custom name instead —
// this list is a shortcut, not a restriction.

export interface ExerciseCategory {
  category: string;
  exercises: string[];
}

export const EXERCISE_CATALOG: ExerciseCategory[] = [
  {
    category: 'Chest',
    exercises: [
      'Barbell Bench Press',
      'Incline Barbell Bench Press',
      'Decline Bench Press',
      'Dumbbell Bench Press',
      'Incline Dumbbell Press',
      'Chest Press',
      'Incline Chest Press',
      'Decline Chest Press',
      'Chest Fly',
      'Cable Crossover',
      'Push-up',
      'Dips',
    ],
  },
  {
    category: 'Back',
    exercises: [
      'Barbell Row',
      'Pull-up',
      'Chin-up',
      'Lat Pulldown',
      'Seated Cable Row',
      'T-Bar Row',
      'Single-Arm Dumbbell Row',
      'Face Pull',
    ],
  },
  {
    category: 'Legs',
    exercises: [
      'Deadlift',
      'Back Squat',
      'Front Squat',
      'Leg Press',
      'Romanian Deadlift',
      'Leg Extension',
      'Leg Curl',
      'Walking Lunge',
      'Bulgarian Split Squat',
      'Calf Raise',
      'Hip Thrust',
    ],
  },
  {
    category: 'Shoulders',
    exercises: [
      'Overhead Press',
      'Dumbbell Shoulder Press',
      'Arnold Press',
      'Lateral Raise',
      'Front Raise',
      'Rear Delt Fly',
      'Upright Row',
      'Shrug',
    ],
  },
  {
    category: 'Arms',
    exercises: [
      'Barbell Curl',
      'Dumbbell Curl',
      'Hammer Curl',
      'Preacher Curl',
      'Tricep Pushdown',
      'Overhead Tricep Extension',
      'Skull Crusher',
      'Close-Grip Bench Press',
    ],
  },
  {
    category: 'Core',
    exercises: [
      'Plank',
      'Hanging Leg Raise',
      'Leg Lift',
      'Flutter Kick',
      'Cable Crunch',
      'Russian Twist',
      'Ab Wheel Rollout',
      'Sit-up',
    ],
  },
  {
    category: 'Cardio',
    exercises: [
      'Treadmill Run',
      'Stationary Bike',
      'Rowing Machine',
      'Stair Climber',
      'Jump Rope',
      'Elliptical',
    ],
  },
  {
    category: 'Full Body',
    exercises: ['Kettlebell Swing', "Farmer's Carry", 'Burpee', 'Clean and Jerk', 'Snatch'],
  },
];
