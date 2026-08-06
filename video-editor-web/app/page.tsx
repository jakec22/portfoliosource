"use client";

import { useState } from "react";
import { ClipUploader } from "@/components/ClipUploader";
import { GuidelinesForm } from "@/components/GuidelinesForm";
import { PlanOptions } from "@/components/PlanOptions";
import { RenderPanel } from "@/components/RenderPanel";
import { extractClipAsset } from "@/lib/frames";
import { renderEditPlan } from "@/lib/ffmpegClient";
import type { AnalyzeResponseBody, ClipAsset, EditPlan } from "@/lib/types";

export default function Home() {
  const [clips, setClips] = useState<ClipAsset[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [guidelines, setGuidelines] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [plans, setPlans] = useState<EditPlan[]>([]);
  const [renderingPlanId, setRenderingPlanId] = useState<string | null>(null);
  const [renderProgress, setRenderProgress] = useState<number | null>(null);
  const [outputUrl, setOutputUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFilesSelected(files: FileList) {
    setError(null);
    setIsExtracting(true);
    try {
      const newClips = await Promise.all(
        Array.from(files).map((file, i) => extractClipAsset(file, `clip-${Date.now()}-${i}`)),
      );
      setClips((prev) => [...prev, ...newClips]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to read one or more clips");
    } finally {
      setIsExtracting(false);
    }
  }

  function handleRemoveClip(id: string) {
    setClips((prev) => prev.filter((c) => c.id !== id));
  }

  async function handleGenerateOptions() {
    setError(null);
    setIsAnalyzing(true);
    setPlans([]);
    setOutputUrl(null);
    setRenderProgress(null);
    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guidelines,
          clips: clips.map((c) => ({
            id: c.id,
            fileName: c.fileName,
            durationSec: c.durationSec,
            frames: c.previewFrames,
          })),
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? `Request failed with status ${response.status}`);
      }

      const data: AnalyzeResponseBody = await response.json();
      setPlans(data.plans);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate edit options");
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function handleRenderPlan(plan: EditPlan) {
    setError(null);
    setRenderingPlanId(plan.id);
    setRenderProgress(0);
    setOutputUrl(null);
    try {
      const url = await renderEditPlan(plan, clips, setRenderProgress);
      setOutputUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to render video");
    } finally {
      setRenderingPlanId(null);
    }
  }

  return (
    <main className="mx-auto max-w-4xl space-y-10 px-6 py-10">
      <header>
        <h1 className="text-2xl font-semibold">Clip Combiner</h1>
        <p className="text-sm text-neutral-400">
          Import short clips, describe what you want, and let AI propose a few ways to combine them.
        </p>
      </header>

      {error && (
        <div className="rounded-lg border border-red-900 bg-red-950/40 p-3 text-sm text-red-300">{error}</div>
      )}

      <ClipUploader
        clips={clips}
        isExtracting={isExtracting}
        onFilesSelected={handleFilesSelected}
        onRemoveClip={handleRemoveClip}
      />

      <GuidelinesForm
        guidelines={guidelines}
        onChange={setGuidelines}
        onSubmit={handleGenerateOptions}
        disabled={clips.length === 0}
        isAnalyzing={isAnalyzing}
      />

      <PlanOptions plans={plans} renderingPlanId={renderingPlanId} onRender={handleRenderPlan} />

      <RenderPanel progress={renderProgress} outputUrl={outputUrl} />
    </main>
  );
}
