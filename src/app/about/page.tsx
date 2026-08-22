import type { Metadata } from "next";
import { ContentShell, CtaLink } from "@/components/layout/ContentShell";
import { Arrow } from "@/components/ui/Arrow";
import { PageBanner } from "@/components/ui/PageBanner";

export const metadata: Metadata = {
  title: "About - SealedSkin",
  description:
    "What SealedSkin is, why the routines are short, and what happens to your answers.",
};

const eyebrow = "font-mono text-[11.5px] tracking-[0.13em] uppercase text-ss-accent-ink mb-3";
const sectionH = "font-head font-semibold text-[20px] leading-[1.2] tracking-[-0.02em] text-ss-ink mt-9 mb-3";
const para = "text-[15.5px] leading-[1.6] text-ss-ink-soft [text-wrap:pretty]";

export default function AboutPage() {
  return (
    <ContentShell>
      <div className={eyebrow}>About</div>
      <h1 className="font-head font-semibold text-[32px] leading-[1.1] tracking-[-0.025em] text-ss-ink mb-[14px] max-w-[480px] [text-wrap:balance]">
        Fewer products, chosen properly
      </h1>
      <p className="text-[16.5px] leading-[1.6] text-ss-ink-soft max-w-[560px] [text-wrap:pretty]">
        Buying skincare is confusing. Eleven serums on one shelf, all promising the same thing, and
        no way to tell which two you need. So SealedSkin asks seven questions about how your skin
        behaves on a normal day, then hands back a morning and evening routine you can memorise.
        Usually four steps. Sometimes three.
      </p>

      <div className="mt-9">
        <PageBanner
          src="/pages/about-cosmetics.jpg"
          alt="Unlabelled skincare bottles on a stone ledge with a eucalyptus sprig"
        />
      </div>

      <h2 className={sectionH}>Why the routine is short</h2>
      <p className={para}>
        Consistency beats complexity. A twelve-step routine gets abandoned by Friday. A four-step
        one survives a bad week, a holiday and a cold. So the routine here is short on purpose.
        Cleanse. Treat the one thing that bothers you most. Moisturise. Wear sunscreen in the
        morning. Everything past that is optional, and you can add it once the basics are a habit.
      </p>

      <h2 className={sectionH}>How we build your routine</h2>
      <p className={para}>
        Your answers set three things: your skin type, the two or three concerns you want dealt
        with first, and how many steps you&rsquo;re willing to do. The routine gets built around
        ingredients that suit all three. An AI writes the final version and looks up current
        products and prices while it does, then it gets checked against a fixed set of safety rules
        before it reaches you.
      </p>

      <h2 className={sectionH}>Your privacy</h2>
      <p className={para}>
        Your answers build your routine and go nowhere else. We don&rsquo;t sell them, and
        there&rsquo;s no profile of your skin sitting anywhere for an advertiser to buy. Retake the
        quiz as often as you like.
      </p>

      <h2 className={sectionH}>A note on safety</h2>
      <p className={para}>
        The brands we show are examples of the right kind of product. Buy whichever version of it
        you can find. Everything here is general guidance and no substitute for a dermatologist. If
        you&rsquo;re pregnant or nursing we leave out the ingredients usually avoided then, but for
        a diagnosed skin condition, or anything that worries you, please go and see one.
      </p>

      <div className="mt-10">
        <CtaLink href="/">Build your routine <Arrow /></CtaLink>
      </div>
    </ContentShell>
  );
}
