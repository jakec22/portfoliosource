import { supabase } from './supabase';

export interface AnalyzedItem {
  name: string;
  serving?: string;
  // Weight of the AI-estimated portion in grams. Present when Gemini returns
  // it; enables the user to re-enter the amount by g / oz in the UI.
  serving_grams?: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

/**
 * Send a base64-encoded meal photo to the `analyze-meal` Edge Function, which
 * runs it through Gemini server-side and returns estimated macros per item.
 */
export async function analyzeMealPhoto(
  base64: string,
  mimeType = 'image/jpeg',
): Promise<AnalyzedItem[]> {
  return invokeAnalyze({ image: base64, mimeType });
}

/**
 * Send a free-text meal description (e.g. "2 scrambled eggs and a slice of
 * toast with butter") to the same `analyze-meal` Edge Function for macro
 * estimation.
 */
export async function analyzeMealText(description: string): Promise<AnalyzedItem[]> {
  return invokeAnalyze({ description });
}

async function invokeAnalyze(body: Record<string, unknown>): Promise<AnalyzedItem[]> {
  const { data, error } = await supabase.functions.invoke('analyze-meal', { body });
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
  const items = (data?.items ?? []) as AnalyzedItem[];
  // Defensively coerce numbers in case the model returns strings.
  return items.map((it) => ({
    name: String(it.name ?? 'Food'),
    serving: it.serving ? String(it.serving) : undefined,
    serving_grams: it.serving_grams && Number(it.serving_grams) > 0
      ? Math.round(Number(it.serving_grams))
      : undefined,
    calories: Math.max(0, Math.round(Number(it.calories) || 0)),
    protein: Math.max(0, Math.round(Number(it.protein) || 0)),
    carbs: Math.max(0, Math.round(Number(it.carbs) || 0)),
    fat: Math.max(0, Math.round(Number(it.fat) || 0)),
  }));
}
