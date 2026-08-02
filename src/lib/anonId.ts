/**
 * A stable per-browser anonymous id, used only to group log lines.
 *
 * The quiz works signed-out, so most routine builds have no Firebase uid. This
 * gives those requests an identity, so a person can be followed through the
 * quiz and — once they sign in — linked to their uid via the `sessionId` field
 * that keeps travelling alongside it.
 *
 * Not a security token and never treated as one: it is client-generated and
 * freely editable. It only ever groups logs.
 */
const KEY = "ss-anon-id";

/** `anon_` + 16 hex chars — matches the server's `readAnonId` validation. */
function generate(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `anon_${hex}`;
}

/**
 * The current browser's anonymous id, creating and persisting one on first use.
 * Returns null during SSR, and if localStorage is unavailable (private mode,
 * blocked cookies) — callers simply send no id in that case.
 */
export function getAnonId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const existing = window.localStorage.getItem(KEY);
    if (existing) return existing;
    const fresh = generate();
    window.localStorage.setItem(KEY, fresh);
    return fresh;
  } catch {
    return null;
  }
}

/**
 * Headers to attach to an API call so its logs are attributable.
 * Spreads to nothing when no id is available, so call sites stay simple.
 */
export function anonHeaders(): Record<string, string> {
  const id = getAnonId();
  return id ? { "x-anon-id": id } : {};
}
