import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import type { DecodedIdToken } from "firebase-admin/auth";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import type { SaveQuizRequest } from "@/lib/domain/types";

// firebase-admin uses Node APIs — pin this route to the Node.js runtime.
export const runtime = "nodejs";

/** Verify the `Authorization: Bearer <token>` header; returns the uid or null. */
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

/**
 * GET /api/users
 * Headers: Authorization: Bearer <Firebase ID token>
 *
 * Returns the signed-in user's profile and their saved routines (newest first),
 * read server-side so the locked-down Firestore rules can stay deny-all.
 */
export async function GET(req: Request) {
  const token = await authedUid(req);
  if (!token) {
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
  }

  try {
    const db = adminDb();
    const userRef = db.collection("users").doc(token.uid);
    const snap = await userRef.collection("quizzes").orderBy("createdAt", "desc").get();

    const quizzes = snap.docs.map((doc) => {
      const data = doc.data();
      const createdAt = data.createdAt;
      return {
        id: doc.id,
        // Firestore Timestamp → epoch millis (serializable); null if not yet set.
        createdAt: createdAt && typeof createdAt.toMillis === "function" ? createdAt.toMillis() : null,
        submission: data.submission ?? null,
        result: data.result ?? null,
        isMain: data.isMain === true,
      };
    });

    // Exactly one routine is the "main" one. If nothing is flagged (e.g. legacy
    // saves), treat the newest (first, since ordered desc) as main so the UI
    // always has a main to show.
    if (quizzes.length && !quizzes.some((q) => q.isMain)) {
      quizzes[0].isMain = true;
    }

    return NextResponse.json({
      profile: {
        uid: token.uid,
        email: token.email ?? null,
        displayName: token.name ?? null,
        photoURL: token.picture ?? null,
      },
      quizzes,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * PUT /api/users
 * Headers: Authorization: Bearer <Firebase ID token>
 * Body: SaveQuizRequest & { id: string }
 *
 * Updates an existing saved quiz in place (used when a user edits a routine).
 * The quiz must already exist under the caller's own account; `createdAt` is
 * preserved and an `updatedAt` timestamp is set.
 */
export async function PUT(req: Request) {
  const token = await authedUid(req);
  if (!token) {
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
  }

  let body: SaveQuizRequest & { id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body?.id || !body?.submission || !body?.result) {
    return NextResponse.json(
      { error: "Body must include `id`, `submission` and `result`" },
      { status: 400 },
    );
  }

  try {
    const db = adminDb();
    const quizRef = db
      .collection("users")
      .doc(token.uid)
      .collection("quizzes")
      .doc(body.id);
    if (!(await quizRef.get()).exists) {
      return NextResponse.json({ error: "Routine not found" }, { status: 404 });
    }
    await quizRef.set(
      {
        submission: body.submission,
        result: body.result,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    return NextResponse.json({ ok: true, quizId: body.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/users?id=<quizId>
 * Headers: Authorization: Bearer <Firebase ID token>
 *
 * Removes one saved quiz from the caller's own account.
 */
export async function DELETE(req: Request) {
  const token = await authedUid(req);
  if (!token) {
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
  }

  const id = new URL(req.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing `id` query parameter" }, { status: 400 });
  }

  try {
    const quizzesRef = adminDb()
      .collection("users")
      .doc(token.uid)
      .collection("quizzes");

    // Note whether we're removing the main routine before deleting it.
    const doomed = await quizzesRef.doc(id).get();
    const wasMain = doomed.exists && doomed.data()?.isMain === true;

    await quizzesRef.doc(id).delete();

    // Keep exactly one main: if the deleted routine was main, promote the newest
    // remaining routine.
    if (wasMain) {
      const rest = await quizzesRef.orderBy("createdAt", "desc").limit(1).get();
      if (!rest.empty) {
        await rest.docs[0].ref.set({ isMain: true }, { merge: true });
      }
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * PATCH /api/users
 * Headers: Authorization: Bearer <Firebase ID token>
 * Body: { id: string }
 *
 * Marks the given routine as the account's single "main" routine, clearing the
 * flag on all others. Only one main routine is allowed at a time.
 */
export async function PATCH(req: Request) {
  const token = await authedUid(req);
  if (!token) {
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
  }

  let body: { id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body?.id) {
    return NextResponse.json({ error: "Body must include `id`" }, { status: 400 });
  }

  try {
    const quizzesRef = adminDb()
      .collection("users")
      .doc(token.uid)
      .collection("quizzes");
    if (!(await quizzesRef.doc(body.id).get()).exists) {
      return NextResponse.json({ error: "Routine not found" }, { status: 404 });
    }

    // One main at a time: set the target and clear every other in a single batch.
    const all = await quizzesRef.get();
    const batch = adminDb().batch();
    all.docs.forEach((doc) => {
      batch.set(doc.ref, { isMain: doc.id === body.id }, { merge: true });
    });
    await batch.commit();
    return NextResponse.json({ ok: true, mainId: body.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/users
 * Headers: Authorization: Bearer <Firebase ID token>
 * Body: SaveQuizRequest { submission, result }
 *
 * Verifies the caller's Google sign-in, then upserts `users/{uid}` and appends
 * the completed quiz to `users/{uid}/quizzes`. The uid comes from the verified
 * token, never the body, so a user can only write under their own account.
 */
export async function POST(req: Request) {
  // 1. Authenticate.
  const header = req.headers.get("authorization") ?? "";
  const bearer = header.match(/^Bearer (.+)$/i);
  if (!bearer) {
    return NextResponse.json(
      { error: "Missing or malformed Authorization header" },
      { status: 401 },
    );
  }
  let token: DecodedIdToken;
  try {
    token = await adminAuth().verifyIdToken(bearer[1]);
  } catch {
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
  }

  // 2. Parse and validate the body.
  let body: SaveQuizRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body?.submission || !body?.result) {
    return NextResponse.json(
      { error: "Body must include `submission` and `result`" },
      { status: 400 },
    );
  }

  // 3. Write the user profile and the quiz record.
  try {
    const db = adminDb();
    const userRef = db.collection("users").doc(token.uid);

    // Cap saved routines at 3 per account. Enforced here (creation only) — editing
    // an existing routine goes through PUT and is unaffected.
    const existing = await userRef.collection("quizzes").get();
    if (existing.size >= 3) {
      return NextResponse.json(
        {
          error:
            "You can keep up to 3 saved routines. Delete one from your account to save a new one.",
        },
        { status: 409 },
      );
    }
    // The first routine an account saves becomes its main routine.
    const isFirst = existing.empty;

    const profile = {
      uid: token.uid,
      email: token.email ?? null,
      displayName: token.name ?? null,
      photoURL: token.picture ?? null,
      updatedAt: FieldValue.serverTimestamp(),
    };
    const exists = (await userRef.get()).exists;
    await userRef.set(
      exists ? profile : { ...profile, createdAt: FieldValue.serverTimestamp() },
      { merge: true },
    );

    const quizRef = await userRef.collection("quizzes").add({
      submission: body.submission,
      result: body.result,
      isMain: isFirst,
      createdAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ ok: true, quizId: quizRef.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
