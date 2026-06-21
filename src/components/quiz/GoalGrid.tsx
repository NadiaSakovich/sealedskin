import type { Goal, OptionLevel } from "../../types";

function GoalCard({ goal, selected, onToggle }: { goal: Goal; selected: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={selected}
      className={`relative text-left cursor-pointer flex items-start gap-3 px-[15px] py-4 rounded-[14px] font-body text-ss-ink transition-[border-color,background,box-shadow] duration-150 ${
        selected
          ? "border-[1.5px] border-ss-accent bg-ss-accent-tint shadow-[0_8px_22px_-16px_rgba(36,63,57,.55)]"
          : "border-[1.5px] border-ss-hairline bg-ss-surface shadow-[0_1px_2px_rgba(36,63,57,.04)]"
      }`}
    >
      <span
        aria-hidden="true"
        className={`shrink-0 mt-px w-[22px] h-[22px] rounded-[7px] flex items-center justify-center transition-all duration-150 ${
          selected ? "border border-ss-accent bg-ss-accent" : "border-[1.5px] border-ss-hairline-strong bg-transparent"
        }`}
      >
        {selected && (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2.5 6.2L5 8.5L9.5 3.5" stroke="#f6faf8" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
      <span className="min-w-0 block flex-1">
        <span className="block text-[15px] font-semibold tracking-[-0.01em] leading-[1.25] mb-[2px]">{goal.label}</span>
        <span className="block text-[12.5px] leading-[1.35] text-ss-ink-soft">{goal.desc}</span>
      </span>
    </button>
  );
}

export function GoalGrid({ goals, selected, onToggle }: { goals: Goal[]; selected: string[]; onToggle: (id: string) => void }) {
  return (
    <div className="grid grid-cols-2 gap-[10px]">
      {goals.map((g) => (
        <GoalCard key={g.id} goal={g} selected={selected.includes(g.id)} onToggle={() => onToggle(g.id)} />
      ))}
    </div>
  );
}

export function CommitmentPicker({
  levels,
  value,
  onChange,
}: {
  levels: OptionLevel[];
  value: string | null;
  onChange: (id: string) => void;
}) {
  return (
    <div className="grid gap-[10px]">
      {levels.map((lvl) => {
        const on = value === lvl.id;
        return (
          <button
            key={lvl.id}
            type="button"
            onClick={() => onChange(lvl.id)}
            aria-pressed={on}
            className={`text-left cursor-pointer flex items-center gap-[14px] p-4 rounded-[14px] font-body text-ss-ink transition-all duration-150 ${
              on
                ? "border-[1.5px] border-ss-accent bg-ss-accent-tint shadow-[0_8px_22px_-16px_rgba(36,63,57,.55)]"
                : "border-[1.5px] border-ss-hairline bg-ss-surface shadow-[0_1px_2px_rgba(36,63,57,.04)]"
            }`}
          >
            <span
              aria-hidden="true"
              className={`shrink-0 w-[22px] h-[22px] rounded-full transition-all duration-150 ${
                on ? "border-[6px] border-ss-accent bg-ss-surface" : "border-[1.5px] border-ss-hairline-strong bg-transparent"
              }`}
            />
            <span className="flex-1 min-w-0 block">
              <span className="block text-[16px] font-semibold tracking-[-0.01em]">{lvl.label}</span>
              <span className="block text-[13px] text-ss-ink-soft">{lvl.desc}</span>
            </span>
            <span
              className={`shrink-0 font-mono text-[10.5px] tracking-[0.04em] uppercase px-[9px] py-[5px] rounded-full whitespace-nowrap border ${
                on ? "text-ss-accent-ink bg-ss-surface border-ss-hairline" : "text-ss-ink-faint bg-transparent border-transparent"
              }`}
            >
              {lvl.meta}
            </span>
          </button>
        );
      })}
    </div>
  );
}
