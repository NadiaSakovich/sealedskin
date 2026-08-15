"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "../ui/Button";
import { useAuth } from "../../lib/firebase/useAuth";
import { signInWithGoogle, signOutUser, POPUP_CLOSED } from "../../lib/firebase/client";
import { reportClientError } from "../../lib/clientLog";

/** Head-and-shoulders glyph used by the compact (narrow-screen) control. */
function PersonIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="19"
      height="19"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="8" r="3.6" />
      <path d="M4.8 20a7.2 7.2 0 0 1 14.4 0" />
    </svg>
  );
}

/**
 * Header account control.
 *  - Signed out: a "Sign in" button that opens the Google sign-in window directly.
 *  - Signed in:  an avatar button that toggles a dropdown (email + Sign out).
 *    The dropdown closes on click outside or Escape.
 *
 * `compact` is the narrow-screen form that sits next to the hamburger: a smaller
 * "Sign in" button when signed out, and an icon-only person button (same
 * dropdown) when signed in.
 */
export function AccountControl({ compact = false }: { compact?: boolean }) {
  const { user, loading } = useAuth();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointer(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function handleSignIn() {
    setBusy(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      // Ignore the user closing the popup; surface anything else to the console
      // and forward it, so sign-in failures are visible outside the user's own
      // devtools.
      if ((err as { code?: string }).code !== POPUP_CLOSED) {
        console.error("Google sign-in failed", err);
        reportClientError("client.signin.failed", err);
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleSignOut() {
    setOpen(false);
    await signOutUser();
  }

  // Reserve space while auth state resolves to avoid a signed-in→out flash.
  if (loading) {
    return <div className={`h-[38px] ${compact ? "w-10" : "w-[92px]"}`} aria-hidden />;
  }

  if (!user) {
    return (
      <Button
        variant="ghost"
        // Border is left as the ghost default (ss-hairline-strong, 1px) so it
        // matches the hamburger button and the signed-in account button.
        className={`!text-ss-ink ${compact ? "!px-[14px] !py-[9px] !text-[14px]" : "!px-[18px] !py-[9px]"}`}
        onClick={handleSignIn}
        disabled={busy}
      >
        {busy ? "Signing in…" : "Sign in"}
      </Button>
    );
  }

  const label = user.displayName ?? user.email ?? "Account";
  const initial = (label.trim()[0] ?? "?").toUpperCase();

  return (
    <div className="relative" ref={ref}>
      {compact ? (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label={`Account menu for ${label}`}
          className="inline-flex items-center justify-center rounded-[10px] border border-ss-hairline-strong bg-transparent text-ss-ink cursor-pointer w-10 h-10"
        >
          <PersonIcon />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={open}
          className="inline-flex items-center gap-[9px] rounded-full border border-ss-hairline-strong bg-transparent cursor-pointer px-[6px] py-[5px] pr-[13px]"
        >
          <span className="shrink-0 w-7 h-7 rounded-full bg-ss-accent text-ss-on-accent font-head font-semibold text-[13px] inline-flex items-center justify-center">
            {initial}
          </span>
          <span className="font-body text-[14px] font-medium text-ss-ink truncate max-w-[140px]">{label}</span>
        </button>
      )}

      {open && (
        <div
          role="menu"
          className="absolute top-[calc(100%+10px)] right-0 w-[256px] max-w-[calc(100vw-44px)] bg-ss-panel border border-ss-hairline rounded-2xl shadow-[0_24px_50px_-28px_rgba(36,63,57,.5)] p-[16px] z-[60] text-left"
        >
          <div className="font-mono text-[10.5px] tracking-[0.08em] uppercase text-ss-ink-faint mb-1">Signed in as</div>
          <div className="text-[14px] font-medium text-ss-ink truncate mb-[14px]">{user.email ?? label}</div>
          <Link
            href="/profile"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex w-full items-center justify-center mb-2 px-4 py-[11px] rounded-full no-underline border border-ss-hairline-strong bg-transparent text-ss-ink font-body text-[14.5px] font-medium"
          >
            My account
          </Link>
          <Button variant="ghost" className="w-full justify-center" onClick={handleSignOut}>
            Sign out
          </Button>
        </div>
      )}
    </div>
  );
}
