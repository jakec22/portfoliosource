import { Platform } from 'react-native';

/**
 * Reads today's (or any date's) Active Energy Burned from HealthKit — the
 * "calories burned" total Apple Health accumulates from the iPhone's motion
 * sensors and, when the user wears one, an Apple Watch. Mirrors the guarded
 * lazy-load pattern in `heartRate.ts`: the native module is required lazily
 * and every call degrades to "no data" (null) rather than throwing, so this
 * is safe to call from Expo Go or a build without the native module.
 *
 * No new native config is needed beyond what heart-rate already set up —
 * HealthKit authorization is granted per read-type at runtime via
 * `requestAuthorization`, reusing the same NSHealthShareUsageDescription
 * already declared in app.json.
 */
const ACTIVE_ENERGY_ID = 'HKQuantityTypeIdentifierActiveEnergyBurned' as const;

function loadHealthKit(): typeof import('@kingstinct/react-native-healthkit') | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('@kingstinct/react-native-healthkit');
  } catch {
    return null;
  }
}

/** Whether HealthKit is present in this build/device at all. */
export function activeEnergyAvailable(): boolean {
  const hk = loadHealthKit();
  if (!hk) return false;
  try {
    return Platform.OS === 'ios' && hk.isHealthDataAvailable();
  } catch {
    return false;
  }
}

/** Ask for read permission. Resolves true if granted. */
export async function requestActiveEnergyPermission(): Promise<boolean> {
  const hk = loadHealthKit();
  if (!hk) return false;
  try {
    return await hk.requestAuthorization({ toRead: [ACTIVE_ENERGY_ID] });
  } catch {
    return false;
  }
}

/**
 * Cumulative Active Energy Burned (kcal) between two instants, or null if
 * HealthKit is unavailable, permission wasn't granted, or the read failed —
 * the caller should treat null as "hide this", not "zero".
 */
export async function queryActiveEnergyRange(
  startDate: Date,
  endDate: Date
): Promise<number | null> {
  const hk = loadHealthKit();
  if (!hk) return null;
  try {
    const res = await hk.queryStatisticsForQuantity(ACTIVE_ENERGY_ID, ['cumulativeSum'], {
      filter: { date: { startDate, endDate } },
      unit: 'kcal',
    });
    const kcal = res.sumQuantity?.quantity;
    return typeof kcal === 'number' ? Math.round(kcal) : null;
  } catch {
    return null;
  }
}

/** Cumulative Active Energy Burned (kcal) for the given YYYY-MM-DD date. */
export async function queryActiveEnergy(dateStr: string): Promise<number | null> {
  const [y, m, d] = dateStr.split('-').map(Number);
  return queryActiveEnergyRange(
    new Date(y, m - 1, d, 0, 0, 0, 0),
    new Date(y, m - 1, d, 23, 59, 59, 999)
  );
}

/** Cumulative Active Energy Burned (kcal) between two epoch-ms timestamps —
 * for scoping the read to a specific workout's actual start/end. */
export async function queryActiveEnergyForWorkout(
  startMs: number,
  endMs: number
): Promise<number | null> {
  return queryActiveEnergyRange(new Date(startMs), new Date(endMs));
}
