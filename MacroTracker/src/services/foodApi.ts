import { Food } from '../types';
import { USDA_API_KEY, FATSECRET_CLIENT_ID, FATSECRET_CLIENT_SECRET } from '../config';
import { searchFoods as searchLocalFoods } from '../data/foods';

// --- Shared helpers ----------------------------------------------------------

function titleCase(s: string): string {
  return s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function num(v: number | undefined): number {
  return v ? Math.round(v * 10) / 10 : 0;
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
  foodNutrients?: UsdaNutrient[];
}

function pickNutrient(nutrients: UsdaNutrient[] | undefined, number: string): number {
  if (!nutrients) return 0;
  const found = nutrients.find((n) => n.nutrientNumber === number);
  return Math.round((found?.value ?? 0) * 10) / 10;
}

function usdaToFood(item: UsdaFood): Food {
  const n = item.foodNutrients;
  return {
    id: `usda-${item.fdcId}`,
    name: titleCase(item.description),
    brand: item.brandName || item.brandOwner || 'USDA',
    // USDA search nutrients are per 100 g.
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

// Whole/generic foods have cleaner macros than the long tail of branded
// entries, so we surface them first within the USDA results.
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
  nutriments?: OffNutriments;
}

function isUsProduct(p: OffProduct): boolean {
  return (p.countries_tags ?? []).includes('en:united-states');
}

function offToFood(p: OffProduct): Food | null {
  const nut: OffNutriments = p.nutriments ?? {};
  const calories = num(nut['energy-kcal_100g']);
  if (!p.product_name || calories === 0) return null;
  return {
    id: `off-${p.id ?? p.product_name}`,
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
}

async function searchOpenFoodFacts(q: string, signal?: AbortSignal): Promise<Food[]> {
  const url =
    `https://world.openfoodfacts.org/cgi/search.pl` +
    `?search_terms=${encodeURIComponent(q)}` +
    `&json=1&page_size=40` +
    `&fields=id,product_name,brands,countries_tags,nutriments`;

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

// --- FatSecret Platform API --------------------------------------------------
// Large branded + restaurant + generic database with a genuine free tier.
// Auth is OAuth 2.0 client credentials; we cache the token in module scope
// since it lasts 24 h and acquiring one per search would be wasteful.

let fsTokenCache: { value: string; expiresAt: number } | null = null;

async function getFatSecretToken(): Promise<string | null> {
  if (!FATSECRET_CLIENT_ID || !FATSECRET_CLIENT_SECRET) return null;
  if (fsTokenCache && Date.now() < fsTokenCache.expiresAt) return fsTokenCache.value;

  const res = await fetch('https://oauth.fatsecret.com/connect/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=client_credentials&scope=basic` +
      `&client_id=${encodeURIComponent(FATSECRET_CLIENT_ID)}` +
      `&client_secret=${encodeURIComponent(FATSECRET_CLIENT_SECRET)}`,
  });
  if (!res.ok) return null;
  const json = await res.json();
  if (!json.access_token) return null;
  // Subtract 60 s from expiry as a safety margin.
  fsTokenCache = { value: json.access_token, expiresAt: Date.now() + (json.expires_in - 60) * 1000 };
  return fsTokenCache.value;
}

// FatSecret search results embed nutrients as a text description:
// "Per 100g - Calories: 52kcal | Fat: 0.17g | Carbs: 13.81g | Protein: 0.26g"
// Parse it out since the basic search tier doesn't return structured nutrient fields.
interface FsParsed {
  serving_size: number;
  serving_unit: string;
  calories: number;
  fat: number;
  carbs: number;
  protein: number;
}

function parseFsDescription(desc: string): FsParsed | null {
  const cal = desc.match(/Calories:\s*([\d.]+)kcal/i);
  if (!cal) return null;
  const fat = desc.match(/Fat:\s*([\d.]+)g/i);
  const carbs = desc.match(/Carbs:\s*([\d.]+)g/i);
  const protein = desc.match(/Protein:\s*([\d.]+)g/i);
  // "Per 100g" / "Per 1 serving" / "Per 1 cup (240ml)"
  const serving = desc.match(/^Per\s+([\d.]+)\s*([a-zA-Z]+)/i);
  return {
    serving_size: serving ? parseFloat(serving[1]) : 100,
    serving_unit: serving ? serving[2].toLowerCase() : 'g',
    calories: parseFloat(cal[1]),
    fat: fat ? parseFloat(fat[1]) : 0,
    carbs: carbs ? parseFloat(carbs[1]) : 0,
    protein: protein ? parseFloat(protein[1]) : 0,
  };
}

interface FsFood {
  food_id?: string;
  food_name?: string;
  brand_name?: string;
  food_type?: string;
  food_description?: string;
}

function fsToFood(item: FsFood): Food | null {
  if (!item.food_name || !item.food_description) return null;
  const parsed = parseFsDescription(item.food_description);
  if (!parsed || parsed.calories === 0) return null;
  return {
    id: `fs-${item.food_id ?? item.food_name}`,
    name: titleCase(item.food_name),
    brand: item.brand_name || (item.food_type === 'Generic' ? 'Generic' : 'FatSecret'),
    serving_size: parsed.serving_size,
    serving_unit: parsed.serving_unit,
    macros: {
      calories: parsed.calories,
      protein: parsed.protein,
      carbs: parsed.carbs,
      fat: parsed.fat,
      fiber: 0,
      sugar: 0,
    },
  };
}

// FatSecret sometimes returns a single object instead of an array when there
// is only one result — normalise both shapes here.
function toArray<T>(v: T | T[] | undefined): T[] {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

export async function searchFatSecret(q: string, signal?: AbortSignal): Promise<Food[]> {
  const token = await getFatSecretToken();
  if (!token) return [];

  try {
    const url =
      `https://platform.fatsecret.com/rest/server.api` +
      `?method=foods.search&format=json&max_results=30` +
      `&search_expression=${encodeURIComponent(q)}`;
    const res = await fetch(url, {
      signal,
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`FatSecret ${res.status}`);
    const json = await res.json();
    const items: FsFood[] = toArray(json?.foods?.food);
    return items.map(fsToFood).filter((f): f is Food => f !== null);
  } catch (err: any) {
    if (err?.name === 'AbortError') throw err;
    return [];
  }
}

// --- Combined search ---------------------------------------------------------

/**
 * Search across the local curated list, USDA, FatSecret, and Open Food Facts
 * — all in parallel. Falls back to local foods if all remote sources fail.
 */
export async function searchFoodsApi(
  query: string,
  signal?: AbortSignal,
): Promise<Food[]> {
  const q = query.trim();
  if (!q) return searchLocalFoods('');

  const localMatches = searchLocalFoods(q);

  const [usda, fs, off] = await Promise.allSettled([
    searchUsda(q, signal),
    searchFatSecret(q, signal),
    searchOpenFoodFacts(q, signal),
  ]);

  // If every remote source aborted, propagate so the caller ignores this result.
  const allAborted = [usda, fs, off].every(
    (r) => r.status === 'rejected' && r.reason?.name === 'AbortError',
  );
  if (allAborted) throw (usda as PromiseRejectedResult).reason;

  const usdaFoods = usda.status === 'fulfilled' ? usda.value : [];
  const fsFoods = fs.status === 'fulfilled' ? fs.value : [];
  const offFoods = off.status === 'fulfilled' ? off.value : [];

  // Local curated first (cleanest), then USDA generics (most accurate macros),
  // then FatSecret (best branded/restaurant coverage), then OFF.
  return dedupeFoods([...localMatches, ...usdaFoods, ...fsFoods, ...offFoods]);
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
      `.json?fields=product_name,brands,nutriments`;
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
