import { Platform } from 'react-native';

/**
 * Active Energy Burned — the "calories burned" figure the phone's health store
 * accumulates from motion sensors and any wearable feeding it. HealthKit on
 * iOS, Health Connect's ActiveCaloriesBurned on Android.
 *
 * Mirrors the guarded lazy-load pattern in `heartRate.ts`: native modules are
 * required on demand and every call degrades to "no data" (null) rather than
 * throwing, so this is safe from Expo Go or a build without them. null means
 * "hide this", never "zero" — a day with no wearable and a day of rest must
 * not look the same.
 *
 * Permissions ride along with heart rate on both platforms: HealthKit grants
 * per read-type at runtime under the usage string already in app.json, and
 * Health Connect's ActiveCaloriesBurned read is requested here against the
 * permission app.json declares.
 */
const ACTIVE_ENERGY_ID = 'HKQuantityTypeIdentifierActiveEnergyBurned' as const;

function loadHealthConnect(): typeof import('react-native-health-connect') | null {
  if (Platform.OS !== 'android') return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('react-native-health-connect');
  } catch {
    return null;
  }
}

function loadHealthKit(): typeof import('@kingstinct/react-native-healthkit') | null {
  if (Platform.OS !== 'ios') return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('@kingstinct/react-native-healthkit');
  } catch {
    return null;
  }
}

/** Whether a health store is present in this build/device at all. */
export function activeEnergyAvailable(): boolean {
  if (Platform.OS === 'android') return loadHealthConnect() != null;
  const hk = loadHealthKit();
  if (!hk) return false;
  try {
    return hk.isHealthDataAvailable();
  } catch {
    return false;
  }
}

/** Ask for read permission. Resolves true if granted. */
export async function requestActiveEnergyPermission(): Promise<boolean> {
  const hc = loadHealthConnect();
  if (hc) {
    try {
      if ((await hc.getSdkStatus()) !== hc.SdkAvailabilityStatus.SDK_AVAILABLE) return false;
      if (!(await hc.initialize())) return false;
      const granted = await hc.requestPermission([
        { accessType: 'read', recordType: 'ActiveCaloriesBurned' },
      ]);
      return granted.some(
        (p) =>
          'recordType' in p &&
          p.recordType === 'ActiveCaloriesBurned' &&
          p.accessType === 'read'
      );
    } catch {
      return false;
    }
  }
  const hk = loadHealthKit();
  if (!hk) return false;
  try {
    return await hk.requestAuthorization({ toRead: [ACTIVE_ENERGY_ID] });
  } catch {
    return false;
  }
}

/**
 * Cumulative Active Energy Burned (kcal) between two instants, or null if the
 * health store is unavailable, permission wasn't granted, or the read found
 * nothing — the caller treats null as "hide this", not "zero".
 */
export async function queryActiveEnergyRange(
  startDate: Date,
  endDate: Date
): Promise<number | null> {
  const hc = loadHealthConnect();
  if (hc) {
    try {
      const res = await hc.aggregateRecord({
        recordType: 'ActiveCaloriesBurned',
        timeRangeFilter: {
          operator: 'between',
          startTime: startDate.toISOString(),
          endTime: endDate.toISOString(),
        },
      });
      const kcal = res.ACTIVE_CALORIES_TOTAL?.inKilocalories;
      // Health Connect answers an empty window with 0 rather than nothing, so
      // a zero here is indistinguishable from no data and is treated as such.
      return typeof kcal === 'number' && kcal > 0 ? Math.round(kcal) : null;
    } catch {
      return null;
    }
  }
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
