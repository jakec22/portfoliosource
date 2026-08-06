"use client";

interface Props {
  guidelines: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled: boolean;
  isAnalyzing: boolean;
}

export function GuidelinesForm({ guidelines, onChange, onSubmit, disabled, isAnalyzing }: Props) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-medium uppercase tracking-wide text-neutral-400">2. Describe what you want</h2>
      <textarea
        value={guidelines}
        onChange={(e) => onChange(e.target.value)}
        placeholder="e.g. Keep it upbeat, under 45 seconds, lead with the beach clip, cut out the parts where I'm fumbling with the camera."
        rows={4}
        className="w-full rounded-lg border border-neutral-800 bg-neutral-900 p-3 text-sm placeholder:text-neutral-600 focus:border-neutral-500 focus:outline-none"
      />
      <button
        type="button"
        onClick={onSubmit}
        disabled={disabled || isAnalyzing}
        className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-neutral-950 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {isAnalyzing ? "Asking AI for options…" : "Generate edit options"}
      </button>
    </section>
  );
}
