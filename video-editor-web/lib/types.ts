/**
 * A clip the user imported, plus what we extracted from it locally
 * (never the raw video) to send to the AI for analysis.
 */
export interface ClipAsset {
  id: string;
  file: File;
  fileName: string;
  durationSec: number;
  /** Data URLs (JPEG) of a handful of representative frames. */
  previewFrames: string[];
}

/** Metadata about a clip, safe to send to the API route (no File object). */
export interface ClipMeta {
  id: string;
  fileName: string;
  durationSec: number;
  frames: string[];
}

export type TransitionType = "cut" | "fade" | "dissolve";

/** One clip segment within a candidate edit plan. */
export interface EditPlanSegment {
  clipId: string;
  startSec: number;
  endSec: number;
  transitionOut: TransitionType;
}

/** A single candidate "edit decision list" the AI proposes. */
export interface EditPlan {
  id: string;
  title: string;
  rationale: string;
  estimatedDurationSec: number;
  segments: EditPlanSegment[];
}

export interface AnalyzeRequestBody {
  guidelines: string;
  clips: ClipMeta[];
}

export interface AnalyzeResponseBody {
  plans: EditPlan[];
}
