import type { ReactNode } from "react";
import { Button } from "../ui/Button";
import { Arrow } from "../ui/Arrow";
import { MiniChip } from "../ui/Chips";

export function ResultsEyebrow({ step, total = 4 }: { step: number; total?: number }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="font-mono text-[11.5px] tracking-[0.13em] uppercase text-ss-accent-ink">Your routine</span>
      <span className="flex gap-[5px]">
        {Array.from({ length: total }).map((_, i) => (
          <span key={i} className={`w-[6px] h-[6px] rounded-full ${i + 1 <= step ? "bg-ss-accent" : "bg-ss-track"}`} />
        ))}
      </span>
      <span className="font-mono text-[11.5px] text-ss-ink-faint">step {step} of {total}</span>
    </div>
  );
}

export const resHeadlineClass =
  "font-head font-semibold text-[28px] leading-[1.12] tracking-[-0.025em] text-ss-ink m-0 mb-[10px] [text-wrap:balance]";
export const resIntroClass = "text-[15.5px] leading-[1.55] text-ss-ink-soft m-0 mb-[22px] [text-wrap:pretty]";

interface Chip { label: string; solid?: boolean }

export function NeedsSummary({
  chips, paragraph, needs, onContinue, onBack,
}: {
  chips: Chip[];
  paragraph: ReactNode;
  needs: string[];
  onContinue: () => void;
  onBack: () => void;
}) {
  return (
    <div className="py-0.5">
      <ResultsEyebrow step={1} />
      <h1 className={resHeadlineClass}>Here&rsquo;s what your skin is asking for</h1>

      <div className="flex flex-wrap gap-[7px] mb-5">
        {chips.map((c, i) => (
          <MiniChip key={i} solid={c.solid}>{c.label}</MiniChip>
        ))}
      </div>

      <p className="text-[16px] leading-[1.6] text-ss-ink m-0 mb-[22px] [text-wrap:pretty]">{paragraph}</p>

      <div className="px-5 py-[18px] rounded-2xl bg-ss-accent-tint border border-ss-accent">
        <div className="font-head font-semibold text-[16px] text-ss-ink tracking-[-0.01em] mb-[13px]">Your skin&rsquo;s priorities</div>
        <ul className="list-none m-0 p-0 grid gap-[10px]">
          {needs.map((n, i) => (
            <li key={i} className="flex gap-[11px] items-start">
              <span aria-hidden="true" className="shrink-0 mt-0.5 w-[18px] h-[18px] rounded-full bg-ss-accent flex items-center justify-center">
                <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                  <path d="M2.5 6.2L5 8.5L9.5 3.5" stroke="#f6faf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <span className="flex-1 min-w-0 block text-[14.5px] leading-[1.45] text-ss-ink">{n}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex items-center justify-between mt-6">
        <Button variant="ghost" onClick={onBack}><Arrow back /> Back</Button>
        <Button onClick={onContinue}>Ingredients to look for <Arrow /></Button>
      </div>
    </div>
  );
}
