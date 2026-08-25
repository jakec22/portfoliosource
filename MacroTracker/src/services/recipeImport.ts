import { supabase } from './supabase';

export interface ParsedIngredient {
  name: string;
  amount?: string;
}

export interface ParsedRecipe {
  name: string;
  servings: number;
  ingredients: ParsedIngredient[];
  steps: string[];
  calories: number; // per serving
  protein: number;
  carbs: number;
  fat: number;
}

/**
 * Send a recipe URL or pasted text (e.g. an Instagram caption) to the
 * `analyze-recipe` Edge Function, which extracts ingredients, steps, and
 * per-serving macros via Gemini server-side.
 *
 * Website links are fetched server-side directly. Instagram (and similar
 * sites that block automated fetching) won't yield a page's caption via
 * `url` — pass the caption/description text via `text` instead.
 */
export async function analyzeRecipe(input: { url?: string; text?: string }): Promise<ParsedRecipe> {
  const { data, error } = await supabase.functions.invoke('analyze-recipe', { body: input });
  if (error) {
    // Supabase wraps the function's JSON error body in error.context when
    // available; surface the most useful message.
    let detail = error.message;
    try {
      const errBody = await (error as any).context?.json?.();
      if (errBody?.error) detail = errBody.error;
    } catch {
      /* ignore — fall back to error.message */
    }
    throw new Error(detail);
  }
  // Defensively coerce in case the model returns strings for numbers.
  return {
    name: String(data?.name ?? 'Recipe').trim() || 'Recipe',
    servings: Math.max(1, Math.round(Number(data?.servings) || 1)),
    ingredients: Array.isArray(data?.ingredients)
      ? data.ingredients
          .map((i: any) => ({
            name: String(i?.name ?? '').trim(),
            amount: i?.amount ? String(i.amount).trim() : undefined,
          }))
          .filter((i: ParsedIngredient) => i.name)
      : [],
    steps: Array.isArray(data?.steps)
      ? data.steps.map((s: any) => String(s ?? '').trim()).filter(Boolean)
      : [],
    calories: Math.max(0, Math.round(Number(data?.caloriesPerServing) || 0)),
    protein: Math.max(0, Math.round(Number(data?.proteinPerServing) || 0)),
    carbs: Math.max(0, Math.round(Number(data?.carbsPerServing) || 0)),
    fat: Math.max(0, Math.round(Number(data?.fatPerServing) || 0)),
  };
}

/** True for strings that look like a URL (vs. pasted recipe/caption text). */
export function looksLikeUrl(v: string): boolean {
  return /^https?:\/\/\S+$/i.test(v.trim());
}
