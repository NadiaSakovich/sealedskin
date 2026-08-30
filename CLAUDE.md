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

**Latency/behaviour observed:** `gemini-3.5-flash-lite` (default) ≈11-12s and *does* ground (≈2-8
sources + chip — an improvement on the old `3.1-flash-lite`, which usually returned 0);
`gemini-3.7-flash` ≈13s with the 512 cap (its predecessor `3.6-flash` was ≈18s). Grounding is
non-deterministic — the model decides per request, so source counts swing run to run. **Skin-type analysis stays
LOCAL** (`analyzeSkin`), since it's already shown mid-quiz in `AnalysisView`; the AI only produces
ingredients, routine (am/pm/notes), and grounded product picks.

**Grounding ToS:** when a grounded answer is shown you MUST display the source links AND the Search
Suggestions chip (`GroundingSources` renders `grounding.searchSuggestionHtml` via
`dangerouslySetInnerHTML`) — required by Google's grounding terms. It is deliberately **discreet**:
one small footnote line ("SOURCES · domain · domain · +N more" + the chip), rendered **once**, at the
bottom of the **shop** screen only — it used to be a bordered card repeated under the ingredients,
routine *and* shop screens, which read as redundant. Don't restyle the chip markup itself (the terms
require it unmodified); the wrapper carries `min-w-0` so Google's nowrap carousel scrolls inside the
reading column instead of overflowing it.

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
  creates a new saved routine and **returns its `quizId`**, which the client keeps so a later rebuild
  updates that routine rather than creating a second one; `PUT` (body carries `id`) **updates one in
  place** (used when editing a saved routine); `PATCH` (body carries `id`) **sets that routine as the single main routine**
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

  The Shop page offers to save when `!updateId || reviewChanged || reviewRebuilt || alreadySaved`. A
  pure review (nothing changed, nothing rebuilt) shows **no** save section; a quiz with nothing stored
  yet always shows "Save your routine". Both saved-routine cases PUT (update in place) — only the
  wording differs, via `SaveRoutine`'s `rebuiltOnly` prop: "Save this version / You just rebuilt this
  routine…" instead of "Save your changes". `SaveRoutine` is **keyed by `rebuildCount`**, so its
  internal "Updated ✓" state resets on each rebuild and a second regeneration can be saved in turn.
  `rebuildCount` resets on "Start over".

  Both comparisons run against **the stored copy**, which is not always the routine we opened:
  `updateId = editingId ?? createdId` and `savedBaseline = editOriginal ?? savedMark.submission`
  (see "A freshly saved routine is updatable too" below).
- **The save confirmation survives leaving the shop screen.** "Updated ✓" used to be purely internal
  to `SaveRoutine`, so stepping Back to the routine screen and returning via "See recommended
  products" remounted it in `idle` and re-offered "Update my routine" for an already-saved version.
  `SkinQuiz` now remembers what was saved (`savedMark = { rebuildCount, submission, created }`, set
  from `SaveRoutine`'s `onSaved`) and passes `saved={alreadySaved}` — true only while neither a rebuild
  nor an answer change has happened since. The panel keeps showing the confirmation instead; a
  further rebuild or edit flips it back to offering the save. Cleared on "Start over". Same guard
  applies to a fresh quiz, so a saved routine isn't POSTed twice by walking back and forth.
- **A freshly saved routine is updatable too.** `POST /api/users` returns `{ ok, quizId }`;
  `SaveRoutine` reads that id off the response and hands it up as `onSaved(newId)`. `SkinQuiz` keeps
  it as **`createdId`**, so rebuilding after a save (a model switch, say) offers "Save this version →
  **Update my routine**" and PUTs that routine, instead of stranding a stale "Saved ✓" or saving a
  second copy against the 3-routine cap. Details that matter:
  - `createdId` is deliberately **separate from `editingId`**. `editingId` means "opened from the
    account" and also switches the finale into the review hub and adds the header's "← Back to my
    account"; a fresh quiz that merely got saved should not change shape mid-flow. Only the save
    panel reads the union, `updateId = editingId ?? createdId`.
  - `savedMark.created` records that the stored copy was **created** here, so the confirmation reads
    "Saved ✓ / Your routine is saved to your account" rather than "Updated ✓" — `editId` is set by
    then, so `editing` alone would report the wrong thing. It reaches `SaveRoutine` as `savedAsNew`.
  - `reviewChanged` compares against `savedBaseline = editOriginal ?? savedMark.submission`, so an
    edit made *after* saving a fresh quiz is measured against what was actually stored.
  - Cleared on "Start over" alongside `editingId`/`savedMark`/`rebuildCount`.
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

### "Discuss with Snuffy" - the routine chat

The assistant is a character: **Snuffy the Cosmetologist**, a seal (a magical one) who works as a
cosmetologist. The chat window is headed **"Snuffy The Cosmetologist"**.

**Two voices, chosen by the user.** An empty conversation opens on a chooser rather than a greeting:
**Warm and encouraging** or **Dry and direct**. Only the *manner* differs - the expertise, the
product quality bar and every safety rule are shared, and the chooser copy says so ("He knows your
skin just as well either way"). The two personalities exist because the character was described
twice, differently, and picking one would have thrown away a good version of him.

- `lib/ai/personas.ts` - the whitelist (`CHAT_PERSONA_IDS`, `isChatPersonaId`,
  `DEFAULT_CHAT_PERSONA = "warm"`) plus the UI labels. Deliberately **zero imports**, so the client
  bundle can read the labels without pulling in `chat.ts` -> `agent.ts` -> the product catalogue, and
  so **the system prompt is never shipped to the browser**. Same shape as `ALLOWED_MODELS`: the
  browser names a persona, it never supplies one.
- `lib/ai/chat.ts` splits the prompt in three. `SNUFFY_CORE` (who he is) and `SHARED_RULES` (scope,
  the product bar, the imported price/region/safety/style blocks) are identical for both voices;
  only `PERSONA_VOICES[id]` differs. `buildChatSystem(persona)` composes them.
- **The safety rules live in the shared block on purpose.** Both voices have a register that can land
  badly at the wrong moment, so "WHEN TO DROP THE VOICE COMPLETELY" (pregnancy/nursing, anything that
  sounds medical, a client upset about their skin) is written **once** rather than twice and drifting
  apart. The same goes for the **refusal register**: declining is where sarcasm is most tempting and
  worst received, so a refusal is respectful in *either* voice.
- **Persistence:** the choice is stored as `chatPersona` on the routine document (it belongs to the
  conversation, not to a turn) and returned by `GET`, so reopening the window resumes in the same
  voice. `POST` resolves request -> stored -> default. **`DELETE` clears it with the transcript**, so
  "Clear chat" is also how you change your mind about the voice.
- Verified: `buildChatSystem` unit-tested for both ids (all shared markers present in both, neither
  voice leaks into the other, non-voice text byte-identical, 0 long dashes); Playwright drive of the
  real UI (chooser renders, composer is inert until you pick, `persona` rides on the POST body,
  Clear chat returns to the chooser, both greetings, light + dark, 0 console errors).

**Gotcha - a Firestore batch gives every write the SAME commit timestamp.** Both messages of a turn
are written in one batch with `FieldValue.serverTimestamp()`, so `orderBy("createdAt", "asc")` cannot
separate the question from its answer and falls back to breaking the tie by **random document id**.
About half of all turns were therefore read back as `[assistant, user]`.

The symptom was not cosmetic and did not look like a sorting bug: a reversed turn puts two user
messages side by side in the transcript replayed to the model, with the older one looking
unanswered, so **the model answered the previous question again before getting to the new one**.
Every reply echoed the one before it.

- `lib/domain/chatOrder.ts` - `byConversationOrder()`. A `createdAt` tie can only ever be the two
  halves of one batch, and the question is always the first half, so the rule is exact rather than
  heuristic. Two messages of the same role cannot tie, so it returns 0 and the (stable) sort leaves
  Firestore's order. A `null` timestamp means a server value that has not materialised, which only
  happens for a write that has just landed, so it sorts **newest**.
- **Fixed on the READ side on purpose.** Distinct write timestamps or a sequence field would only fix
  new messages and leave every stored conversation permanently scrambled. Sorting on read repairs the
  existing ones with no migration.
- **The 40-message trim had the same root cause** and is fixed with it: it re-ran
  `orderBy("createdAt").limit(n)`, so it could delete a question and keep its answer, leaving a
  dangling half-turn. It now deletes by id from the already-ordered `history`, which also saves a
  read.
- Unit-tested over 6 orderings (reversed turn, already-correct, pending timestamp, both pending,
  same-role tie, four consecutive reversed turns), plus an assertion that no two user messages end up
  adjacent.

**Scope is SKINCARE, not just this routine.** The first version fenced Snuffy to "ONLY this client's
saved routine and what bears directly on it", which made him refuse things he should obviously help
with - most visibly, a client whose routine leans European asking about a Korean product got turned
down. The boundary is now:
- **In scope:** the client's skin and skincare generally, with their saved routine as the anchor and
  usual starting point. Ingredients, brands, technique, a concern they have not raised before, a
  product they are curious about.
- **Stored preferences are DEFAULTS, not a cage.** Region, budget and commitment describe how the
  routine was built; they do not limit what may be asked. `REGION_RULES` gets a chat-only rider
  saying so (mirroring the `PRICE_RULES` rider above it): never refuse a product question because the
  brand is from the "wrong" region.
- **Out of scope** is anything not about skin: relationships, work, current events, general
  knowledge, code. Declined in one sentence, respectfully, as before - and the prompt now says
  explicitly that refusing is not a way to dodge a skincare question that steps outside the saved
  preferences.
- **Edges** (sleep, stress, diet, hormones, hard water, weather, makeup) are in scope insofar as they
  bear on THIS client's skin; a general lecture on nutrition is not.

Third instance of the same bug class, after the three-item list and the per-reply disclaimer: a rule
written for the routine builder - where the user is not present to ask for an exception - inherited
by a conversation, where they are.

**No per-reply disclaimer.** `SAFETY_RULES` used to end with "Include a brief note that this is
general guidance and no substitute for a dermatologist" - a rule about a DOCUMENT, inherited by a
conversation, where it meant "say this every time you speak". Snuffy duly closed **every** reply with
it. Split into `ROUTINE_DISCLAIMER_RULE` (exported from `agent.ts`, appended to the two routine
prompts only); the chat prompt instead says not to end on a standing disclaimer, since the window
already shows one permanently under the message box. Enforced as well as prompted:
`stripTrailingDisclaimer()` in `chat.ts` drops a trailing boilerplate sentence.
- It matches **stock phrases** ("general guidance", "not a substitute", "does not replace", "not
  medical advice"), never the act of recommending a doctor - "please see a dermatologist about that"
  has none of those markers and survives untouched. That distinction is the whole point: the referral
  is the most important thing Snuffy says.
- **Sentence-level, last block only.** A reply ending "...see a dermatologist. This is general
  guidance and no substitute for one." keeps the first sentence and drops the second. A reply that is
  ONLY a disclaimer is left alone - that is a refusal to advise, which is content.
- Unit-tested over 7 cases including a genuine referral, a merged referral+boilerplate, and a
  pregnancy answer. Same third failure of the same kind as the three-item list and the em dash: a
  rule written for one register, silently inherited by another.

**`PROSE_RULES` is deliberately NOT imported here** - see the note in `agent.ts`. Still open: with the
warm voice no longer sarcastic, the marketing-word list (journey, elevate, powerhouse, game-changer)
is unguarded in chat. Promoting a few of those into `STYLE_RULES` would close it.

The **main** routine's card carries a filled accent pill, **"Discuss with Snuffy"**, where the secondary
cards show their quiet "Set as main" text link. It opens a modal chat with a grounded cosmetologist
persona that discusses **only that routine**. (The "Main routine" badge was softened from a filled
accent chip to an accent *tint* chip so the pill is the one filled element in the list.) The pill
mirrors the badge's type treatment exactly - mono, uppercase, `10.5px`, `tracking-[0.08em]`, a
shared explicit **`h-[22px]`**, and no shadow - so the two align as a matched pair across the footer
and the main card's footer stays close to the secondary cards'. What makes it the action is the
accent **fill**, not a bigger or different label.

- `components/profile/RoutineChat.tsx` - the modal (`role="dialog"`, Esc / backdrop / ✕ to close,
  body scroll lock, starter chips on an empty conversation, typing indicator, "Clear chat"). It
  posts **only a question**: the routine context is read server-side, so the client can't forge it.
  Assistant text renders as plain paragraphs and `- ` bullets - deliberately **not** a markdown
  renderer (a dependency plus an injection surface for what is only a formatting habit).
- `lib/ai/chat.ts` - `buildRoutineContext()` (saved profile, needs, ingredients, AM/PM steps and the
  **saved product picks**, read defensively since `QuizResultSnapshot` is `unknown`-typed and old
  saves lack fields) and `answerRoutineQuestion()`. The system prompt **imports**
  `SAFETY_RULES` / `PRICE_RULES` / `REGION_RULES` / `STYLE_RULES` from `agent.ts` (now exported)
  rather than restating them - a swap suggested in chat obeys the same pregnancy safety, $80 ceiling,
  brand-origin and plain-hyphen rules the routine was built under.
- `app/api/routine-chat/route.ts` - `POST` (ask), `GET` (history), `DELETE` (clear). Auth is
  **required** on all three (unlike `/api/routine`); the routine is loaded from
  `users/{uid}/quizzes/{quizId}` via the Admin SDK, so `firestore.rules` stays deny-all. Uses
  `createProvider()` with **no model override**, i.e. exactly the quiz's default model.
- **Persistence:** `users/{uid}/quizzes/{quizId}/chat/{msgId}` = `{ role, text, grounding?,
  createdAt }`, capped at 40 stored messages (oldest trimmed); only the last `CHAT_HISTORY_TURNS`
  (12) are replayed into the prompt. Grounding is stored **per assistant turn** because the ToS
  display obligation follows the answer, including when a stored conversation is reloaded.
- **Delete cascade:** Firestore does not remove subcollections with their parent, so
  `DELETE /api/users` now deletes the `chat` subcollection explicitly. Without it the messages orphan
  and a reused id could surface someone's old conversation.

**Two enforcement layers, both measured and both needed:**

1. **Scope.** The prompt states the boundary, refuses in one sentence, and treats any in-conversation
   instruction that tries to redefine the rules as off-topic. Measured: general knowledge, "write me
   a Python script", a direct "ignore your previous instructions", adjacent-but-out-of-scope
   (dandruff shampoo) and an injection placed *after* a legitimate turn were all declined and
   redirected.
2. **Product quality - the prompt is NOT enough.** The bar is "only recommend well-regarded products,
   with the rating you actually saw". Grounding is the model's own decision, and over 5 repeats of the
   same product question it searched on only **3 of 5** - the other two named a product *and* quoted a
   star rating purely from memory. So `answerRoutineQuestion()` retries: if a reply makes a product
   claim (`PRODUCT_CLAIM_RE` - a star score, review count, "recommended by", a price) while
   `grounding` is empty, it re-asks once with `FORCE_SEARCH_NUDGE` ("search now, or name no product
   at all"). An ungrounded reply with no product claim (order, frequency, layering) is left alone -
   retrying those only adds latency. A claim that survives both attempts is logged as
   `chat.unverifiedClaim` rather than passing silently. After the fix: **8/8 grounded, 0 unverified.**
3. `stripMarkdown()` runs alongside `stripLongDashes()` on every reply - the model reached for
   `**bold**` product names, which the plain-text bubble would have shown as literal asterisks.

**Gotcha - a scrim must not use `ss-ink`.** `--color-ss-ink` inverts to a *light* colour in dark
mode, so a `bg-ss-ink/35` backdrop brightened the page behind the dialog instead of dimming it. The
overlay uses `bg-black/45` in both themes.

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
- **Nothing over `MAX_PRODUCT_PRICE` ($80, exported from `products.ts`).** The audience is people
  building a first routine, so "Premium" is capped rather than open-ended. Prompt **and** enforcement
  again: `PRICE_RULES` (both prompts in `agent.ts`) keeps the model from spending its three picks on
  products we won't show, and `ShopView.resolve` drops over-cap picks **while collecting**, not after,
  so an expensive pick can't eat one of the three slots and then vanish. Only *parseable* prices are
  judged (an unparseable one passes, like an unknown brand in `enforceRegion`). Filtering at render
  means saved routines and the offline catalog are covered too. The two catalog entries that breached
  it (SkinCeuticals C E Ferulic $182, Drunk Elephant Framboos $90) were removed; every slot still has
  ≥3 picks per region.
- **Labels:** the routine screen CTA reads "**See recommended products**" (`RoutineView`), and the
  shop screen heading is "**Products for your routine**" (`ShopView`).
- `products.ts` catalog depth: every **common** routine slot has ≥3 options per major region
  (asia/us/eu) so the offline fallback can honour a region preference without borrowing off-region
  brands; niche actives (azelaic/benzoyl/squalane/cica) may still mix, matching the "leaning toward
  {region}" copy. The grounded prompt (`agent.ts`) also asks for exactly three picks per step.

### Region means brand ORIGIN, not availability

The quiz's region options are about where a brand *comes from* — `goals.ts` spells it out ("North
American brands", "European pharmacy & heritage brands"). That distinction is easy to lose, and
losing it makes the whole preference a no-op, since essentially every major brand is sold in every
major market. Two places had lost it:

**The region options carry no `meta` chips.** They used to: "Local" on US & Canada and "Pharmacy" on
European. Both were wrong for a worldwide audience - "Local" is only true if you assume a North
American reader, and "Pharmacy" quietly writes off the European brands sold in supermarkets, some of
which are the best of them. All four chips were dropped (`OptionLevel.meta` is now optional and
`GoalGrid` renders the chip only when present); the **commitment** levels keep theirs. The European
`desc` went from "European pharmacy & heritage brands" to plain **"European brands"** - note `desc`
is sent to the model as part of `label - desc`, so it still has to state ORIGIN.

- **The prompt.** The model was sent only the bare label (`Region preference: US & Canada`), which
  reads as a *market*. Measured result: "Korean & Asian" stayed clean (unambiguous), but "US &
  Canada" returned La Roche-Posay, COSRX, Heimish and Peach & Slices. Fixed on both ends —
  `SkinQuiz.toQuizAnswers` now sends `label — desc` ("US & Canada — North American brands"), and
  `agent.ts`'s `REGION_RULES` states the origin test with per-region examples *and counter-examples*,
  and replaces the old "unless no regional option exists" escape hatch with "list fewer and say why"
  (the shop already renders an empty step with a note).
- **The catalog.** Three `region` tags failed the origin test and were corrected: **The Ordinary** →
  `us` (Deciem is Torontonian, not European), **CeraVe** "Moisturising Cream (EU)" → replaced with
  Bioderma (an EU *formulation* of an American brand isn't a European brand), **Belif** → dropped
  from `us` (it's Korean, LG H&H). EU replacements were added so every common slot still has ≥3 per
  region — verified by driving `selectProducts` over all 14 common slots × 3 regions.

**The prompt is not enough on its own — don't remove the enforcement.** Grounding is
non-deterministic, so a single clean run proves nothing: measured over 4 repeats of the *same*
European profile on `3.5-flash-lite`, the tightened prompt still leaked CeraVe / The Ordinary /
Heimish on **3 of 4**. (An earlier one-sample-per-region check looked clean and was simply lucky —
always repeat this measurement.) So region gets the same prompt-**and**-enforcement split as the
minimal-routine shape:

- `data/brandRegions.ts` — a brand→origin map, seeded from `products.ts` (already tagged by origin,
  so it stays in sync for free) and extended with the brands grounded searches actually return.
  `isOffRegion(brand, region)` is true only when the origin is **known** and differs; **unknown
  brands pass**, since plenty of legitimate small in-region brands will never be listed.
- `lib/ai/result.ts` — `enforceRegion()` drops off-region picks from `productsByType`. It runs
  **last** in `buildAiResult`, after the double-cleanse split and `applyMinimalShape` have settled
  their keys. A step left short (or empty) is acceptable — `ShopView` renders an empty step with a
  note rather than hiding it, and back-filling from the static catalog is exactly the bug that
  "Shop product sourcing" above exists to prevent.
- **Paired brands are the sneaky case.** The model sometimes puts two alternatives in one row —
  brand `"Heimish / SVR"`, name `"All Clean Balm / Topialyse Cleansing Balm"` — and the joined
  string matches no brand at all, so a plain lookup waves it through. That is exactly how a Korean
  brand survived the first version of this filter. `keepInRegion()` splits on `/` and ` or `: when
  brand and name split into the same number of parts it keeps only the in-region halves (→ "SVR —
  Topialyse Cleansing Balm"); when they don't line up it can't tell which name goes with which
  brand, so the whole pick is dropped.

Because it lives in `buildAiResult`, the filter applies before a routine is **saved**, so snapshots
are clean too — but note `POST /api/routine` returns the *raw* model output, so an API-level test
does NOT exercise this. Test it through `buildAiResult` or the UI.

**Saved routines are the exception:** a reopened saved routine shows the products **as saved**
(`productsByType` from its snapshot), not re-fetched — so an old save keeps its original (possibly
pre-fix) picks until rebuilt.

## Snuffy's avatar

The chat window's header shows Snuffy himself (`public/snuffy/snuffy-avatar.png`, 192px PNG with
alpha, rendered by `next/image` at **48px**), not the generic speech-bubble SVG it replaced.

- **Sits in a 48px circular plate, full-bleed and bottom-aligned** - Snuffy is cropped BY the disc
  like a portrait by a round frame, not floating inside it. Two things are load-bearing here: the
  wrapper is `items-end`, and the PNG is exported **tight-cropped**. The draft PNGs carry a 6%
  breathing margin from `key.py`, which at 48px reads as a gap between his body and the bottom of
  the circle. Re-export tight if you swap variants. `alt=""` - decorative, the heading names him.
- **The plate has its own token, `--color-ss-avatar-plate`**, and it is the one place the dark value
  is deliberately *lighter* than its surface rather than darker (`#51675c` on `#1c2723`). Reusing
  `ss-accent-tint` does not work: that inverts to `#21301a` and the disc disappears into the header
  band. Measured against the alternatives - the sage accent `#7a9e54` reads as a loud green blob and
  competes with the accent text next to it, and a pale plate washes out Snuffy's own pale body.
- **Drafts live in `design-drafts/snuffy-avatar/`** with a `preview.html` that shows each option
  inside a replica of the real header, light and dark, at 36/48/56/72px. Three characters are kept:
  `02-line-art` (**the one implemented**), `03-soft-gouache` (scarf) and `16-fur-mid-olive`
  (clinician's coat). Swapping is a re-export of the 512px draft plus a file replace - but mind the
  image-optimizer stale-variant gotcha below: overwriting a file in `public/` needs a full
  `rm -rf .next`.

### Generating these (two gotchas that cost real time)

Both bite anything generated with `gemini-3-pro-image`, not just this avatar:

- **Asking for "a transparent background" makes the model PAINT A CHECKERBOARD** - a literal grey and
  white grid baked into an opaque JPEG. It never returns alpha. Generate on a flat magenta `#FF00FF`
  chroma key instead and punch it out afterwards (soft alpha ramp over the key range so anti-aliased
  edges stay smooth, plus a de-fringe pass pulling green up to `min(r,b)` on partly transparent
  pixels, or every edge keeps a pink halo).
- **The model silently ignores the chroma key perhaps a third of the time** and paints a near-white
  background instead (~`(250,250,245)`). That is within ~10 RGB of an off-white lab coat, so keying
  it out eats the garment. **Verify, do not trust:** sample all four corners and regenerate until
  they are genuinely magenta - one variant needed three attempts. Putting the key instruction
  *first* in the prompt helps; burying it at the end is what caused the misses.
- A variant may also draw a panel or frame behind the subject, which survives the key as a
  rectangle. A corner flood-fill removes an unstroked one; a stroked one needs a regeneration with
  explicit anti-frame wording.

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
- **Any focused text input under 16px zooms the WHOLE SITE on iOS.** Safari zooms in on focus
  and never zooms back out on its own, so the layout viewport stays put while the visual one
  shrinks — it reads to the user as "the site is the wrong width and scrolls sideways", and it
  persists after the field is closed. Size text inputs `text-[16px] sm:text-[14px]` (desktop
  can't auto-zoom, so it keeps the smaller type), and don't autofocus on a coarse pointer —
  on a phone that only throws the keyboard over the content anyway. This is invisible in
  Chrome, including its device emulation: it is native Safari behaviour, so it can only be
  confirmed on a real device. It cost us the Snuffy chat's whole width on iPhone (`c328bb5`);
  that textarea is currently the app's ONLY text input, which is why nothing else showed it.
- Buttons go through `ui/Button.tsx` (`variant="primary" | "ghost"`); the primary CTA has the
  `bg-ss-accent` class (handy selector for E2E driving).
- Preserve the safety logic in `actives.ts`: SPF + a hydrator are always included; actives
  flagged `avoidInPregnancy` are filtered out for pregnant/planning/breastfeeding. Product
  brands are examples, not endorsements; content is heuristic, not medical advice.
- **Don't merge grounding + `responseSchema` into one Gemini call** — it corrupts the JSON (see
  "Two-step agent"). Keep grounded prose and JSON structuring as separate `generate()` calls.
- **`thinkingBudget: 0` is rejected by the current models.** `gemini-3.5-flash-lite` and
  `gemini-3.7-flash` 400 (`INVALID_ARGUMENT`) on a thinking budget of exactly 0 — thinking can't be
  switched off on them (older `3.1-flash-lite`/`3.5-flash` allowed it). Any budget ≥ 1, or `-1`
  (dynamic), is fine; `agent.ts` uses `MIN_THINKING_BUDGET = 1` for the structuring step. Symptom if
  this regresses: every routine silently falls back to the local logic, since `/api/routine` 500s.
  `thinkingLevel` (`low`/`medium`/`high`) is NOT accepted on these models via v1beta — use the
  numeric budget.
- **AI latency:** a grounded `gemini-3.7-flash` route is ~13s; mind serverless function
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
- **`CONFIG.autoAdvance` is `false`**, so a driver must click an answer card *and then* the Continue
  CTA. Also drive with `:visible` selectors — during a `Screen` transition the outgoing screen's
  buttons are still in the DOM, and `.first()` will happily click one of those.

### Driving the signed-in flow (no Google popup)

The Google sign-in popup can't be automated, but Firebase restores its session from **IndexedDB**, so
a fake one can be seeded before the app loads (`context.addInitScript`) and the whole authenticated
client path drives normally:

- DB `firebaseLocalStorageDb` → store `firebaseLocalStorage` (keyPath `fbase_key`) → record
  `{ fbase_key: "firebase:authUser:<NEXT_PUBLIC_FIREBASE_API_KEY>:[DEFAULT]", value: <user> }`.
- **`value` must be the user OBJECT, not a JSON string** — the IndexedDB persistence layer stores a
  structured clone (only the localStorage fallback stringifies). Getting this wrong fails silently:
  the app just renders as signed out.
- The user needs `uid`, `apiKey`, `appName: "[DEFAULT]"`, `providerData`, and a `stsTokenManager`
  with a **future `expirationTime`** — then `getIdToken()` returns the stub token without a network
  round trip. Stub `**/identitytoolkit.googleapis.com/**` + `**/securetoken.googleapis.com/**` so a
  background refresh can't sign the fake user out - but the identitytoolkit stub **must return a real
  `getAccountInfo` body** (`{ users: [{ localId, email, providerUserInfo, ... }] }`). Fulfilling it
  with `{}` makes Firebase treat the restored session as invalid and **DELETE the seeded record on
  load**, which looks exactly like the seeding having failed.
- `addInitScript` is the wrong place to seed: it cannot be awaited, so its IndexedDB write races
  Firebase's own read. Load the origin first, seed with an **awaited** `page.evaluate` (resolve on
  `tx.oncomplete`), then `reload()`.
- Then `page.route("**/api/users**")` fulfils the save requests and lets you assert the method/body
  (POST without an id → PUT carrying the returned `quizId`). The **server** is stubbed out this way,
  so this proves the client contract only, not token verification or the Firestore writes.

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
24. **Custom domain, quieter grounding credit, and the region-preference fix (this session):**
    - **`sealedskin.com` went live** (DNS at Cloudflare, `A @` + `CNAME www` pointing at Vercel, both
      records **DNS only** / grey cloud so Vercel's cert can issue). `sealedskin.vercel.app` still
      works. Nothing in the code hardcoded the old host, so no repo change was needed — but Firebase
      Auth → Settings → **Authorized domains** must list the new host or Google sign-in fails with
      `auth/unauthorized-domain`.
    - **Grounding credit shrunk to a footnote** — see the Grounding ToS note above. Also fixed a
      layout bug it exposed: Google's chip is a `white-space: nowrap` carousel that overflowed the
      reading column until its wrapper got `min-w-0`.
    - **Region preference fixed end-to-end** — see "Region means brand ORIGIN, not availability".
      Three parts: the prompt (`REGION_RULES` + sending the option's description, not just its
      label), the catalog's mis-tagged brands (The Ordinary / CeraVe / Belif), and a new
      deterministic `enforceRegion()` filter backed by `data/brandRegions.ts`.
    - **Process lesson worth keeping:** the first pass was declared fixed on the strength of ONE
      grounded run per region. Repeating the same profile showed 3 of 4 runs still leaking. Anything
      measured through a grounded model needs **repeated** runs before it counts as verified.
25. **No em dashes, new age bands, and an $80 price ceiling (this session):**
    - **Every long dash in user-facing copy is now a plain hyphen.** Readers clock an em dash as
      "an AI wrote this", so `-` is the house style: 76 replacements across 17 files (page metadata
      and content routes, quiz screens and help text, results screens, `analysis.ts` prose,
      `actives.ts` step notes and ingredient copy, `goals.ts`, `questions.ts`). Code comments were
      left alone. Ranges went with it ("SPF 30-50", "2-3 nights a week").
    - **The AI's copy is normalised too**, prompt **and** enforcement: `STYLE_RULES` (both prompts in
      `agent.ts`) asks for plain hyphens only, and `stripLongDashes()` runs over the whole model
      output at the top of `buildAiResult` — before anything reads it, so step types stay consistent
      with the `productsByType` keys derived from them.
    - **Age ranges are now Under 18 / 18-24 / 25-34 / 35-44 / 45+** (`AgeId` ids `under18`, `18to24`,
      `25to34`, `35to44`, `45plus`). Not just relabelled: the **active targeting moved with the
      bands** — retinoid scores for `25to34/35to44/45plus`, peptides for `35to44/45plus` — and the
      prevention-vs-renewal split in `needsSummary` now breaks at `under18/18to24`. `AGE_LABELS` is
      the sentence form ("Being 25 to 34, …"); a new `AGE_CHIP_LABELS` gives the results chip its
      short form, replacing the `.replace("in your ", "")` string surgery in `SkinQuiz`.
      **Saved routines from before this** hold retired option ids, so their age question shows
      nothing selected when reopened (the snapshot itself still renders fine).
    - **Nothing over $80 is suggested** — see "Nothing over `MAX_PRODUCT_PRICE`" under Shop product
      sourcing. Prompt (`PRICE_RULES`) plus a render-time filter in `ShopView.resolve`, two catalog
      entries removed.
    - Verified: `tsc`/ESLint clean; an SSR unit test of `ShopView` (over-cap picks dropped without
      eating a slot: $182/$95 out, three picks still shown); a catalog sweep (every slot ≥3 picks per
      region, 0 entries over the cap); a `buildAiResult` unit test (0 long dashes left, product keying
      intact); and a full Playwright drive on a **live AI** routine — new age options render, chip
      reads "25-34", prose reads "Being 25 to 34", all 15 picks $10-$24, 0 long dashes, 0 console
      errors.
    - Handy: SSR-rendering a component in a unit test works with the same
      `npx --yes tsx <script>.tsx` trick, but the script must sit **in the repo root** — from the
      scratchpad, Node can't resolve `react-dom/server`.
26. **A freshly saved routine can be updated in place (this session):** `SaveRoutine` now reads the
    `quizId` that `POST /api/users` already returned and hands it up via `onSaved(newId)`; `SkinQuiz`
    keeps it as `createdId`, so rebuilding after a save PUTs that routine instead of leaving a stale
    "Saved ✓" (see "A freshly saved routine is updatable too"). Kept `createdId` separate from
    `editingId` so a fresh quiz doesn't turn into the review hub mid-flow; added `savedMark.created`
    → `savedAsNew` so the first save still reads "Saved ✓", not "Updated ✓".
    - Verified with a **fake Firebase session + stubbed `/api/users`** (new technique, documented
      under "Driving the signed-in flow"): a live-AI fresh quiz → "Save your routine" → POST (no id)
      → "Saved ✓" → model switch → "Save this version / Update my routine" → **PUT with the returned
      id** → "Updated ✓". Repeated twice, identical. The review-hub path was regression-driven from
      the same fixture: a pure review still shows **no** save panel and issues **0** writes, and a
      rebuild there still offers "Save this version" → PUT. 0 console errors in both.
27. **"Discuss with AI" chat on the main routine (this session):** a filled accent pill on the main
    routine's card opens a modal conversation with a grounded cosmetologist persona that discusses
    only that routine — see the section of the same name under User profile. New `lib/ai/chat.ts`,
    `app/api/routine-chat/route.ts` (POST/GET/DELETE, auth required) and
    `components/profile/RoutineChat.tsx`; conversations persist under
    `users/{uid}/quizzes/{quizId}/chat` and are cascade-deleted with the routine. The shared rule
    blocks in `agent.ts` are now exported and reused, so chat obeys the same safety, $80 and
    brand-origin rules.
    - Verified: refusal/scope probes (general knowledge, code, direct injection, adjacent skincare,
      injection after a legitimate turn) — all declined and redirected. Product-recommendation
      grounding measured over repeats: **3/5 before** the retry enforcement (two replies quoted a
      star rating with no search behind it), **8/8 grounded, 0 unverified after**. Playwright drive
      with a fake Firebase session + stubbed `/api/routine-chat`: one Discuss button (main card
      only), correct POST body, history restores on reopen, Clear chat empties it, Esc closes,
      dark-mode scrim fixed, 0 console errors. Real token verification and the Firestore
      read/write path are **not** E2E-tested (same gap as the rest of the signed-in server half).
28. **`gemini-3.6-flash` → `gemini-3.7-flash` (this session):** the `ModelPicker`'s second option,
    changed across `ALLOWED_MODELS`, `ModelPicker`, `.env.example` and the code comments. The id was
    confirmed against the live `models` list first (as with the previous bump), then driven
    end-to-end through `POST /api/routine`: ≈13s, 5 grounded sources + chip, 4 ingredients, 4+4
    steps, 25 products, and **no `thinkingBudget` 400** — the failure the last upgrade hit. Also
    confirmed the retired `gemini-3.6-flash` id now falls back to the env default instead of being
    passed through, which is exactly what `ALLOWED_MODELS` is for. The default model and the routine
    chat are untouched: both still run `gemini-3.5-flash-lite`.

29. **Snuffy gets a name, a face and two voices (this session):** the routine chat's assistant is now
    **Snuffy the Cosmetologist** - a seal, a magical one, and a career cosmetologist. The card pill
    reads **"Discuss with Snuffy"** and the window is headed **"Snuffy The Cosmetologist"**.
    - **Two personalities, picked by the user at the start of a conversation** (Warm and encouraging /
      Dry and direct), because the character had been described two different ways and both were
      worth keeping. New `lib/ai/personas.ts` (whitelist + labels, zero imports so the prompt never
      reaches the browser); `chat.ts` split into `SNUFFY_CORE` + `PERSONA_VOICES` + `SHARED_RULES`
      behind `buildChatSystem(persona)`; `chatPersona` persisted on the routine doc, returned by
      `GET`, resolved request -> stored -> default by `POST`, and cleared by `DELETE` so "Clear chat"
      doubles as changing the voice. See the section above.
    - **Two open questions from PR #6 were closed by the split:** the refusal register is now
      respectful in *either* voice (declining is the worst moment to be clever at someone), and the
      drop-the-act safety rule moved into the shared block so it cannot drift between personalities.
    - **Fixed: the prompts banned a character they used.** `SAFETY_RULES`, `REGION_RULES`,
      `RESEARCH_SYSTEM` and `MINIMAL_RULES` contained 13 em dashes inside the template literals sent
      to the model, while `STYLE_RULES` in the same prompt says "NEVER an em dash". Normalised to
      plain hyphens (comments left alone, matching the earlier pass). The composed chat prompt went
      from 8 long dashes to 0.
    - Verified: `tsc`/ESLint clean; `buildChatSystem` unit-tested across both ids (shared markers
      present in both, no cross-leak, non-voice text byte-identical); full Playwright drive of the
      signed-in UI with a stubbed `/api/routine-chat` - chooser renders light + dark, composer inert
      until a voice is picked, `persona` on the POST body, Clear chat returns to the chooser, 0
      console errors. **Not** exercised: a real grounded reply in either voice, so how the two
      actually sound is still unmeasured.
    - **Fixed after live testing: Snuffy closed every reply with a medical disclaimer.** The
      instruction came from `SAFETY_RULES`, written for the one-shot routine document and inherited
      by the chat. Split into `ROUTINE_DISCLAIMER_RULE` (routine prompts only), told the chat prompt
      not to sign off that way, and added `stripTrailingDisclaimer()` as the deterministic backstop -
      matching stock phrases only, so a real "see a dermatologist" is never stripped. 7/7 unit tests.
    - **Fixed after live testing: Snuffy was too fenced in, and the region chips were wrong.** Scope
      widened from "this saved routine" to "this client's skin and skincare", with stored preferences
      demoted to defaults (a European-leaning routine no longer blocks a Korean product question) and
      a chat-only rider on `REGION_RULES`. Genuinely unrelated questions are still declined. Separately,
      the `Local` / `Pharmacy` region chips were removed (wrong for a worldwide audience) and the
      European description simplified to "European brands". Verified by driving the quiz to both the
      region and commitment steps: region tiles show no chips, commitment tiles keep theirs, 0 console
      errors.
    - **Fixed after live testing: every reply echoed the previous question.** Root cause was Firestore,
      not the prompt - a batch gives both messages of a turn the same commit timestamp, so the
      transcript came back with the turn reversed about half the time and the model saw an unanswered
      older question. Added `lib/domain/chatOrder.ts` and sorted on read (which repairs conversations
      already stored), and rebuilt the trim to delete by id from the ordered history. 6/6 unit tests.
      **Note the server half is still untested end-to-end** - the comparator is unit-tested and the
      route is type-checked, but no test exercises the real Firestore read.

## Likely next steps

- **Measure how the two voices actually sound.** Everything about the personas is verified
  structurally (prompt composition, UI, persistence); no test has read a real grounded reply in
  either voice. Worth repeated runs per persona - especially the dry voice against "never at the
  client's expense", and both against the drop-the-voice rule (pregnancy, anything medical, a client
  upset about their skin). Per the region lesson, one clean run per voice proves nothing.
- **The chat's marketing vocabulary is unguarded.** `PROSE_RULES` is not imported into the chat
  prompt (it exists to fight voicelessness, which a character does not have), so "journey",
  "elevate", "powerhouse" and "game-changer" are only blocked in the routine copy. Promoting two or
  three of the worst into `STYLE_RULES` would close it without touching the split.
- **Pick one model and remove the temporary `ModelPicker`** (the user plans to compare
  `3.5-flash-lite` vs `3.7-flash`, then keep one and delete the switch).
- Add an explicit **account-creation prompt** after results (the pieces exist — auth + `SaveRoutine`
  + the `/profile` page — but there's no dedicated "save & track vs. continue without an account"
  moment yet).
- **E2E-test the signed-in flow against the real server** (PATCH set-main and DELETE especially).
  The client side of save/update is now driven in tests with a **stubbed** `/api/users` and a fake
  Firebase session (see "Driving the signed-in flow" below); what stays unverified is the server
  half — real token verification, the 3-routine cap, `isMain` promotion and delete. The routine
  chat's server half (`/api/routine-chat` Firestore read/write, the 40-message trim, the delete
  cascade) is in the same position.
- **Consider a rate limit on `/api/routine-chat`.** Every message is a paid grounded call (sometimes
  two, when the search retry fires), and today the only limits are auth plus a 1000-character cap.
- Consider giving saved routines **persisted, user-editable names** (currently the "Routine N" label
  is derived from list position, not stored). (A **delete** action now exists.)
- Flesh out the static pages further / add real nav destinations as the marketing site grows.
- Optionally delete `design-incoming/` once no longer needed as reference.
- Mind AI latency vs. serverless timeouts if/when deploying the grounded `3.7-flash` path.
- Consider basic CI (`tsc --noEmit` + `next build`) — the `README.md` and the Vercel deploy are done.
- **Spot-check the EU catalog replacements** added when The Ordinary was re-tagged to `us`: the
  INKEY List / Geek & Gorgeous / Medik8 / Nip+Fab / Facetheory entries came from model knowledge,
  not grounded search, so the exact product names and prices are worth verifying. Offline-fallback
  only, so it's low risk.
- **Keep `data/brandRegions.ts` growing** as grounded searches surface new brands. A dev-only log
  when `enforceRegion` drops a pick would make the gaps visible instead of silent.
- Saved routines keep their original picks until rebuilt, so **pre-fix saves still show off-region
  products**. If that matters, a one-off migration or a "refresh this routine" action would fix it.
