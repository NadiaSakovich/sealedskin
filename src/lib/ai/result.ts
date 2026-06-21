import type {
  Analysis,
  Concern,
  Goal,
  Profile,
  Routine,
  ScoredActive,
} from "@/types";
import { recommendActives, buildRoutine } from "@/data/actives";
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
  /** Step `type` -> grounded products. Absent steps fall back to the static catalog. */
  productsByType?: Record<string, ShopProduct[]>;
  grounding?: GroundingInfo;
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

/** Adapt the grounded AI output onto the design view types. */
export function buildAiResult(
  output: AiRoutineOutput,
  profile: Profile,
  analysis: Analysis,
  grounding?: GroundingInfo,
): RoutineResult {
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

  const routine: Routine = {
    am: output.routine.am.map((s) => ({
      type: s.type,
      active: s.active ?? null,
      note: s.note,
      ...(s.spf ? { spf: true } : {}),
    })),
    pm: output.routine.pm.map((s) => ({
      type: s.type,
      active: s.active ?? null,
      note: s.note,
      ...(s.spf ? { spf: true } : {}),
    })),
    notes: output.routine.notes ?? [],
  };

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
