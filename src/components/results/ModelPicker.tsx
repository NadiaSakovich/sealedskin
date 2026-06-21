"use client";

// TEMPORARY — a dev-facing switch to compare Gemini models on the results
// screens. Remove this component (and its usages in SkinQuiz) once a single
// model is chosen.

export const AI_MODELS = [
  { id: "gemini-3.1-flash-lite", label: "3.1 Flash-Lite" },
  { id: "gemini-3.5-flash", label: "3.5 Flash" },
];

export const DEFAULT_AI_MODEL = AI_MODELS[0].id;

export function ModelPicker({
  value,
  onChange,
  busy,
}: {
  value: string;
  onChange: (model: string) => void;
  busy: boolean;
}) {
  return (
    <label className="inline-flex items-center gap-2 font-mono text-[11px] text-ss-ink-faint">
      <span className="uppercase tracking-[0.08em]">Engine</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={busy}
        className="bg-ss-surface border border-ss-hairline rounded-[8px] px-2 py-1 text-[12px] text-ss-ink cursor-pointer disabled:cursor-wait disabled:opacity-60"
      >
        {AI_MODELS.map((m) => (
          <option key={m.id} value={m.id}>
            {m.label}
          </option>
        ))}
      </select>
      {busy && <span className="text-ss-accent-ink">rebuilding…</span>}
    </label>
  );
}
