/**
 * Browser-side Firebase: Google Authentication.
 *
 * Uses the public web config (NEXT_PUBLIC_FIREBASE_*) — these are safe to ship to
 * the client; they're identifiers, not secrets. Access to data is protected by
 * Firebase Auth + locked-down Firestore rules (writes go through /api/users).
 *
 * Init is lazy and HMR-safe (reuses the existing app instance) so this module is
 * harmless if it's ever imported during SSR — nothing runs until you call
 * {@link signInWithGoogle}.
 */
import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type Auth,
  type User,
} from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

function getFirebaseApp(): FirebaseApp {
  return getApps().length ? getApp() : initializeApp(firebaseConfig);
}

export function getFirebaseAuth(): Auth {
  return getAuth(getFirebaseApp());
}

export interface GoogleSignInResult {
  user: {
    uid: string;
    email: string | null;
    displayName: string | null;
    photoURL: string | null;
  };
  /** Firebase ID token (JWT) to send as `Authorization: Bearer <token>`. */
  idToken: string;
}

/** Error code Firebase throws when the user closes the popup without signing in. */
export const POPUP_CLOSED = "auth/popup-closed-by-user";

/** Open the Google sign-in popup and return the user plus a fresh ID token. */
export async function signInWithGoogle(): Promise<GoogleSignInResult> {
  const provider = new GoogleAuthProvider();
  const cred = await signInWithPopup(getFirebaseAuth(), provider);
  const idToken = await cred.user.getIdToken();
  return {
    user: {
      uid: cred.user.uid,
      email: cred.user.email,
      displayName: cred.user.displayName,
      photoURL: cred.user.photoURL,
    },
    idToken,
  };
}

/** Subscribe to auth state changes. Returns an unsubscribe function. */
export function watchAuth(cb: (user: User | null) => void): () => void {
  return onAuthStateChanged(getFirebaseAuth(), cb);
}

/** Sign the current user out. */
export async function signOutUser(): Promise<void> {
  await signOut(getFirebaseAuth());
}

/** ID token for the already-signed-in user, or null if nobody is signed in. */
export async function getCurrentIdToken(): Promise<string | null> {
  const user = getFirebaseAuth().currentUser;
  return user ? user.getIdToken() : null;
}
