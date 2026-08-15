import type {
  Analysis,
  Concern,
  Goal,
  Profile,
  RegionId,
  Routine,
  RoutineStep,
  ScoredActive,
} from "@/types";
import {
  recommendActives,
  buildRoutine,
  capMinimalSteps,
  MOISTURISING_SPF_STEP,
} from "@/data/actives";
import { isOffRegion } from "@/data/brandRegions";
import type { AiRoutineOutput } from "@/lib/domain/types";
import type { GroundingInfo } from "./types";

/** A product row as the shop screen renders it (region-agnostic display shape). */
export interface ShopProduct {
  tier: string;
  brand: string;
  name: string;
  price: string;
  url?: string;
}

/**
 * Everything the results screens need, independent of whether it came from the
 * AI (grounded) or the local engine (fallback). The four result screens read
 * this single object, so they don't care about the source.
 */
export interface RoutineResult {
  source: "ai" | "local";
  analysis: Analysis;
  profile: Profile;
  picked: ScoredActive[];
  routine: Routine;
  /**
   * Step `type` -> real-time grounded products from the AI. Present on AI results
   * (shown verbatim — never topped up from the static catalog). Absent on the
   * offline `local` fallback, which is the only path that uses the static catalog.
   */
  productsByType?: Record<string, ShopProduct[]>;
  grounding?: GroundingInfo;
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

/** Em dash, en dash and the horizontal bar, all replaced by a plain hyphen. */
const LONG_DASH_RE = /[—–―]/g;

/**
 * Models love an em dash, and readers read it as "written by an AI" - so all of
 * our own copy uses plain hyphens, and the model's copy is normalised to match.
 * `STYLE_RULES` in `agent.ts` asks for the same thing; this is the guarantee,
 * the same prompt-plus-enforcement split as the region and minimal-shape rules.
 *
 * Applied to the whole output before anything else reads it, so step types stay
 * consistent with the `productsByType` keys derived from them.
 */
function stripLongDashes<T>(value: T): T {
  if (typeof value === "string") return value.replace(LONG_DASH_RE, "-") as T;
  if (Array.isArray(value)) return value.map(stripLongDashes) as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = stripLongDashes(v);
    return out as T;
  }
  return value;
}

/** A step is a lumped "double cleanse" if its type says so. */
const DOUBLE_CLEANSE_RE = /double\s*cleans/i;
/** Product names that read as an oil/balm (first) cleanser rather than a water-based one. */
const OIL_CLEANSER_RE = /\b(oil|balm|sherbet)\b|cleansing oil|cleansing balm|oil[- ]?to[- ]?foam/i;

const OIL_CLEANSE_STEP = "Oil cleanser or balm";
const WATER_CLEANSE_STEP = "Water-based cleanser";
/** A minimal routine keeps one evening cleanse, so a lumped step collapses to this. */
const SINGLE_CLEANSE_STEP = "Cleanser";

/** Step types that read as the sunscreen step. Tested BEFORE the moisturiser test. */
const SPF_STEP_RE = /sunscreen|spf|\bsun\b/i;
/** Step types that read as a plain moisturiser (incl. night cream / gel-cream). */
const MOISTURISER_STEP_RE = /moistur|night\s*cream|\bcream\b|\blotion\b/i;

/**
 * Hold an AI routine to the minimal shape: at most 3 steps per half of the day,
 * with the morning ending on ONE moisturising sunscreen. Both rules are also in
 * the prompts (`agent.ts` `MINIMAL_RULES`), but the model doesn't reliably comply
 * — same lesson as the double-cleanse split — so this is the guarantee.
 *
 * Mutates `productsByType`: the combined step is re-keyed so the shop screen
 * resolves it exactly rather than falling back to family matching.
 */
function applyMinimalShape(
  routine: Routine,
  productsByType: Record<string, ShopProduct[]>,
): Routine {
  const isSpf = (s: RoutineStep) => !!s.spf || SPF_STEP_RE.test(s.type);
  const isMoisturiser = (s: RoutineStep) => !isSpf(s) && MOISTURISER_STEP_RE.test(s.type);

  // Collapse the morning's moisturiser + sunscreen into one closing step. If the
  // model skipped SPF entirely we still add it — sunscreen is never optional.
  const spf = [...routine.am].reverse().find(isSpf);
  const picks = spf ? productsByType[spf.type] ?? [] : [];
  if (spf && spf.type !== MOISTURISING_SPF_STEP) delete productsByType[spf.type];
  productsByType[MOISTURISING_SPF_STEP] = picks;

  const am = [
    ...routine.am.filter((s) => !isSpf(s) && !isMoisturiser(s)),
    {
      type: MOISTURISING_SPF_STEP,
      active: spf?.active ?? "Broad-spectrum SPF 30-50",
      note: "Hydrates and protects in one - never skip it",
      spf: true as const,
    },
  ];

  return { ...routine, am: capMinimalSteps(am), pm: capMinimalSteps(routine.pm) };
}

/** Adapt the grounded AI output onto the design view types. */
/**
 * Drop grounded picks whose brand demonstrably comes from another region.
 *
 * The region preference means brand ORIGIN (see `data/brandRegions.ts`), and the
 * prompt alone doesn't hold: measured over repeated runs of the same European
 * profile on `gemini-3.5-flash-lite`, 3 of 4 still slipped in CeraVe, The
 * Ordinary or a Korean brand. So the prompt gets the right products and this
 * guarantees the rule — the same split as the minimal-routine shape.
 *
 * Mutates in place, and runs LAST so the split/minimal reshuffles above have
 * already settled their `productsByType` keys. Only brands whose origin we
 * actually know are dropped; a step left with fewer picks (or none) is fine —
 * `ShopView` renders an empty step with a note rather than hiding it.
 */
function enforceRegion(productsByType: Record<string, ShopProduct[]>, region: RegionId): void {
  if (!region || region === "none") return;
  for (const [step, picks] of Object.entries(productsByType)) {
    productsByType[step] = picks
      .map((p) => keepInRegion(p, region))
      .filter((p): p is ShopProduct => p !== null);
  }
}

/** Split a paired "A / B" (or "A or B") field into its alternatives. */
const ALTERNATIVES_RE = /\s*\/\s*|\s+or\s+/i;

/**
 * A single pick, with out-of-region alternatives removed — or `null` if nothing
 * of it survives.
 *
 * The model sometimes offers two brands in one row ("Heimish / SVR", named
 * "All Clean Balm / Topialyse Cleansing Balm"). That slipped straight through a
 * plain brand lookup, because the joined string matches no brand at all. When
 * the brand and name split into the same number of parts we can drop just the
 * offending half and keep the rest; when they don't line up we can't tell which
 * name belongs to which brand, so the whole pick goes.
 */
function keepInRegion(p: ShopProduct, region: RegionId): ShopProduct | null {
  const brands = p.brand.split(ALTERNATIVES_RE).filter(Boolean);
  if (brands.length < 2) return isOffRegion(p.brand, region) ? null : p;

  const names = p.name.split(ALTERNATIVES_RE).filter(Boolean);
  const keep = brands
    .map((brand, i) => ({ brand, name: names[i] }))
    .filter((x) => !isOffRegion(x.brand, region));
  if (!keep.length) return null;
  if (keep.length === brands.length) return p;
  if (names.length !== brands.length) return null;
  return { ...p, brand: keep.map((x) => x.brand).join(" / "), name: keep.map((x) => x.name).join(" / ") };
}

export function buildAiResult(
  rawOutput: AiRoutineOutput,
  profile: Profile,
  analysis: Analysis,
  grounding?: GroundingInfo,
): RoutineResult {
  const output = stripLongDashes(rawOutput);

  const picked: ScoredActive[] = output.ingredients.map((ing, i) => ({
    active: {
      // id is only used as a render key; synthesize a stable one.
      id: `ai-${i}-${slug(ing.name)}`,
      name: ing.name,
      aka: ing.aka,
      type: ing.type,
      what: ing.what,
      why: ing.why,
      for: [],
      gentle: ing.gentle,
    },
    // Preserve the model's ordering as a descending pseudo-score.
    score: output.ingredients.length - i,
    reasons: ing.reasons ?? [],
  }));

  // Grounded products keyed by the exact step type the model assigned them.
  const productsByType: Record<string, ShopProduct[]> = {};
  for (const p of output.products ?? []) {
    (productsByType[p.stepType] ??= []).push({
      tier: p.tier,
      brand: p.brand,
      name: p.name,
      price: p.price,
      ...(p.url ? { url: p.url } : {}),
    });
  }

  const minimal = profile.commitment === "minimal";

  // The model sometimes emits a single "Double cleanse" step, then hangs a mix of
  // oil AND water cleansers off it — confusing on the shop page. Split any such
  // step into two explicit steps (oil/balm first, water-based second) and
  // partition that step's products between them by name, so each step shows only
  // the cleansers that belong to it.
  const splitStep = (s: {
    type: string;
    active: string | null | undefined;
    note: string;
    spf?: boolean;
  }): Routine["am"] => {
    const base = {
      type: s.type,
      active: s.active ?? null,
      note: s.note,
      ...(s.spf ? { spf: true as const } : {}),
    };
    if (!DOUBLE_CLEANSE_RE.test(s.type)) return [base];

    const picks = productsByType[s.type] ?? [];
    // Minimal routines keep a SINGLE evening cleanse, so collapse rather than
    // split — preferring the water-based picks, which is what one cleanse means.
    if (minimal) {
      const water = picks.filter((p) => !OIL_CLEANSER_RE.test(p.name));
      productsByType[SINGLE_CLEANSE_STEP] = water.length ? water : picks;
      delete productsByType[s.type];
      return [{ type: SINGLE_CLEANSE_STEP, active: null, note: "Remove the day gently" }];
    }
    // Set both keys (even if empty) so the shop's tolerant matcher resolves each
    // split step exactly and never cross-fills one from the other.
    productsByType[OIL_CLEANSE_STEP] = picks.filter((p) => OIL_CLEANSER_RE.test(p.name));
    productsByType[WATER_CLEANSE_STEP] = picks.filter((p) => !OIL_CLEANSER_RE.test(p.name));
    delete productsByType[s.type];
    return [
      { type: OIL_CLEANSE_STEP, active: null, note: "First cleanse - melts away SPF, makeup and the day's grime" },
      { type: WATER_CLEANSE_STEP, active: null, note: "Second cleanse - washes the skin underneath" },
    ];
  };

  const built: Routine = {
    am: output.routine.am.flatMap(splitStep),
    pm: output.routine.pm.flatMap(splitStep),
    notes: output.routine.notes ?? [],
  };
  const routine = minimal ? applyMinimalShape(built, productsByType) : built;
  enforceRegion(productsByType, profile.region);

  return { source: "ai", analysis, profile, picked, routine, productsByType, grounding };
}

/**
 * Package the existing local logic into the same shape, for the fallback path
 * (no API key, AI error). This is the app's original behaviour.
 */
export function buildLocalResult(
  profile: Profile,
  analysis: Analysis,
  CONCERNS: Concern[],
  GOALS: Goal[],
): RoutineResult {
  const picked = recommendActives(profile, CONCERNS, GOALS);
  const routine = buildRoutine(profile, picked);
  return { source: "local", analysis, profile, picked, routine };
}
