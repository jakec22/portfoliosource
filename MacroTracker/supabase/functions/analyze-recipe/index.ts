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
// Website recipe URLs are fetched directly and generally work well.

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
const GEMINI_MODEL = 'gemini-2.5-flash';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PROMPT = `You are a recipe extraction assistant. You are given the text content of a
web page, or a caption/description a user pasted (e.g. from a social media post). Determine
whether it actually describes a cooking recipe (has ingredients and/or steps).

If it does, extract:
- name: a short recipe title.
- servings: how many servings/portions it makes (a whole number). If not stated, give a
  reasonable estimate for a typical batch of this dish; never 0.
- ingredients: each ingredient as it's used, with "name" (the ingredient itself, e.g.
  "all-purpose flour") and "amount" (the quantity as written, e.g. "2 cups") when available.
- steps: the cooking steps as an ordered list of short, clear instructions (split run-on
  instructions into separate steps).
- Then estimate the TOTAL nutrition for the whole recipe divided evenly across "servings" —
  i.e. per-serving calories (kcal), protein (g), carbs (g), and fat (g). Base this on the
  ingredients and their amounts; be realistic, and when an amount is vague, use a typical
  serving-sized assumption.

If the content does NOT describe a recipe (e.g. it's an unrelated article, an ad, or a caption
with no real ingredients/steps), set "found" to false and leave the other fields as your best
empty-ish guess (servings: 1, empty arrays, 0 macros) — do not invent a recipe.

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
    calories: { type: 'number' },
    protein: { type: 'number' },
    carbs: { type: 'number' },
    fat: { type: 'number' },
  },
  required: ['found', 'name', 'servings', 'ingredients', 'steps', 'calories', 'protein', 'carbs', 'fat'],
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Strip a webpage down to plain-ish text so it fits comfortably in the prompt:
// drop script/style blocks, tags, and collapse whitespace. Not a real HTML
// parser — good enough for a recipe-extraction prompt where structure doesn't
// matter, only the visible words do.
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

async function fetchUrlText(url: string): Promise<string> {
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
        content = await fetchUrlText(url.trim());
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
        temperature: 0.2,
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
