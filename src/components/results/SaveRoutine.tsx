"use client";

import { useState } from "react";
import { Button } from "../ui/Button";
import { signInWithGoogle, getCurrentIdToken, POPUP_CLOSED } from "../../lib/firebase/client";
import { useAuth } from "../../lib/firebase/useAuth";
import type { SaveQuizRequest } from "../../lib/domain/types";

type Status = "idle" | "saving" | "saved" | "error";

/**
 * End-of-results prompt to save the routine. Signs in with Google in the browser,
 * then POSTs the quiz to /api/users with the resulting ID token. The server
 * verifies the token and persists under the user's account.
 */
export function SaveRoutine({ payload }: { payload: SaveQuizRequest }) {
  const { user } = useAuth();
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setStatus("saving");
    setError(null);
    try {
      // Reuse the header session if already signed in; otherwise open Google.
      const idToken = (await getCurrentIdToken()) ?? (await signInWithGoogle()).idToken;
      const res = await fetch("/api/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `Save failed (${res.status})`);
      }
      setStatus("saved");
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

  if (status === "saved") {
    return (
      <div className="mt-7 rounded-[14px] border border-ss-hairline bg-ss-accent-tint px-[18px] py-[15px] text-center">
        <p className="font-head font-semibold text-[16px] text-ss-accent-ink m-0">
          Saved ✓
        </p>
        <p className="text-[13.5px] leading-[1.5] text-ss-ink-soft m-0 mt-1 [text-wrap:pretty]">
          Your routine is saved to your account. Sign in again any time to pick it back up.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-7 rounded-[14px] border border-ss-hairline bg-ss-surface px-[18px] py-[16px]">
      <p className="font-head font-semibold text-[16px] text-ss-ink m-0 mb-1">
        Save your routine
      </p>
      <p className="text-[13.5px] leading-[1.5] text-ss-ink-soft m-0 mb-[14px] [text-wrap:pretty]">
        {user
          ? "Save this routine to your account and come back to it later."
          : "Create a free account to keep this routine and come back to it later."}
      </p>
      <Button onClick={handleSave} disabled={status === "saving"}>
        {status === "saving"
          ? "Saving…"
          : user
            ? "Save my routine"
            : "Sign in with Google & save"}
      </Button>
      {status === "error" && error && (
        <p className="text-[12.5px] leading-[1.45] text-caution-text m-0 mt-3 [text-wrap:pretty]">
          {error} — please try again.
        </p>
      )}
    </div>
  );
}
