import type { Metadata } from "next";
import Image from "next/image";
import { ContentShell, CtaLink } from "@/components/layout/ContentShell";
import { Arrow } from "@/components/ui/Arrow";
import { pageMetadata } from "@/lib/seo";

const TITLE = "About";
const DESCRIPTION =
  "Who built SealedSkin and why - a short quiz that turns a shelf of confusing serums into a routine you can keep.";

export const metadata: Metadata = pageMetadata({
  title: TITLE,
  description: DESCRIPTION,
  path: "/about",
});

const eyebrow = "font-mono text-[11.5px] tracking-[0.13em] uppercase text-ss-accent-ink mb-3";
const sectionH = "font-head font-semibold text-[20px] leading-[1.2] tracking-[-0.02em] text-ss-ink mt-9 mb-3";
const para = "text-[15.5px] leading-[1.6] text-ss-ink-soft [text-wrap:pretty]";

export default function AboutPage() {
  return (
    <ContentShell>
      <div className={eyebrow}>About</div>
      <h1 className="font-head font-semibold text-[32px] leading-[1.1] tracking-[-0.025em] text-ss-ink mb-[14px] max-w-[480px] [text-wrap:balance]">
        Hi, I&rsquo;m Nadia
      </h1>

      <div className="flex items-start gap-4 sm:gap-5">
        <Image
          src="/about/nadia.jpg"
          alt="Nadia, who built SealedSkin"
          width={512}
          height={512}
          priority
          className="shrink-0 w-[88px] h-[88px] sm:w-28 sm:h-28 rounded-full object-cover border border-ss-hairline ring-4 ring-ss-accent-tint"
        />
        <p className="text-[16.5px] leading-[1.6] text-ss-ink-soft [text-wrap:pretty]">
          I&rsquo;m an electrical engineer. Years ago, in an earlier career, I was a front-end web
          developer. SealedSkin is a hobby project - a small thing built on the weekends, for anyone
          who wants to take better care of their skin and has no idea where to start.
        </p>
      </div>

      <h2 className={sectionH}>Why I built it</h2>
      <p className={para}>
        It started with my own face. I suddenly started getting acne and realized I needed to do
        something about it. I had no real idea where to start - which ingredient does what, which of
        the eleven serums on the shelf was meant for me, in what order any of it goes on. Eventually
        I asked an AI to work it out. I followed what it gave me, and my skin soon got better. What
        finally worked was simple. Finding this simple solution was the hard part, and it
        shouldn&rsquo;t be.
      </p>

      <h2 className={sectionH}>What I wanted it to be</h2>
      <p className={para}>
        So I built a simple web service I wish I&rsquo;d had. No twenty-minute questionnaire - a
        short quiz that asks only what is actually needed to pick the right ingredients and put them
        in a sensible order. And because a routine always leaves you with questions, there is
        someone here to answer them.
      </p>

      <h2 className={sectionH}>Meet Snuffy</h2>
      <div className="mt-4 flex flex-col-reverse sm:flex-row items-center gap-4 sm:gap-6 rounded-2xl border border-ss-hairline bg-ss-panel px-5 py-5">
        <div className="flex-1 min-w-0">
          <p className={para}>
            Every saved routine comes with a cosmetologist attached. Snuffy is a seal - a magical
            one - and he has been doing this for years. Open a chat with him from your account and
            ask why an ingredient is in your routine, whether two products will get along, or what
            to use instead when something stings.
          </p>
          <p className={`${para} mt-3`}>
            He looks up current reviews before he recommends anything, and he follows the same
            safety rules your routine was built under. He will also tell you plainly when the
            honest answer is to go and see a dermatologist. You choose how he talks to you: warm
            and encouraging, or dry and direct.
          </p>
        </div>
        <Image
          src="/snuffy/snuffy-portrait.png"
          alt="Snuffy the Cosmetologist: a seal in a lab coat and round spectacles, holding a jar of cream"
          width={800}
          height={1067}
          className="shrink-0 w-[150px] sm:w-[186px] h-auto"
        />
      </div>

      <h2 className={sectionH}>A note on safety</h2>
      <p className={para}>
        The brands we show are examples of the right kind of product. Buy whichever version of it
        looks more appealing to you, and if that doesn&rsquo;t work, give another one a shot. If
        you&rsquo;re pregnant or nursing we leave out the ingredients usually avoided in pregnancy.
        Everything here is general guidance and no substitute for a dermatologist. For a diagnosed
        skin condition, or anything looking like a serious problem, please go and see a
        professional.
      </p>

      <div className="mt-10">
        <CtaLink href="/">Build your routine <Arrow /></CtaLink>
      </div>
    </ContentShell>
  );
}
