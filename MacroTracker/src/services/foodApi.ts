import { Food } from '../types';
import {
  USDA_API_KEY,
  NUTRITIONIX_APP_ID,
  NUTRITIONIX_APP_KEY,
} from '../config';
import { searchFoods as searchLocalFoods } from '../data/foods';

// --- USDA FoodData Central -------------------------------------------------
// Nutrient numbers are stable identifiers in the USDA dataset.
const USDA_NUTRIENT = {
  calories: '208',
  protein: '203',
  fat: '204',
  carbs: '205',
  fiber: '291',
  sugar: '269',
} as const;

interface UsdaNutrient {
  nutrientNumber?: string;
  value?: number;
}

interface UsdaFood {
  fdcId: number;
  description: string;
  brandName?: string;
  brandOwner?: string;
  dataType?: string;
  foodNutrients?: UsdaNutrient[];
}

function pickNutrient(nutrients: UsdaNutrient[] | undefined, number: string): number {
  if (!nutrients) return 0;
  const found = nutrients.find((n) => n.nutrientNumber === number);
  const v = found?.value ?? 0;
  return Math.round(v * 10) / 10;
}

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function usdaToFood(item: UsdaFood): Food {
  const n = item.foodNutrients;
  return {
    id: `usda-${item.fdcId}`,
    name: titleCase(item.description),
    brand: item.brandName || item.brandOwner || 'USDA',
    // USDA search nutrients are reported per 100 g.
    serving_size: 100,
    serving_unit: 'g',
    macros: {
      calories: pickNutrient(n, USDA_NUTRIENT.calories),
      protein: pickNutrient(n, USDA_NUTRIENT.protein),
      carbs: pickNutrient(n, USDA_NUTRIENT.carbs),
      fat: pickNutrient(n, USDA_NUTRIENT.fat),
      fiber: pickNutrient(n, USDA_NUTRIENT.fiber),
      sugar: pickNutrient(n, USDA_NUTRIENT.sugar),
    },
  };
}

// Whole/generic foods have cleaner, more trustworthy macros than the long
// tail of branded entries, so we surface them first within the USDA results.
const USDA_TYPE_RANK: Record<string, number> = {
  Foundation: 0,
  'SR Legacy': 1,
  Survey: 2,
  Branded: 3,
};

async function searchUsda(q: string, signal?: AbortSignal): Promise<Food[]> {
  const url =
    `https://api.nal.usda.gov/fdc/v1/foods/search` +
    `?api_key=${USDA_API_KEY}` +
    `&query=${encodeURIComponent(q)}` +
    `&pageSize=50` +
    `&dataType=${encodeURIComponent('Foundation,SR Legacy,Survey (FNDDS),Branded')}`;

  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`USDA ${res.status}`);
  const json = await res.json();
  const items: UsdaFood[] = json.foods ?? [];

  // Stable sort by data-type rank, preserving USDA's relevance order within
  // each tier (so whole foods lead, branded follow, both still relevant).
  const ranked = items
    .map((item, i) => ({ item, i }))
    .sort((a, b) => {
      const ra = USDA_TYPE_RANK[a.item.dataType ?? 'Branded'] ?? 3;
      const rb = USDA_TYPE_RANK[b.item.dataType ?? 'Branded'] ?? 3;
      return ra - rb || a.i - b.i;
    });

  return ranked
    .map(({ item }) => usdaToFood(item))
    // Drop entries with no calorie data — usually incomplete records.
    .filter((f) => f.macros.calories > 0);
}

// Remove duplicates that appear across sources (e.g. the same branded item in
// both USDA and Nutritionix), keyed by normalized name + brand.
function dedupeFoods(foods: Food[]): Food[] {
  const seen = new Set<string>();
  const out: Food[] = [];
  for (const f of foods) {
    const key = `${f.name}|${f.brand ?? ''}`.toLowerCase().replace(/\s+/g, ' ').trim();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(f);
  }
  return out;
}

/**
 * Search across the local curated list, USDA, and (when keys are configured)
 * Nutritionix. USDA and Nutritionix are queried in parallel. Falls back to the
 * bundled local list if the network requests fail so the app works offline.
 */
export async function searchFoodsApi(
  query: string,
  signal?: AbortSignal,
): Promise<Food[]> {
  const q = query.trim();
  if (!q) return searchLocalFoods('');

  const localMatches = searchLocalFoods(q);

  const [usda, nutritionix] = await Promise.allSettled([
    searchUsda(q, signal),
    searchNutritionix(q, signal),
  ]);

  // If both remote sources aborted (a newer query superseded this one),
  // propagate the abort so the caller can ignore this stale result.
  if (
    usda.status === 'rejected' &&
    usda.reason?.name === 'AbortError' &&
    nutritionix.status === 'rejected' &&
    nutritionix.reason?.name === 'AbortError'
  ) {
    throw usda.reason;
  }

  const usdaFoods = usda.status === 'fulfilled' ? usda.value : [];
  const nixFoods = nutritionix.status === 'fulfilled' ? nutritionix.value : [];

  // Local curated matches first (cleanest data), then Nutritionix (best for
  // restaurant/branded), then USDA generic + branded.
  return dedupeFoods([...localMatches, ...nixFoods, ...usdaFoods]);
}

// --- Nutritionix (restaurant & branded food coverage) ----------------------
interface NixItem {
  food_name?: string;
  brand_name?: string;
  serving_qty?: number;
  serving_unit?: string;
  nix_item_id?: string;
  tag_id?: string;
  nf_calories?: number;
  nf_protein?: number;
  nf_total_carbohydrate?: number;
  nf_total_fat?: number;
  nf_dietary_fiber?: number;
  nf_sugars?: number;
}

function nixToFood(item: NixItem): Food {
  const id = item.nix_item_id
    ? `nix-${item.nix_item_id}`
    : `nix-${item.tag_id ?? item.food_name}`;
  return {
    id,
    name: titleCase(item.food_name ?? 'Unknown'),
    brand: item.brand_name || 'Nutritionix',
    // Nutritionix nutrients are reported for the stated serving, not per 100g.
    serving_size: item.serving_qty && item.serving_qty > 0 ? item.serving_qty : 1,
    serving_unit: item.serving_unit || 'serving',
    macros: {
      calories: num(item.nf_calories),
      protein: num(item.nf_protein),
      carbs: num(item.nf_total_carbohydrate),
      fat: num(item.nf_total_fat),
      fiber: num(item.nf_dietary_fiber),
      sugar: num(item.nf_sugars),
    },
  };
}

/**
 * Search Nutritionix instant search. Requires app id + key to be configured;
 * returns [] when unset or on any error. `detailed=true` returns full macros
 * inline for branded items so we can show P/C/F without per-item lookups.
 */
export async function searchNutritionix(
  query: string,
  signal?: AbortSignal,
): Promise<Food[]> {
  if (!NUTRITIONIX_APP_ID || !NUTRITIONIX_APP_KEY) return [];
  const q = query.trim();
  if (!q) return [];

  try {
    const url =
      `https://trackapi.nutritionix.com/v2/search/instant` +
      `?query=${encodeURIComponent(q)}&detailed=true`;
    const res = await fetch(url, {
      signal,
      headers: {
        'x-app-id': NUTRITIONIX_APP_ID,
        'x-app-key': NUTRITIONIX_APP_KEY,
        'x-remote-user-id': '0',
      },
    });
    if (!res.ok) throw new Error(`Nutritionix ${res.status}`);
    const json = await res.json();
    const items: NixItem[] = [...(json.branded ?? []), ...(json.common ?? [])];
    return items
      .map(nixToFood)
      // Without full nutrients an item is useless in the list — drop it.
      .filter((f) => f.macros.calories > 0);
  } catch (err: any) {
    if (err?.name === 'AbortError') throw err;
    return [];
  }
}

// --- Open Food Facts (barcode lookup) --------------------------------------
interface OffNutriments {
  ['energy-kcal_100g']?: number;
  proteins_100g?: number;
  carbohydrates_100g?: number;
  fat_100g?: number;
  fiber_100g?: number;
  sugars_100g?: number;
}

function num(v: number | undefined): number {
  return v ? Math.round(v * 10) / 10 : 0;
}

/**
 * Look up a product by barcode via Open Food Facts (best barcode coverage).
 * Returns null if the product isn't found.
 */
export async function lookupBarcode(
  barcode: string,
  signal?: AbortSignal,
): Promise<Food | null> {
  try {
    const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(
      barcode,
    )}.json?fields=product_name,brands,nutriments`;
    const res = await fetch(url, { signal });
    if (!res.ok) return null;
    const json = await res.json();
    if (json.status !== 1 || !json.product) return null;

    const p = json.product;
    const nut: OffNutriments = p.nutriments ?? {};
    const calories = num(nut['energy-kcal_100g']);
    if (!p.product_name || calories === 0) return null;

    return {
      id: `off-${barcode}`,
      name: titleCase(p.product_name),
      brand: p.brands ? p.brands.split(',')[0].trim() : 'Unknown',
      serving_size: 100,
      serving_unit: 'g',
      macros: {
        calories,
        protein: num(nut.proteins_100g),
        carbs: num(nut.carbohydrates_100g),
        fat: num(nut.fat_100g),
        fiber: num(nut.fiber_100g),
        sugar: num(nut.sugars_100g),
      },
    };
  } catch {
    return null;
  }
}
