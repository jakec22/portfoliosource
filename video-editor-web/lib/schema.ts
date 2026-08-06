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
