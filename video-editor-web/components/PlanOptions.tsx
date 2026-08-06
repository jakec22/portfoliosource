"use client";

import type { EditPlan } from "@/lib/types";

interface Props {
  plans: EditPlan[];
  renderingPlanId: string | null;
  onRender: (plan: EditPlan) => void;
}

export function PlanOptions({ plans, renderingPlanId, onRender }: Props) {
  if (plans.length === 0) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-medium uppercase tracking-wide text-neutral-400">3. Choose an option</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {plans.map((plan) => (
          <div key={plan.id} className="space-y-2 rounded-lg border border-neutral-800 p-4">
            <div className="flex items-baseline justify-between">
              <h3 className="font-medium text-neutral-100">{plan.title}</h3>
              <span className="text-xs text-neutral-500">~{Math.round(plan.estimatedDurationSec)}s</span>
            </div>
            <p className="text-sm text-neutral-400">{plan.rationale}</p>
            <ol className="space-y-1 text-xs text-neutral-500">
              {plan.segments.map((segment, i) => (
                <li key={i}>
                  {i + 1}. clip {segment.clipId}: {segment.startSec.toFixed(1)}s–{segment.endSec.toFixed(1)}s
                  {" → "}
                  {segment.transitionOut}
                </li>
              ))}
            </ol>
            <button
              type="button"
              onClick={() => onRender(plan)}
              disabled={renderingPlanId !== null}
              className="w-full rounded-lg border border-neutral-700 px-3 py-1.5 text-sm hover:border-neutral-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {renderingPlanId === plan.id ? "Rendering…" : "Render this option"}
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
