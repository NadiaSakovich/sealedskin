"use client";

import { useSyncExternalStore } from "react";

/** Re-read whenever the <html> class attribute changes (toggle or inline script). */
function subscribeToTheme(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
}
const isDark = () => document.documentElement.classList.contains("dark");
// The inline no-flash script runs before hydration, so the server can't know the
// real theme — default to light on the server; the client re-reads after mount
// (useSyncExternalStore tolerates this client/server difference without warning).
const isDarkServer = () => false;

/**
 * Light/dark theme switch shown in the header next to the account control.
 *
 * The actual theme is applied as early as possible by the inline script in
 * `layout.tsx` (no-flash). This component mirrors that state into a toggle and
 * persists changes to `localStorage` under the `ss-theme` key.
 *
 * `full` stretches the control into a labeled row for the mobile menu layout.
 */
export function ThemeToggle({ full = false }: { full?: boolean }) {
  // Mirror the DOM's theme class straight into render — no in-effect state sync.
  const dark = useSyncExternalStore(subscribeToTheme, isDark, isDarkServer);

  function toggle() {
    const next = !isDark();
    // Flipping the class triggers the observer above, which re-renders this switch.
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("ss-theme", next ? "dark" : "light");
    } catch {
      /* ignore storage being unavailable */
    }
  }

  const Switch = (
    <span
      className={`relative inline-flex h-[26px] w-[46px] shrink-0 items-center rounded-full border transition-colors duration-200 ${
        dark ? "border-ss-accent bg-ss-accent-tint" : "border-ss-hairline-strong bg-ss-track"
      }`}
    >
      <span
        className={`absolute top-1/2 -translate-y-1/2 inline-flex h-[18px] w-[18px] items-center justify-center rounded-full bg-ss-surface shadow-[0_1px_3px_rgba(0,0,0,.28)] transition-[left] duration-200 ${
          dark ? "left-[24px]" : "left-[3px]"
        }`}
      >
        {dark ? <MoonIcon /> : <SunIcon />}
      </span>
    </span>
  );

  if (full) {
    return (
      <button
        type="button"
        onClick={toggle}
        role="switch"
        aria-checked={dark}
        aria-label="Toggle dark mode"
        className="flex w-full items-center justify-between gap-3 border-none bg-transparent cursor-pointer px-1 py-[10px] font-body text-[15.5px] font-medium text-ss-ink-soft tracking-[-0.01em]"
      >
        <span>{dark ? "Dark mode" : "Light mode"}</span>
        {Switch}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      role="switch"
      aria-checked={dark}
      aria-label="Toggle dark mode"
      title={dark ? "Switch to light mode" : "Switch to dark mode"}
      className="inline-flex items-center border-none bg-transparent cursor-pointer p-0"
    >
      {Switch}
    </button>
  );
}

function SunIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" className="text-ss-accent-ink">
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 2v2.4M12 19.6V22M4.6 4.6l1.7 1.7M17.7 17.7l1.7 1.7M2 12h2.4M19.6 12H22M4.6 19.4l1.7-1.7M17.7 6.3l1.7-1.7" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" className="text-ss-accent-ink">
      <path d="M20.5 14.2A8.2 8.2 0 0 1 9.8 3.5a8.2 8.2 0 1 0 10.7 10.7z" />
    </svg>
  );
}
