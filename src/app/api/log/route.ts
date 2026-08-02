import { NextResponse } from "next/server";
import {
  logger,
  flushLogs,
  userContext,
  readAnonId,
} from "@/lib/logger";
import { optionalUser } from "@/lib/firebase/optionalUser";

// Uses firebase-admin (to resolve a signed-in caller) — Node runtime.
export const runtime = "nodejs";

/**
 * Client-side events worth forwarding to Better Stack. Browser failures never
 * reach the server on their own, so sign-in problems were previously invisible
 * outside the user's own devtools.
 *
 * An allowlist, not free-form: this endpoint is necessarily unauthenticated
 * (sign-in failures happen precisely when there is no session), so the shape of
 * what a hostile client can write into the log stream is fixed here.
 */
const ALLOWED_EVENTS = new Set([
  "client.signin.failed",
  "client.routine.fallback",
]);

/** Cap free-text so a hostile client can't flood the log budget. */
const MAX_MESSAGE = 300;

/**
 * POST /api/log
 * Body: { event: string, message?: string }
 *
 * Fire-and-forget: always answers 204, even for rejected input. The client
 * must never retry, surface, or block on logging.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { event?: unknown; message?: unknown };
    const event = typeof body.event === "string" ? body.event : "";
    if (!ALLOWED_EVENTS.has(event)) {
      return new NextResponse(null, { status: 204 });
    }

    const anonId = readAnonId(req);
    const who = await optionalUser(req);
    const message =
      typeof body.message === "string" ? body.message.slice(0, MAX_MESSAGE) : null;

    logger.warn(event, {
      ...userContext({ uid: who?.uid, email: who?.email, anonId }),
      source: "client",
      ...(message ? { message } : {}),
      userAgent: req.headers.get("user-agent")?.slice(0, 200) ?? null,
    });
    await flushLogs();
  } catch {
    // Malformed body, logging failure — nothing here is worth failing on.
  }
  return new NextResponse(null, { status: 204 });
}
