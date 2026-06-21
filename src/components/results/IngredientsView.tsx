import type { ScoredActive } from "../../types";
import { Button } from "../ui/Button";
import { Arrow } from "../ui/Arrow";
import { ResultsEyebrow, resHeadlineClass, resIntroClass } from "./NeedsSummary";

export function IngredientsView({
  picked, sensitive, onContinue, onBack,
}: {
  picked: ScoredActive[];
  sensitive: boolean;
  onContinue: () => void;
  onBack: () => void;
}) {
  return (
    <div className="py-0.5">
      <ResultsEyebrow step={2} />
      <h1 className={resHeadlineClass}>Ingredients &amp; actives to look for</h1>
      <p className={resIntroClass}>
        These are the hero ingredients matched to your skin. Look for them on labels — you don&rsquo;t need all of them at once,
        and a few well-chosen ones go a long way.
      </p>

      <div className="grid gap-3">
        {picked.map(({ active, reasons }) => {
          const caution = sensitive && !active.gentle;
          return (
            <div key={active.id} className="px-[18px] py-4 rounded-2xl bg-ss-surface border border-ss-hairline">
              <div className="flex items-baseline justify-between gap-3 mb-1">
                <span className="font-head font-semibold text-[17.5px] text-ss-ink tracking-[-0.015em]">{active.name}</span>
                <span className="font-mono text-[11px] text-ss-ink-faint whitespace-nowrap shrink-0">{active.aka}</span>
              </div>
              <div className="font-mono text-[10.5px] tracking-[0.06em] uppercase text-ss-accent-ink mb-[9px]">{active.type}</div>
              <p className="text-[14.5px] leading-[1.5] text-ss-ink m-0 mb-[6px] [text-wrap:pretty]">{active.what}</p>
              <p className="text-[14px] leading-[1.5] text-ss-ink-soft m-0 mb-[11px] [text-wrap:pretty]">
                <span className="font-semibold text-ss-accent-ink">Why it helps you · </span>
                {active.why}
              </p>
              <div className="flex flex-wrap gap-[6px] items-center">
                {(reasons.length ? reasons : ["Everyday protection"]).map((r, i) => (
                  <span key={i} className="text-[11.5px] font-mono text-ss-ink-soft bg-ss-accent-tint px-[9px] py-1 rounded-full">{r}</span>
                ))}
                {caution && (
                  <span className="text-[11.5px] font-mono text-caution-text bg-caution-bg px-[9px] py-1 rounded-full">introduce slowly</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between mt-6">
        <Button variant="ghost" onClick={onBack}><Arrow back /> Back</Button>
        <Button onClick={onContinue}>See my routine <Arrow /></Button>
      </div>
    </div>
  );
}
