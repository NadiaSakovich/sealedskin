import { NextResponse } from "next/server";
import { FieldValue, type QueryDocumentSnapshot } from "firebase-admin/firestore";
import type { DecodedIdToken } from "firebase-admin/auth";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { createProvider } from "@/lib/ai";
import {
  answerRoutineQuestion,
  buildRoutineContext,
  MAX_CHAT_MESSAGE_CHARS,
} from "@/lib/ai/chat";
import {
  DEFAULT_CHAT_PERSONA,
  isChatPersonaId,
  type ChatPersonaId,
} from "@/lib/ai/personas";
import type { RoutineChatMessage } from "@/lib/domain/types";
import { byConversationOrder } from "@/lib/domain/chatOrder";
import {
  logger,
  flushLogs,
  userContext,
  readAnonId,
  errorData,
  type UserContext,
} from "@/lib/logger";

// firebase-admin needs Node APIs, and the grounded call wants the longer
// timeouts of the Node runtime.
export const runtime = "nodejs";

// A grounded reply runs ~5-15s. Same 60s budget as /api/routine, for the same
// reason: enough headroom for a slow search, not so much that a wedged call
// hangs for minutes.
export const maxDuration = 60;

/**
 * Stored turns kept per routine. The prompt only ever replays the last
 * `CHAT_HISTORY_TURNS` of them (see `lib/ai/chat.ts`); this is about not letting
 * the transcript grow without bound in Firestore. Oldest trimmed as new arrive.
 */
const MAX_STORED_MESSAGES = 40;

/** Verify the `Authorization: Bearer <token>` header; returns the token or null. */
async function authedUid(req: Request): Promise<DecodedIdToken | null> {
  const header = req.headers.get("authorization") ?? "";
  const bearer = header.match(/^Bearer (.+)$/i);
  if (!bearer) return null;
  try {
    return await adminAuth().verifyIdToken(bearer[1]);
  } catch {
    return null;
  }
}

function ctx(token: DecodedIdToken, req: Request): UserContext {
  return userContext({ uid: token.uid, email: token.email, anonId: readAnonId(req) });
}

async function unauthorized(req: Request, operation: string) {
  logger.warn("chat.unauthorized", {
    ...userContext({ anonId: readAnonId(req) }),
    operation,
  });
  await flushLogs();
  return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
}

/** The chat subcollection of one of the caller's own saved routines. */
function chatRef(uid: string, quizId: string) {
  return adminDb()
    .collection("users")
    .doc(uid)
    .collection("quizzes")
    .doc(quizId)
    .collection("chat");
}

/**
 * The voice this conversation is being held in.
 *
 * Stored on the routine document rather than on each message: it belongs to the
 * conversation, not to a turn, and it has to survive a page reload so Snuffy
 * doesn't change character halfway through. Anything unrecognised (an old save,
 * a hand-edited document) reads as the default rather than reaching the model.
 */
function storedPersona(quiz: FirebaseFirestore.DocumentData): ChatPersonaId | null {
  return isChatPersonaId(quiz.chatPersona) ? quiz.chatPersona : null;
}

function toMessage(doc: QueryDocumentSnapshot): RoutineChatMessage {
  const data = doc.data();
  const createdAt = data.createdAt;
  return {
    id: doc.id,
    role: data.role === "assistant" ? "assistant" : "user",
    text: typeof data.text === "string" ? data.text : "",
    ...(data.grounding ? { grounding: data.grounding } : {}),
    createdAt:
      createdAt && typeof createdAt.toMillis === "function" ? createdAt.toMillis() : null,
  };
}

/**
 * Read the stored conversation, oldest first (the order the model expects).
 *
 * Sorted in memory rather than trusting `orderBy("createdAt")` alone: the two
 * messages of a turn share one commit timestamp, so Firestore breaks that tie by
 * random document id. See `lib/domain/chatOrder`.
 *
 * Sorting on the READ side is deliberate. A write-side fix would only help new
 * messages and would leave every conversation already stored permanently
 * scrambled; this repairs those too, with no migration.
 */
async function readHistory(uid: string, quizId: string): Promise<RoutineChatMessage[]> {
  const snap = await chatRef(uid, quizId).orderBy("createdAt", "asc").get();
  return snap.docs.map(toMessage).sort(byConversationOrder);
}

/**
 * GET /api/routine-chat?quizId=<id>
 *
 * The stored conversation for one saved routine, so reopening the chat window
 * resumes where the user left off, plus the voice it is being held in. A null
 * `persona` is what makes the window show the chooser, so it is returned
 * distinct from the default rather than being filled in here.
 */
export async function GET(req: Request) {
  const token = await authedUid(req);
  if (!token) return unauthorized(req, "history");
  const user = ctx(token, req);

  const quizId = new URL(req.url).searchParams.get("quizId");
  if (!quizId) {
    await flushLogs();
    return NextResponse.json({ error: "Missing `quizId` query parameter" }, { status: 400 });
  }

  try {
    const quizSnap = await adminDb()
      .collection("users")
      .doc(token.uid)
      .collection("quizzes")
      .doc(quizId)
      .get();
    const messages = await readHistory(token.uid, quizId);
    const persona = quizSnap.exists ? storedPersona(quizSnap.data() ?? {}) : null;
    logger.info("chat.history", {
      ...user,
      quizId,
      messageCount: messages.length,
      persona: persona ?? "unset",
    });
    await flushLogs();
    return NextResponse.json({ messages, persona });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    logger.error("chat.history.failed", { ...user, quizId, ...errorData(err) });
    await flushLogs();
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/routine-chat?quizId=<id>
 *
 * Clears the conversation for one saved routine ("Clear chat" in the window).
 *
 * The stored persona goes with it. Clearing is how a client starts over, and
 * the voice was chosen for the conversation being discarded - so the next one
 * gets the chooser again rather than silently inheriting the old choice.
 */
export async function DELETE(req: Request) {
  const token = await authedUid(req);
  if (!token) return unauthorized(req, "clearChat");
  const user = ctx(token, req);

  const quizId = new URL(req.url).searchParams.get("quizId");
  if (!quizId) {
    await flushLogs();
    return NextResponse.json({ error: "Missing `quizId` query parameter" }, { status: 400 });
  }

  try {
    const snap = await chatRef(token.uid, quizId).get();
    const batch = adminDb().batch();
    snap.docs.forEach((doc) => batch.delete(doc.ref));
    batch.update(
      adminDb().collection("users").doc(token.uid).collection("quizzes").doc(quizId),
      { chatPersona: FieldValue.delete() },
    );
    await batch.commit();
    logger.info("chat.cleared", { ...user, quizId, messageCount: snap.size });
    await flushLogs();
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    logger.error("chat.clear.failed", { ...user, quizId, ...errorData(err) });
    await flushLogs();
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/routine-chat
 * Headers: Authorization: Bearer <Firebase ID token>
 * Body: { quizId: string, message: string, persona?: ChatPersonaId }
 * Returns: { reply: RoutineChatMessage, persona: ChatPersonaId }
 *
 * Answers one question about the caller's own saved routine.
 *
 * The routine itself is read from Firestore server-side rather than accepted
 * from the browser: the client cannot forge the context the model is given, and
 * the request stays small. The model is the quiz's default (`createProvider()`
 * with no override), so chat and routine generation always speak with the same
 * voice and the same capabilities.
 *
 * `persona` names one of two voices; it never carries one. The browser sends an
 * id, this route resolves it against the whitelist in `lib/ai/personas`, and an
 * unrecognised value falls back to what is stored, then to the default - so a
 * crafted request can pick between Snuffy's two registers and nothing else.
 */
export async function POST(req: Request) {
  const startedAt = Date.now();
  const token = await authedUid(req);
  if (!token) return unauthorized(req, "chat");
  const user = ctx(token, req);

  let body: { quizId?: string; message?: string; persona?: unknown };
  try {
    body = await req.json();
  } catch {
    logger.warn("chat.badRequest", { ...user, reason: "invalid JSON body" });
    await flushLogs();
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const quizId = typeof body.quizId === "string" ? body.quizId : "";
  const question = typeof body.message === "string" ? body.message.trim() : "";
  if (!quizId || !question) {
    logger.warn("chat.badRequest", { ...user, reason: "missing quizId or message" });
    await flushLogs();
    return NextResponse.json(
      { error: "Body must include `quizId` and a non-empty `message`" },
      { status: 400 },
    );
  }
  if (question.length > MAX_CHAT_MESSAGE_CHARS) {
    logger.warn("chat.badRequest", { ...user, quizId, reason: "message too long" });
    await flushLogs();
    return NextResponse.json(
      { error: `Please keep your question under ${MAX_CHAT_MESSAGE_CHARS} characters.` },
      { status: 400 },
    );
  }

  try {
    const quizRef = adminDb()
      .collection("users")
      .doc(token.uid)
      .collection("quizzes")
      .doc(quizId);
    const quizSnap = await quizRef.get();
    if (!quizSnap.exists) {
      logger.warn("chat.notFound", { ...user, quizId });
      await flushLogs();
      return NextResponse.json({ error: "Routine not found" }, { status: 404 });
    }
    const quiz = quizSnap.data() ?? {};

    const history = await readHistory(token.uid, quizId);
    const routineContext = buildRoutineContext(quiz.submission ?? null, quiz.result ?? null);

    // The request's choice wins (this is the turn the client picked it on),
    // then whatever the conversation was already being held in, then the
    // default for a transcript saved before the chooser existed.
    const persona: ChatPersonaId = isChatPersonaId(body.persona)
      ? body.persona
      : (storedPersona(quiz) ?? DEFAULT_CHAT_PERSONA);

    const provider = createProvider();
    const reply = await answerRoutineQuestion(
      provider,
      routineContext,
      history,
      question,
      persona,
    );

    // The model asserted a product's standing without ever searching, twice in a
    // row. The reply still goes out (it is advice, not a fabrication we can
    // detect precisely), but this must be visible rather than silent - a rise
    // here means the quality bar in the prompt has stopped biting.
    if (reply.unverifiedClaim) {
      logger.warn("chat.unverifiedClaim", { ...user, quizId, replyChars: reply.text.length });
    }

    // Persist both turns. Written after the model call so a failed reply doesn't
    // leave a dangling question in the transcript.
    const chat = chatRef(token.uid, quizId);
    const batch = adminDb().batch();
    // Written every turn rather than only the first: it is a single field on a
    // document already being read, and it repairs a conversation whose stored
    // choice was missing or unrecognised.
    if (storedPersona(quiz) !== persona) {
      batch.update(quizRef, { chatPersona: persona });
    }
    batch.set(chat.doc(), {
      role: "user",
      text: question,
      createdAt: FieldValue.serverTimestamp(),
    });
    const replyRef = chat.doc();
    batch.set(replyRef, {
      role: "assistant",
      text: reply.text,
      // Firestore rejects `undefined`, and an ungrounded turn simply has none.
      ...(reply.grounding ? { grounding: reply.grounding } : {}),
      createdAt: FieldValue.serverTimestamp(),
    });
    await batch.commit();

    // Trim the oldest turns so one routine's transcript stays bounded.
    //
    // Deleted by id from the already-ordered `history` rather than by re-running
    // `orderBy("createdAt").limit(n)`. That query breaks the same batch-timestamp
    // tie by random document id (see `lib/domain/chatOrder`), so it could delete
    // a question while keeping its answer and leave a dangling half-turn in the
    // transcript. It also saves a read: the two new messages are by definition
    // the newest, so everything trimmable is already in `history`.
    const stored = history.length + 2;
    if (stored > MAX_STORED_MESSAGES) {
      const overflow = history.slice(0, stored - MAX_STORED_MESSAGES);
      const trim = adminDb().batch();
      overflow.forEach((m) => trim.delete(chat.doc(m.id)));
      await trim.commit();
    }

    logger.info("chat.success", {
      ...user,
      quizId,
      model: `${provider.id}:${provider.model}`,
      persona,
      durationMs: Date.now() - startedAt,
      questionChars: question.length,
      replyChars: reply.text.length,
      historyTurns: history.length,
      groundingSources: reply.grounding?.sources?.length ?? 0,
    });
    await flushLogs();

    const message: RoutineChatMessage = {
      id: replyRef.id,
      role: "assistant",
      text: reply.text,
      ...(reply.grounding ? { grounding: reply.grounding } : {}),
      createdAt: Date.now(),
    };
    return NextResponse.json({ reply: message, persona });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    logger.error("chat.failed", {
      ...user,
      quizId,
      durationMs: Date.now() - startedAt,
      ...errorData(err),
    });
    await flushLogs();
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
