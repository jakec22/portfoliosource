import { Food, MacroNutrients } from '../types';
import { USDA_API_KEY } from '../config';
import { searchFoods as searchLocalFoods } from '../data/foods';

// --- Shared helpers ----------------------------------------------------------

function titleCase(s: string): string {
  return s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function num(v: number | undefined): number {
  return v ? Math.round(v * 10) / 10 : 0;
}

// A real-world serving for a food, in grams or millilitres.
interface Portion {
  size: number;
  unit: string;
}

// Sources report macros per 100 g/ml. Validate a candidate serving so we don't
// pick up garbage values (0, negatives, or absurdly large/odd-unit entries).
function validPortion(size: number | undefined, unit: string | undefined): Portion | null {
  if (!size || size <= 0 || size > 2000) return null;
  const u = (unit ?? 'g').toLowerCase();
  if (u !== 'g' && u !== 'ml') return null;
  return { size: Math.round(size * 10) / 10, unit: u };
}

function scaleMacros(per100: MacroNutrients, factor: number): MacroNutrients {
  const r = (x: number | undefined) => Math.round((x ?? 0) * factor * 10) / 10;
  return {
    calories: r(per100.calories),
    protein: r(per100.protein),
    carbs: r(per100.carbs),
    fat: r(per100.fat),
    fiber: r(per100.fiber),
    sugar: r(per100.sugar),
  };
}

// Turn per-100 macros + an optional real serving into the stored shape, where
// `macros` always represent exactly one `serving_size`. Falls back to 100 g
// when no trustworthy serving is available.
function applyPortion(
  per100: MacroNutrients,
  portion: Portion | null,
): Pick<Food, 'serving_size' | 'serving_unit' | 'macros'> {
  if (!portion) return { serving_size: 100, serving_unit: 'g', macros: per100 };
  return {
    serving_size: portion.size,
    serving_unit: portion.unit,
    macros: scaleMacros(per100, portion.size / 100),
  };
}

// Remove duplicates across sources keyed by normalized name + brand.
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

// --- USDA FoodData Central ---------------------------------------------------
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
  servingSize?: number;
  servingSizeUnit?: string;
  foodNutrients?: UsdaNutrient[];
}

function pickNutrient(nutrients: UsdaNutrient[] | undefined, number: string): number {
  if (!nutrients) return 0;
  const found = nutrients.find((n) => n.nutrientNumber === number);
  return Math.round((found?.value ?? 0) * 10) / 10;
}

function usdaToFood(item: UsdaFood): Food {
  const n = item.foodNutrients;
  // USDA search nutrients are reported per 100 g.
  const per100: MacroNutrients = {
    calories: pickNutrient(n, USDA_NUTRIENT.calories),
    protein: pickNutrient(n, USDA_NUTRIENT.protein),
    carbs: pickNutrient(n, USDA_NUTRIENT.carbs),
    fat: pickNutrient(n, USDA_NUTRIENT.fat),
    fiber: pickNutrient(n, USDA_NUTRIENT.fiber),
    sugar: pickNutrient(n, USDA_NUTRIENT.sugar),
  };
  // Branded items carry a label serving size; whole foods don't, so they keep
  // the 100 g reference.
  const portion = validPortion(item.servingSize, item.servingSizeUnit);
  return {
    id: `usda-${item.fdcId}`,
    name: titleCase(item.description),
    brand: item.brandName || item.brandOwner || 'USDA',
    ...applyPortion(per100, portion),
  };
}

// Whole/generic foods have cleaner macros than the long tail of branded
// entries, so we surface them first within the USDA results.
const USDA_TYPE_RANK: Record<string, number> = {
  Foundation: 0,
  'SR Legacy': 1,
  Survey: 2,
  Branded: 3,
};

async function searchUsda(q: string, signal?: AbortSignal): Promise<Food[]> {
  // Each dataType must be its own param — joining them with commas inside one
  // encoded value collapses them into a single malformed type and USDA then
  // returns nothing (or ignores the filter).
  const dataTypes = ['Foundation', 'SR Legacy', 'Survey (FNDDS)', 'Branded'];
  const url =
    `https://api.nal.usda.gov/fdc/v1/foods/search` +
    `?api_key=${USDA_API_KEY}` +
    `&query=${encodeURIComponent(q)}` +
    `&pageSize=50` +
    dataTypes.map((t) => `&dataType=${encodeURIComponent(t)}`).join('');

  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`USDA ${res.status}`);
  const json = await res.json();
  const items: UsdaFood[] = json.foods ?? [];

  // Stable sort by data-type rank, preserving USDA's relevance order within
  // each tier (whole foods lead, branded follow).
  const ranked = items
    .map((item, i) => ({ item, i }))
    .sort((a, b) => {
      const ra = USDA_TYPE_RANK[a.item.dataType ?? 'Branded'] ?? 3;
      const rb = USDA_TYPE_RANK[b.item.dataType ?? 'Branded'] ?? 3;
      return ra - rb || a.i - b.i;
    });

  return ranked
    .map(({ item }) => usdaToFood(item))
    .filter((f) => f.macros.calories > 0);
}

// --- Open Food Facts text search ---------------------------------------------
// The same API we already use for barcode lookups also supports text search
// with no key required. Good for packaged/branded products worldwide.

interface OffNutriments {
  ['energy-kcal_100g']?: number;
  proteins_100g?: number;
  carbohydrates_100g?: number;
  fat_100g?: number;
  fiber_100g?: number;
  sugars_100g?: number;
}

interface OffProduct {
  id?: string;
  product_name?: string;
  brands?: string;
  countries_tags?: string[];
  serving_quantity?: number | string;
  nutriments?: OffNutriments;
}

function isUsProduct(p: OffProduct): boolean {
  return (p.countries_tags ?? []).includes('en:united-states');
}

function offToFood(p: OffProduct): Food | null {
  const nut: OffNutriments = p.nutriments ?? {};
  // OFF nutrients are reported per 100 g/ml.
  const per100: MacroNutrients = {
    calories: num(nut['energy-kcal_100g']),
    protein: num(nut.proteins_100g),
    carbs: num(nut.carbohydrates_100g),
    fat: num(nut.fat_100g),
    fiber: num(nut.fiber_100g),
    sugar: num(nut.sugars_100g),
  };
  if (!p.product_name || per100.calories === 0) return null;
  // Use the label serving (grams) when present, else the 100 g reference.
  const qty =
    typeof p.serving_quantity === 'string'
      ? parseFloat(p.serving_quantity)
      : p.serving_quantity;
  const portion = validPortion(qty, 'g');
  return {
    id: `off-${p.id ?? p.product_name}`,
    name: titleCase(p.product_name),
    brand: p.brands ? p.brands.split(',')[0].trim() : 'Unknown',
    ...applyPortion(per100, portion),
  };
}

async function searchOpenFoodFacts(q: string, signal?: AbortSignal): Promise<Food[]> {
  const url =
    `https://world.openfoodfacts.org/cgi/search.pl` +
    `?search_terms=${encodeURIComponent(q)}` +
    `&json=1&page_size=40` +
    `&fields=id,product_name,brands,countries_tags,serving_quantity,nutriments`;

  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`OFF ${res.status}`);
  const json = await res.json();
  const products: OffProduct[] = json.products ?? [];

  // Surface US products first, preserving relevance order within each group,
  // so foreign items stop dominating the top of the list.
  const ranked = products
    .map((p, i) => ({ p, i }))
    .sort((a, b) => {
      const ua = isUsProduct(a.p) ? 0 : 1;
      const ub = isUsProduct(b.p) ? 0 : 1;
      return ua - ub || a.i - b.i;
    });

  return ranked.map(({ p }) => offToFood(p)).filter((f): f is Food => f !== null);
}

// --- Combined search ---------------------------------------------------------

/**
 * Search across the local curated list, Open Food Facts, and USDA — all in
 * parallel. Falls back to local foods if both remote sources fail.
 */
export async function searchFoodsApi(
  query: string,
  signal?: AbortSignal,
): Promise<Food[]> {
  const q = query.trim();
  if (!q) return searchLocalFoods('');

  const localMatches = searchLocalFoods(q);

  const [usda, off] = await Promise.allSettled([
    searchUsda(q, signal),
    searchOpenFoodFacts(q, signal),
  ]);

  // If both remote sources aborted, propagate so the caller ignores this result.
  if (
    usda.status === 'rejected' &&
    usda.reason?.name === 'AbortError' &&
    off.status === 'rejected' &&
    off.reason?.name === 'AbortError'
  ) {
    throw usda.reason;
  }

  // Surface source failures in the dev console so a sparse result set is
  // diagnosable (e.g. a rate-limited USDA key vs. a flaky OFF endpoint).
  if (usda.status === 'rejected' && usda.reason?.name !== 'AbortError') {
    console.warn('[foodApi] USDA search failed:', usda.reason?.message ?? usda.reason);
  }
  if (off.status === 'rejected' && off.reason?.name !== 'AbortError') {
    console.warn('[foodApi] Open Food Facts search failed:', off.reason?.message ?? off.reason);
  }

  const usdaFoods = usda.status === 'fulfilled' ? usda.value : [];
  const offFoods = off.status === 'fulfilled' ? off.value : [];

  // Local curated first (cleanest), then USDA generics (most accurate macros),
  // then OFF branded/packaged (widest product coverage).
  return dedupeFoods([...localMatches, ...usdaFoods, ...offFoods]);
}

// --- Open Food Facts barcode lookup ------------------------------------------

/**
 * Look up a product by barcode via Open Food Facts.
 * Returns null if the product isn't found.
 */
export async function lookupBarcode(
  barcode: string,
  signal?: AbortSignal,
): Promise<Food | null> {
  try {
    const url =
      `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}` +
      `.json?fields=product_name,brands,serving_quantity,nutriments`;
    const res = await fetch(url, { signal });
    if (!res.ok) return null;
    const json = await res.json();
    if (json.status !== 1 || !json.product) return null;
    const food = offToFood({ ...json.product, id: barcode });
    return food ? { ...food, id: `off-${barcode}` } : null;
  } catch {
    return null;
  }
}
