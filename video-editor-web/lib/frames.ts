import type { ClipAsset } from "./types";

const FRAMES_PER_CLIP = 4;

/**
 * Loads a video file into an offscreen <video> element, seeks to a handful
 * of evenly-spaced timestamps, and grabs each frame via canvas. This is the
 * browser equivalent of AVAssetImageGenerator: it lets us send a few small
 * JPEGs to the AI instead of the raw video.
 */
export async function extractClipAsset(file: File, id: string): Promise<ClipAsset> {
  const video = document.createElement("video");
  video.preload = "metadata";
  video.muted = true;
  video.src = URL.createObjectURL(file);

  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = () => reject(new Error(`Could not read video metadata for ${file.name}`));
  });

  const durationSec = video.duration;
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");

  const previewFrames: string[] = [];
  for (let i = 0; i < FRAMES_PER_CLIP; i++) {
    const t = (durationSec * (i + 0.5)) / FRAMES_PER_CLIP;
    await seekTo(video, t);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    previewFrames.push(canvas.toDataURL("image/jpeg", 0.6));
  }

  URL.revokeObjectURL(video.src);

  return {
    id,
    file,
    fileName: file.name,
    durationSec,
    previewFrames,
  };
}

function seekTo(video: HTMLVideoElement, timeSec: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const onSeeked = () => {
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("error", onError);
      resolve();
    };
    const onError = () => {
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("error", onError);
      reject(new Error("Failed to seek video"));
    };
    video.addEventListener("seeked", onSeeked);
    video.addEventListener("error", onError);
    video.currentTime = timeSec;
  });
}
