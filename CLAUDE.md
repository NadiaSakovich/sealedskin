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
- `src/app/layout.tsx` — root layout + metadata (no font loaders; fonts come from `globals.css`).
  Also runs an inline **no-flash theme script** in `<head>` that adds `.dark` to `<html>` before
  first paint; `<html>` carries `suppressHydrationWarning` (see Dark mode below).
- `src/app/globals.css` — Tailwind v4 entry. Design tokens live in an `@theme` block (see Tokens below).
- `src/lib/firebase/**` — `client.ts` (Google sign-in), `useAuth.ts`, `admin.ts`. Auth surfaces in
  the header via `AccountControl`; results can be saved (`SaveRoutine` → `POST /api/users`,
  guarded by `firestore.rules`).
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
- `src/types.ts` — shared domain types for the quiz/logic (the design's types).

## AI routine engine (wired into the UI)

The routine-building engine is an AI model, model-agnostic so the model can be swapped
(currently **Gemini**). It drives the live quiz's analysis/routine:

- `src/lib/ai/types.ts` — `LLMProvider` interface (`generate(messages, opts)` → `GenerateResult`
  `{ text, grounding? }`), `ChatMessage`, `GroundingInfo`/`GroundingSource`. `GenerateOptions`
  carries `grounding?: boolean` and `thinkingBudget?: number`.
- `src/lib/ai/providers/gemini.ts` — `GeminiProvider`, a thin REST wrapper (no SDK). Default model
  `gemini-3.1-flash-lite`. `grounding: true` adds `tools: [{ google_search: {} }]` (model decides
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
   `OUTPUT_SCHEMA` mirroring `AiRoutineOutput`) reshapes the brief into clean JSON, `thinkingBudget:
   0` (mechanical, no reasoning needed). `parseRoutineJson()` strips code fences + tolerates stray
   control chars via `sanitizeJson()`.

The grounding shown in the UI comes from step 1; the structured routine comes from step 2.

**Latency/behaviour observed:** `gemini-3.1-flash-lite` (default) ≈10s but usually does NOT search
(0 sources); `gemini-3.5-flash` ≈32–35s with the 512 cap and grounds richly (~14–23 sources +
chip). Grounding is non-deterministic — the model decides per request. **Skin-type analysis stays
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
   Concerns, and Routine sections → "Build my routine".
5. **Results:** Needs summary → Ingredients → AM/PM Routine → Shop.

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

- `components/layout/SiteHeader.tsx` — brand links to `/`; nav items are `next/link`s to
  `/how-it-works` and `/about` with active-state styling (via `usePathname()`). (The old
  "Ingredients" nav item was removed.) Hosts `ThemeToggle` + `AccountControl`.
- The quiz uses `Shell` (header + progress rail); content routes use `ContentShell` (header only).

## Quiz imagery

- `ui/PhotoSlot.tsx` renders a real image (`next/image`, `fill` + `object-cover`) when given a
  `src`, else the striped placeholder. Where it's used: the two quiz intros (`SkinQuiz.tsx`) and
  the concern tiles (`ConcernGrid.tsx`, both the grid `16/10` and priority `1/1`).
- Images live in `public/quiz/` — `intro-skin.jpg`, `intro-concerns.jpg`, and
  `concern-<id>.jpg` (id matches `SKIN_CONCERNS[].id`, so the path is derived, not stored). All
  **Gemini-generated** (`gemini-3.1-flash-image`, 1:1), one cohesive sage-green editorial set,
  downscaled to 512px JPEG (~35–55KB each). `concerns.ts`'s `photo` field is now unused (alt text
  comes from `label`); kept harmlessly.
- To regenerate/extend: a small REST loop hitting
  `POST v1beta/models/gemini-3.1-flash-image:generateContent` with
  `generationConfig.imageConfig.aspectRatio` (needs **v1beta** — `v1` rejects `imageConfig`/
  `responseModalities`), `x-goog-api-key: $GEMINI_API_KEY`, image bytes at
  `candidates[0].content.parts[].inline_data.data` (base64). Then `sips -Z 512` into `public/quiz/`.

## Conventions & gotchas

- **Strict TS** — no unused locals/params; build fails otherwise.
- **Turbopack stale cache:** if styles look wrong (e.g. tokens not applying / old classes
  served), the `.next` cache can be stale — `pkill -f "next dev"; rm -rf .next; npm run dev`.
  This bit us after running `next build` then `next dev`.
- Don't run `next build` while `next dev` is running (shared `.next` → conflicts).
- Buttons go through `ui/Button.tsx` (`variant="primary" | "ghost"`); the primary CTA has the
  `bg-ss-accent` class (handy selector for E2E driving).
- Preserve the safety logic in `actives.ts`: SPF + a hydrator are always included; actives
  flagged `avoidInPregnancy` are filtered out for pregnant/planning/breastfeeding. Product
  brands are examples, not endorsements; content is heuristic, not medical advice.
- **Don't merge grounding + `responseSchema` into one Gemini call** — it corrupts the JSON (see
  "Two-step agent"). Keep grounded prose and JSON structuring as separate `generate()` calls.
- **AI latency:** a grounded `gemini-3.5-flash` route is ~32–35s; mind serverless function
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
    - Default model set to **`gemini-3.1-flash-lite`**; `ModelPicker` switches to `gemini-3.5-flash`
      (the one that actually grounds). `/api/routine` allowlists both via `ALLOWED_MODELS`.
    - Added `thinkingBudget` support and **capped the research step at 512** (structuring at 0),
      cutting the grounded `3.5-flash` route from ~64s → ~32–35s with grounding intact.
    - `GroundingSources` renders the required source links + Search Suggestions chip.
14. **Replaced the quiz image placeholders with real imagery:** generated a cohesive 14-image set
    (2 intros + 12 concerns) with `gemini-3.1-flash-image`, downscaled into `public/quiz/`; taught
    `PhotoSlot` to render `next/image` from a `src` (see "Quiz imagery").

## Likely next steps

- **Pick one model and remove the temporary `ModelPicker`** (the user plans to compare
  `3.1-flash-lite` vs `3.5-flash`, then keep one and delete the switch).
- Add an explicit **account-creation prompt** after results (the pieces exist — auth + `SaveRoutine`
  — but there's no dedicated "save & track vs. continue without an account" moment yet).
- Flesh out the static pages further / add real nav destinations as the marketing site grows.
- Optionally delete `design-incoming/` once no longer needed as reference.
- Mind AI latency vs. serverless timeouts if/when deploying the grounded `3.5-flash` path.
