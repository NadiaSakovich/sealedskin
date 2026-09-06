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

/**
 * The canonical origin. Duplicated from `src/lib/seo.ts` rather than imported:
 * next.config is evaluated before the `@/*` path alias exists, and a config file
 * is the one place where a repeated constant beats a fragile import. Keep the
 * two in sync - `SITE_URL` there is what the canonical tags emit.
 */
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.sealedskin.com").replace(/\/+$/, "");

/**
 * Vercel's auto-assigned production alias serves the whole site on its own host,
 * so `sealedskin.vercel.app` is a complete duplicate of the real domain -
 * indexable, with no `x-robots-tag` of its own. The canonical tags point at the
 * real domain, which is usually enough, but a 308 settles it outright and moves
 * any link equity across.
 *
 * The host is matched EXACTLY, which is what keeps preview deployments working:
 * those are `sealedskin-git-<branch>-<scope>.vercel.app` and do not match. Dots
 * are escaped because `has.value` is a regular expression.
 *
 * This is a `redirects()` entry rather than proxy/middleware on purpose - Vercel
 * compiles these into its routing layer, so it costs no function invocation.
 */
const vercelAliasRedirect = {
  source: "/:path*",
  has: [{ type: "host" as const, value: "sealedskin\\.vercel\\.app" }],
  destination: `${SITE_URL}/:path*`,
  permanent: true,
};

const nextConfig: NextConfig = {
  async redirects() {
    return [vercelAliasRedirect];
  },

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
