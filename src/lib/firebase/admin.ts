/**
 * Server-side Firebase Admin: verify ID tokens and write Firestore.
 *
 * Credentials come from a service-account key (FIREBASE_* env, secret — only in
 * .env.local). The admin SDK bypasses Firestore security rules, so all writes are
 * gated by token verification in the API route, never by the client.
 *
 * Init is lazy (functions, not top-level) so a missing env var fails the request
 * with a clear message rather than crashing the build/import. Env style mirrors
 * {@link file://./../ai/index.ts}'s createProvider().
 */
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

function getAdminApp(): App {
  const existing = getApps();
  if (existing.length) return existing[0]!;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Firebase Admin env is not set. Copy .env.example to .env.local and set " +
        "FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY from " +
        "your service-account JSON.",
    );
  }

  return initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      // In .env the key is one line with literal "\n"; restore real newlines.
      privateKey: privateKey.replace(/\\n/g, "\n"),
    }),
  });
}

export function adminAuth(): Auth {
  return getAuth(getAdminApp());
}

export function adminDb(): Firestore {
  return getFirestore(getAdminApp());
}
