import type { Analysis, Profile, Routine, ScoredActive } from "../../types";
import type { GroundingInfo } from "../../lib/ai/types";
import type { ShopProduct } from "../../lib/ai/result";

/** What the profile page knows about a stored routine result. */
export interface SavedResult {
  source?: "ai" | "local";
  profile: Profile;
  analysis: Analysis;
  routine: Routine;
  picked?: ScoredActive[];
  /** Grounded products keyed by routine step `type` (kept so edits don't lose them). */
  productsByType?: Record<string, ShopProduct[]>;
  grounding?: GroundingInfo;
}
