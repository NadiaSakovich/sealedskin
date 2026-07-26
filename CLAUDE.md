@AGENTS.md

# SealedSkin

A web service that builds a personalized skincare routine. The user takes a
staged quiz (skin type → concerns → preferences), gets a skin analysis, and
receives an AM/PM routine plus example product picks.

## Stack

- **Next.js 16.2.7** (App Router, **Turbopack**) — note the AGENTS.md warning:
  this Next major has breaking changes vs. older training data.
- **React 19**, **TypeScript** (strict), **Tailwind CSS v4**.
- Import alias `@/*` → `./src/*`.
- Run: `npm run dev` (port 3000). Build: `npm run build`. Typecheck: `npx tsc --noEmit`.

## How the app is organized

- `src/app/page.tsx` — renders `<SkinQuiz />` (the whole experience).
- `src/app/{about,how-it-works}/page.tsx` — static content routes (server components) shown from
  the header nav. They use `ContentShell` (header + reading column, no quiz progress rail).
- `src/app/profile/page.tsx` — the **user profile** route (server component → renders the client
  `components/profile/ProfileView`, also in `ContentShell`). Shows the signed-in user's Google
  identity (photo/name/email) and their **saved routines** list; reached from the header account
  dropdown ("Your profile") — see "User profile" below.
- `src/app/layout.tsx` — root layout + metadata (no font loaders; fonts come from `globals.css`).
  Also runs an inline **no-flash theme script** in `<head>` that adds `.dark` to `<html>` before
  first paint; `<html>` carries `suppressHydrationWarning` (see Dark mode below).
- `src/app/globals.css` — Tailwind v4 entry. Design tokens live in an `@theme` block (see Tokens below).
- `src/lib/firebase/**` — `client.ts` (Google sign-in), `useAuth.ts`, `admin.ts`. Auth surfaces in
  the header via `AccountControl`; results can be saved (`SaveRoutine` → `POST /api/users`,
  guarded by `firestore.rules`). `GET /api/users` reads them back for the profile page.
- `src/components/SkinQuiz.tsx` — **the core**: a `"use client"` step machine keyed off an
  integer `step`. Constants `S2_*`, `S3_*`, `R_*` define screen order; add a screen by
  inserting a constant + a render branch + wiring `go()`. All child components are client
  components automatically (imported under this `"use client"` boundary).
- `src/components/{layout,quiz,results,ui}/**` — presentational components.
- `src/data/*.ts` — quiz content: `questions.ts`, `concerns.ts`, `goals.ts`, `actives.ts`
  (ingredient catalog + `recommendActives`/`buildRoutine`), `products.ts`.
- `src/lib/analysis.ts` — pure `analyzeSkin()`; scores skin type from question `signal`s.
  Depends on question ids `after_cleanse`, `midday_shine`, `pores`, `tightness`,
  `end_of_day`, `sensitivity` — don't rename without updating this.
- `src/lib/editSession.ts` — a `sessionStorage` handoff (`stashEditQuiz`/`takeEditQuiz`) used to
  reopen a **saved** routine inside the quiz for review/edit: the profile stashes the saved
  `{ id, submission, result }` and navigates to `/?edit=1`; `SkinQuiz` reads it on mount (see
  "Saved-routine review hub" under User profile).
- `src/types.ts` — shared domain types for the quiz/logic (the design's types).

## AI routine engine (wired into the UI)

The routine-building engine is an AI model, model-agnostic so the model can be swapped
(currently **Gemini**). It drives the live quiz's analysis/routine:

- `src/lib/ai/types.ts` — `LLMProvider` interface (`generate(messages, opts)` → `GenerateResult`
  `{ text, grounding? }`), `ChatMessage`, `GroundingInfo`/`GroundingSource`. `GenerateOptions`
  carries `grounding?: boolean` and `thinkingBudget?: number`.
- `src/lib/ai/providers/gemini.ts` — `GeminiProvider`, a thin REST wrapper (no SDK). Default model
  `gemini-3.5-flash-lite`. `grounding: true` adds `tools: [{ google_search: {} }]` (model decides
  whether to search); `thinkingBudget` maps to `generationConfig.thinkingConfig.thinkingBudget`
  (0 disables thinking). `parseGrounding()` normalizes `groundingMetadata` → sources/chip/queries.
- `src/lib/ai/index.ts` — `createProvider(modelOverride?)` factory reading env (`AI_PROVIDER`,
  `AI_MODEL`, `GEMINI_API_KEY`). Add a new vendor = new file + a case here.
- `src/lib/ai/agent.ts` — `buildRoutine(provider, answers)` → `{ output, grounding }`, run as a
  **two-step pipeline** (see below).
- `src/lib/ai/result.ts` — `buildAiResult()` / `buildLocalResult()` → a unified `RoutineResult`
  ({ `source: "ai" | "local"`, profile, analysis, picked, routine, productsByType, grounding? })
  that the four results screens render.
- `src/lib/domain/types.ts` — `QuizAnswer`, `AiRoutineOutput`, `SkincareRoutine`, `SaveQuizRequest`,
  `UserRecord` (the AI/persistence contract; distinct from the design's `src/types.ts`).
- `src/app/api/routine/route.ts` — `POST /api/routine` { answers, model? } → { output, grounding?,
  model }. Node runtime; `ALLOWED_MODELS` whitelists which models the client may request (else falls
  back to the env/provider default — the client can't force an arbitrary model).
- `.env.example` — copy to `.env.local` and set `GEMINI_API_KEY` (get one at
  https://aistudio.google.com/apikey). `.env.local` is git-ignored.

**The quiz calls the AI first, with the local logic as the fallback.** On "Build my routine",
`SkinQuiz.startBuild()` POSTs to `/api/routine`; on **any** failure (missing key, network, bad
response) it soft-falls-back to the design's LOCAL logic (`recommendActives`/`buildRoutine` in
`src/data/actives.ts`) via `buildLocalResult`, so the user is never stuck — the chosen path is
tagged on `RoutineResult.source`. `ModelPicker` (atop each results screen) switches model and
rebuilds; `GroundingSources` renders Gemini grounding when present. Without `GEMINI_API_KEY` set,
you always get the local fallback (tagged "Standard routine · AI unavailable").

### Two-step agent (the key constraint)

Gemini **cannot reliably combine Google Search grounding with structured JSON (`responseSchema`)
in one call** — with `google_search` on, the JSON gets corrupted (e.g. the array opening after
`"ingredients":` is dropped), on **both 2.5 and 3.x**. So `agent.ts` splits the work:

1. **Grounded research → PROSE.** A grounded `generate()` (`grounding: true`) asks for a free-form
   brief (current products/prices, region availability, recent ingredient guidance). Grounding does
   NOT corrupt prose, and this is where the live web data + the `grounding` metadata (sources +
   Search Suggestions chip) are captured. Capped at `thinkingBudget: 512` — a small budget still
   triggers searches but is ~30% faster than uncapped thinking.
2. **Structure → JSON.** A second, **non-grounded** `generate()` with `responseSchema` (the
   `OUTPUT_SCHEMA` mirroring `AiRoutineOutput`) reshapes the brief into clean JSON, with thinking as
   low as the models allow (`MIN_THINKING_BUDGET = 1` — see the gotcha below; it used to be 0).
   `parseRoutineJson()` strips code fences + tolerates stray control chars via `sanitizeJson()`.

The grounding shown in the UI comes from step 1; the structured routine comes from step 2.

**Latency/behaviour observed:** `gemini-3.5-flash-lite` (default) ≈11s and *does* ground (≈5 sources
+ chip — an improvement on the old `3.1-flash-lite`, which usually returned 0); `gemini-3.6-flash`
≈18s with the 512 cap and grounds more richly (≈13 sources + chip). Grounding is non-deterministic — the model decides per request. **Skin-type analysis stays
LOCAL** (`analyzeSkin`), since it's already shown mid-quiz in `AnalysisView`; the AI only produces
ingredients, routine (am/pm/notes), and grounded product picks.

**Grounding ToS:** when a grounded answer is shown you MUST display the source links AND the Search
Suggestions chip (`GroundingSources` renders `grounding.searchSuggestionHtml` via
`dangerouslySetInnerHTML`) — required by Google's grounding terms.

`ModelPicker` is **TEMPORARY** (`// TEMPORARY` marked) — a dev switch between the two models so the
user can compare; to be removed once one model is chosen.

## Quiz flow (current)

1. **Stage 1 — Skin type:** 7 diagnostic questions (after_cleanse, midday_shine, pores,
   tightness, sensitivity, end_of_day, age).
2. **Stage 2 — Concerns:** pick concerns → priority step (choose **up to 3** that matter most).
3. **Stage 3 — Preferences:** commitment level (minimal/balanced/thorough) → region →
   pregnancy/nursing.
4. **Finale** ("Your skin profile is ready"): review card with **edit** links on Skin type,
   Concerns, and Routine sections → "Build my routine". The round accent badge/icon that used to
   sit above the heading was **removed** — now just the "Profile complete" eyebrow + heading. When
   opened from a **saved** routine the finale becomes a **review hub** instead (see "Saved-routine
   review hub").
5. **Results:** Needs summary → Ingredients → AM/PM Routine → Shop.

`RoutineView` takes a `minimal` prop (`commitment === "minimal"`). When set, its **"Good to know"**
card leads with a double-cleanse tip ("If you apply SPF in the morning, it's worth double cleansing
at night…") prepended to `routine.notes` — a minimal routine keeps a single evening cleanse, so this
fills the gap. The card now renders whenever `notes.length > 0` (so the tip shows even if the AI
returned no other notes).

### The minimal-routine shape (a hard rule, both paths)

A "minimal" commitment isn't just *fewer serums* — it has a fixed shape, applied to the AI and the
offline routines alike:

- **At most `MINIMAL_MAX_STEPS` (3) steps in AM and 3 in PM.**
- **The morning ends on ONE combined `MOISTURISING_SPF_STEP`** ("Moisturising sunscreen"): splitting
  moisturiser and SPF into two steps is redundant when the point is fewer steps, but SPF is never
  dropped — so they merge rather than either one going.
- **A single evening cleanse** (no double cleanse), which is what the "Good to know" tip above covers.

Where it lives:
- `data/actives.ts` exports the shared rules — `MINIMAL_MAX_STEPS`, `MOISTURISING_SPF_STEP`, and
  `capMinimalSteps()` (trims to 3, always keeping the first step (cleanse) and last (moisturise /
  protect), dropping optional middle treatments). The local `buildRoutine` emits the combined step
  directly for minimal and caps both halves.
- `lib/ai/agent.ts` — `MINIMAL_RULES` is appended to **both** system prompts when `wantsMinimal()`
  sees the commitment answer, so the grounded research looks for hydrating SPFs and the structuring
  step keeps the shape.
- `lib/ai/result.ts` — `applyMinimalShape()` **enforces** it on the AI output: folds the moisturiser
  and SPF steps into the combined one (re-keying `productsByType` so the shop resolves it exactly),
  adds the SPF step if the model omitted it entirely, and caps both halves. `splitStep` also
  *collapses* a lumped "Double cleanse" to a single `Cleanser` (preferring the water-based picks)
  instead of splitting it in two, which is the opposite of the non-minimal behaviour.

The prompt and the enforcement are both needed: the prompt gets the right *products* (hydrating SPFs
rather than bare sunscreens, which the enforcement can't retrofit), the enforcement guarantees the
*shape*. Same division of labour as the double-cleanse split.

Note: the pregnancy question lives in `src/data/questions.ts` (id `pregnancy`) but is rendered
in Stage 3, not Stage 1 — `SkinQuiz` splits `SKIN_QS` (everything except pregnancy) from
`PREG_Q`. `analyzeSkin`/`buildProfile` still read it from the full `QS` list via `answers`.

## Design source / Tailwind tokens

- The UI was **ported from a Vite + React 18 + Tailwind 3 export** kept at
  `design-incoming/sealedskin-react/` (excluded from tsconfig; it's a visual/logic reference,
  not part of the build). Its `reference/SealedSkin-prototype.html` shows the intended look.
- During the port, Tailwind v3's `tailwind.config.ts` tokens were moved into a Tailwind v4
  `@theme {}` block in `globals.css`: colors as `--color-ss-*` / `--color-caution-*`
  (→ `bg-ss-accent`, `text-ss-ink`, `border-ss-hairline`, …) and fonts as
  `--font-head/body/mono`. Google Fonts are loaded via an `@import url(...)` at the top of
  `globals.css`. Keep using the `ss-*` utility classes, not raw hex.

## Dark mode

- Light + dark are the same palette; dark just overrides the tokens. A `:root.dark { … }` block in
  `globals.css` redefines every `--color-ss-*` / `--color-caution-*` variable (darker/inverted),
  so **every `ss-*` utility re-themes from that one block** — components need no per-color changes.
  Add new colors as tokens (with a `.dark` value), not raw hex, or they won't adapt.
- `.dark` is toggled on `<html>` by `components/layout/ThemeToggle.tsx` (in the header, desktop +
  mobile). It persists to `localStorage["ss-theme"]` and falls back to `prefers-color-scheme`.
  The no-flash script in `layout.tsx` applies the class before first paint.

## Site header & nav

- `components/layout/SiteHeader.tsx` — the brand (logo + "SealedSkin" word) links to `/`; nav items
  are `next/link`s to `/how-it-works` and `/about` with active-state styling (via `usePathname()`).
  (The old "Ingredients" nav item was removed.) Hosts `ThemeToggle` + `AccountControl`. **Brand click
  on the home route resets the quiz:** `/` *is* the quiz step machine, so a plain `Link` to `/` while
  already there is a no-op; `Brand` special-cases `pathname === "/"` to `preventDefault()` +
  `window.location.assign("/")`, forcing a fresh load back to the landing/start (from other routes it
  navigates normally via the SPA).
- The quiz uses `Shell` (header + progress rail); content routes use `ContentShell` (header only).
- `AccountControl`'s signed-in dropdown has a **"Your profile"** `next/link` (→ `/profile`) above
  "Sign out".

## User profile

- **Route:** `/profile` (`src/app/profile/page.tsx`) → `components/profile/ProfileView.tsx`
  (`"use client"`), inside `ContentShell`. Auth-gated by `useAuth`: signed-out shows a Google
  sign-in prompt; signed-in fetches `GET /api/users` and renders the profile + saved routines.
- **API (`route.ts`, all token-verified via `authedUid`):** `GET` returns `{ profile, quizzes }` —
  the user's saved quizzes from `users/{uid}/quizzes`, newest first, with the Firestore `createdAt`
  Timestamp converted to **epoch millis** (serializable) and an `isMain` boolean per quiz. `POST`
  creates a new saved routine; `PUT` (body carries `id`) **updates one in place** (used when editing
  a saved routine); `PATCH` (body carries `id`) **sets that routine as the single main routine**
  (clears `isMain` on all others in one batch); `DELETE` (`?id=` query param) removes one. All go
  through the Admin SDK server-side, so `firestore.rules` stays **deny-all** (no client Firestore
  access).
- **Max 3 routines + one "main" (`isMain`):** an account may keep **at most 3** saved routines.
  `POST` enforces this server-side — a 4th returns **HTTP 409** with a friendly message; `SaveRoutine`
  special-cases 409 into a "you've reached 3 saved routines" panel (with a link to the account) that
  offers **both** ways forward — *delete one to free a slot, or update an existing routine instead*
  (since after deleting there's no automatic route back to the unsaved routine) — rather than a
  generic error. Editing (`PUT`) is exempt. Exactly one routine is **main**:
  the **first** save becomes main; `PATCH` promotes any other (only one main at a time); deleting the
  main **auto-promotes the newest remaining**; `GET` treats the newest as main if none is flagged
  (legacy saves). `ProfileView` shows a **"Main routine"** badge (accent border + a filled star
  icon — the star reuses `Chips.tsx`'s proven `0 0 12 12` path, not a hand-rolled 24-grid one) on
  the main and a **"Set as main"** action on the others, plus an **"Up to 3 saved routines"** note
  (static, not a live "N of 3" count) and an at-limit note.
- **List:** routines render as cards **titled by skin type** with the **commitment level**
  (Minimal/Balanced/Thorough, via `commitmentLabel()` from `submission.commitment`) as the accent
  detail — e.g. **"Combination skin · Balanced"** (NOT "Routine N"; the small numbered circle badge
  is still list position). Older saves with no stored commitment show the skin type alone. Cards
  also show top concerns + save date, a **delete** action (`handleDelete` → `DELETE /api/users`),
  and a footer showing the **main-routine badge** or a **"Set as main"** button (`handleSetMain` →
  `PATCH /api/users`). Clicking a card
  **opens it back in the quiz** for review/edit (`handleOpen` → `stashEditQuiz` +
  `router.push("/?edit=1")`); there is no longer a separate read-only detail component (the old
  `SavedRoutineDetail.tsx` was removed; the `SavedResult` type now lives in
  `components/profile/types.ts`).
- **"Profile" vs "Account" naming:** the `/profile` route/dir/component names are unchanged, but the
  **user-facing** account label is now **"Account"** (not "Profile"), to avoid confusion with the
  **skin** profile ("Your skin profile is ready"). Account/nav labels also read **"My …"** (My
  account, ← Back to my account, My routines); results/routine screens keep **"Your …"** ("Your
  everyday routine", the "Your routine" eyebrow). Skin-profile copy is left as-is.
- **Richer saved snapshot:** `QuizResultSnapshot` (`lib/domain/types.ts`) also carries optional
  `source`, `picked` (ingredients), `productsByType`, and `grounding`; `SkinQuiz.startBuild`'s save
  payload passes them, so a reopened routine renders as fully as the live results (and shows the
  **exact products as saved**, not re-fetched). The new fields are optional/guarded, so older saves
  (routine-only) still render.

### Saved-routine review hub

Opening a saved routine reuses the quiz instead of a separate viewer. `ProfileView` stashes the
`{ id, submission, result }` (`stashEditQuiz`) and navigates to `/?edit=1`; `SkinQuiz`'s mount
effect calls `takeEditQuiz()`, restores the answers + result, sets `editingId` (so a later save
PUTs in place), snapshots the loaded submission as `editOriginal`, and lands on the **finale**.

- **`FinaleScreen` gains an optional `review` prop** (`ReviewControls`). With it, the finale stops
  being a one-shot "Build my routine" and becomes a hub with two stages:
  - `stage: "landing"` — three buttons: **Review routine** (→ results screens, no rebuild),
    **Review & edit quiz** (walks the quiz from step 1), **Back to profile**.
  - `stage: "editing"` (set once the user enters quiz editing via any edit link) — the CTA is
    **Rebuild my routine** if answers changed, else **Show my routine** (shows the saved result, no
    AI rebuild).
- **Change detection — two independent ways a saved routine can drift:**
  1. **Answers changed** — `submissionChanged(editOriginal, current)` in `SkinQuiz`
     (order-independent for the concern arrays). Also drives the finale's rebuild-vs-show CTA.
  2. **Routine regenerated** — `rebuildCount > 0`, incremented by every `startBuild()`. A
     **model switch** rebuilds the routine without touching a single answer, so the saved copy is
     stale even though `submissionChanged` is false. Counts the AI-failure path too, since the stored
     result still changes (to a locally built one).

  The Shop page offers to save when `!editingId || reviewChanged || reviewRebuilt`. A pure review
  (nothing changed, nothing rebuilt) shows **no** save section; a fresh quiz always shows "Save your
  routine". Both saved-routine cases PUT (update in place) — only the wording differs, via
  `SaveRoutine`'s `rebuiltOnly` prop: "Save this version / You just rebuilt this routine…" instead of
  "Save your changes". `SaveRoutine` is **keyed by `rebuildCount`** while editing, so its internal
  "Updated ✓" state resets on each rebuild and a second regeneration can be saved in turn.
  `rebuildCount` resets on "Start over".
- **`Shell` gains `onBackToProfile`** — while editing a saved routine (`editingId` set), every quiz
  and results screen shows a persistent "← Back to profile" link in the header band.
- **Profile photo** uses a plain `<img>` (Google `lh3.googleusercontent.com` avatar, with an
  `eslint-disable @next/next/no-img-element`) to avoid adding `next.config` `remotePatterns`.
- **Gotcha — `react-hooks/set-state-in-effect`:** the ESLint 9 config (and `next build`) flags
  synchronous `setState` reached from an effect, and it traces *through* called functions, so even a
  fetch helper that defers all `setState` until after its first `await` trips it. `ProfileView`'s
  fetch-on-auth-change effect carries a targeted `// eslint-disable-next-line` for this (a legit
  external-sync effect). Signed-out state is handled by a render guard, not by clearing state in the
  effect.

## Shop product sourcing (real-time, with offline fallback)

Product picks on the Shop screen must be **real-time** — taken from the AI's grounded research, not
a hardcoded list. The flow (`components/results/ShopView.tsx`):

- **Live AI routine** → shows **ONLY** the grounded picks the model just returned
  (`RoutineResult.productsByType`, keyed by routine-step `type`). The static catalog is **never**
  used to top these up — an earlier "always show 3" fix that padded from the catalog was the bug that
  leaked off-region brands (e.g. The Ordinary/CeraVe into a K-beauty routine) and was removed.
- **Offline fallback** (`source: "local"` — no `GEMINI_API_KEY`, network error, or failed call, so
  `productsByType` is absent) → and **only then** → the static catalog `src/data/products.ts`
  (`productsForStep` → `slotForStep` + `selectProducts`, region-aware). This is the one place the
  catalog still feeds the UI; it's kept purely as a reliability backstop.
- **Tolerant step matching:** the model's `stepType` doesn't always string-match the routine step's
  `type` ("Gentle Cleanser"/"Face Wash" vs "Cleanser"), which used to silently drop a step's picks.
  `ShopView.resolve` now matches by normalised type first, then by a **coarse step family** derived
  from `slotForStep` (all cleanser slots → "cleanser", all moisturiser slots + nightcream →
  "moisturizer", SPF → "spf"; actives like vitc/niacinamide stay their own family so a Vitamin C step
  never grabs niacinamide products). `slotForStep` was also hardened to recognise label variants
  ("cleansing"/"wash"/"cleansing oil", "sun cream"/"spf"/standalone "sun").
- **No silent omission:** if a step truly has no picks, `ShopStep` still renders the step header with
  a plain note rather than disappearing, so the Shop page always mirrors the routine.
- **Double cleanse is always two steps.** The AI sometimes emits a single "Double cleanse" step and
  hangs a MIX of oil + water cleansers off it (confusing on the shop page). `buildAiResult`
  (`result.ts`) detects any step whose type matches `/double\s*cleans/i` and splits it into two —
  **"Oil cleanser or balm"** + **"Water-based cleanser"** — then partitions that step's grounded
  products between them by name (`OIL_CLEANSER_RE` → oil/balm step, the rest → water step), setting
  BOTH new `productsByType` keys (even if empty) so the shop's tolerant matcher resolves each split
  step exactly and never cross-fills. Both AI prompts (`agent.ts`) also ask for two separate cleanse
  steps, but the `buildAiResult` split is the guarantee. The local `buildRoutine` already split the
  PM double cleanse into two steps.
- The intro copy says "**A few** picks at different budgets per step" (not "Three") since live counts
  depend on what grounding returns.
- **Tiers come from absolute price bands.** The source tier labels — whether AI-assigned or from the
  static catalog — are unreliable (a "Mid" can cost more than a "Premium"). So `ShopView.resolve`
  **relabels** by price: `tierForPrice(price)` assigns **Budget ≤ $20**, **Mid ≤ $35**, **Premium**
  above (unparseable prices read as Premium). `priceValue` parses `$/£/€`, commas, and ranges → first
  number. Picks are still sorted cheapest→priciest for display order, but each pick's tier is its own
  band, so labels are consistent across steps for **both** the live AI picks and the offline catalog.
- **Labels:** the routine screen CTA reads "**See recommended products**" (`RoutineView`), and the
  shop screen heading is "**Products for your routine**" (`ShopView`).
- `products.ts` catalog depth: every **common** routine slot has ≥3 options per major region
  (asia/us/eu) so the offline fallback can honour a region preference without borrowing off-region
  brands; niche actives (azelaic/benzoyl/squalane/cica) may still mix, matching the "leaning toward
  {region}" copy. The grounded prompt (`agent.ts`) also asks for exactly three picks per step and to
  strongly favour the user's stated region.

**Saved routines are the exception:** a reopened saved routine shows the products **as saved**
(`productsByType` from its snapshot), not re-fetched — so an old save keeps its original (possibly
pre-fix) picks until rebuilt.

## Quiz imagery

- `ui/PhotoSlot.tsx` renders a real image (`next/image`, `fill` + `object-cover`) when given a
  `src`, else the striped placeholder. Where it's used: the two quiz intros (`SkinQuiz.tsx`) and
  the concern tiles (`ConcernGrid.tsx`, both the grid `16/10` and priority `1/1`).
- Images live in `public/quiz/` — `intro-skin-1.jpg`/`-2`/`-3` (the Stage-1 hero **rotates**: one
  of the three is picked at random per page load — `INTRO_SKIN_IMAGES` in `SkinQuiz`, chosen in an
  effect so SSR always renders index 0 and there's no hydration mismatch), `intro-concerns.jpg`, and
  `concern-<id>.jpg` (id matches `SKIN_CONCERNS[].id`, so the path is derived, not stored). All
  **Gemini-generated** (`gemini-3.1-flash-image`, 1:1), one cohesive sage-green editorial set,
  downscaled to 512px JPEG (~35–55KB each). `concerns.ts`'s `photo` field is now unused (alt text
  comes from `label`); kept harmlessly.
- To regenerate/extend: a small REST loop hitting
  `POST v1beta/models/gemini-3.1-flash-image:generateContent` with
  `generationConfig.imageConfig.aspectRatio` (needs **v1beta** — `v1` rejects `imageConfig`/
  `responseModalities`), `x-goog-api-key: $GEMINI_API_KEY`, image bytes at
  `candidates[0].content.parts[].inline_data.data` (base64). Then `sips -Z 512` into `public/quiz/`.

## Content-page imagery

- `ui/PageBanner.tsx` — a **21:9** full-column banner (`next/image` `fill` + `object-cover`,
  `priority`, rounded + hairline border) used by the two content routes. 21:9 was chosen so the
  banner spans the 680px reading column but stays ~2.3× shorter than it is wide (≈680×291 rendered).
- Images live in `public/pages/` — `how-it-works.jpg` (a woman smiling at her reflection in a bright
  minimal bathroom — the quiz's woman, happy, in an interior) and `about-cosmetics.jpg` (unlabelled
  bottles on a limestone ledge with eucalyptus and calendula petals; no brand names by design).
  Both **Gemini-generated** (`gemini-3.1-flash-image`, `aspectRatio: "21:9"`), same sage/warm-cream
  editorial look as `public/quiz/`, downscaled to 1360px wide (2× the column) JPEG ~130–140KB.
- Placement: on `/how-it-works` between the intro paragraph and the numbered steps; on `/about`
  between the intro paragraph and "What we believe".

## Conventions & gotchas

- **Strict TS** — no unused locals/params; build fails otherwise.
- **Turbopack stale cache:** if styles look wrong (e.g. tokens not applying / old classes
  served), the `.next` cache can be stale — `pkill -f "next dev"; rm -rf .next; npm run dev`.
  This bit us after running `next build` then `next dev`.
- **Next image-optimizer stale variant:** after overwriting a file in `public/` (e.g. regenerating
  a quiz image), the dev server keeps serving the OLD optimized image. It caches per `Accept`
  header, so the browser's webp/avif variant survives a plain dev restart AND even
  `rm -rf .next/cache/images`. Fix that actually works: full `rm -rf .next` + restart. (Production
  builds optimize fresh, so this is dev-only. Verify with `curl -H "Accept: image/webp" <_next/image url>`.)
- Don't run `next build` while `next dev` is running (shared `.next` → conflicts).
- Buttons go through `ui/Button.tsx` (`variant="primary" | "ghost"`); the primary CTA has the
  `bg-ss-accent` class (handy selector for E2E driving).
- Preserve the safety logic in `actives.ts`: SPF + a hydrator are always included; actives
  flagged `avoidInPregnancy` are filtered out for pregnant/planning/breastfeeding. Product
  brands are examples, not endorsements; content is heuristic, not medical advice.
- **Don't merge grounding + `responseSchema` into one Gemini call** — it corrupts the JSON (see
  "Two-step agent"). Keep grounded prose and JSON structuring as separate `generate()` calls.
- **`thinkingBudget: 0` is rejected by the current models.** `gemini-3.5-flash-lite` and
  `gemini-3.6-flash` 400 (`INVALID_ARGUMENT`) on a thinking budget of exactly 0 — thinking can't be
  switched off on them (older `3.1-flash-lite`/`3.5-flash` allowed it). Any budget ≥ 1, or `-1`
  (dynamic), is fine; `agent.ts` uses `MIN_THINKING_BUDGET = 1` for the structuring step. Symptom if
  this regresses: every routine silently falls back to the local logic, since `/api/routine` 500s.
  `thinkingLevel` (`low`/`medium`/`high`) is NOT accepted on these models via v1beta — use the
  numeric budget.
- **AI latency:** a grounded `gemini-3.6-flash` route is ~18s; mind serverless function
  timeouts when deploying. Levers if needed: trim the brief, request fewer products, lower the
  research `thinkingBudget` further.
- The two-step prompts/safety rules live in `agent.ts` (`SAFETY_RULES` is shared by both steps so
  the grounded brief is safe AND the structuring step preserves that safety).

## Verifying UI changes (Playwright)

No browser tooling is installed in-repo. We drive the app with **Playwright + the system
Google Chrome** from a throwaway dir to keep project deps clean:

- `npm i playwright` was installed under `/tmp/ss-pw/` (not in package.json).
- Scripts use `chromium.launch({ channel: "chrome" })` and `fullPage` screenshots to `/tmp`.
- Drive pattern: primary CTA = `button.bg-ss-accent`; answer cards = `button.appearance-none`;
  concern/goal/commitment options have `aria-pressed`. Note the content-page CTAs (`CtaLink`) are
  `<a>` not `<button>` (`a.bg-ss-accent`); the dark-mode switch is `button[aria-label="Toggle dark
  mode"]`; nav is `header nav a`.
- Playwright in `/tmp/ss-pw/` can get corrupted (missing `package.json`); if `import` fails, just
  re-run `npm i playwright` there. Soft (Link) navigations need `waitForURL`, not bare `p.url()`.
- After a change, run `npx tsc --noEmit` and a screenshot drive; check `console --errors`.

## Repository & git

- Hosted at **https://github.com/NadiaSakovich/sealedskin** (public). Owner username is
  **NadiaSakovich** (renamed from `NadzeyaSakovich`). The account **ID is stable** (`5446710`), so
  `gh` auth and the ID-based noreply email keep working across the rename; the `origin` URL and
  commit identity were repointed to the new username (don't rely on GitHub's old-username redirect).
- Auth is the **`gh` CLI over HTTPS** (installed via Homebrew; not a repo dependency). Push/pull use
  gh's git credential helper — no SSH keys. `gh auth login` must be run in a real terminal (the
  interactive prompts don't work through the in-session `!` runner).
- Commit identity is set **repo-locally** to the GitHub username + the account's `noreply` email
  (`5446710+NadiaSakovich@users.noreply.github.com`) so the personal email stays out of public
  history. The global git identity is intentionally left empty/untouched.
- `.gitignore` decisions: `.env*` stays ignored **except `!.env.example`** (committed template, no
  secrets); `design-incoming/` and `.claude/settings.local.json` are ignored. `.env.local` (the
  real Gemini + Firebase keys) is never committed — confirmed absent from the remote.

## Work done this session

1. Scaffolded the Next.js project (TS, Tailwind v4, App Router, Turbopack).
2. Stood up the model-agnostic AI agent foundation (Gemini provider, `/api/routine`) — not yet
   connected to the UI.
3. **Ported the full design** from `design-incoming/` into the app: copied data/logic/components
   verbatim (relative imports preserved), migrated Tailwind v3 config → v4 `@theme`, added the
   `"use client"` boundary, replaced boilerplate `page.tsx`/`layout.tsx`. Fixed two latent
   strict-mode bugs (duplicate `key` spread in `AnalysisView`; locked-config comparison in
   `SkinQuiz`).
4. UI fixes:
   - Step-1 answer cards: removed an extra inset shadow so their selected border matches the
     concern/goal/commitment tiles (`AnswerCard.tsx`).
   - Scroll-to-top on every screen change (Back/Continue) via the shared `Screen` effect.
   - Routine step circles: made all uniform (removed the darker SPF-only circle in `RoutineView`).
5. **Removed the concerns/goals redundancy** (goals largely mirrored concerns): dropped the goals
   grid; Stage 3 is now **Preferences** (commitment + region). `recommendActives` no longer
   receives goals (`goalIds: []`). Updated copy (`AnalysisView` "Continue to Preferences"),
   `Shell` stage label, and removed the Goals section from `FinaleScreen`.
6. **Moved the pregnancy question** from Stage 1 to Stage 3 (Preferences).
7. Priority step now allows **up to 3** top concerns (was 2); `analysis.ts` prose lists all of them.
8. Added an **edit link to the Routine section** of the finale (→ commitment step).
9. Fixed commitment scaling: **AM routine now scales with commitment** (minimal 0 serums /
   balanced 1 / thorough up to 3) and minimal PM single-cleanses, so both AM and PM respond to
   the "How involved…" choice.
10. **Wired the AI engine into the UI** (supersedes #2's "not yet connected"): "Build my routine"
    now calls `/api/routine` (Gemini, with grounding) and renders the result, with the local logic
    as a soft fallback (`result.ts`, `ModelPicker`, `GroundingSources`). Added Firebase auth
    (header `AccountControl` Google sign-in) + routine saving (`SaveRoutine` → `/api/users`,
    `firestore.rules`).
11. **Added dark mode**: `:root.dark` token overrides in `globals.css`, the no-flash script in
    `layout.tsx`, and a header `ThemeToggle` (persists to `localStorage`, falls back to OS).
12. **Added content pages + nav routing**: real `/about` and `/how-it-works` routes (`ContentShell`,
    `CtaLink`); header nav items are now `next/link`s with active state and the brand links home;
    **removed "Ingredients"** from the menu.
13. **Deepened the Gemini grounding integration:**
    - Discovered Gemini corrupts JSON when grounding + `responseSchema` are combined → reworked
      `agent.ts` into the **two-step pipeline** (grounded prose research → non-grounded JSON
      structuring) so we get BOTH live grounding and clean structured output.
    - `GeminiProvider.generate()` now returns `{ text, grounding? }`; added grounding tool wiring
      and `parseGrounding()` (sources + Search Suggestions chip + queries).
    - Default model set to `gemini-3.1-flash-lite`; `ModelPicker` switched to `gemini-3.5-flash`
      (the one that actually grounded). `/api/routine` allowlists both via `ALLOWED_MODELS`.
      **(Both models were later replaced — see the routine-model upgrade below.)**
    - Added `thinkingBudget` support and **capped the research step at 512** (structuring at 0),
      cutting the grounded `3.5-flash` route from ~64s → ~32–35s with grounding intact.
    - `GroundingSources` renders the required source links + Search Suggestions chip.
14. **Replaced the quiz image placeholders with real imagery:** generated a cohesive 14-image set
    (2 intros + 12 concerns) with `gemini-3.1-flash-image`, downscaled into `public/quiz/`; taught
    `PhotoSlot` to render `next/image` from a `src` (see "Quiz imagery").
15. **Polished imagery + published to GitHub.** Regenerated the intro hero (`intro-skin.jpg`) to a
    brighter, livelier shot (the first one read as dull); hit and documented the image-optimizer
    stale-variant gotcha. Then published the repo: installed `gh`, authed over HTTPS, tuned
    `.gitignore` (commit `.env.example`; ignore `design-incoming/` + local Claude settings), set a
    privacy-friendly noreply commit identity, and pushed `main` to a new **public** repo. Later
    handled the owner's GitHub **username change** (`NadzeyaSakovich` → `NadiaSakovich`) by
    repointing the `origin` URL + commit identity (see "Repository & git").
16. **Added the user profile page** (see "User profile"): new `/profile` route showing the signed-in
    user's Google identity + their **saved routines** list (cards labeled "Routine N · {skin type}");
    clicking one opens a read-only `SavedRoutineDetail`. Added `GET /api/users` (token-verified,
    Admin-SDK read, `createdAt` → millis) so `firestore.rules` stays deny-all; enriched
    `QuizResultSnapshot` (+`source`/`picked`/`productsByType`/`grounding`) so saved routines render as
    fully as live ones; added a **"Your profile"** link to the `AccountControl` dropdown. Verified:
    `tsc`/`eslint` clean, signed-out `/profile` renders with zero console errors (Playwright). The
    **signed-in path was not E2E-tested** (needs a real Google popup + Firebase keys).
17. **Reworked the saved-routine flow into a review hub** (see "Saved-routine review hub"): opening a
    saved routine now reuses the quiz via `editSession.ts` + `/?edit=1` and lands on the finale as a
    hub (Review routine / Review & edit quiz / Back to profile); editing shows **Rebuild** (if answers
    changed) or **Show** (if not). Added `Shell.onBackToProfile` (persistent "← Back to profile" while
    editing), `submissionChanged` change-detection, in-place save via `PUT /api/users`, and a
    **delete** action via `DELETE /api/users`. **Removed** the old read-only `SavedRoutineDetail.tsx`
    (its `SavedResult` type moved to `components/profile/types.ts`).
18. **Made Shop products real-time** (see "Shop product sourcing"): live routines render only the AI's
    grounded picks — removed the static-catalog top-up that was leaking off-region brands. The catalog
    is now the **offline-only** fallback. Added tolerant `stepType`→step matching (so a "Cleanser"
    step isn't dropped when the model labels it "Face Wash" etc.), hardened `slotForStep`, kept empty
    steps visible with a note, and changed the copy to "a few picks". Enriched `products.ts` so each
    common slot has ≥3 options per region (offline fallback honours region preference); grounded prompt
    now asks for 3 picks/step and to favour the stated region.
19. **Stage-1 intro hero now rotates** between `intro-skin-1/2/3.jpg` (random per load, SSR-safe);
    the single `intro-skin.jpg` was removed.
20. **Finale, account naming, routine cap, shop labels & product tiers (this session):**
    - **Removed the finale's round accent badge/icon** above "Your skin profile is ready"
      (`FinaleScreen`).
    - **Renamed user-facing "Profile" → "Account"** (account contexts only): `AccountControl`
      ("My account"), `Shell` ("← Back to my account"), `FinaleScreen` review button/prose,
      `SaveRoutine` copy, `ProfileView` eyebrows, and the `/profile` `<title>`. Account/nav labels use
      **"My …"**; results/routine screens keep **"Your …"**. Skin-profile text and the `/profile`
      route/file names are unchanged.
    - **Capped saved routines at 3 with one main routine:** `POST` returns **409** on a 4th (friendly
      panel in `SaveRoutine`); added `isMain` + `PATCH` (set-main), delete-auto-promote, and `GET`
      normalization; `ProfileView` gained the Main badge / "Set as main" action, a "N of 3 saved"
      count, and an at-limit note. See "Max 3 routines + one main" under User profile.
    - **Shop labels:** routine CTA → "See recommended products"; shop heading → "Products for your
      routine".
    - **Fixed product tier ordering:** tiers are now **derived from price** in `ShopView.resolve`
      (`priceValue`/`tierForRank`), so Budget ≤ Mid ≤ Premium always holds for AI and offline picks.
    - Verified: `tsc`/ESLint clean; Playwright drive confirmed the finale badge is gone, shop tiers are
      monotonic on a **live AI** result, and the account eyebrow renamed — 0 console errors. The
      **signed-in** main/limit paths are type/lint-checked but not clicked through (need real Google
      auth).
21. **Header reset, absolute price tiers, double-cleanse split, minimal tip & account tweaks (this
    session):**
    - **Clickable brand resets the quiz:** `SiteHeader.Brand` now force-reloads `/` when already on
      the home route (the quiz), so the logo/word takes you back to the start mid-quiz (see "Site
      header & nav"). Content-page navigation is unchanged (SPA `Link`).
    - **Product tiers by absolute price band:** `ShopView` replaced rank-based `tierForRank` with
      `tierForPrice` — **Budget ≤ $20, Mid ≤ $35, else Premium** (see "Shop product sourcing").
    - **Save-limit copy** rephrased: the 409 panel now offers *delete one OR update an existing
      routine* (there's no auto-route back to the unsaved routine after deleting).
    - **Double cleanse always splits into two steps:** `buildAiResult` splits a lumped AI "Double
      cleanse" step into oil + water steps and partitions its products; both AI prompts nudge the
      same (see "Double cleanse is always two steps").
    - **Minimal-routine tip** now leads the **"Good to know"** card in `RoutineView` (was a separate
      tile), with the SPF/double-cleanse guidance.
    - **Account page:** count reads **"Up to 3 saved routines"** (was "N of 3 saved"); cards are
      **titled by skin type** with the **commitment label** (Minimal/Balanced/Thorough) as the accent
      (was "Routine N · {skin type}"); the **"Main routine" star** icon was fixed (reuses `Chips.tsx`'s
      path — the old 24-grid path rendered as a "tree branch").
    - Verified: `tsc`/ESLint clean; dev server hot-reloads clean. Signed-in account list still not
      clicked through E2E (needs real Google auth).
22. **Content-page banners + routine-model upgrade (this session):**
    - **Added banner imagery to `/how-it-works` and `/about`** via a new `ui/PageBanner` (21:9, full
      reading-column width) — see "Content-page imagery". Options were generated and previewed first;
      the picks were the bathroom-mirror shot and the limestone-ledge still life.
    - **Upgraded the routine models:** `gemini-3.1-flash-lite` → **`gemini-3.5-flash-lite`** (default)
      and `gemini-3.5-flash` → **`gemini-3.6-flash`**, across `gemini.ts` (provider default),
      `ALLOWED_MODELS`, `ModelPicker`, `.env.example` and `.env.local`. Both IDs were confirmed
      against the live `models` list first.
    - **Fixed the 400 this exposed:** the new models reject `thinkingBudget: 0`, which the structuring
      step used — so *every* routine 500'd and fell back to the local logic. Now
      `MIN_THINKING_BUDGET = 1` (see the gotcha). Verified end-to-end through `POST /api/routine`:
      3.5-flash-lite ≈11s / 5 sources / 24 picks, 3.6-flash ≈18s / 13 sources / 15 picks, both with
      full ingredients + AM/PM routine and the Search Suggestions chip.
    - **A regenerated saved routine can now be saved.** Switching model while reviewing a saved
      routine rebuilds it but leaves the answers untouched, so the old answers-only change detection
      hid the save panel. Added `rebuildCount` + `reviewRebuilt` and the `rebuiltOnly` wording — see
      "Change detection" under the review hub.
    - **E2E note:** the review hub *can* be driven without Google auth — seed the saved routine
      straight into `sessionStorage` under `ss-edit-quiz` (the key `editSession.ts` uses) and load
      `/?edit=1`. The fixture must match `src/types.ts` `Analysis`/`Profile` exactly (`typeLabel`,
      not `label`), or the results screens throw. Only the actual save request needs a real account.
23. **Minimal routine capped at 3 steps with a combined moisturising sunscreen (this session):**
    - Added `MINIMAL_RULES` to both AI prompts and `applyMinimalShape()` enforcement, plus the same
      shape in the local engine — see "The minimal-routine shape" above.
    - Verified: **both models already obey the prompt** (3+3 steps, last AM step "Moisturising
      sunscreen", 0 separate moisturiser steps), while *balanced* is unchanged (4+4, separate SPF,
      PM double cleanse). The enforcement was then unit-tested against a deliberately non-compliant
      response (5 AM / 4 PM with a lumped double cleanse): trimmed to 3+3 with the SPF picks carried
      onto the combined step, and balanced left untouched. Live UI drive: minimal AM = Cleanser →
      Targeted Serum → Moisturising sunscreen, PM = 3 steps, shop shows hydrating SPF fluids under
      the combined step with no empty-step notes, 0 console errors.
    - Handy: `npx --yes tsx <script>.mts` run from the repo root resolves the `@/*` alias, so
      `lib/**` functions can be unit-tested directly without adding a test framework.

## Likely next steps

- **Pick one model and remove the temporary `ModelPicker`** (the user plans to compare
  `3.5-flash-lite` vs `3.6-flash`, then keep one and delete the switch).
- Add an explicit **account-creation prompt** after results (the pieces exist — auth + `SaveRoutine`
  + the `/profile` page — but there's no dedicated "save & track vs. continue without an account"
  moment yet).
- **E2E-test the signed-in flow** end-to-end (save a routine; open it → review hub → review / edit /
  rebuild / show / update-in-place / delete / back-to-profile). The review hub itself is now driven
  in tests via the `ss-edit-quiz` sessionStorage seed (see the E2E note above), so what's left
  unverified is specifically the **authenticated write path** — the POST/PUT/PATCH/DELETE round trips.
- Consider having `POST /api/users` **return the new routine id** so `SaveRoutine` can hand it back to
  `SkinQuiz` as `editingId`. Then a fresh quiz that's saved and then rebuilt (e.g. model switch) could
  offer to *update* that routine instead of leaving a stale "Saved ✓" panel — today only *reopened*
  saved routines get the regenerate-and-save treatment.
- Consider giving saved routines **persisted, user-editable names** (currently the "Routine N" label
  is derived from list position, not stored). (A **delete** action now exists.)
- Flesh out the static pages further / add real nav destinations as the marketing site grows.
- Optionally delete `design-incoming/` once no longer needed as reference.
- Mind AI latency vs. serverless timeouts if/when deploying the grounded `3.6-flash` path.
- Add a **`README.md`** (setup/run, required env vars) now that the repo is public; consider a
  deploy target (Vercel) and basic CI (`tsc --noEmit` + `next build`).
