import type { Analysis, Concern, Question } from "../types";

const TYPE_LABELS: Record<string, string> = { dry: "Dry", normal: "Normal", combination: "Combination", oily: "Oily" };

const TYPE_METERS: Record<string, { oil: number; dryness: number }> = {
  dry: { oil: 0, dryness: 3 },
  normal: { oil: 1, dryness: 1 },
  combination: { oil: 2, dryness: 2 },
  oily: { oil: 3, dryness: 1 },
};

const TYPE_PROSE: Record<string, string> = {
  dry: "Your answers point to dry skin. It produces little excess oil, which keeps shine and visible pores to a minimum — but it also means moisture escapes easily, so skin can feel tight, look a little dull, or flake, especially after cleansing or in cold, dry air.",
  normal: "Your answers read as fairly normal, balanced skin. It isn\u2019t especially oily or dry, pores stay modest, and it generally tolerates products well — a stable, forgiving base that most routines can build on.",
  combination: "Your answers point to combination skin. The T-zone — forehead, nose and chin — runs oilier and shinier, while your cheeks sit drier and more comfortable. That split is completely normal; it simply means different zones of your face want slightly different care.",
  oily: "Your answers point to oily skin. The oil glands are quite active, so shine returns through the day, pores look more visible, and skin can lean toward congestion — but that same oil keeps skin supple and tends to slow the look of fine lines over time.",
};

const TYPE_SUBHEAD: Record<string, string> = {
  dry: "Low oil, low moisture retention — comfort and hydration are the priority.",
  normal: "Well balanced and resilient — easy to keep healthy.",
  combination: "An oilier T-zone with drier cheeks — it wants balance, not extremes.",
  oily: "Active oil and visible pores — clarity and balance are the priority.",
};

const SENS_PROSE: Record<string, string> = {
  high: "Your skin is also quite reactive — redness, stinging or tightness come on easily, a sign the barrier is working overtime. Gentle, low-fragrance formulas and a slow, one-at-a-time approach to active ingredients will matter a lot for you.",
  moderate: "Your skin reacts now and then to new products, so patch-testing and introducing stronger actives one at a time is wise — but you have reasonable tolerance overall.",
  low: "Reassuringly, your skin rarely reacts, which gives you room to use more active ingredients — though it\u2019s still smart to introduce them gradually so you can spot what works.",
};

const CONCERN_NOTES: Record<string, string> = {
  acne: "which usually means oil and dead skin are clogging pores and tipping into inflammation",
  congestion: "the blackheads and small bumps that form when pores trap oil and debris",
  oil: "the surface shine that builds up as the day goes on",
  dryness: "a sign your skin is short on water and struggling to hold onto it",
  redness: "reactivity that points to a barrier in need of calming and support",
  dullness: "a build-up of dead surface cells dimming your natural radiance",
  darkspots: "lingering pigment, often left behind by past blemishes or sun exposure",
  wrinkles: "the early lines that appear as collagen production gradually slows",
  firmness: "a subtle loss of bounce as the skin\u2019s support structure softens",
  pores: "pores that look larger when filled with oil or stretched over time",
  texture: "an uneven, slightly rough surface that smoother cell turnover can refine",
  undereye: "shadows and puffiness tied to thin under-eye skin, fluid and fatigue",
};

function needsFromConcerns(ids: string[]): string[] {
  const out: string[] = [];
  const has = (x: string) => ids.includes(x);
  if (has("acne") || has("congestion") || has("oil") || has("pores"))
    out.push("Keep pores clear and balance oil without stripping your skin");
  if (has("dryness")) out.push("Replenish water and lock it in with barrier-supporting moisture");
  if (has("redness")) out.push("Lead with soothing, fragrance-light formulas that calm reactivity");
  if (has("dullness") || has("darkspots") || has("texture"))
    out.push("Brighten and smooth with gentle, gradual exfoliation");
  if (has("wrinkles") || has("firmness"))
    out.push("Support collagen with targeted actives like retinoids and antioxidants");
  if (has("undereye")) out.push("Treat the eye area gently with hydration and brightening");
  return out;
}

export function analyzeSkin(
  answers: Record<string, string>,
  QS: Question[],
  concernIds: string[],
  topConcern: string[] | string,
  CONCERNS: Concern[]
): Analysis {
  const typeQs = ["after_cleanse", "midday_shine", "pores", "tightness", "end_of_day"];
  const counts: Record<string, number> = { dry: 0, normal: 0, combination: 0, oily: 0 };
  typeQs.forEach((qid) => {
    const q = QS.find((x) => x.id === qid);
    const opt = q && q.options.find((o) => o.id === answers[qid]);
    if (opt && opt.signal && counts[opt.signal] !== undefined) counts[opt.signal] += 1;
  });

  const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  let type = (ranked[0][1] === 0 ? "normal" : ranked[0][0]) as Analysis["type"];
  if (counts.dry >= 2 && counts.oily >= 2) type = "combination";
  else if (type !== "combination" && counts.combination >= 2 && counts.combination >= ranked[0][1] - 1)
    type = "combination";

  const sQ = QS.find((x) => x.id === "sensitivity");
  const sOpt = sQ && sQ.options.find((o) => o.id === answers["sensitivity"]);
  const sSignal = sOpt ? sOpt.signal : "somewhat";
  const sensitivity: Analysis["sensitivity"] =
    sSignal === "sensitive" ? "high" : sSignal === "somewhat" ? "moderate" : "low";
  const sensLevel = sensitivity === "high" ? 3 : sensitivity === "moderate" ? 2 : 1;

  const typeLabel = TYPE_LABELS[type];
  const headline = sensitivity === "high" ? `${typeLabel} skin, with a sensitive streak` : `${typeLabel} skin`;

  const ansLabel = (qid: string) => {
    const q = QS.find((x) => x.id === qid);
    const opt = q && q.options.find((o) => o.id === answers[qid]);
    return opt ? opt.label.toLowerCase() : null;
  };
  const ac = ansLabel("after_cleanse");
  const md = ansLabel("midday_shine");
  const eod = ansLabel("end_of_day");
  const behaviourBits: string[] = [];
  if (ac) behaviourBits.push(`after cleansing it feels \u201c${ac}\u201d`);
  if (md) behaviourBits.push(`by midday it\u2019s \u201c${md}\u201d`);
  if (eod) behaviourBits.push(`and by evening it looks \u201c${eod}\u201d`);
  const behaviour = behaviourBits.length
    ? `In your own words, ${behaviourBits.join(", ")} — a pattern that fits ${typeLabel.toLowerCase()} skin well.`
    : "";

  const chosen = CONCERNS.filter((c) => concernIds.includes(c.id));
  const topIds = Array.isArray(topConcern) ? topConcern : topConcern ? [topConcern] : [];
  const tops = topIds.map((id) => chosen.find((c) => c.id === id)).filter(Boolean) as Concern[];
  if (!tops.length && chosen.length) tops.push(chosen[0]);
  let concernsPara = "";
  if (chosen.length) {
    const topIdSet = tops.map((c) => c.id);
    const others = chosen.filter((c) => !topIdSet.includes(c.id));
    let s = `The concerns you flagged sharpen the picture. `;
    if (tops.length >= 2) {
      const labels = tops.map((c) => c.label.toLowerCase());
      const last = labels[labels.length - 1];
      const head = labels.slice(0, -1).join(", ");
      s += `Front of mind are ${head} and ${last} — ${CONCERN_NOTES[tops[0].id] || "the priorities we'll lead with"}.`;
    } else if (tops.length === 1) {
      s += `Front of mind is ${tops[0].label.toLowerCase()} — ${CONCERN_NOTES[tops[0].id] || "a key focus for you"}.`;
    }
    if (others.length === 1) {
      s += ` You also pointed to ${others[0].label.toLowerCase()}, ${CONCERN_NOTES[others[0].id] || ""}.`;
    } else if (others.length > 1) {
      const list = others.map((c) => c.label.toLowerCase());
      const last = list.pop();
      s += ` You also flagged ${list.join(", ")} and ${last} — all common companions to this skin type, and all very workable.`;
    }
    concernsPara = s;
  } else {
    concernsPara =
      "You didn\u2019t flag any specific concerns, which suggests your skin is in a fairly good place — so your routine can focus on maintaining its health and protecting it day to day.";
  }

  const needs: string[] = [];
  if (type === "dry") needs.push("Replenish water and lock it in with barrier-supporting moisture");
  if (type === "oily" || type === "combination") needs.push("Balance oil and keep pores clear without over-drying");
  if (type === "normal") needs.push("Maintain balance with steady, gentle hydration");
  if (sensitivity === "high") needs.push("Lead with soothing, fragrance-light formulas and introduce actives slowly");
  needsFromConcerns(concernIds).forEach((n) => needs.push(n));
  needs.push("Protect every result with daily broad-spectrum SPF");
  const uniqueNeeds = [...new Set(needs)].slice(0, 5);

  const meters = [
    { key: "oil", label: "Oil production", level: TYPE_METERS[type].oil,
      value: ["Low", "Balanced", "Higher in T-zone", "High"][TYPE_METERS[type].oil] },
    { key: "dryness", label: "Dryness", level: TYPE_METERS[type].dryness,
      value: ["Minimal", "Low", "Moderate", "High"][TYPE_METERS[type].dryness] },
    { key: "sens", label: "Sensitivity", level: sensLevel,
      value: ["Very low", "Low", "Moderate", "High"][sensLevel] },
  ];

  const paragraphs = [TYPE_PROSE[type]];
  if (behaviour) paragraphs.push(behaviour);
  paragraphs.push(SENS_PROSE[sensitivity]);
  if (concernsPara) paragraphs.push(concernsPara);

  return { type, typeLabel, sensitivity, headline, subhead: TYPE_SUBHEAD[type], meters, paragraphs, needs: uniqueNeeds };
}
