import { z } from "zod";

/**
 * Zod schema the AI's structured output is validated against before we
 * trust it. If this fails, we treat it as a bad response rather than
 * passing malformed data on to the renderer.
 */
export const editPlanSegmentSchema = z.object({
  clipId: z.string(),
  startSec: z.number().min(0),
  endSec: z.number().min(0),
  transitionOut: z.enum(["cut", "fade", "dissolve"]),
});

export const editPlanSchema = z.object({
  id: z.string(),
  title: z.string(),
  rationale: z.string(),
  estimatedDurationSec: z.number().min(0),
  segments: z.array(editPlanSegmentSchema).min(1),
});

export const editPlansSchema = z.object({
  plans: z.array(editPlanSchema).min(1).max(4),
});

/**
 * Claude's tool-use output occasionally double-encodes: instead of
 * { plans: [...] } it returns { plans: "{\"plans\":[...]}" } (the array
 * serialized as a JSON string, sometimes still wrapped in the same key).
 * Try the direct shape first, then unwrap a stringified `plans` field
 * before giving up, so a formatting slip doesn't discard an otherwise
 * valid response.
 */
export function parseEditPlansResponse(rawInput: unknown) {
  const direct = editPlansSchema.safeParse(rawInput);
  if (direct.success) return direct;

  if (
    rawInput &&
    typeof rawInput === "object" &&
    "plans" in rawInput &&
    typeof (rawInput as { plans: unknown }).plans === "string"
  ) {
    try {
      const unwrapped = JSON.parse((rawInput as { plans: string }).plans);
      const candidate = Array.isArray(unwrapped) ? { plans: unwrapped } : unwrapped;
      const retry = editPlansSchema.safeParse(candidate);
      if (retry.success) return retry;
    } catch {
      // fall through to returning the original failure below
    }
  }

  return direct;
}

/**
 * The same shape, expressed as JSON Schema, so we can hand it to Claude as
 * a tool definition and force structured (rather than free-text) output.
 */
export const editPlansToolInputSchema = {
  type: "object" as const,
  properties: {
    plans: {
      type: "array",
      minItems: 1,
      maxItems: 4,
      items: {
        type: "object",
        properties: {
          id: { type: "string", description: "Short unique slug, e.g. 'fast-cuts'." },
          title: { type: "string", description: "Short human-readable name for this option." },
          rationale: {
            type: "string",
            description: "1-2 sentences on the editorial choice made and how it follows the user's guidelines.",
          },
          estimatedDurationSec: { type: "number" },
          segments: {
            type: "array",
            minItems: 1,
            items: {
              type: "object",
              properties: {
                clipId: { type: "string", description: "Must match one of the provided clip ids." },
                startSec: { type: "number", minimum: 0 },
                endSec: { type: "number", minimum: 0 },
                transitionOut: {
                  type: "string",
                  enum: ["cut", "fade", "dissolve"],
                  description: "Transition to use going into the next segment.",
                },
              },
              required: ["clipId", "startSec", "endSec", "transitionOut"],
            },
          },
        },
        required: ["id", "title", "rationale", "estimatedDurationSec", "segments"],
      },
    },
  },
  required: ["plans"],
};
