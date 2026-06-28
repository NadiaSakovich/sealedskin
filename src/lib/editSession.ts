import type { QuizSubmission, QuizResultSnapshot } from "./domain/types";

/**
 * Short-lived handoff used to carry a saved routine from the profile page into
 * the quiz for editing. The profile stashes the saved quiz, then navigates to
 * `/?edit=1`; `SkinQuiz` consumes it on mount (and clears it) so a refresh
 * doesn't re-trigger the edit. sessionStorage keeps it tab-scoped and ephemeral.
 */
const KEY = "ss-edit-quiz";

export interface EditQuizPayload {
  /** Firestore quiz id, so saving updates this routine in place. */
  id: string;
  submission: QuizSubmission;
  result: QuizResultSnapshot;
}

/** Store the routine to edit; called right before navigating to `/?edit=1`. */
export function stashEditQuiz(payload: EditQuizPayload): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(payload));
  } catch {
    /* sessionStorage unavailable (private mode / SSR) — edit just won't prefill. */
  }
}

/** Read and remove the stashed routine (one-shot). Returns null if none. */
export function takeEditQuiz(): EditQuizPayload | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    sessionStorage.removeItem(KEY);
    return JSON.parse(raw) as EditQuizPayload;
  } catch {
    return null;
  }
}
