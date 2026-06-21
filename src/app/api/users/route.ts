import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import type { DecodedIdToken } from "firebase-admin/auth";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import type { SaveQuizRequest } from "@/lib/domain/types";

// firebase-admin uses Node APIs — pin this route to the Node.js runtime.
export const runtime = "nodejs";

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
      createdAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ ok: true, quizId: quizRef.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
