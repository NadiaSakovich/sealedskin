/**
 * Forward a browser-side problem to the server so it reaches Better Stack.
 *
 * Client errors otherwise live and die in the user's devtools. Kept to the
 * events `/api/log` allows; anything else is dropped server-side.
 *
 * Never throws and never blocks: callers keep their own `console.error` so
 * local development is unchanged, and a failed report is simply lost.
 */
import { anonHeaders } from "./anonId";

type ClientEvent = "client.signin.failed" | "client.routine.fallback";

export function reportClientError(event: ClientEvent, err: unknown): void {
  if (typeof window === "undefined") return;
  const message = err instanceof Error ? err.message : String(err ?? "");
  try {
    void fetch("/api/log", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...anonHeaders() },
      body: JSON.stringify({ event, message }),
      // Survives the page being navigated away from mid-report.
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* reporting must never break the UI */
  }
}
