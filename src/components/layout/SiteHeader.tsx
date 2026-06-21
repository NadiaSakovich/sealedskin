"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AccountControl } from "./AccountControl";
import { ThemeToggle } from "./ThemeToggle";

const NAV_LINKS: { label: string; href: string }[] = [
  { label: "How it works", href: "/how-it-works" },
  { label: "About", href: "/about" },
];

function Logo({ size = 34 }: { size?: number }) {
  const letterStyle = { fontSize: size * 0.44, lineHeight: 1 };
  return (
    <span
      aria-hidden="true"
      className="shrink-0 rounded-full border-[1.5px] border-ss-ink inline-flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <span className="flex items-center font-head font-bold text-ss-ink">
        <span style={letterStyle}>S</span>
        <span style={{ ...letterStyle, marginLeft: -(size * 0.05) }}>S</span>
      </span>
    </span>
  );
}

function Brand({ size = 34 }: { size?: number }) {
  return (
    <Link href="/" className="flex items-center gap-[11px] no-underline" aria-label="SealedSkin home">
      <Logo size={size} />
      <span className="font-head font-semibold text-[18px] tracking-[-0.02em] text-ss-ink">SealedSkin</span>
    </Link>
  );
}

export function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();

  const linkClass =
    "no-underline border-none bg-transparent cursor-pointer font-body text-[14.5px] font-medium px-1 py-[6px] tracking-[-0.01em]";

  return (
    <header className="sticky top-0 z-50 w-full bg-ss-panel/[0.86] backdrop-blur-[10px] backdrop-saturate-[1.4] border-b border-ss-hairline">
      <div className="max-w-[1080px] mx-auto px-[22px] py-3 flex items-center justify-between gap-4">
        <Brand size={34} />

        <nav className="hidden md:flex items-center gap-[22px]">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`${linkClass} ${pathname === l.href ? "text-ss-ink" : "text-ss-ink-soft"}`}
            >
              {l.label}
            </Link>
          ))}
          <span className="w-px h-5 bg-ss-hairline" />
          <ThemeToggle />
          <AccountControl />
        </nav>

        <button
          type="button"
          aria-label="Menu"
          onClick={() => setMenuOpen((v) => !v)}
          className="md:hidden inline-flex flex-col items-center justify-center gap-1 border border-ss-hairline-strong bg-transparent rounded-[10px] w-10 h-10 cursor-pointer"
        >
          {[0, 1, 2].map((i) => (
            <span key={i} className="w-4 h-[1.6px] bg-ss-ink rounded-[2px]" />
          ))}
        </button>
      </div>

      {menuOpen && (
        <div className="md:hidden border-t border-ss-hairline px-[22px] pt-[10px] pb-4 flex flex-col gap-1">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setMenuOpen(false)}
              className={`${linkClass} text-left !py-[10px] !text-[15.5px] ${pathname === l.href ? "text-ss-ink" : "text-ss-ink-soft"}`}
            >
              {l.label}
            </Link>
          ))}
          <div className="mt-1 border-t border-ss-hairline pt-1">
            <ThemeToggle full />
          </div>
          <div className="mt-2">
            <AccountControl full />
          </div>
        </div>
      )}
    </header>
  );
}
