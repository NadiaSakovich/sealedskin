"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "../ui/Button";
import { signInWithGoogle, getCurrentIdToken, POPUP_CLOSED } from "../../lib/firebase/client";
import { useAuth } from "../../lib/firebase/useAuth";
import type { SaveQuizRequest } from "../../lib/domain/types";
import { anonHeaders } from "../../lib/anonId";

type Status = "idle" | "saving" | "saved" | "error" | "limit";

/**
 * End-of-results prompt to save the routine. Signs in with Google in the browser,
 * then POSTs the quiz to /api/users with the resulting ID token. The server
 * verifies the token and persists under the user's account.
 *
 * When `editId` is set (the user is editing a saved routine), it PUTs to update
 * that routine in place instead of creating a new one.
 *
 * `rebuiltOnly` distinguishes the two ways a saved routine can differ from its
 * stored copy: edited answers, or the same answers regenerated (e.g. switched to
 * another AI model). Only the wording changes — both PUT.
 *
 * `saved` says this exact version is already stored (the parent remembers it, so
 * the confirmation survives leaving and re-entering the shop screen); `onSaved`
 * reports a successful save back up so the parent can remember it.
 */
export function SaveRoutine({
  payload,
  editId,
  rebuiltOnly = false,
  saved = false,
  onSaved,
}: {
  payload: SaveQuizRequest;
  editId?: string;
  rebuiltOnly?: boolean;
  saved?: boolean;
  onSaved?: () => void;
}) {
  const { user } = useAuth();
  const [status, setStatus] = useState<Status>(saved ? "saved" : "idle");
  const [error, setError] = useState<string | null>(null);
  const editing = !!editId;
  const regenerated = editing && rebuiltOnly;

  async function handleSave() {
    setStatus("saving");
    setError(null);
    try {
      // Reuse the header session if already signed in; otherwise open Google.
      const idToken = (await getCurrentIdToken()) ?? (await signInWithGoogle()).idToken;
      const res = await fetch("/api/users", {
        method: editing ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
          ...anonHeaders(),
        },
        body: JSON.stringify(editing ? { ...payload, id: editId } : payload),
      });
      if (!res.ok) {
        // 409 = the account already holds the max of 3 saved routines. This isn't
        // a failure to surface as a generic error — show the friendly limit note.
        if (res.status === 409) {
          setStatus("limit");
          return;
        }
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `Save failed (${res.status})`);
      }
      setStatus("saved");
      onSaved?.();
    } catch (err) {
      // User dismissed the Google popup — not an error, just reset.
      if ((err as { code?: string }).code === POPUP_CLOSED) {
        setStatus("idle");
        return;
      }
      setError(err instanceof Error ? err.message : "Something went wrong");
      setStatus("error");
    }
  }

  if (status === "limit") {
    return (
      <div className="mt-7 rounded-[14px] border border-ss-hairline bg-ss-surface px-[18px] py-[15px]">
        <p className="font-head font-semibold text-[16px] text-ss-ink m-0 mb-1">
          You&rsquo;ve reached 3 saved routines
        </p>
        <p className="text-[13.5px] leading-[1.5] text-ss-ink-soft m-0 mb-[14px] [text-wrap:pretty]">
          An account can keep up to 3 saved routines. In your account you can delete one to free up
          a slot for a new routine, or update one of your existing routines instead.
        </p>
        <Link
          href="/profile"
          className="inline-flex items-center gap-[8px] px-[18px] py-[10px] rounded-full no-underline bg-ss-accent text-ss-on-accent font-body text-[14px] font-semibold tracking-[-0.01em]"
        >
          Go to my account
        </Link>
      </div>
    );
  }

  if (status === "saved" || saved) {
    return (
      <div className="mt-7 rounded-[14px] border border-ss-hairline bg-ss-accent-tint px-[18px] py-[15px] text-center">
        <p className="font-head font-semibold text-[16px] text-ss-accent-ink m-0">
          {editing ? "Updated ✓" : "Saved ✓"}
        </p>
        <p className="text-[13.5px] leading-[1.5] text-ss-ink-soft m-0 mt-1 [text-wrap:pretty]">
          {regenerated
            ? "This routine now holds the version you just generated. Find it any time in your account."
            : editing
              ? "Your changes are saved to this routine. Find it any time in your account."
              : "Your routine is saved to your account. Sign in again any time to pick it back up."}
        </p>
      </div>
    );
  }

  return (
    <div className="mt-7 rounded-[14px] border border-ss-hairline bg-ss-surface px-[18px] py-[16px]">
      <p className="font-head font-semibold text-[16px] text-ss-ink m-0 mb-1">
        {regenerated ? "Save this version" : editing ? "Save your changes" : "Save your routine"}
      </p>
      <p className="text-[13.5px] leading-[1.5] text-ss-ink-soft m-0 mb-[14px] [text-wrap:pretty]">
        {regenerated
          ? "You just rebuilt this routine, so it differs from the saved copy. Update it to keep this version instead."
          : editing
          ? "Update this routine in your account with the changes you just made."
          : user
            ? "Save this routine to your account and come back to it later."
            : "Create a free account to keep this routine and come back to it later."}
      </p>
      <Button onClick={handleSave} disabled={status === "saving"}>
        {status === "saving"
          ? editing
            ? "Updating…"
            : "Saving…"
          : editing
            ? "Update my routine"
            : user
              ? "Save my routine"
              : "Sign in with Google & save"}
      </Button>
      {status === "error" && error && (
        <p className="text-[12.5px] leading-[1.45] text-caution-text m-0 mt-3 [text-wrap:pretty]">
          {error} - please try again.
        </p>
      )}
    </div>
  );
}
