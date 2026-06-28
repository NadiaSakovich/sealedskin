import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Concern, OptionLevel, Question } from "../../types";
import { Button } from "../ui/Button";
import { Arrow } from "../ui/Arrow";
import { Chips } from "../ui/Chips";

function SummarySection({ label, onEdit, children, first }: { label: string; onEdit?: () => void; children: ReactNode; first?: boolean }) {
  return (
    <div className={`py-4 ${first ? "" : "border-t border-ss-hairline"}`}>
      <div className="flex justify-between items-center mb-[11px]">
        <span className="font-mono text-[11px] tracking-[0.1em] uppercase text-ss-ink-faint">{label}</span>
        {onEdit && (
          <button type="button" onClick={onEdit} className="border-none bg-transparent cursor-pointer font-mono text-[11.5px] text-ss-accent-ink">
            edit
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

/**
 * When the user opened a *saved* routine, the finale becomes a review hub instead
 * of a one-shot "Build my routine". `stage: "landing"` shows the three review
 * buttons; once they choose "edit quiz" it becomes `"editing"` and the CTA turns
 * into rebuild (if answers changed) or show (if not).
 */
export interface ReviewControls {
  stage: "landing" | "editing";
  /** Whether the quiz answers differ from the saved version. */
  changed: boolean;
  onReviewRoutine: () => void;
  onEditQuiz: () => void;
  onBackToProfile: () => void;
  onRebuild: () => void;
  onShow: () => void;
}

interface Props {
  QS: Question[];
  answers: Record<string, string>;
  chosenConcerns: Concern[];
  topConcerns: string[];
  level: OptionLevel | undefined;
  onBuild: () => void;
  onEditSkin: () => void;
  onEditConcerns: () => void;
  onEditRoutine: () => void;
  onBack: () => void;
  /** Present only when reviewing/editing a saved routine. */
  review?: ReviewControls;
}

export function FinaleScreen({
  QS, answers, chosenConcerns, topConcerns, level,
  onBuild, onEditSkin, onEditConcerns, onEditRoutine, onBack, review,
}: Props) {
  const [phase, setPhase] = useState<"idle" | "building">("idle");
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  function build() {
    setPhase("building");
    // The results flow shows its own loading screen while the routine builds.
    onBuild();
  }

  const skinRows = QS.filter((q) => q.id !== "age" && q.id !== "pregnancy")
    .map((q) => ({ topic: q.topic, ans: q.options.find((o) => o.id === answers[q.id]) }))
    .filter((r) => r.ans);

  return (
    <div className="py-1">
      <div className="text-center mb-[26px]">
        <div className="w-[60px] h-[60px] rounded-full bg-ss-accent flex items-center justify-center mx-auto mb-5">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 2.5l2.1 5.1 5.4.5-4.1 3.6 1.2 5.3L12 19.8 7.4 22.5l1.2-5.3-4.1-3.6 5.4-.5z" fill="#f6faf8" />
          </svg>
        </div>
        <div className="font-mono text-[11.5px] tracking-[0.13em] uppercase text-ss-accent-ink mb-3">Profile complete</div>
        <h1 className="font-head font-semibold text-[29px] leading-[1.13] tracking-[-0.025em] text-ss-ink mx-auto mb-[14px] max-w-[430px] [text-wrap:balance]">
          Your skin profile is ready
        </h1>
        <p className="text-[16px] leading-[1.55] text-ss-ink-soft max-w-[410px] mx-auto mb-0 [text-wrap:pretty]">
          {review
            ? "Here’s the profile behind this saved routine. Review the routine, edit your answers, or head back to your profile."
            : "Here’s everything you told us. Review it, tweak anything, then build your routine."}
        </p>
      </div>

      <div className="bg-ss-surface border border-ss-hairline rounded-[18px] px-5 pt-[6px] pb-3 text-left">
        <SummarySection label="Skin type · how it behaves" onEdit={onEditSkin} first>
          <div className="grid gap-[9px]">
            {skinRows.map((r, i) => (
              <div key={i} className="flex gap-[14px] items-baseline">
                <span className="text-[12.5px] text-ss-ink-faint basis-[122px] shrink-0">{r.topic}</span>
                <span className="text-[13.5px] text-ss-ink font-medium flex-1 [text-wrap:pretty]">{r.ans!.label}</span>
              </div>
            ))}
          </div>
        </SummarySection>

        <SummarySection label="Concerns" onEdit={onEditConcerns}>
          {chosenConcerns.length ? (
            <Chips items={chosenConcerns} topIds={topConcerns} />
          ) : (
            <span className="text-[13.5px] text-ss-ink-faint">None selected</span>
          )}
        </SummarySection>

        <SummarySection label="Routine" onEdit={onEditRoutine}>
          {level ? (
            <div className="flex items-baseline gap-[10px]">
              <span className="text-[15px] font-semibold text-ss-ink">{level.label}</span>
              <span className="text-[13px] text-ss-ink-soft">{level.desc}</span>
            </div>
          ) : (
            <span className="text-[13.5px] text-ss-ink-faint">Not set</span>
          )}
        </SummarySection>
      </div>

      {!review && (
        <>
          <div className="mt-6 text-center">
            <Button onClick={build} disabled={phase === "building"} className={`!px-7 !py-[15px] !text-[16.5px] ${phase === "building" ? "!opacity-70 cursor-wait" : ""}`}>
              {phase === "building" ? "Building your routine…" : "Build my routine"}
              {phase !== "building" && <Arrow />}
            </Button>
          </div>
          <div className="flex justify-center mt-[18px]">
            <Button variant="ghost" onClick={onBack}>
              <Arrow back /> Back
            </Button>
          </div>
        </>
      )}

      {review && review.stage === "landing" && (
        <div className="mt-6 flex flex-col items-center gap-[10px]">
          <Button onClick={review.onReviewRoutine} className="!px-7 !py-[15px] !text-[16.5px]">
            Review routine <Arrow />
          </Button>
          <Button variant="ghost" onClick={review.onEditQuiz}>
            <Arrow back /> Review &amp; edit quiz
          </Button>
          <Button variant="ghost" onClick={review.onBackToProfile}>
            Back to profile
          </Button>
        </div>
      )}

      {review && review.stage === "editing" && (
        <>
          <div className="mt-6 text-center">
            <Button
              onClick={review.changed ? review.onRebuild : review.onShow}
              className="!px-7 !py-[15px] !text-[16.5px]"
            >
              {review.changed ? "Rebuild my routine" : "Show my routine"} <Arrow />
            </Button>
            {review.changed && (
              <p className="text-[12.5px] text-ss-ink-faint mt-[10px] [text-wrap:pretty]">
                You changed your answers — rebuild to refresh the routine.
              </p>
            )}
          </div>
          <div className="flex justify-center mt-[18px]">
            <Button variant="ghost" onClick={onBack}>
              <Arrow back /> Back
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
