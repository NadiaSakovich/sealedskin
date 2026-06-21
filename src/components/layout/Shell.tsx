import type { ReactNode } from "react";
import { SiteHeader } from "./SiteHeader";
import { ProgressRail } from "../ui/ProgressRail";

interface Props {
  stageIndex: number;
  fraction: number;
  headerRight: string;
  children: ReactNode;
}

const STAGES = ["Skin type", "Concerns", "Preferences"];

export function Shell({ stageIndex, fraction, headerRight, children }: Props) {
  return (
    <div className="w-full min-h-screen flex flex-col">
      <SiteHeader />
      <div className="flex-1 flex justify-center items-start px-5 pt-[34px] pb-14">
        <div className="w-full max-w-[640px]">
          <div className="mb-[26px]">
            <div className="flex justify-end mb-[9px]">
              <span className="font-mono text-[11.5px] tracking-[0.04em] uppercase text-ss-ink-faint whitespace-nowrap">
                {headerRight}
              </span>
            </div>
            <ProgressRail stageIndex={stageIndex} stageCount={3} fraction={fraction} />
            <div className="flex justify-between mt-[9px]">
              {STAGES.map((s, i) => (
                <span
                  key={s}
                  className={`font-mono text-[10.5px] tracking-[0.04em] uppercase ${
                    i === stageIndex ? "text-ss-accent-ink font-semibold" : "text-ss-ink-faint font-normal"
                  }`}
                >
                  {s}
                </span>
              ))}
            </div>
          </div>

          <main className="bg-ss-panel border border-ss-hairline rounded-[22px] px-7 pt-[30px] pb-[26px] shadow-[0_30px_60px_-40px_rgba(58,50,43,.4)] min-h-[380px]">
            {children}
          </main>

          <div className="text-center mt-4 text-[11.5px] text-ss-ink-faint font-mono">
            Your answers stay private · SealedSkin
          </div>
        </div>
      </div>
    </div>
  );
}
