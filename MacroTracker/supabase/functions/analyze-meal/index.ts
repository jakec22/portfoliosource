// Analyzes a meal photo with Google Gemini (free tier) and returns estimated
// macros per detected food item. The Gemini API key stays server-side here —
// it is never shipped in the app bundle.
//
// Deploy:   supabase functions deploy analyze-meal
// Secret:   supabase secrets set GEMINI_API_KEY=your-key
// Get a free key at https://aistudio.google.com/apikey

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
// gemini-2.5-flash supports image input and has a free tier. Swap the model
// here if Google changes free-tier availability.
const GEMINI_MODEL = 'gemini-2.5-flash';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PHOTO_PROMPT = `You are a nutrition estimation assistant. Analyze the meal in the photo.
Identify each distinct food item you can see. For each item, estimate the portion
that appears in the photo and its nutrition. Report protein, carbs, and fat in grams
and calories in kcal. Also estimate the weight of the visible portion in grams
(serving_grams) — this is used so the user can re-enter the amount by weight.
Be realistic; when unsure, give your best estimate based on typical servings.
Ignore plates, utensils, and non-caloric drinks like water.
Return only the structured data.`;

const TEXT_PROMPT = `You are a nutrition estimation assistant. The user describes a
meal in words, including foods and (sometimes) amounts. Identify each distinct food
item. For each item, estimate its nutrition. Report protein, carbs, and fat in grams
and calories in kcal. Also estimate the weight of the portion in grams (serving_grams)
— this is used so the user can re-enter the amount by weight. If the user gives an
explicit amount (e.g. "2 eggs", "200g rice", "a cup of milk"), respect it; otherwise
assume a typical serving. Be realistic; when unsure, give your best estimate.
Ignore non-caloric drinks like water. Return only the structured data.`;

// Force Gemini to return parseable, well-shaped JSON.
const responseSchema = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          serving: { type: 'string' },
          serving_grams: { type: 'number' },
          calories: { type: 'number' },
          protein: { type: 'number' },
          carbs: { type: 'number' },
          fat: { type: 'number' },
        },
        required: ['name', 'calories', 'protein', 'carbs', 'fat'],
      },
    },
  },
  required: ['items'],
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    if (!GEMINI_API_KEY) return json({ error: 'GEMINI_API_KEY not configured' }, 500);

    const { image, mimeType, description } = await req.json();
    if (!image && !(typeof description === 'string' && description.trim())) {
      return json({ error: 'Provide an image or a description' }, 400);
    }

    // Text-only path uses the description; photo path sends the image bytes.
    const parts = image
      ? [
          { text: PHOTO_PROMPT },
          { inline_data: { mime_type: mimeType ?? 'image/jpeg', data: image } },
        ]
      : [{ text: `${TEXT_PROMPT}\n\nMeal description:\n${String(description).trim()}` }];

    const body = JSON.stringify({
      contents: [{ parts }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema,
        temperature: 0.2,
      },
    });

    // New-style Gemini keys (AQ. prefix) must be sent in the x-goog-api-key
    // header; the legacy ?key= query parameter only works for old AIza keys.
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
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return json({ error: 'No analysis returned' }, 502);

    let parsed: { items?: unknown };
    try {
      parsed = JSON.parse(text);
    } catch {
      return json({ error: 'Could not parse analysis' }, 502);
    }

    const items = Array.isArray(parsed.items) ? parsed.items : [];
    return json({ items });
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
