// Designs a training program with Google Gemini and returns it as days of
// exercises drawn from a vocabulary the app supplies. The Gemini API key stays
// server-side here — it is never shipped in the app bundle.
//
// Deploy:   supabase functions deploy design-workout
// Secret:   supabase secrets set GEMINI_API_KEY=your-key   (shared with analyze-meal)
//
// ## The allowed list is an argument, not a constant
//
// The client sends `allowed`: the exercises it is willing to receive, already
// filtered by the equipment the user says they have. That list becomes an
// `enum` in the response schema, so the model cannot return anything else —
// not a near-miss, not a plausible invention, not "Dumbbell Incline Chest Fly
// (Neutral Grip)". Every name that comes back is one the app already holds a
// drawing, three cues, an equipment tag and a muscle for.
//
// That is a guarantee rather than an instruction the model may ignore, and it
// is why this is a feature of the app instead of a chat window that writes
// workouts. It also means the catalog can grow without redeploying this
// function: the vocabulary lives where it is maintained.
//
// ## What it does not do
//
// It does not prescribe weights. The model has never seen this person lift.
// Sets and reps come back; the app seeds the load from their own history
// where it has any, and leaves it blank where it does not.

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
const GEMINI_MODEL = 'gemini-2.5-flash';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_ALLOWED = 400; // sanity bound on the vocabulary the client may send
const MAX_DAYS = 6;

const PROMPT = `You are a strength coach writing a training program for someone who
is not sure what to do in the gym. Write the program they should follow.

Rules you must not break:
- Use ONLY exercises from the provided list. You cannot invent, rename or vary one.
- Give sets and reps. Do NOT give weights, loads, percentages or RPE — you have
  never seen this person train and the app fills loads in from their own history.
- For an exercise that is held or timed rather than repped (planks, holds, carries,
  cardio), give "seconds" instead of "reps".
- Order each day sensibly: the heaviest compound movements first, isolation and
  core last.
- Across the week, cover the whole body. Do not give three days that are all chest.
- Respect the session length. Roughly one exercise per 7-9 minutes, including rest.

Program for the goal they picked. This is what the week is for, so it decides
rep ranges and how the days are built:
- "muscle": mostly 6-12 reps, 3-4 sets, compounds led by enough isolation work to
  cover each muscle group across the week.
- "strength": 3-6 reps on the main compound lifts, 4-5 sets, fewer exercises per
  session so there is room to rest between them. Isolation only in support.
- "fatloss": keep the resistance work that protects muscle — 8-15 reps — and
  finish sessions with conditioning. Favor compounds over isolation; the lifting
  is there so they lose fat rather than muscle.
- "fitness": 8-12 reps, balanced across the body, with some conditioning each week.

If a sex is given, use it only to choose sensible starting variations where
average strength differs — a beginner may need an assisted or inclined version
of a pulling or pressing movement. Never use it to assume which muscles someone
wants to train, or to write a different kind of program.

Name each day for what it trains ("Push", "Pull", "Legs", "Full Body A"), not
"Day 1". Name the program for what it is.

The note is 2-3 sentences for a beginner: how to run the week, and how to know
when to add weight. Plain language, no jargon, no medical claims, no promises
about results.`;

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

    const { allowed, days, minutes, experience, goal, sex, age, nutritionGoal, recent } =
      await req.json();

    if (!Array.isArray(allowed) || allowed.length === 0) {
      return json({ error: 'No exercises available' }, 400);
    }
    if (allowed.length > MAX_ALLOWED) {
      return json({ error: 'Too many exercises' }, 400);
    }
    const vocabulary = allowed.map(String);
    const dayCount = Math.max(1, Math.min(MAX_DAYS, Math.round(Number(days) || 3)));
    const sessionMinutes = Math.max(15, Math.min(120, Math.round(Number(minutes) || 45)));

    // Everything below here goes into a prompt, so each field is matched
    // against a known set rather than interpolated as it arrives. The client
    // is our own app, but a body is a body: an unrecognized value becomes
    // absent context instead of a sentence somebody else wrote.
    const pick = <T extends string>(v: unknown, allowedValues: readonly T[]): T | null =>
      allowedValues.includes(v as T) ? (v as T) : null;

    const trainingGoal = pick(goal, ['muscle', 'strength', 'fatloss', 'fitness'] as const);
    const theirSex = pick(sex, ['male', 'female'] as const);
    const theirExperience = pick(experience, ['new', 'returning', 'experienced'] as const);
    const eating = pick(nutritionGoal, ['lose', 'maintain', 'gain'] as const);
    const theirAge = Number(age) >= 13 && Number(age) <= 100 ? Math.round(Number(age)) : null;

    // The enum is what makes the vocabulary binding rather than advisory.
    const responseSchema = {
      type: 'object',
      properties: {
        name: { type: 'string' },
        note: { type: 'string' },
        days: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              exercises: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    name: { type: 'string', enum: vocabulary },
                    sets: { type: 'number' },
                    reps: { type: 'number' },
                    seconds: { type: 'number' },
                  },
                  required: ['name', 'sets'],
                },
              },
            },
            required: ['name', 'exercises'],
          },
        },
      },
      required: ['name', 'note', 'days'],
    };

    // Everything the app already knows, so the program is about this person
    // rather than about nobody. All of it optional — a first-run user has none.
    const context = [
      // First, because it is the one the program is built around.
      `Training goal: ${trainingGoal ?? 'fitness'}`,
      `Days per week: ${dayCount}`,
      `Session length: about ${sessionMinutes} minutes`,
      theirExperience ? `Experience: ${theirExperience}` : null,
      theirSex ? `Sex: ${theirSex}` : null,
      theirAge ? `Age: ${theirAge}` : null,
      // Secondary, and named as what it is. It says how much food there is to
      // recover on, not what the training is for — if the two disagree, the
      // training goal above is the one they chose for this program.
      eating
        ? `They are eating to ${eating} weight, so recovery capacity is ` +
          `${eating === 'lose' ? 'limited' : eating === 'gain' ? 'good' : 'normal'}. ` +
          `This is context, not the goal of the program.`
        : null,
      recent && typeof recent === 'object' && Object.keys(recent).length > 0
        ? `What they have actually trained in the last 30 days, as a share of total ` +
          `volume: ${Object.entries(recent)
            .map(([k, v]) => `${k} ${Math.round(Number(v) * 100)}%`)
            .join(', ')}. Give the neglected areas more room.`
        : `No training history yet — assume a complete beginner.`,
      '',
      `Exercises you may use (exactly these names):`,
      vocabulary.join('\n'),
    ]
      .filter(Boolean)
      .join('\n');

    const body = JSON.stringify({
      contents: [{ parts: [{ text: `${PROMPT}\n\n${context}` }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema,
        // Some variety between runs is wanted here — asking twice should not
        // return the identical program — but not so much that it starts
        // choosing oddly. Higher than the label transcription, which is 0.
        temperature: 0.7,
      },
    });

    // gemini-2.5-flash can return 503 (high demand) or 429 on the free tier,
    // which analyze-meal handles the same way.
    let res: Response | undefined;
    for (let attempt = 0; attempt < 3; attempt++) {
      res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY },
          body,
        },
      );
      if (res.status !== 503 && res.status !== 429) break;
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
    }

    if (!res || !res.ok) {
      const msg = res ? await res.text() : 'no response';
      return json({ error: `Gemini ${res?.status ?? 0}: ${msg}` }, 502);
    }

    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return json({ error: 'No program returned' }, 502);

    let parsed: { name?: unknown; note?: unknown; days?: unknown };
    try {
      parsed = JSON.parse(text);
    } catch {
      return json({ error: 'Could not parse the program' }, 502);
    }

    // Belt and braces: the enum should make this impossible, but a name the
    // app cannot resolve would become an exercise with no demo and no muscle.
    const permitted = new Set(vocabulary);
    const outDays = (Array.isArray(parsed.days) ? parsed.days : [])
      .map((d: any) => ({
        name: String(d?.name ?? 'Workout'),
        exercises: (Array.isArray(d?.exercises) ? d.exercises : [])
          .filter((e: any) => permitted.has(String(e?.name)))
          .map((e: any) => ({
            name: String(e.name),
            sets: Math.max(1, Math.min(10, Math.round(Number(e.sets) || 3))),
            reps: Number(e.reps) > 0 ? Math.max(1, Math.min(100, Math.round(Number(e.reps)))) : undefined,
            seconds:
              Number(e.seconds) > 0 ? Math.max(5, Math.min(3600, Math.round(Number(e.seconds)))) : undefined,
          })),
      }))
      .filter((d: any) => d.exercises.length > 0);

    if (outDays.length === 0) return json({ error: 'The program came back empty' }, 502);

    return json({
      name: String(parsed.name ?? 'Training program'),
      note: String(parsed.note ?? ''),
      days: outDays,
    });
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
