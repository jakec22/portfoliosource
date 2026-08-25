// Extracts a structured recipe (ingredients + steps + per-serving macros) from
// a webpage URL or pasted text (e.g. an Instagram caption) using Google
// Gemini. The Gemini API key stays server-side — never shipped in the app.
//
// Deploy:   supabase functions deploy analyze-recipe
// Secret:   supabase secrets set GEMINI_API_KEY=your-key   (shared with analyze-meal)
//
// Instagram note: Instagram blocks unauthenticated scraping, so a shared
// Instagram link alone usually won't yield the caption/recipe text server-side.
// For Instagram, the client should have the user paste the caption text
// instead of the link — this function accepts `text` for exactly that case.
// Website recipe URLs are fetched directly.
//
// Quality note: most recipe sites embed a schema.org Recipe JSON-LD block
// (for Google's recipe rich snippets) with clean, pre-separated ingredients
// and instructions. When present we extract and hand THAT to Gemini instead
// of noisy scraped page text — this is what makes quality consistent across
// sites rather than depending on how messy a given page's prose is. Only
// sites without that markup fall back to raw scraped text.

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
const GEMINI_MODEL = 'gemini-2.5-flash';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PROMPT = `You are a recipe extraction assistant. You are given content describing a
recipe: either raw text from a web page or pasted caption, OR a pre-structured block already
labeled with RECIPE NAME / SERVINGS / INGREDIENTS / INSTRUCTIONS sections. Determine whether it
actually describes a cooking recipe (has ingredients and/or steps).

If it does, extract:
- name: a short recipe title.
- servings: how many servings/portions it makes (a whole number). If a SERVINGS line is given,
  use it. Otherwise, if not stated, give a reasonable estimate for a typical batch; never 0.
- ingredients: one entry per ingredient LINE, with "name" (the ingredient itself, e.g.
  "all-purpose flour") and "amount" (the quantity as written, e.g. "2 cups"). If the content
  gives a pre-structured INGREDIENTS list, that list is already complete and correct — do not
  add, remove, merge, or reorder ingredients; only split each line into its amount and name.
- steps: copy the cooking instructions AS WRITTEN — do not rewrite, rephrase, summarize,
  reorder, condense, or add steps that aren't there. If the content gives a pre-structured
  INSTRUCTIONS list, that list is already correctly separated by the source itself — copy each
  numbered line into "steps" exactly as one entry each; do not merge lines together, split them
  further, or reword them. If instead you're working from raw unstructured text, preserve the
  original wording, temperatures, times, and techniques; the ONLY transformation allowed there
  is splitting one sentence that runs together multiple sequential actions (e.g. "Preheat the
  oven to 350°F and grease a 9x9 pan.") into separate entries at those natural breaks.
- totalCalories, totalProtein, totalCarbs, totalFat: your best estimate of the nutrition for
  the ENTIRE recipe (all servings combined), based on the ingredients and their amounts.
- caloriesPerServing, proteinPerServing, carbsPerServing, fatPerServing: each of the totals
  above divided by "servings", rounded — the amount in ONE serving. Compute this as an actual
  division of the total fields you just filled in; never repeat the total as the per-serving
  value. Example: totalCalories 2400 with servings 6 means caloriesPerServing is 400, not 2400.

If the content does NOT describe a recipe (e.g. it's an unrelated article, an ad, or a caption
with no real ingredients/steps), set "found" to false and leave the other fields as your best
empty-ish guess (servings: 1, empty arrays, 0 for every nutrition field) — do not invent one.

Return only the structured data.`;

const responseSchema = {
  type: 'object',
  properties: {
    found: { type: 'boolean' },
    name: { type: 'string' },
    servings: { type: 'number' },
    ingredients: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          amount: { type: 'string' },
        },
        required: ['name'],
      },
    },
    steps: { type: 'array', items: { type: 'string' } },
    totalCalories: { type: 'number' },
    totalProtein: { type: 'number' },
    totalCarbs: { type: 'number' },
    totalFat: { type: 'number' },
    caloriesPerServing: { type: 'number' },
    proteinPerServing: { type: 'number' },
    carbsPerServing: { type: 'number' },
    fatPerServing: { type: 'number' },
  },
  required: [
    'found',
    'name',
    'servings',
    'ingredients',
    'steps',
    'totalCalories',
    'totalProtein',
    'totalCarbs',
    'totalFat',
    'caloriesPerServing',
    'proteinPerServing',
    'carbsPerServing',
    'fatPerServing',
  ],
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// ── schema.org Recipe (JSON-LD) extraction ──────────────────────────────────
// Most recipe sites embed <script type="application/ld+json"> with a Recipe
// object (for Google's recipe rich snippets) carrying clean, pre-separated
// recipeIngredient / recipeInstructions arrays. Extracting this directly is
// far more reliable than asking an LLM to reconstruct steps from messy
// scraped prose, and is why quality otherwise varies a lot by site.

interface JsonLdRecipe {
  name?: string;
  recipeIngredient?: unknown;
  recipeInstructions?: unknown;
  recipeYield?: unknown;
}

// A Recipe node may be the top-level object, inside an @graph array, or
// @type may itself be an array (e.g. ["Recipe", "NewsArticle"]).
function findRecipeNode(node: unknown, depth = 0): JsonLdRecipe | null {
  if (!node || typeof node !== 'object' || depth > 4) return null;
  const obj = node as Record<string, unknown>;
  const type = obj['@type'];
  const isRecipe = type === 'Recipe' || (Array.isArray(type) && type.includes('Recipe'));
  if (isRecipe) return obj as JsonLdRecipe;
  if (Array.isArray(obj['@graph'])) {
    for (const child of obj['@graph'] as unknown[]) {
      const found = findRecipeNode(child, depth + 1);
      if (found) return found;
    }
  }
  return null;
}

function extractJsonLdRecipe(html: string): JsonLdRecipe | null {
  const scripts = html.matchAll(
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  );
  for (const m of scripts) {
    let data: unknown;
    try {
      data = JSON.parse(m[1].trim());
    } catch {
      continue; // some pages emit malformed/partial JSON-LD — skip and keep looking
    }
    const candidates = Array.isArray(data) ? data : [data];
    for (const item of candidates) {
      const found = findRecipeNode(item);
      if (found) return found;
    }
  }
  return null;
}

// recipeInstructions varies by site: a plain string, an array of strings, an
// array of HowToStep objects ({text}), or HowToSection objects that nest
// their own itemListElement of HowToSteps. Flatten all of these to strings.
function normalizeInstructions(raw: unknown): string[] {
  if (!raw) return [];
  if (typeof raw === 'string') {
    return raw.split(/\n+/).map((s) => s.trim()).filter(Boolean);
  }
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item === 'string') {
      out.push(item);
      continue;
    }
    if (item && typeof item === 'object') {
      const obj = item as Record<string, unknown>;
      if (obj['@type'] === 'HowToSection' && Array.isArray(obj.itemListElement)) {
        out.push(...normalizeInstructions(obj.itemListElement));
        continue;
      }
      const text = obj.text ?? obj.name;
      if (typeof text === 'string') out.push(text);
    }
  }
  return out.map((s) => s.trim()).filter(Boolean);
}

// recipeYield is commonly a number, a numeric string, a string like "6 servings",
// or an array of these. Pull the first integer found.
function normalizeYield(raw: unknown): number | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value === 'number' && value > 0) return Math.round(value);
  if (typeof value === 'string') {
    const m = value.match(/\d+/);
    if (m) return parseInt(m[0], 10);
  }
  return null;
}

function normalizeIngredients(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((s) => String(s).trim()).filter(Boolean);
}

// Build a clean, pre-labeled block from a page's own Recipe schema data, so
// Gemini is transcribing/splitting rather than reconstructing from scratch.
function structuredContentFrom(recipe: JsonLdRecipe): string | null {
  const ingredients = normalizeIngredients(recipe.recipeIngredient);
  const steps = normalizeInstructions(recipe.recipeInstructions);
  if (ingredients.length === 0 && steps.length === 0) return null;

  const yieldNum = normalizeYield(recipe.recipeYield);
  const parts: string[] = [];
  if (recipe.name) parts.push(`RECIPE NAME: ${recipe.name}`);
  if (yieldNum) parts.push(`SERVINGS: ${yieldNum}`);
  if (ingredients.length) {
    parts.push(`INGREDIENTS:\n${ingredients.map((i) => `- ${i}`).join('\n')}`);
  }
  if (steps.length) {
    parts.push(`INSTRUCTIONS:\n${steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}`);
  }
  return parts.join('\n\n');
}

// Strip a webpage down to plain-ish text so it fits comfortably in the prompt:
// drop script/style blocks, tags, and collapse whitespace. Not a real HTML
// parser — good enough for a recipe-extraction prompt where structure doesn't
// matter, only the visible words do. Used only when the page has no usable
// Recipe JSON-LD to work from.
function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

const MAX_CONTENT_CHARS = 60000;

async function fetchUrlContent(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        // A browser-like UA avoids basic bot-blocking on some recipe sites.
        'User-Agent':
          'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      },
    });
    if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
    const html = await res.text();

    const recipe = extractJsonLdRecipe(html);
    const structured = recipe && structuredContentFrom(recipe);
    if (structured) return structured.slice(0, MAX_CONTENT_CHARS);

    return htmlToText(html).slice(0, MAX_CONTENT_CHARS);
  } finally {
    clearTimeout(timeout);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    if (!GEMINI_API_KEY) return json({ error: 'GEMINI_API_KEY not configured' }, 500);

    const { url, text } = await req.json();
    const hasUrl = typeof url === 'string' && url.trim();
    const hasText = typeof text === 'string' && text.trim();
    if (!hasUrl && !hasText) return json({ error: 'Provide a url or text' }, 400);

    let content: string;
    if (hasUrl) {
      try {
        content = await fetchUrlContent(url.trim());
      } catch (e) {
        return json(
          {
            error:
              `Could not load that link (${String((e as Error)?.message ?? e)}). ` +
              'Some sites (including Instagram) block automatic fetching — try pasting the ' +
              'recipe text or caption instead.',
          },
          502,
        );
      }
      if (!content) {
        return json(
          { error: 'That page had no readable content — try pasting the recipe text instead.' },
          502,
        );
      }
    } else {
      content = String(text).trim().slice(0, 20000);
    }

    const body = JSON.stringify({
      contents: [{ parts: [{ text: `${PROMPT}\n\nContent:\n${content}` }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema,
        // Extraction + arithmetic, not creative writing — minimize sampling
        // randomness so the same page gives consistent results.
        temperature: 0,
      },
    });

    // gemini-2.5-flash can return 503 (high demand) on the free tier, so retry
    // a couple of times with a short backoff before giving up.
    let geminiRes: Response | undefined;
    for (let attempt = 0; attempt < 3; attempt++) {
      geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': GEMINI_API_KEY,
          },
          body,
        },
      );
      if (geminiRes.status !== 503 && geminiRes.status !== 429) break;
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
    }

    if (!geminiRes || !geminiRes.ok) {
      const msg = geminiRes ? await geminiRes.text() : 'no response';
      return json({ error: `Gemini ${geminiRes?.status ?? 0}: ${msg}` }, 502);
    }

    const data = await geminiRes.json();
    const responseText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!responseText) return json({ error: 'No analysis returned' }, 502);

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(responseText);
    } catch {
      return json({ error: 'Could not parse analysis' }, 502);
    }

    if (!parsed.found) {
      return json(
        { error: "Couldn't find a recipe in that — check the link, or paste the recipe text directly." },
        422,
      );
    }

    return json(parsed);
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
