import type { Metadata } from "next";
import { ContentShell, CtaLink } from "@/components/layout/ContentShell";
import { Arrow } from "@/components/ui/Arrow";

export const metadata: Metadata = {
  title: "How it works — SealedSkin",
  description:
    "How SealedSkin turns a few quick questions about your skin into a personalized AM/PM skincare routine.",
};

const STEPS: { title: string; body: string }[] = [
  {
    title: "Answer a few questions about your skin",
    body: "Seven quick, no-wrong-answer questions about how your skin actually behaves day to day — tightness after cleansing, midday shine, sensitivity, and so on. Takes about a minute.",
  },
  {
    title: "Tell us what you want to improve",
    body: "Pick the concerns you notice — as many or as few as feel true — then star up to three that matter most right now. Those become the centre of your routine.",
  },
  {
    title: "Set your preferences",
    body: "Choose how involved you want the routine to be, where you'd like products sourced from, and whether you're pregnant or nursing so we can keep ingredients safe.",
  },
  {
    title: "Get your routine",
    body: "A clear read on your skin type, the key ingredients worth looking for, and a step-by-step AM/PM routine — plus example product picks you can shop at any budget.",
  },
];

const eyebrow = "font-mono text-[11.5px] tracking-[0.13em] uppercase text-ss-accent-ink mb-3";

export default function HowItWorksPage() {
  return (
    <ContentShell>
      <div className={eyebrow}>How it works</div>
      <h1 className="font-head font-semibold text-[32px] leading-[1.1] tracking-[-0.025em] text-ss-ink mb-[14px] max-w-[460px] [text-wrap:balance]">
        From a few questions to a routine that fits
      </h1>
      <p className="text-[16.5px] leading-[1.55] text-ss-ink-soft max-w-[540px] mb-9 [text-wrap:pretty]">
        SealedSkin is a guided quiz, not a quiz that sells you the most products. You answer a
        few honest questions; we analyze your skin and build a routine around what it actually
        needs.
      </p>

      <ol className="grid gap-3 list-none p-0 m-0">
        {STEPS.map((s, i) => (
          <li
            key={s.title}
            className="bg-ss-panel border border-ss-hairline rounded-2xl p-5 flex gap-4 items-start"
          >
            <span className="shrink-0 w-9 h-9 rounded-full bg-ss-accent-tint text-ss-accent-ink font-head font-semibold text-[16px] inline-flex items-center justify-center">
              {i + 1}
            </span>
            <div>
              <h2 className="font-head font-semibold text-[18.5px] leading-[1.25] tracking-[-0.015em] text-ss-ink m-0 mb-[6px]">
                {s.title}
              </h2>
              <p className="text-[15px] leading-[1.55] text-ss-ink-soft m-0 [text-wrap:pretty]">{s.body}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-9 bg-ss-accent-tint/60 border border-ss-hairline rounded-2xl p-5">
        <h2 className="font-head font-semibold text-[16px] text-ss-ink m-0 mb-2">What&rsquo;s behind the suggestions</h2>
        <ul className="m-0 pl-5 grid gap-[7px] text-[14.5px] leading-[1.5] text-ss-ink-soft [text-wrap:pretty]">
          <li>Sunscreen and a hydrator are always part of the routine — the two steps that help almost everyone.</li>
          <li>If you tell us you&rsquo;re pregnant or nursing, ingredients flagged to avoid are filtered out automatically.</li>
          <li>Recommendations are evidence-informed and AI-assisted, and the underlying model can be swapped over time.</li>
          <li>This is a heuristic guide, not medical advice. For a diagnosed condition, see a dermatologist.</li>
        </ul>
      </div>

      <div className="mt-10">
        <CtaLink href="/">Take the quiz <Arrow /></CtaLink>
      </div>
    </ContentShell>
  );
}
