import type { ClipMeta } from "./types";

export const SYSTEM_PROMPT = `You are an expert short-form video editor. You are given several short video
clips (as a few representative frames per clip, in order) plus the user's
free-text guidelines for the final video. Propose 2-4 distinct candidate
edit plans for combining the clips into one longer video.

Rules:
- Every clip you reference must use the exact clip id provided.
- startSec/endSec must stay within that clip's stated duration.
- Segments within a plan should be ordered as they will appear in the final video.
- Prefer trimming out dead time (long pauses, shaky starts/ends) rather than always using a clip's full length.
- Make the candidate plans meaningfully different from each other (e.g. different ordering, pacing, or which moments are kept), not minor variations.
- Follow the user's guidelines as closely as possible; if a guideline can't be satisfied exactly, get as close as you reasonably can and say so in the rationale.
- Call the propose_edit_plans tool exactly once with your answer. Do not respond in plain text.`;

export function buildUserContentBlocks(guidelines: string, clips: ClipMeta[]) {
  const content: Array<
    | { type: "text"; text: string }
    | { type: "image"; source: { type: "base64"; media_type: "image/jpeg"; data: string } }
  > = [];

  content.push({
    type: "text",
    text: `User guidelines:\n${guidelines || "(none provided — use your best editorial judgement)"}`,
  });

  content.push({
    type: "text",
    text: `Clips (${clips.length} total):`,
  });

  for (const clip of clips) {
    content.push({
      type: "text",
      text: `Clip id: ${clip.id} | file: ${clip.fileName} | duration: ${clip.durationSec.toFixed(2)}s | frames below are evenly spaced samples from this clip in chronological order.`,
    });
    for (const frame of clip.frames) {
      content.push({
        type: "image",
        source: {
          type: "base64",
          media_type: "image/jpeg",
          data: stripDataUrlPrefix(frame),
        },
      });
    }
  }

  return content;
}

function stripDataUrlPrefix(dataUrl: string): string {
  const commaIndex = dataUrl.indexOf(",");
  return commaIndex === -1 ? dataUrl : dataUrl.slice(commaIndex + 1);
}
