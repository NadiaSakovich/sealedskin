import type { Metadata } from "next";
import { ContentShell } from "@/components/layout/ContentShell";
import { ContactForm } from "@/components/contact/ContactForm";
import { pageMetadata } from "@/lib/seo";

const TITLE = "Contact us";
const DESCRIPTION =
  "Send a message straight to the developer of SealedSkin - a question, a bug, an idea, or something that did not work.";

export const metadata: Metadata = pageMetadata({
  title: TITLE,
  description: DESCRIPTION,
  path: "/contact",
});

const eyebrow = "font-mono text-[11.5px] tracking-[0.13em] uppercase text-ss-accent-ink mb-3";
const para = "text-[15.5px] leading-[1.6] text-ss-ink-soft [text-wrap:pretty]";

export default function ContactPage() {
  return (
    <ContentShell>
      <div className={eyebrow}>Contact us</div>
      <h1 className="font-head font-semibold text-[32px] leading-[1.1] tracking-[-0.025em] text-ss-ink mb-[14px] max-w-[480px] [text-wrap:balance]">
        Tell us what you think
      </h1>
      <p className="text-[16.5px] leading-[1.6] text-ss-ink-soft max-w-[560px] [text-wrap:pretty]">
        SealedSkin is built and looked after by one developer, and the form below goes straight to
        their inbox. No ticketing system, no support queue, no bot reading it first.
      </p>

      <div className="mt-6 rounded-2xl border border-ss-hairline bg-ss-panel px-5 py-6 sm:px-6">
        <ContactForm />
      </div>

      <h2 className="font-head font-semibold text-[20px] leading-[1.2] tracking-[-0.02em] text-ss-ink mt-10 mb-3">
        What is worth writing about
      </h2>
      <p className={para}>
        A routine that came out strange. A product suggestion that made no sense for your skin.
        Something on the site that broke, or read badly, or would not work on your phone. An
        ingredient you think we get wrong. All of it helps, and small reports are welcome.
      </p>
      <p className={`${para} mt-3`}>
        One thing we cannot do is answer medical questions. If something on your skin worries you,
        please see a dermatologist rather than writing to us. Snuffy will tell you the same, and he
        is right.
      </p>
    </ContentShell>
  );
}
