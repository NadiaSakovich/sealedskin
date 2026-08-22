import type { Metadata } from "next";
import { ContentShell, CtaLink } from "@/components/layout/ContentShell";
import { Arrow } from "@/components/ui/Arrow";
import { PageBanner } from "@/components/ui/PageBanner";

export const metadata: Metadata = {
  title: "How it works - SealedSkin",
  description:
    "How SealedSkin turns seven questions about your skin into a personalised morning and evening skincare routine.",
};

const STEPS: { title: string; body: string }[] = [
  {
    title: "Answer seven questions about your skin",
    body: "Six of them are about how your skin behaves on a normal day. Tightness after cleansing, shine by lunchtime, how easily it reacts. The seventh is your age range. No wrong answers, and it takes about a minute.",
  },
  {
    title: "Tell us what you want to improve",
    body: "Pick whatever you notice, as many or as few as you like. Then star up to three. Those three are what the routine gets built around.",
  },
  {
    title: "Set your preferences",
    body: "How many steps you're willing to do, and where you'd like the brands to come from. There's a question about pregnancy and nursing too, so we can leave out the ingredients to avoid.",
  },
  {
    title: "Get your routine",
    body: "Your skin type, the ingredients worth looking for on a label, and a morning and evening routine in order. Every step comes with three products at different prices.",
  },
];

const eyebrow = "font-mono text-[11.5px] tracking-[0.13em] uppercase text-ss-accent-ink mb-3";

export default function HowItWorksPage() {
  return (
    <ContentShell>
      <div className={eyebrow}>How it works</div>
      <h1 className="font-head font-semibold text-[32px] leading-[1.1] tracking-[-0.025em] text-ss-ink mb-[14px] max-w-[460px] [text-wrap:balance]">
        Seven questions, one routine
      </h1>
      <p className="text-[16.5px] leading-[1.55] text-ss-ink-soft max-w-[540px] mb-9 [text-wrap:pretty]">
        About a minute of questions, and a routine at the end. Here&rsquo;s what happens in between.
      </p>

      <div className="mb-9">
        <PageBanner
          src="/pages/how-it-works.jpg"
          alt="A woman smiling at her reflection in a bright, minimal bathroom"
        />
      </div>

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
          <li>Sunscreen and a hydrator are always in there. Those two help almost everyone.</li>
          <li>If you tell us you&rsquo;re pregnant or nursing, the ingredients usually avoided then are filtered out automatically.</li>
          <li>An AI writes the recommendations, and looks up current products and prices while it does.</li>
          <li>This is general guidance. For a diagnosed condition, see a dermatologist.</li>
        </ul>
      </div>

      <div className="mt-10">
        <CtaLink href="/">Take the quiz <Arrow /></CtaLink>
      </div>
    </ContentShell>
  );
}
