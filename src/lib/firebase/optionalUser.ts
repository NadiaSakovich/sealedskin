/**
 * Best-effort identity for routes that do NOT require authentication.
 *
 * `/api/routine` is open to signed-out visitors, but when a signed-in user is
 * building a routine we want their real uid and email in the logs rather than a
 * client-supplied claim. This verifies an Authorization header if one is
 * present and otherwise returns null — it never rejects a request.
 *
 * Deliberately separate from the `authedUid` helper in the users route: that
 * one gates access, this one only enriches logs. Keeping them apart makes it
 * hard to accidentally use this for authorisation.
 */
import type { DecodedIdToken } from "firebase-admin/auth";
import { adminAuth } from "./admin";

export interface OptionalUser {
  uid: string;
  email: string | null;
}

/**
 * Verify the bearer token if present. Returns null when there is no token, the
 * token is invalid/expired, or Firebase Admin isn't configured at all — none of
 * which should stop an anonymous user from getting a routine.
 */
export async function optionalUser(req: Request): Promise<OptionalUser | null> {
  const header = req.headers.get("authorization") ?? "";
  const bearer = header.match(/^Bearer (.+)$/i);
  if (!bearer) return null;

  try {
    const token: DecodedIdToken = await adminAuth().verifyIdToken(bearer[1]);
    return { uid: token.uid, email: token.email ?? null };
  } catch {
    return null;
  }
}
