import type { Concern } from "../../types";
import { PhotoSlot } from "../ui/PhotoSlot";

function Check({ on, white }: { on: boolean; white?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center transition-all duration-150 ${
        on
          ? "border border-ss-accent bg-ss-accent"
          : white
          ? "border-[1.5px] border-ss-hairline-strong bg-white/85 backdrop-blur-[2px]"
          : "border-[1.5px] border-ss-hairline-strong bg-transparent"
      }`}
    >
      {on && (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M2.5 6.2L5 8.5L9.5 3.5" stroke="#f6faf8" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </span>
  );
}

function ConcernCard({ concern, selected, onToggle }: { concern: Concern; selected: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={selected}
      className={`relative text-left cursor-pointer flex flex-col gap-0 p-0 overflow-hidden rounded-2xl font-body text-ss-ink transition-[border-color,background,box-shadow] duration-150 ${
        selected
          ? "border-[1.5px] border-ss-accent bg-ss-accent-tint shadow-[0_8px_22px_-16px_rgba(36,63,57,.6)]"
          : "border-[1.5px] border-ss-hairline bg-ss-surface shadow-[0_1px_2px_rgba(36,63,57,.04)]"
      }`}
    >
      <div className="relative">
        <PhotoSlot label={concern.label} src={`/quiz/concern-${concern.id}.jpg`} ratio="16 / 10" radius={0} />
        <span className="absolute top-[9px] right-[9px]">
          <Check on={selected} white />
        </span>
      </div>
      <div className="px-[13px] pt-3 pb-[14px]">
        <div className="text-[15px] font-semibold tracking-[-0.01em] leading-[1.2] mb-[3px]">{concern.label}</div>
        <div className="text-[12.5px] leading-[1.35] text-ss-ink-soft">{concern.desc}</div>
      </div>
    </button>
  );
}

export function ConcernGrid({ concerns, selected, onToggle }: { concerns: Concern[]; selected: string[]; onToggle: (id: string) => void }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {concerns.map((c) => (
        <ConcernCard key={c.id} concern={c} selected={selected.includes(c.id)} onToggle={() => onToggle(c.id)} />
      ))}
    </div>
  );
}

export function PriorityList({
  concerns,
  value,
  onToggle,
  max = 2,
}: {
  concerns: Concern[];
  value: string[];
  onToggle: (id: string) => void;
  max?: number;
}) {
  const atLimit = value.length >= max;
  return (
    <div className="grid gap-[10px]">
      {concerns.map((c) => {
        const on = value.includes(c.id);
        const dim = !on && atLimit;
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => onToggle(c.id)}
            disabled={dim}
            aria-pressed={on}
            className={`text-left flex items-center gap-[14px] p-3 min-h-[80px] rounded-[14px] font-body text-ss-ink transition-all duration-150 ${
              dim ? "cursor-not-allowed opacity-45" : "cursor-pointer opacity-100"
            } ${
              on
                ? "border-[1.5px] border-ss-accent bg-ss-accent-tint shadow-[0_8px_22px_-16px_rgba(36,63,57,.55)]"
                : "border-[1.5px] border-ss-hairline bg-ss-surface shadow-[0_1px_2px_rgba(36,63,57,.04)]"
            }`}
          >
            <div className="basis-[56px] shrink-0 w-14 h-14 overflow-hidden rounded-[10px]">
              <PhotoSlot label={c.label} src={`/quiz/concern-${c.id}.jpg`} ratio="1 / 1" radius={10} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[15.5px] font-semibold tracking-[-0.01em]">{c.label}</div>
              <div className="text-[12.5px] text-ss-ink-soft whitespace-nowrap overflow-hidden text-ellipsis">{c.desc}</div>
            </div>
            <Check on={on} />
          </button>
        );
      })}
    </div>
  );
}
