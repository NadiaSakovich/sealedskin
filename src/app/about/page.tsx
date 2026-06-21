import type { Metadata } from "next";
import { ContentShell, CtaLink } from "@/components/layout/ContentShell";
import { Arrow } from "@/components/ui/Arrow";

export const metadata: Metadata = {
  title: "About — SealedSkin",
  description:
    "What SealedSkin is, what we believe about skincare, and how we build a routine that's honest, personal, and private.",
};

const eyebrow = "font-mono text-[11.5px] tracking-[0.13em] uppercase text-ss-accent-ink mb-3";
const sectionH = "font-head font-semibold text-[20px] leading-[1.2] tracking-[-0.02em] text-ss-ink mt-9 mb-3";
const para = "text-[15.5px] leading-[1.6] text-ss-ink-soft [text-wrap:pretty]";

export default function AboutPage() {
  return (
    <ContentShell>
      <div className={eyebrow}>About</div>
      <h1 className="font-head font-semibold text-[32px] leading-[1.1] tracking-[-0.025em] text-ss-ink mb-[14px] max-w-[480px] [text-wrap:balance]">
        Skincare advice without the noise
      </h1>
      <p className="text-[16.5px] leading-[1.6] text-ss-ink-soft max-w-[560px] [text-wrap:pretty]">
        The skincare aisle runs on confusion — more steps, more products, more promises. SealedSkin
        is the opposite. We ask a few honest questions, read what your skin tells us, and hand back
        a routine you can actually keep up with.
      </p>

      <h2 className={sectionH}>What we believe</h2>
      <p className={para}>
        A few well-chosen steps beat a twelve-step shelf you&rsquo;ll abandon by Friday. Most skin
        does best with the basics done consistently: gentle cleansing, the right active for your
        concerns, something to hold moisture, and sunscreen every morning. We&rsquo;d rather
        recommend four things you&rsquo;ll use than ten you won&rsquo;t.
      </p>

      <h2 className={sectionH}>How we build your routine</h2>
      <p className={para}>
        Your answers feed a skin analysis and an AM/PM routine matched to your type, concerns, and
        how involved you want to be. The routine engine is AI-assisted and evidence-informed, and
        it&rsquo;s designed to be model-agnostic — so the advice can keep improving as the
        technology behind it does, without changing the experience.
      </p>

      <h2 className={sectionH}>Your privacy</h2>
      <p className={para}>
        The quiz is meant to feel low-stakes. Your answers stay private and are only used to build
        your routine — nothing about your skin is sold or put on display. You can retake the quiz
        any time without leaving a trail.
      </p>

      <h2 className={sectionH}>A note on safety</h2>
      <p className={para}>
        Product brands we show are examples to illustrate a routine, not endorsements, and the
        content is a heuristic guide rather than medical advice. If you&rsquo;re pregnant or nursing
        we filter out ingredients flagged to avoid — but for a diagnosed skin condition, or anything
        that worries you, please see a dermatologist.
      </p>

      <div className="mt-10">
        <CtaLink href="/">Build your routine <Arrow /></CtaLink>
      </div>
    </ContentShell>
  );
}
