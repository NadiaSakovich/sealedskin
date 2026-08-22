import type { Active, Profile, ScoredActive, Routine, RoutineStep, Concern, Goal, AgeId, Analysis } from "../types";

export const ACTIVES: Active[] = [
  { id: "spf", name: "Broad-spectrum SPF", aka: "Mineral or hybrid, SPF 30-50", type: "Sunscreen",
    what: "UV does most of the visible damage to skin. Sunscreen is what stops it.",
    why: "Nothing else you use works as hard. Skip it and you undo the rest.",
    for: ["everyone", "protect"], gentle: true },
  { id: "vitc", name: "Vitamin C", aka: "L-ascorbic acid or derivatives", type: "Antioxidant serum",
    what: "A morning antioxidant. It mops up the damage that daylight and pollution leave behind.",
    why: "Dullness lifts and old marks fade. Give it a few months.",
    for: ["dullness", "darkspots", "bright", "glow", "protect"], gentle: true },
  { id: "niacinamide", name: "Niacinamide", aka: "Vitamin B3", type: "Balancing serum",
    what: "The quiet all-rounder. It settles oil, shores up the barrier and evens out tone.",
    why: "Almost nobody reacts to it, and it gets along with everything else in the routine.",
    for: ["oil", "pores", "redness", "dullness", "darkspots", "balance", "calm"], gentle: true },
  { id: "salicylic", name: "Salicylic acid", aka: "BHA", type: "Exfoliating treatment",
    what: "An acid that dissolves in oil, which lets it work inside a clogged pore.",
    why: "The one to reach for when blackheads keep coming back.",
    for: ["acne", "congestion", "oil", "pores", "texture"], gentle: false, avoidInPregnancy: true },
  { id: "benzoyl", name: "Benzoyl peroxide", aka: "2.5-5%", type: "Spot treatment",
    what: "Kills the bacteria that turn a clogged pore into an angry spot.",
    why: "Fast on inflamed breakouts. It bleaches towels and pillowcases, so keep it off the good ones.",
    for: ["acne"], gentle: false, avoidInPregnancy: true },
  { id: "azelaic", name: "Azelaic acid", aka: "10-15%", type: "Targeted serum",
    what: "A mild acid that works on redness, spots and pigment at the same time.",
    why: "Slower than a retinoid and much easier to live with. Good if your skin flares.",
    for: ["redness", "darkspots", "acne", "calm", "dullness"], gentle: true },
  { id: "retinoid", name: "Retinol / Retinoid", aka: "Vitamin A", type: "Renewing treatment",
    what: "Speeds up how fast skin renews itself and nudges it into making more collagen.",
    why: "The best-studied anti-ageing ingredient there is. Also the one most likely to make you peel in week two.",
    for: ["wrinkles", "firmness", "texture", "acne", "darkspots", "25to34", "35to44", "45plus"], gentle: false, avoidInPregnancy: true },
  { id: "aha", name: "Glycolic / Lactic acid", aka: "AHA", type: "Exfoliating treatment",
    what: "A surface exfoliant. It loosens the dull, dead layer sitting on top.",
    why: "Skin looks brighter and feels smoother inside a couple of weeks.",
    for: ["texture", "dullness", "darkspots", "smooth"], gentle: false },
  { id: "peptides", name: "Peptides", aka: "Signal peptides", type: "Firming serum",
    what: "Short chains of amino acids that signal skin to firm and repair.",
    why: "Mild enough to layer with anything. The results are quiet ones.",
    for: ["firmness", "wrinkles", "35to44", "45plus"], gentle: true },
  { id: "ha", name: "Hyaluronic acid", aka: "Humectant", type: "Hydrating serum",
    what: "A humectant. It pulls water into the upper layers of skin.",
    why: "Plumping, straight away. Put it on damp skin and seal it with moisturiser, or it will dry you out.",
    for: ["dryness", "hydration", "dry"], gentle: true },
  { id: "ceramides", name: "Ceramides", aka: "Barrier lipids", type: "Barrier moisturiser",
    what: "The lipids your skin barrier is built from, put back.",
    why: "If your skin is tight, flaky or reacting to everything, start here.",
    for: ["dryness", "redness", "calm", "dry"], gentle: true },
  { id: "cica", name: "Centella (Cica)", aka: "Centella asiatica", type: "Soothing serum",
    what: "Centella extract. It calms irritation and helps skin repair itself.",
    why: "Worth having alongside a retinoid or an acid, for the weeks things get angry.",
    for: ["redness", "calm"], gentle: true },
  { id: "squalane", name: "Squalane", aka: "Lightweight emollient", type: "Facial oil",
    what: "A light oil close to what skin makes itself. Softens with no greasy film.",
    why: "A good last layer for dry skin that still feels tight after moisturiser.",
    for: ["dryness", "balance", "dry"], gentle: true },
];

/** Sentence form, e.g. "Being 25 to 34, ..." (see `needsSummary`). */
export const AGE_LABELS: Record<AgeId, string> = {
  under18: "under 18", "18to24": "18 to 24", "25to34": "25 to 34", "35to44": "35 to 44", "45plus": "45 or older",
};

/** Short form for the results chips, matching the quiz option labels. */
export const AGE_CHIP_LABELS: Record<AgeId, string> = {
  under18: "Under 18", "18to24": "18-24", "25to34": "25-34", "35to44": "35-44", "45plus": "45+",
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

/**
 * Shape rules for a "minimal" routine, shared by the local engine below and the
 * AI path (`lib/ai/result.ts`) so both produce the same thing.
 *
 * A minimal routine is capped at {@link MINIMAL_MAX_STEPS} steps per half of the
 * day, and the morning ends on ONE moisturising sunscreen: splitting moisturiser
 * and SPF into separate steps is redundant when the point is fewer steps, but SPF
 * itself is never dropped.
 */
export const MINIMAL_MAX_STEPS = 3;

/** Step type for the combined moisturiser + SPF that closes a minimal morning. */
export const MOISTURISING_SPF_STEP = "Moisturising sunscreen";

/**
 * Trim a routine to at most {@link MINIMAL_MAX_STEPS}, always keeping the first
 * step (the cleanse) and the last (moisturise / protect) and dropping optional
 * treatments from the middle.
 */
export function capMinimalSteps(steps: RoutineStep[]): RoutineStep[] {
  if (steps.length <= MINIMAL_MAX_STEPS) return steps;
  return [
    steps[0],
    ...steps.slice(1, -1).slice(0, MINIMAL_MAX_STEPS - 2),
    steps[steps.length - 1],
  ];
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

  am.push({ type: cleanser, active: null, note: "Lifts off the night\u2019s oil and sweat" });
  // Daytime serums scale with how involved the routine is: minimal sticks to the
  // essentials (cleanse, moisturise, protect), balanced adds one targeted serum,
  // thorough layers several.
  if (!min) {
    const amSerums: RoutineStep[] = [];
    if (ids.has("vitc")) amSerums.push({ type: "Antioxidant serum", active: "Vitamin C", note: "Antioxidant cover for the day ahead" });
    if (ids.has("niacinamide")) amSerums.push({ type: "Balancing serum", active: "Niacinamide", note: "Evens tone and keeps oil down" });
    if (ids.has("ha")) amSerums.push({ type: "Hydrating serum", active: "Hyaluronic acid", note: "Water first, moisturiser to seal it" });
    amSerums.slice(0, full ? 3 : 1).forEach((s) => am.push(s));
  }
  // Minimal closes the morning with ONE moisturising sunscreen instead of a
  // moisturiser step followed by an SPF step; everything else keeps them separate.
  if (min) {
    am.push({ type: MOISTURISING_SPF_STEP, active: "Broad-spectrum SPF 30-50", note: "Moisturiser and SPF in one step. Never skip it", spf: true });
  } else {
    am.push({ type: moistAM, active: type === "dry" && ids.has("ceramides") ? "Ceramides" : null, note: "Locks in hydration" });
    am.push({ type: "Sunscreen", active: "Broad-spectrum SPF 30-50", note: "The step that protects every other step", spf: true });
  }

  const amHasSPF = am.some((s) => s.spf);
  if (amHasSPF && !min) {
    pm.push({ type: "Oil cleanser or balm", active: null, note: "First cleanse. Melts off sunscreen and makeup" });
    pm.push({ type: cleanser, active: null, note: "Second cleanse. Washes the skin underneath" });
  } else {
    pm.push({ type: cleanser, active: null, note: "Remove the day gently" });
  }

  const exf = ids.has("salicylic")
    ? { active: "Salicylic acid (BHA)", note: "Clears pores. Two or three nights a week" }
    : ids.has("aha")
    ? { active: "Glycolic / Lactic acid (AHA)", note: "Smooths and brightens. Two nights a week" }
    : null;
  if (exf && !min) pm.push({ type: "Exfoliating treatment", active: exf.active, note: exf.note });

  if (ids.has("retinoid"))
    pm.push({ type: "Renewing treatment", active: "Retinol / Retinoid", note: sensitive ? "Start one or two nights a week, over moisturiser" : "Build up to most nights. Never on an acid night" });
  else if (ids.has("benzoyl") && !exf)
    pm.push({ type: "Spot treatment", active: "Benzoyl peroxide", note: "Dab on active breakouts only" });

  if ((full || sensitive) && ids.has("azelaic")) pm.push({ type: "Targeted serum", active: "Azelaic acid", note: "Calms redness and fades marks" });
  else if ((full || sensitive) && ids.has("cica")) pm.push({ type: "Soothing serum", active: "Centella (Cica)", note: "Settles redness and shores up the barrier" });

  if (ids.has("ha") && !min) pm.push({ type: "Hydrating serum", active: "Hyaluronic acid", note: "Replenishes water overnight" });
  pm.push({ type: moistPM, active: type === "dry" && ids.has("ceramides") ? "Ceramides" : null, note: "Seals everything in as you sleep" });
  if (type === "dry" && full && ids.has("squalane")) pm.push({ type: "Facial oil", active: "Squalane", note: "The last layer, for skin that still feels tight" });

  const notes: string[] = [];
  if (["pregnant", "planning", "breastfeeding"].includes(profile.pregnancy ?? ""))
    notes.push("We\u2019ve left out retinoids and the other actives usually avoided in pregnancy or while nursing. Confirm anything new with your doctor.");
  if (ids.has("retinoid") && exf) notes.push("Use your retinoid and your acid on different nights. Never both at once.");
  if (sensitive) notes.push("Your skin reacts easily. Add one new active at a time and patch-test it first.");
  notes.push("Give this six to eight weeks before you judge it.");

  // A minimal routine promises "2–3 steps" — hold it to that in both halves of
  // the day, even when several actives scored well.
  if (min) return { am: capMinimalSteps(am), pm: capMinimalSteps(pm), notes };
  return { am, pm, notes };
}

export function needsSummary(profile: Profile, analysis: Analysis): { paragraph: string; needs: string[] } {
  const t = analysis.typeLabel.toLowerCase();
  // Assembled as whole sentences rather than a running string: the old version
  // appended a comma and then a full stop when only one concern was picked,
  // which rendered as "Front of mind is acne, ."
  const sentences: string[] = [
    profile.sensitivity === "high"
      ? `Your skin reads as ${t}, and it reacts easily.`
      : `Your skin reads as ${t}.`,
  ];

  if (profile.topConcernLabel) {
    const top = profile.topConcernLabel.toLowerCase();
    sentences.push(
      profile.concernCount > 1
        ? `Top of the list is ${top}, with a few related things behind it.`
        : `Top of the list is ${top}.`,
    );
  } else {
    sentences.push("Nothing much is bothering you, so the routine below is about keeping it that way.");
  }

  if (profile.age && AGE_LABELS[profile.age]) {
    sentences.push(
      profile.age === "under18"
        ? "While you\u2019re still in your teens, habits matter more than ingredients."
        : profile.age === "18to24"
        ? `At ${AGE_LABELS[profile.age]}, what you do now saves you work later.`
        : `At ${AGE_LABELS[profile.age]}, firmness and renewal start to matter.`,
    );
  }

  return { paragraph: sentences.join(" "), needs: analysis.needs };
}
