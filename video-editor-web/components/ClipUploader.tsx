"use client";

import type { ClipAsset } from "@/lib/types";

interface Props {
  clips: ClipAsset[];
  isExtracting: boolean;
  onFilesSelected: (files: FileList) => void;
  onRemoveClip: (id: string) => void;
}

export function ClipUploader({ clips, isExtracting, onFilesSelected, onRemoveClip }: Props) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-medium uppercase tracking-wide text-neutral-400">1. Import clips</h2>

      <label className="flex cursor-pointer items-center justify-center rounded-lg border border-dashed border-neutral-700 p-6 text-sm text-neutral-400 hover:border-neutral-500">
        <span>{isExtracting ? "Reading clips…" : "Click to choose video files, or drag them here"}</span>
        <input
          type="file"
          accept="video/*"
          multiple
          className="hidden"
          disabled={isExtracting}
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              onFilesSelected(e.target.files);
              e.target.value = "";
            }
          }}
        />
      </label>

      {clips.length > 0 && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {clips.map((clip) => (
            <li key={clip.id} className="relative overflow-hidden rounded-lg border border-neutral-800">
              {clip.previewFrames[0] && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={clip.previewFrames[0]} alt={clip.fileName} className="aspect-video w-full object-cover" />
              )}
              <div className="p-2 text-xs">
                <p className="truncate text-neutral-200">{clip.fileName}</p>
                <p className="text-neutral-500">{clip.durationSec.toFixed(1)}s</p>
              </div>
              <button
                type="button"
                onClick={() => onRemoveClip(clip.id)}
                className="absolute right-1 top-1 rounded bg-black/70 px-1.5 py-0.5 text-xs text-neutral-200 hover:bg-black"
                aria-label={`Remove ${clip.fileName}`}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
