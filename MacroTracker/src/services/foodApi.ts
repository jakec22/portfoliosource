import { Food } from '../types';
import { USDA_API_KEY } from '../config';
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

/**
 * Search the USDA database. Falls back to the bundled local list if the
 * network request fails so the app still works offline.
 */
export async function searchFoodsApi(
  query: string,
  signal?: AbortSignal,
): Promise<Food[]> {
  const q = query.trim();
  if (!q) return searchLocalFoods('');

  const localMatches = searchLocalFoods(q);

  try {
    const url =
      `https://api.nal.usda.gov/fdc/v1/foods/search` +
      `?api_key=${USDA_API_KEY}` +
      `&query=${encodeURIComponent(q)}` +
      `&pageSize=30` +
      `&dataType=${encodeURIComponent('Foundation,SR Legacy,Branded')}`;

    const res = await fetch(url, { signal });
    if (!res.ok) throw new Error(`USDA ${res.status}`);
    const json = await res.json();
    const foods: Food[] = (json.foods ?? [])
      .map(usdaToFood)
      // Drop entries with no calorie data — usually incomplete records.
      .filter((f: Food) => f.macros.calories > 0);

    // Local curated matches first (clean data), then USDA results.
    return [...localMatches, ...foods];
  } catch (err: any) {
    if (err?.name === 'AbortError') throw err;
    // Network/API failure — degrade gracefully to local results.
    return localMatches;
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
