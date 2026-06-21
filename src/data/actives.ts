import type { Active, Profile, ScoredActive, Routine, RoutineStep, Concern, Goal, AgeId, Analysis } from "../types";

export const ACTIVES: Active[] = [
  { id: "spf", name: "Broad-spectrum SPF", aka: "Mineral or hybrid, SPF 30–50", type: "Sunscreen",
    what: "Shields skin from UV — the main driver of dark spots, fine lines and lost firmness.",
    why: "The single most effective step for protecting your skin and every result you build.",
    for: ["everyone", "protect"], gentle: true },
  { id: "vitc", name: "Vitamin C", aka: "L-ascorbic acid or derivatives", type: "Antioxidant serum",
    what: "A daytime antioxidant that neutralises pollution and brightens with use.",
    why: "Lifts dullness, softens dark marks and brings back a natural glow.",
    for: ["dullness", "darkspots", "bright", "glow", "protect"], gentle: true },
  { id: "niacinamide", name: "Niacinamide", aka: "Vitamin B3", type: "Balancing serum",
    what: "A gentle all-rounder that regulates oil, strengthens the barrier and evens tone.",
    why: "Calms shine and redness while quietly refining pores and marks.",
    for: ["oil", "pores", "redness", "dullness", "darkspots", "balance", "calm"], gentle: true },
  { id: "salicylic", name: "Salicylic acid", aka: "BHA", type: "Exfoliating treatment",
    what: "An oil-soluble acid that gets inside pores to clear oil and dead skin.",
    why: "Keeps breakouts and blackheads in check and refines congested skin.",
    for: ["acne", "congestion", "oil", "pores", "texture"], gentle: false, avoidInPregnancy: true },
  { id: "benzoyl", name: "Benzoyl peroxide", aka: "2.5–5%", type: "Spot treatment",
    what: "Kills the bacteria behind inflamed breakouts.",
    why: "Targets active, stubborn spots directly.",
    for: ["acne"], gentle: false, avoidInPregnancy: true },
  { id: "azelaic", name: "Azelaic acid", aka: "10–15%", type: "Targeted serum",
    what: "A gentle multitasker for redness, breakouts and pigment.",
    why: "A calmer route to clearer, more even skin — kind to sensitive types.",
    for: ["redness", "darkspots", "acne", "calm", "dullness"], gentle: true },
  { id: "retinoid", name: "Retinol / Retinoid", aka: "Vitamin A", type: "Renewing treatment",
    what: "Speeds cell turnover and stimulates collagen as it renews skin.",
    why: "The gold-standard active for lines, firmness, texture and stubborn breakouts.",
    for: ["wrinkles", "firmness", "texture", "acne", "darkspots", "30s", "40s", "50plus"], gentle: false, avoidInPregnancy: true },
  { id: "aha", name: "Glycolic / Lactic acid", aka: "AHA", type: "Exfoliating treatment",
    what: "A surface exfoliant that sweeps away dull, rough dead skin.",
    why: "Smooths texture and brings back brightness and even tone.",
    for: ["texture", "dullness", "darkspots", "smooth"], gentle: false },
  { id: "peptides", name: "Peptides", aka: "Signal peptides", type: "Firming serum",
    what: "Amino-acid messengers that prompt skin to firm and repair.",
    why: "Supports bounce and resilience — gentle enough for most routines.",
    for: ["firmness", "wrinkles", "40s", "50plus"], gentle: true },
  { id: "ha", name: "Hyaluronic acid", aka: "Humectant", type: "Hydrating serum",
    what: "Draws water into the skin for instant plumping and comfort.",
    why: "Tops up hydration so skin looks fuller and feels less tight.",
    for: ["dryness", "hydration", "dry"], gentle: true },
  { id: "ceramides", name: "Ceramides", aka: "Barrier lipids", type: "Barrier moisturiser",
    what: "Replenish the natural lipids that seal moisture in.",
    why: "Reinforces a dry or reactive barrier so it holds water and calms down.",
    for: ["dryness", "redness", "calm", "dry"], gentle: true },
  { id: "cica", name: "Centella (Cica)", aka: "Centella asiatica", type: "Soothing serum",
    what: "A soothing botanical that calms irritation and supports healing.",
    why: "Settles redness and reactivity, especially alongside stronger actives.",
    for: ["redness", "calm"], gentle: true },
  { id: "squalane", name: "Squalane", aka: "Lightweight emollient", type: "Facial oil",
    what: "A skin-like oil that softens and reinforces the barrier without grease.",
    why: "Locks in moisture and comfort — ideal for dry or depleted skin.",
    for: ["dryness", "balance", "dry"], gentle: true },
];

export const AGE_LABELS: Record<AgeId, string> = {
  under20: "under 20", "20s": "in your 20s", "30s": "in your 30s", "40s": "in your 40s", "50plus": "50 or older",
};

export function recommendActives(profile: Profile, CONCERNS: Concern[], GOALS: Goal[]): ScoredActive[] {
  const cl = (id: string) => (CONCERNS.find((c) => c.id === id) || ({} as Concern)).label;
  const gl = (id: string) => (GOALS.find((g) => g.id === id) || ({} as Goal)).label;
  const restricted = ["pregnant", "planning", "breastfeeding"].includes(profile.pregnancy ?? "");

  const scored: ScoredActive[] = ACTIVES.filter((a) => !(restricted && a.avoidInPregnancy)).map((a) => {
    let score = 0;
    const reasons: string[] = [];
    a.for.forEach((f) => {
      if (profile.concernIds.includes(f)) { score += 3; if (cl(f)) reasons.push(cl(f)); }
      else if (profile.goalIds.includes(f)) { score += 2; if (gl(f)) reasons.push(gl(f)); }
      else if (f === profile.type) { score += 2; reasons.push(`${profile.typeLabel} skin`); }
      else if (f === profile.age) { score += 1.5; reasons.push("your age range"); }
      else if (f === "everyone") { score += 1; }
    });
    if (profile.sensitivity === "high" && !a.gentle) score -= 1.5;
    return { active: a, score, reasons: [...new Set(reasons)] };
  });

  let picked = scored.filter((s) => s.score > 0);
  if (!picked.find((p) => p.active.id === "spf")) picked.push(scored.find((s) => s.active.id === "spf")!);
  if (!picked.find((p) => ["ha", "ceramides", "squalane"].includes(p.active.id)))
    picked.push(scored.find((s) => s.active.id === "ha")!);

  picked = [...new Map(picked.map((p) => [p.active.id, p])).values()];
  picked.sort((a, b) => b.score - a.score);
  const top = picked.slice(0, 7);
  if (!top.find((p) => p.active.id === "spf")) {
    top.pop();
    top.push(picked.find((p) => p.active.id === "spf")!);
  }
  return top;
}

export function buildRoutine(profile: Profile, picked: ScoredActive[]): Routine {
  const ids = new Set(picked.map((p) => p.active.id));
  const lvl = profile.commitment || "balanced";
  const full = lvl === "thorough";
  const min = lvl === "minimal";
  const type = profile.type;
  const sensitive = profile.sensitivity === "high";

  const cleanser =
    type === "oily" || type === "combination" ? "Gel or foaming cleanser"
    : type === "dry" ? "Cream or milk cleanser"
    : sensitive ? "Gentle non-foaming cleanser" : "Gentle gel cleanser";
  const moistAM =
    type === "oily" ? "Oil-free gel moisturiser"
    : type === "dry" ? "Rich cream moisturiser"
    : type === "combination" ? "Light lotion moisturiser" : "Lightweight moisturiser";
  const moistPM =
    type === "dry" ? "Rich night cream" : type === "oily" ? "Gel-cream" : "Nourishing night cream";

  const am: RoutineStep[] = [];
  const pm: RoutineStep[] = [];

  am.push({ type: cleanser, active: null, note: "Start clean without stripping" });
  // Daytime serums scale with how involved the routine is: minimal sticks to the
  // essentials (cleanse, moisturise, protect), balanced adds one targeted serum,
  // thorough layers several.
  if (!min) {
    const amSerums: RoutineStep[] = [];
    if (ids.has("vitc")) amSerums.push({ type: "Antioxidant serum", active: "Vitamin C", note: "Brightens and defends through the day" });
    if (ids.has("niacinamide")) amSerums.push({ type: "Balancing serum", active: "Niacinamide", note: "Evens tone, keeps oil in check" });
    if (ids.has("ha")) amSerums.push({ type: "Hydrating serum", active: "Hyaluronic acid", note: "Plumps and preps for moisturiser" });
    amSerums.slice(0, full ? 3 : 1).forEach((s) => am.push(s));
  }
  am.push({ type: moistAM, active: type === "dry" && ids.has("ceramides") ? "Ceramides" : null, note: "Locks in hydration" });
  am.push({ type: "Sunscreen", active: "Broad-spectrum SPF 30–50", note: "Never skip — protects every result", spf: true });

  const amHasSPF = am.some((s) => s.spf);
  if (amHasSPF && !min) {
    pm.push({ type: "Oil cleanser or balm", active: null, note: "First cleanse — melts away SPF, makeup and grime" });
    pm.push({ type: cleanser, active: null, note: "Second cleanse — washes the skin underneath" });
  } else {
    pm.push({ type: cleanser, active: null, note: "Remove the day gently" });
  }

  const exf = ids.has("salicylic")
    ? { active: "Salicylic acid (BHA)", note: "Clears pores — 2–3 nights a week" }
    : ids.has("aha")
    ? { active: "Glycolic / Lactic acid (AHA)", note: "Smooths and brightens — 2 nights a week" }
    : null;
  if (exf && !min) pm.push({ type: "Exfoliating treatment", active: exf.active, note: exf.note });

  if (ids.has("retinoid"))
    pm.push({ type: "Renewing treatment", active: "Retinol / Retinoid", note: sensitive ? "Start 1–2 nights a week, buffer with moisturiser" : "Build to most nights — not the same night as acids" });
  else if (ids.has("benzoyl") && !exf)
    pm.push({ type: "Spot treatment", active: "Benzoyl peroxide", note: "Dab on active breakouts only" });

  if ((full || sensitive) && ids.has("azelaic")) pm.push({ type: "Targeted serum", active: "Azelaic acid", note: "Calms redness and fades marks" });
  else if ((full || sensitive) && ids.has("cica")) pm.push({ type: "Soothing serum", active: "Centella (Cica)", note: "Settles redness, supports the barrier" });

  if (ids.has("ha") && !min) pm.push({ type: "Hydrating serum", active: "Hyaluronic acid", note: "Replenishes water overnight" });
  pm.push({ type: moistPM, active: type === "dry" && ids.has("ceramides") ? "Ceramides" : null, note: "Seals everything in as you sleep" });
  if (type === "dry" && full && ids.has("squalane")) pm.push({ type: "Facial oil", active: "Squalane", note: "Final layer for lasting comfort" });

  const notes: string[] = [];
  if (["pregnant", "planning", "breastfeeding"].includes(profile.pregnancy ?? ""))
    notes.push("We\u2019ve left out retinoids and other actives best avoided during pregnancy or nursing — always confirm with your doctor.");
  if (ids.has("retinoid") && exf) notes.push("Alternate your retinoid and exfoliating acid on different nights — never both at once.");
  if (sensitive) notes.push("Introduce one new active at a time and patch-test first — your skin reacts easily.");
  notes.push("Give any new routine 6–8 weeks of consistency before judging results.");

  return { am, pm, notes };
}

export function needsSummary(profile: Profile, analysis: Analysis): { paragraph: string; needs: string[] } {
  const t = analysis.typeLabel.toLowerCase();
  const sens = profile.sensitivity === "high";
  let lead = `Your skin reads as ${t}${sens ? ", with a reactive, sensitive streak" : ""}. `;
  if (profile.topConcernLabel) {
    lead += `Front of mind is ${profile.topConcernLabel.toLowerCase()}, `;
    lead += profile.concernCount > 1 ? `alongside a few related concerns. ` : `. `;
  } else {
    lead += `It\u2019s in fairly good shape, so the focus is on keeping it healthy. `;
  }
  if (profile.age && AGE_LABELS[profile.age]) {
    lead += `Being ${AGE_LABELS[profile.age]}, ${
      profile.age === "under20" || profile.age === "20s"
        ? "prevention and gentle balance matter most right now."
        : "supporting firmness and renewal becomes increasingly worthwhile."
    }`;
  }
  return { paragraph: lead.trim(), needs: analysis.needs };
}
