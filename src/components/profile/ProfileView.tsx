"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "../../lib/firebase/useAuth";
import { getCurrentIdToken, signInWithGoogle, POPUP_CLOSED } from "../../lib/firebase/client";
import type { QuizSubmission } from "../../lib/domain/types";
import { stashEditQuiz } from "../../lib/editSession";
import { Button } from "../ui/Button";
import { Arrow } from "../ui/Arrow";
import type { SavedResult } from "./types";

interface SavedQuiz {
  id: string;
  createdAt: number | null;
  submission: QuizSubmission | null;
  result: SavedResult | null;
}

interface ProfileData {
  profile: { uid: string; email: string | null; displayName: string | null; photoURL: string | null };
  quizzes: SavedQuiz[];
}

type LoadState = "idle" | "loading" | "ready" | "error";

function formatDate(ms: number | null): string | null {
  if (!ms) return null;
  try {
    return new Date(ms).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return null;
  }
}

/** Best-effort skin-type label for the list row, from the stored result. */
function skinTypeLabel(q: SavedQuiz): string {
  return q.result?.profile?.typeLabel ?? "Skin routine";
}

function Avatar({ photoURL, label }: { photoURL: string | null; label: string }) {
  const initial = (label.trim()[0] ?? "?").toUpperCase();
  if (photoURL) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- Google avatar, no optimization needed
      <img
        src={photoURL}
        alt=""
        referrerPolicy="no-referrer"
        className="w-16 h-16 rounded-full object-cover border border-ss-hairline"
      />
    );
  }
  return (
    <span className="w-16 h-16 rounded-full bg-ss-accent text-ss-on-accent font-head font-semibold text-[26px] inline-flex items-center justify-center">
      {initial}
    </span>
  );
}

export function ProfileView() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<ProfileData | null>(null);
  const [state, setState] = useState<LoadState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Await before the first setState so this is safe to call straight from an
  // effect (no synchronous cascading render).
  const load = useCallback(async () => {
    try {
      const idToken = await getCurrentIdToken();
      if (!idToken) {
        setState("idle");
        return;
      }
      setState("loading");
      setError(null);
      const res = await fetch("/api/users", { headers: { Authorization: `Bearer ${idToken}` } });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Failed to load (${res.status})`);
      }
      setData((await res.json()) as ProfileData);
      setState("ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setState("error");
    }
  }, []);

  useEffect(() => {
    // Signed-out rendering is handled below by the `!user` render guard, so we
    // only need to (re)fetch when a user is present. `load` defers all setState
    // until after its first await (a network call) — exactly the external-sync
    // case effects are for; the lint rule can't see across the async boundary.
    if (loading || !user) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [user, loading, load]);

  async function handleSignIn() {
    setSigningIn(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      if ((err as { code?: string }).code !== POPUP_CLOSED) {
        console.error("Google sign-in failed", err);
      }
    } finally {
      setSigningIn(false);
    }
  }

  // Open a saved routine: hand it off via sessionStorage, then navigate to the
  // quiz, which lands on the finale review hub ("Your skin profile is ready").
  function handleOpen(q: SavedQuiz) {
    if (!q.submission || !q.result) return;
    stashEditQuiz({ id: q.id, submission: q.submission, result: q.result });
    router.push("/?edit=1");
  }

  async function handleDelete(id: string) {
    if (typeof window !== "undefined" && !window.confirm("Delete this saved routine? This can't be undone.")) {
      return;
    }
    setDeletingId(id);
    setActionError(null);
    try {
      const idToken = await getCurrentIdToken();
      if (!idToken) throw new Error("Please sign in again");
      const res = await fetch(`/api/users?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Delete failed (${res.status})`);
      }
      setData((d) => (d ? { ...d, quizzes: d.quizzes.filter((q) => q.id !== id) } : d));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Couldn't delete that routine");
    } finally {
      setDeletingId(null);
    }
  }

  // --- Auth resolving / signed out ---
  if (loading || (user && state === "loading" && !data)) {
    return (
      <div className="py-16 text-center">
        <div className="mx-auto mb-5 w-9 h-9 rounded-full border-[3px] border-ss-hairline border-t-ss-accent animate-spin" />
        <p className="text-[14.5px] text-ss-ink-soft">Loading your profile…</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="py-10">
        <div className="font-mono text-[11.5px] tracking-[0.13em] uppercase text-ss-accent-ink mb-3">Profile</div>
        <h1 className="font-head font-semibold text-[28px] leading-[1.12] tracking-[-0.025em] text-ss-ink m-0 mb-3 [text-wrap:balance]">
          Sign in to see your routines
        </h1>
        <p className="text-[15.5px] leading-[1.55] text-ss-ink-soft m-0 mb-7 max-w-[480px] [text-wrap:pretty]">
          Sign in with Google to view your saved skincare routines, revisit your skin profile, and
          pick up where you left off.
        </p>
        <Button onClick={handleSignIn} disabled={signingIn}>
          {signingIn ? "Signing in…" : "Sign in with Google"} <Arrow />
        </Button>
      </div>
    );
  }

  const quizzes = data?.quizzes ?? [];
  const displayName = data?.profile.displayName ?? user.displayName ?? "Your account";
  const email = data?.profile.email ?? user.email ?? null;
  const photoURL = data?.profile.photoURL ?? user.photoURL ?? null;

  // --- Profile + saved routines list ---
  return (
    <div className="py-0.5">
      <div className="font-mono text-[11.5px] tracking-[0.13em] uppercase text-ss-accent-ink mb-3">Profile</div>

      <div className="flex items-center gap-[18px] mb-9">
        <Avatar photoURL={photoURL} label={displayName} />
        <div className="min-w-0">
          <h1 className="font-head font-semibold text-[26px] leading-[1.15] tracking-[-0.02em] text-ss-ink m-0 [text-wrap:balance]">
            {displayName}
          </h1>
          {email && <p className="text-[14.5px] text-ss-ink-soft m-0 mt-1 truncate">{email}</p>}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="flex items-baseline gap-2">
          <h2 className="font-head font-semibold text-[20px] leading-[1.2] tracking-[-0.02em] text-ss-ink m-0">
            Saved routines
          </h2>
          {quizzes.length > 0 && (
            <span className="font-mono text-[12px] text-ss-ink-faint">{quizzes.length} saved</span>
          )}
        </div>
        <Link
          href="/"
          className="inline-flex items-center gap-[8px] px-[18px] py-[10px] rounded-full no-underline bg-ss-accent text-ss-on-accent font-body text-[14px] font-semibold tracking-[-0.01em] whitespace-nowrap"
        >
          New routine <Arrow />
        </Link>
      </div>

      {actionError && (
        <div className="rounded-[14px] border border-ss-hairline bg-ss-surface px-[18px] py-3 mb-4">
          <p className="text-[13px] text-caution-text m-0">{actionError} — please try again.</p>
        </div>
      )}

      {state === "error" && (
        <div className="rounded-[14px] border border-ss-hairline bg-ss-surface px-[18px] py-4 mb-4">
          <p className="text-[13.5px] text-caution-text m-0">{error} — please try again.</p>
          <button
            type="button"
            onClick={() => void load()}
            className="mt-2 text-[13px] font-medium text-ss-accent-ink underline underline-offset-2 cursor-pointer bg-transparent border-none p-0"
          >
            Retry
          </button>
        </div>
      )}

      {state === "ready" && quizzes.length === 0 && (
        <div className="rounded-[14px] border border-ss-hairline bg-ss-surface px-[18px] py-7 text-center">
          <p className="font-head font-semibold text-[16px] text-ss-ink m-0 mb-1">No saved routines yet</p>
          <p className="text-[13.5px] leading-[1.5] text-ss-ink-soft m-0 mb-[16px] [text-wrap:pretty]">
            Take the quiz and save your result — it&rsquo;ll show up here so you can come back to it any time.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-[9px] px-[22px] py-[13px] rounded-full no-underline bg-ss-accent text-ss-on-accent font-body text-[15.5px] font-semibold tracking-[-0.01em] whitespace-nowrap"
          >
            Build a routine <Arrow />
          </Link>
        </div>
      )}

      {quizzes.length > 0 && (
        <ul className="list-none m-0 p-0 grid gap-[10px]">
          {quizzes.map((q, i) => {
            const concerns = q.result?.profile?.topConcernLabels ?? [];
            const date = formatDate(q.createdAt);
            const num = quizzes.length - i;
            return (
              <li
                key={q.id}
                className="flex items-stretch gap-2 rounded-2xl bg-ss-surface border border-ss-hairline overflow-hidden hover:border-ss-hairline-strong transition-colors"
              >
                <button
                  type="button"
                  onClick={() => handleOpen(q)}
                  disabled={!q.result || !q.submission}
                  className="flex-1 min-w-0 text-left flex items-center gap-4 px-[18px] py-4 bg-transparent border-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="shrink-0 w-10 h-10 rounded-full bg-ss-accent-tint text-ss-accent-ink font-head font-semibold text-[15px] inline-flex items-center justify-center">
                    {num}
                  </span>
                  <span className="flex-1 min-w-0 block">
                    <span className="block font-head font-semibold text-[16px] text-ss-ink tracking-[-0.01em]">
                      Routine {num}
                      <span className="font-body font-medium text-ss-accent-ink"> · {skinTypeLabel(q)}</span>
                    </span>
                    <span className="block text-[13px] leading-[1.4] text-ss-ink-soft mt-0.5 truncate">
                      {concerns.length ? concerns.join(", ") : "Personalized routine"}
                      {date && <span className="text-ss-ink-faint"> · {date}</span>}
                    </span>
                  </span>
                  <span className="shrink-0 text-ss-ink-faint"><Arrow /></span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(q.id)}
                  disabled={deletingId === q.id}
                  aria-label={`Delete routine ${num}`}
                  title="Delete routine"
                  className="shrink-0 px-4 flex items-center justify-center border-l border-ss-hairline bg-transparent text-ss-ink-faint hover:text-caution-text hover:bg-caution-bg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {deletingId === q.id ? (
                    <span className="w-4 h-4 rounded-full border-2 border-ss-hairline border-t-caution-text animate-spin" />
                  ) : (
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                      <line x1="10" y1="11" x2="10" y2="17" />
                      <line x1="14" y1="11" x2="14" y2="17" />
                    </svg>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
