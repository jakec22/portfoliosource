"use client";

interface Props {
  progress: number | null;
  outputUrl: string | null;
}

export function RenderPanel({ progress, outputUrl }: Props) {
  if (progress === null && !outputUrl) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-medium uppercase tracking-wide text-neutral-400">4. Result</h2>

      {progress !== null && !outputUrl && (
        <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-800">
          <div
            className="h-full bg-white transition-all"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
      )}

      {outputUrl && (
        <div className="space-y-3">
          <video src={outputUrl} controls className="w-full max-w-xl rounded-lg border border-neutral-800" />
          <a
            href={outputUrl}
            download="combined-video.mp4"
            className="inline-block rounded-lg border border-neutral-700 px-3 py-1.5 text-sm hover:border-neutral-500"
          >
            Download MP4
          </a>
        </div>
      )}
    </section>
  );
}
