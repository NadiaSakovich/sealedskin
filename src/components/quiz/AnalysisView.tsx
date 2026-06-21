import type { Analysis, Meter } from "../../types";
import { Button } from "../ui/Button";
import { Arrow } from "../ui/Arrow";

function DotMeter({ label, level, value }: Omit<Meter, "key">) {
  return (
    <div className="flex-1 min-w-0">
      <div className="font-mono text-[10px] tracking-[0.06em] uppercase text-ss-ink-faint mb-[7px]">{label}</div>
      <div className="flex gap-1 mb-[6px]">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={`flex-1 h-[5px] rounded-full ${i <= level ? "bg-ss-accent" : "bg-ss-track"}`} />
        ))}
      </div>
      <div className="text-[13px] font-semibold text-ss-ink tracking-[-0.01em]">{value}</div>
    </div>
  );
}

interface Props {
  result: Analysis;
  onContinue: () => void;
  onBack: () => void;
  onEditSkin: () => void;
}

export function AnalysisView({ result, onContinue, onBack, onEditSkin }: Props) {
  return (
    <div className="py-0.5">
      <div className="mb-[22px]">
        <div className="flex justify-between items-center mb-3">
          <span className="font-mono text-[11.5px] tracking-[0.13em] uppercase text-ss-accent-ink">
            Your skin analysis · stages 1–2
          </span>
          <button type="button" onClick={onEditSkin} className="border-none bg-transparent cursor-pointer font-mono text-[11.5px] text-ss-accent-ink">
            edit answers
          </button>
        </div>
        <h1 className="font-head font-semibold text-[30px] leading-[1.1] tracking-[-0.025em] text-ss-ink m-0 mb-2 [text-wrap:balance]">
          {result.headline}
        </h1>
        <p className="text-[15px] leading-[1.5] text-ss-ink-soft m-0 [text-wrap:pretty]">{result.subhead}</p>
      </div>

      <div className="flex gap-[18px] px-5 py-[18px] rounded-2xl bg-ss-surface border border-ss-hairline mb-6">
        {result.meters.map(({ key, ...rest }) => (
          <DotMeter key={key} {...rest} />
        ))}
      </div>

      <div className="grid gap-[15px]">
        {result.paragraphs.map((p, i) => (
          <p key={i} className={`text-[15.5px] leading-[1.62] m-0 [text-wrap:pretty] ${i === 0 ? "text-ss-ink" : "text-ss-ink-soft"}`}>
            {p}
          </p>
        ))}
      </div>

      <p className="text-[14.5px] leading-[1.55] text-ss-ink-soft mt-6 mb-0 [text-wrap:pretty]">
        Next, you&rsquo;ll set a few preferences — how involved you want your routine to be and what suits you — and we&rsquo;ll turn
        this whole picture into a routine built for your skin.
      </p>

      <div className="flex items-center justify-between mt-6">
        <Button variant="ghost" onClick={onBack}>
          <Arrow back /> Back
        </Button>
        <Button onClick={onContinue}>
          Continue to Preferences <Arrow />
        </Button>
      </div>
    </div>
  );
}
