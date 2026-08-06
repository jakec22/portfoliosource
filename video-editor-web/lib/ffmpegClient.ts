import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";
import type { ClipAsset, EditPlan } from "./types";

const FFMPEG_CORE_BASE_URL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd";

let ffmpegSingleton: FFmpeg | null = null;

/**
 * Lazily loads ffmpeg.wasm (single-threaded core, no COOP/COEP headers
 * required). Loading happens once per page session.
 */
async function getFFmpeg(onLog?: (message: string) => void): Promise<FFmpeg> {
  if (ffmpegSingleton) return ffmpegSingleton;

  const ffmpeg = new FFmpeg();
  if (onLog) {
    ffmpeg.on("log", ({ message }) => onLog(message));
  }

  await ffmpeg.load({
    coreURL: await toBlobURL(`${FFMPEG_CORE_BASE_URL}/ffmpeg-core.js`, "text/javascript"),
    wasmURL: await toBlobURL(`${FFMPEG_CORE_BASE_URL}/ffmpeg-core.wasm`, "application/wasm"),
  });

  ffmpegSingleton = ffmpeg;
  return ffmpeg;
}

/**
 * Renders a chosen EditPlan into a single MP4 by trimming each referenced
 * segment and concatenating the results. Returns an object URL for preview
 * and download.
 *
 * This mirrors what AVMutableComposition + AVAssetExportSession would do on
 * iOS: the AI never touches the actual video bytes, it only produced the
 * (clipId, startSec, endSec) instructions we execute here.
 */
export async function renderEditPlan(
  plan: EditPlan,
  clips: ClipAsset[],
  onProgress?: (ratio: number) => void,
): Promise<string> {
  const ffmpeg = await getFFmpeg();
  const clipsById = new Map(clips.map((c) => [c.id, c]));

  if (onProgress) {
    ffmpeg.on("progress", ({ progress }) => onProgress(progress));
  }

  const segmentFileNames: string[] = [];

  for (const [i, segment] of plan.segments.entries()) {
    const clip = clipsById.get(segment.clipId);
    if (!clip) {
      throw new Error(`Edit plan referenced unknown clip id "${segment.clipId}"`);
    }

    const inputName = `in_${i}_${sanitize(clip.fileName)}`;
    const outputName = `seg_${i}.mp4`;
    await ffmpeg.writeFile(inputName, await fetchFile(clip.file));

    const duration = Math.max(0, segment.endSec - segment.startSec);
    await ffmpeg.exec([
      "-ss",
      segment.startSec.toString(),
      "-i",
      inputName,
      "-t",
      duration.toString(),
      "-c:v",
      "libx264",
      "-c:a",
      "aac",
      "-y",
      outputName,
    ]);

    segmentFileNames.push(outputName);
  }

  const concatListContents = segmentFileNames.map((name) => `file '${name}'`).join("\n");
  await ffmpeg.writeFile("concat_list.txt", concatListContents);

  const finalOutputName = `${plan.id}_output.mp4`;
  await ffmpeg.exec([
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    "concat_list.txt",
    "-c",
    "copy",
    "-y",
    finalOutputName,
  ]);

  const data = await ffmpeg.readFile(finalOutputName);
  const bytes = data instanceof Uint8Array ? data : new TextEncoder().encode(data);
  const blob = new Blob([new Uint8Array(bytes)], { type: "video/mp4" });
  return URL.createObjectURL(blob);
}

function sanitize(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}
