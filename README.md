# SealedSkin

A web service that builds a personalized skincare routine. You take a staged quiz
(skin type → concerns → preferences), get a skin analysis, and receive an AM/PM
routine plus example product picks sourced from live web results.

**Live:** https://sealedskin.vercel.app

> Content is heuristic and for general guidance only — it is not medical advice, and
> the product names shown are examples rather than endorsements.

## Stack

- **Next.js 16** (App Router, Turbopack) + **React 19** + **TypeScript** (strict)
- **Tailwind CSS v4** — design tokens live in an `@theme` block in `src/app/globals.css`
- **Gemini** for the routine engine, behind a model-agnostic provider interface
- **Firebase** — Google sign-in (client) and Firestore via the Admin SDK (server)

## Quick start

```bash
npm install
cp .env.example .env.local   # then fill in the values (see below)
npm run dev                  # http://localhost:3000
```

The app runs without any credentials — it just degrades. Without `GEMINI_API_KEY`
you always get the offline routine logic (labelled "Standard routine · AI
unavailable"), and without the Firebase keys sign-in and saved routines are
unavailable. Everything else works.

| Script | What it does |
| --- | --- |
| `npm run dev` | Dev server on port 3000 |
| `npm run build` | Production build |
| `npm start` | Serve a production build |
| `npm run lint` | ESLint |
| `npx tsc --noEmit` | Typecheck (strict; unused locals fail the build) |

## Environment variables

Copy `.env.example` → `.env.local` (git-ignored) and fill in:

| Variable | Required for | Where to get it |
| --- | --- | --- |
| `AI_PROVIDER` | AI routines | `gemini` (the only provider today) |
| `AI_MODEL` | AI routines | Default model, e.g. `gemini-3.5-flash-lite` |
| `GEMINI_API_KEY` | AI routines + grounding | https://aistudio.google.com/apikey |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Sign-in | Firebase console → Project settings → Web app |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Sign-in | ” |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Sign-in | ” |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Sign-in | ” |
| `FIREBASE_PROJECT_ID` | Saved routines | Project settings → Service accounts → generate key |
| `FIREBASE_CLIENT_EMAIL` | Saved routines | ” |
| `FIREBASE_PRIVATE_KEY` | Saved routines | ” — one line, in quotes, keeping the literal `\n` escapes |

The `NEXT_PUBLIC_*` values are browser-visible identifiers and safe to expose. The
`FIREBASE_CLIENT_EMAIL` / `FIREBASE_PRIVATE_KEY` pair is a service-account secret —
keep it out of the client and out of git.

## How it works

**The quiz** (`src/components/SkinQuiz.tsx`) is a client-side step machine: skin type
(7 diagnostic questions) → concerns and priorities → preferences (commitment level,
region, pregnancy) → a review screen → results.

**Skin-type analysis is local and deterministic** (`src/lib/analysis.ts`) — it scores
answers rather than asking a model, since the result is shown mid-quiz.

**The routine is built by an AI agent** (`src/lib/ai/agent.ts`) in two steps, because
Gemini cannot reliably combine Google Search grounding with structured JSON output in a
single call — with search enabled the JSON comes back corrupted:

1. A **grounded** call returns free-form prose: current products, prices, regional
   availability. This is where the live web data and the source citations come from.
2. A second, **non-grounded** call with a response schema reshapes that brief into
   validated JSON.

**The AI is called first; the local engine is the fallback.** On any failure — missing
key, network error, malformed response — the quiz silently falls back to the offline
logic in `src/data/actives.ts`, so a user is never stuck. Which path ran is tagged on
`RoutineResult.source`.

When a grounded answer is shown, the source links and the Google Search Suggestions
chip are displayed. That is required by Google's grounding terms — don't remove them.

### Layout

```
src/app/          routes: / (quiz), /about, /how-it-works, /profile, /api/*
src/components/   layout, quiz, results, profile, ui
src/data/         quiz content: questions, concerns, actives, products
src/lib/ai/       provider interface, Gemini provider, agent, result assembly
src/lib/firebase/ client sign-in + Admin SDK
```

## Deployment

Deployed on Vercel; pushes to `main` deploy to production and branches get preview
URLs, via the Vercel GitHub App. Set the same environment variables in the Vercel
project — note that `NEXT_PUBLIC_*` values are inlined at **build** time, so changing
one requires a redeploy, not just a restart.

Two things that are easy to miss:

- **Firebase authorized domains.** Every domain that serves sign-in must be listed in
  Firebase console → Authentication → Settings → Authorized domains. Wildcards aren't
  supported, so preview deployments need their specific hostname added before Google
  sign-in will work there.
- **`/api/routine` sets `maxDuration = 60`.** The grounded pipeline takes 9–18s. If that
  budget is lost the failure is silent — routines just quietly become offline ones.

### The `jose` override

`package.json` pins `jose` to `^5.10.0` through `overrides`. `firebase-admin` depends on
`jwks-rsa`, which does a CommonJS `require('jose')`, but jose 6 is ESM-only; since
`firebase-admin` is in Next's default `serverExternalPackages` list it is loaded with
native `require`, which throws `ERR_REQUIRE_ESM` inside a serverless bundle and 500s
every `/api/users` request.

**This is not reproducible locally** — `next dev` and `next build && next start` both
serve the route correctly. Verify anything touching `firebase-admin`, `jose`, or the
externals config on a preview deployment. Remove the override once `jwks-rsa` switches
to a dynamic `import()`.

## Notes for contributors

- Strict TypeScript: unused locals and params fail the build.
- Use the `ss-*` Tailwind utilities (`bg-ss-accent`, `text-ss-ink`, …) rather than raw
  hex. Dark mode re-themes by overriding those tokens in one place, so a raw color
  simply won't adapt.
- Preserve the safety rules in `src/data/actives.ts`: sunscreen and a hydrator are
  always included, and actives flagged `avoidInPregnancy` are filtered out for users who
  are pregnant, planning, or breastfeeding.
- If styles look stale after switching between `next build` and `next dev`, clear the
  Turbopack cache: `rm -rf .next`.
