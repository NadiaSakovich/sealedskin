/**
 * Core domain model for the skincare service.
 *
 * These types are the stable contract between the quiz UI, the AI agent, and
 * the results screen — independent of how any particular screen is designed.
 */

/** A single answered quiz question. `answer` is an array for multi-select. */
export interface QuizAnswer {
  questionId: string;
  question: string;
  answer: string | string[];
}

export type TimeOfDay = "AM" | "PM" | "both";

export interface RoutineStep {
  /** 1-based order within its routine list. */
  step: number;
  /** Product category, e.g. "Cleanser", "Serum", "Moisturizer", "SPF". */
  category: string;
  /** Concrete product type, e.g. "Gentle gel cleanser". */
  productType: string;
  /** Why this is recommended for this specific user. */
  reason: string;
  keyIngredients: string[];
  /** Cadence, e.g. "Daily", "2–3x per week". */
  frequency: string;
}

/* -------------------------------------------------------------------------- */
/* Persistence contract (Firestore)                                            */
/* -------------------------------------------------------------------------- */

/**
 * Raw quiz state captured from the UI — the user's choices, before any derived
 * analysis. Mirrors the `SkinQuiz` component state.
 */
export interface QuizSubmission {
  /** Question id → selected option id (e.g. `after_cleanse` → `tight`). */
  answers: Record<string, string>;
  /** Selected concern ids. */
  concerns: string[];
  /** Up to 3 top-priority concern ids. */
  topConcerns: string[];
  /** Commitment level id (minimal/balanced/thorough), or null if unset. */
  commitment: string | null;
  /** Region id, or null if unset. */
  region: string | null;
}

/**
 * Derived results snapshot, computed client-side by the design logic
 * (`analyzeSkin`/`recommendActives`/`buildRoutine`). Stored alongside the raw
 * submission so a saved record renders without recomputation. Typed loosely
 * (`unknown`) to avoid coupling the persistence layer to the design's view types
 * in `src/types.ts`.
 */
export interface QuizResultSnapshot {
  /** Which engine produced this result ("ai" grounded, or "local" fallback). */
  source?: "ai" | "local";
  profile: unknown;
  analysis: unknown;
  routine: unknown;
  /** Scored ingredients/actives, so a saved routine can show its ingredients screen. */
  picked?: unknown;
  /** Grounded products keyed by routine step `type`. */
  productsByType?: unknown;
  /** Google Search grounding metadata (sources + Search Suggestions chip). */
  grounding?: unknown;
}

/** Body of `POST /api/users`: what the browser sends to persist a completed quiz. */
export interface SaveQuizRequest {
  submission: QuizSubmission;
  result: QuizResultSnapshot;
}

/** A user document under `users/{uid}` (timestamps added server-side). */
export interface UserRecord {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

/* -------------------------------------------------------------------------- */
/* AI agent contract                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Structured output the grounded agent returns. Shapes mirror the design's view
 * types (`src/types.ts`) so they map onto the existing results screens with no
 * lossy conversion. Skin-type analysis is computed locally (and shown mid-quiz),
 * so the AI focuses on ingredients, the routine, and grounded product picks.
 */
export interface AiIngredient {
  /** Display name, e.g. "Niacinamide". */
  name: string;
  /** Short "also known as", e.g. "Vitamin B3". */
  aka: string;
  /** Category, e.g. "Balancing serum". */
  type: string;
  /** What it does. */
  what: string;
  /** Why it helps this specific user. */
  why: string;
  /** Gentle enough to introduce without ramp-up. */
  gentle: boolean;
  /** Short reason tags tying it to the user's profile. */
  reasons: string[];
}

export interface AiRoutineStep {
  type: string;
  active: string | null;
  note: string;
  spf?: boolean;
}

/** A grounded product suggestion, keyed to a routine step by `stepType`. */
export interface AiShopProduct {
  /** Matches a routine step's `type` so the shop screen can group it. */
  stepType: string;
  tier: "Budget" | "Mid" | "Premium";
  brand: string;
  name: string;
  /** Approximate price, e.g. "$18". */
  price: string;
  /** Optional product/source link surfaced from grounding. */
  url?: string;
}

export interface AiRoutineOutput {
  ingredients: AiIngredient[];
  routine: { am: AiRoutineStep[]; pm: AiRoutineStep[]; notes: string[] };
  products: AiShopProduct[];
}

/* -------------------------------------------------------------------------- */
/* Routine chat contract                                                       */
/* -------------------------------------------------------------------------- */

/**
 * One turn of the "Discuss with AI" conversation about a saved routine, stored
 * under `users/{uid}/quizzes/{quizId}/chat`. `grounding` is kept per assistant
 * turn because Google's grounding terms require the sources and Search
 * Suggestions chip to be shown wherever that answer is shown - including when a
 * stored conversation is reloaded.
 */
export interface RoutineChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  /** `GroundingInfo` from `lib/ai/types`, kept `unknown` so persistence stays decoupled. */
  grounding?: unknown;
  /** Epoch millis; null while the server timestamp has not resolved yet. */
  createdAt: number | null;
}

/** Body of `POST /api/routine-chat`. */
export interface RoutineChatRequest {
  /** Which saved routine to discuss. Must belong to the caller. */
  quizId: string;
  message: string;
  /**
   * Which voice Snuffy should answer in (`ChatPersonaId` in `lib/ai/personas`).
   * Kept loose here so the persistence types stay free of the AI modules; the
   * route validates it against the whitelist and falls back to the stored
   * choice, then to the default. Omitted on a conversation that predates the
   * chooser.
   */
  persona?: string;
}

/** The structured routine the AI agent produces from a user's answers. */
export interface SkincareRoutine {
  /** e.g. "Combination, dehydrated". */
  skinType: string;
  primaryConcerns: string[];
  /** Short, personalised overview shown at the top of the results. */
  summary: string;
  amRoutine: RoutineStep[];
  pmRoutine: RoutineStep[];
  /** Less-than-daily treatments, e.g. exfoliants or masks. */
  weeklyTreatments: RoutineStep[];
  ingredientsToAvoid: string[];
  lifestyleTips: string[];
  /** Safety note; not medical advice. */
  disclaimer: string;
}
