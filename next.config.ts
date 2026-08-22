import type { NextConfig } from "next";

/**
 * Firebase serves its OAuth handler from `<project>.firebaseapp.com/__/auth/*`,
 * and Google's account chooser names whatever host the OAuth redirect points at
 * — hence "continue to sealedskin-8a59b.firebaseapp.com". Proxying that reserved
 * path through our own domain lets `authDomain` be `sealedskin.com`, so the
 * sign-in screen names the site the user actually knows.
 *
 * The rewrite is inert until three things line up (see .env.example):
 *   1. `https://<domain>/__/auth/handler` is an authorized redirect URI on the
 *      OAuth 2.0 web client in the Google Cloud console,
 *   2. the domain is in Firebase Auth → Settings → Authorized domains,
 *   3. NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN is set to that domain.
 * Until then the env var still points at firebaseapp.com and nothing hits this.
 *
 * Note the proxy must pass POST through untouched: Google returns the OAuth
 * response to the handler as a form POST, which Firebase's page reads from a
 * server-injected POST_BODY.
 */
const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

const nextConfig: NextConfig = {
  async rewrites() {
    if (!projectId) return [];
    return [
      {
        source: "/__/auth/:path*",
        destination: `https://${projectId}.firebaseapp.com/__/auth/:path*`,
      },
    ];
  },
};

export default nextConfig;
