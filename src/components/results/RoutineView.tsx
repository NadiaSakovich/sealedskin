import type { Routine, RoutineStep } from "../../types";
import { Button } from "../ui/Button";
import { Arrow } from "../ui/Arrow";
import { ResultsEyebrow, resHeadlineClass, resIntroClass } from "./NeedsSummary";

function RoutineBlock({ title, tag, steps }: { title: string; tag: string; steps: RoutineStep[] }) {
  return (
    <div>
      <div className="flex items-center gap-[10px] mb-[14px]">
        <span className="font-head font-semibold text-[19px] text-ss-ink tracking-[-0.015em]">{title}</span>
        <span className="font-mono text-[11px] tracking-[0.08em] uppercase text-ss-on-accent bg-ss-accent px-[9px] py-[3px] rounded-full">{tag}</span>
      </div>
      <ol className="list-none m-0 p-0 grid gap-[9px]">
        {steps.map((s, i) => (
          <li key={i} className="flex gap-[13px] items-start px-[15px] py-[13px] rounded-[13px] bg-ss-surface border border-ss-hairline">
            <span
              aria-hidden="true"
              className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center font-mono text-[12px] font-semibold bg-ss-accent-tint text-ss-accent-ink"
            >
              {i + 1}
            </span>
            <span className="flex-1 min-w-0 block">
              <span className="block text-[15px] font-semibold text-ss-ink tracking-[-0.01em]">
                {s.type}
                {s.active && <span className="font-medium text-ss-accent-ink"> · {s.active}</span>}
              </span>
              <span className="block text-[13px] leading-[1.4] text-ss-ink-soft mt-px">{s.note}</span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function RoutineView({ routine, onContinue, onBack }: { routine: Routine; onContinue: () => void; onBack: () => void }) {
  return (
    <div className="py-0.5">
      <ResultsEyebrow step={3} />
      <h1 className={resHeadlineClass}>Your everyday routine</h1>
      <p className={resIntroClass}>
        Apply each step in order, from top to bottom — lightest textures first, richest last. This is a template by
        product type and active, not specific brands.
      </p>

      <div className="grid gap-7">
        <RoutineBlock title="Morning" tag="AM" steps={routine.am} />
        <RoutineBlock title="Evening" tag="PM" steps={routine.pm} />
      </div>

      {routine.notes.length > 0 && (
        <div className="mt-6 px-[18px] py-4 rounded-[14px] bg-ss-accent-tint border border-ss-accent">
          <div className="font-mono text-[10.5px] tracking-[0.08em] uppercase text-ss-accent-ink mb-[10px]">Good to know</div>
          <ul className="list-none m-0 p-0 grid gap-2">
            {routine.notes.map((n, i) => (
              <li key={i} className="flex gap-[9px] items-start">
                <span className="shrink-0 mt-2 w-1 h-1 rounded-full bg-ss-accent" />
                <span className="flex-1 block text-[13.5px] leading-[1.45] text-ss-ink">{n}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex items-center justify-between mt-6">
        <Button variant="ghost" onClick={onBack}><Arrow back /> Back</Button>
        <Button onClick={onContinue}>Shop these products <Arrow /></Button>
      </div>
    </div>
  );
}
