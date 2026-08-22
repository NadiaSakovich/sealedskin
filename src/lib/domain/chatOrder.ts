/**
 * Putting a stored conversation back into the order it was held in.
 *
 * Both messages of a turn are written in a SINGLE Firestore batch, and every
 * write in a batch receives the same commit timestamp. `orderBy("createdAt")`
 * therefore cannot separate the question from its answer and falls back to
 * breaking the tie by document id, which is a random auto-id - so about half of
 * all turns were read back as [assistant, user].
 *
 * The damage was not cosmetic. A reversed turn puts two user messages side by
 * side in the transcript replayed to the model, with the older one looking
 * unanswered, so the model answered it again before getting to the real
 * question: every reply echoed the previous one.
 *
 * Lives here, away from the route, because it is pure logic worth testing
 * directly, and a Next.js route module should export handlers and config only.
 */
import type { RoutineChatMessage } from "./types";

/** Within one turn the question always comes first. */
function roleRank(m: RoutineChatMessage): number {
  return m.role === "user" ? 0 : 1;
}

/**
 * Order two stored messages.
 *
 * Exact rather than heuristic: a `createdAt` tie can only ever be the two
 * halves of one batch, and the question is always the first half. Two messages
 * of the same role cannot tie at all, so the comparator returns 0 for them and
 * the (stable) sort leaves them as Firestore gave them.
 */
export function byConversationOrder(a: RoutineChatMessage, b: RoutineChatMessage): number {
  // A server timestamp that has not materialised yet belongs to a write that has
  // only just happened, so it sorts NEWEST. Without this it would fall through to
  // the role comparison and could land in the middle of the transcript.
  if ((a.createdAt == null) !== (b.createdAt == null)) {
    return a.createdAt == null ? 1 : -1;
  }
  // Different turns: the timestamps genuinely differ, so they decide.
  if (a.createdAt != null && b.createdAt != null && a.createdAt !== b.createdAt) {
    return a.createdAt - b.createdAt;
  }
  // Same commit (or both pending): question, then answer.
  return roleRank(a) - roleRank(b);
}
