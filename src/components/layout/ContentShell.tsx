import type { ReactNode } from "react";
import Link from "next/link";
import { SiteHeader } from "./SiteHeader";

/**
 * Layout for static content routes (About, How it works). Same site chrome as
 * the quiz but without the quiz progress rail — just the header, a centered
 * reading column, and the shared footer note.
 */
export function ContentShell({ children }: { children: ReactNode }) {
  return (
    <div className="w-full min-h-screen flex flex-col">
      <SiteHeader />
      <div className="flex-1 flex justify-center items-start px-5 pt-[42px] pb-16">
        <div className="w-full max-w-[680px]">
          {children}
          <div className="text-center mt-[60px] text-[11.5px] text-ss-ink-faint font-mono">
            Your answers stay private · SealedSkin
          </div>
        </div>
      </div>
    </div>
  );
}

/** Primary CTA styled to match `ui/Button` "primary", but as a navigation link. */
export function CtaLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-[9px] px-[22px] py-[13px] rounded-full no-underline bg-ss-accent text-ss-on-accent font-body text-[15.5px] font-semibold tracking-[-0.01em] whitespace-nowrap transition-[transform,opacity] duration-150"
    >
      {children}
    </Link>
  );
}
