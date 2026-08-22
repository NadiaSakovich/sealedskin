/**
 * Which voice Snuffy answers in.
 *
 * The client picks one at the start of a conversation and it is stored with
 * that conversation, so he does not change character between turns or when the
 * window is reopened.
 *
 * Deliberately a module of its own, with NO imports. The chat prompt lives in
 * `./chat`, which pulls in `./agent` and the product catalogue behind it; the
 * chooser in `components/profile/RoutineChat.tsx` needs the labels only. Keeping
 * the identities here means the client bundle gets three short strings instead
 * of the whole prompt stack, and Snuffy's system prompt is never shipped to the
 * browser.
 *
 * The ids are a whitelist, the same shape as `ALLOWED_MODELS` in
 * `app/api/routine/route.ts` and for the same reason: the browser names a
 * persona, it does not supply one. An unrecognised value falls back to the
 * default rather than reaching the model.
 */

export const CHAT_PERSONA_IDS = ["warm", "dry"] as const;

export type ChatPersonaId = (typeof CHAT_PERSONA_IDS)[number];

/**
 * Used for a conversation saved before the choice existed, and whenever a
 * request names a persona we don't recognise. The warm voice is the safer
 * default: it is the register that cannot land badly on a question we failed to
 * anticipate.
 */
export const DEFAULT_CHAT_PERSONA: ChatPersonaId = "warm";

export interface ChatPersonaMeta {
  /** Shown on the chooser card and in the header once chosen. */
  label: string;
  /** One line under the label. Describes the manner, never the expertise. */
  tagline: string;
}

/**
 * What the chooser shows. Both descriptions are about MANNER only - the skill
 * is not on the menu, and the copy must not imply that picking one voice gets
 * you a less careful cosmetologist than the other.
 */
export const CHAT_PERSONA_META: Record<ChatPersonaId, ChatPersonaMeta> = {
  warm: {
    label: "Warm and encouraging",
    tagline: "Friendly and patient, and happy to explain the reasoning.",
  },
  dry: {
    label: "Dry and direct",
    tagline: "Straight to the point, with a sense of humour about the industry.",
  },
};

/** True for a value the browser sent that we are willing to act on. */
export function isChatPersonaId(value: unknown): value is ChatPersonaId {
  return typeof value === "string" && (CHAT_PERSONA_IDS as readonly string[]).includes(value);
}
