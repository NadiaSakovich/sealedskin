import type { Analysis, Concern, Question } from "../types";

const TYPE_LABELS: Record<string, string> = { dry: "Dry", normal: "Normal", combination: "Combination", oily: "Oily" };

const TYPE_METERS: Record<string, { oil: number; dryness: number }> = {
  dry: { oil: 0, dryness: 3 },
  normal: { oil: 1, dryness: 1 },
  combination: { oil: 2, dryness: 2 },
  oily: { oil: 3, dryness: 1 },
};

const TYPE_PROSE: Record<string, string> = {
  dry: "Your answers point to dry skin. There isn\u2019t much oil on the surface, so shine and open pores are rarely your problem. Water is. It escapes faster than your skin can replace it, which is why things feel tight after washing and flake when the weather turns.",
  normal: "Your answers read as normal, balanced skin. Not much oil, not much dryness, pores that stay out of the way, and a decent tolerance for whatever you put on it. That is a forgiving place to start from.",
  combination: "Your answers point to combination skin. Your forehead, nose and chin run oily. Your cheeks don\u2019t. That split is common and completely normal, and it mostly means one product will never be right for your whole face at once.",
  oily: "Your answers point to oily skin. The glands are busy, so shine comes back through the day and pores are easy to see. There is a real upside, though. Oily skin stays supple, and it tends to line later than dry skin does.",
};

const TYPE_SUBHEAD: Record<string, string> = {
  dry: "Low oil, and it struggles to hold water.",
  normal: "Balanced, and hard to upset.",
  combination: "Oily down the middle, drier at the edges.",
  oily: "Busy oil glands and pores you can see.",
};

const SENS_PROSE: Record<string, string> = {
  high: "It\u2019s also reactive. Redness and stinging turn up easily, which usually means the barrier is under strain. Skip fragrance where you can, and add new actives one at a time with a week in between.",
  moderate: "It reacts to a new product now and then. Nothing dramatic. Patch-test the strong things and you\u2019ll be fine.",
  low: "It almost never reacts, which gives you room to use stronger actives than most people can. Still add them one at a time, so you can tell what\u2019s working.",
};

const CONCERN_NOTES: Record<string, string> = {
  acne: "That usually means oil and dead skin are blocking pores and tipping into inflammation.",
  congestion: "Those are pores holding onto oil and debris.",
  oil: "That\u2019s surface shine building up through the day.",
  dryness: "Your skin is short on water and struggling to keep hold of it.",
  redness: "Reactivity like that points to a barrier that needs calming.",
  dullness: "Dead surface cells build up and dim the light coming back off your skin.",
  darkspots: "Pigment left behind by old blemishes, or by the sun.",
  wrinkles: "Early lines show up as collagen production slows down.",
  firmness: "The support structure underneath softens, and skin loses some bounce.",
  pores: "Pores look bigger when they\u2019re full of oil, or have been stretched over time.",
  texture: "A rough, uneven surface that faster cell turnover can smooth out.",
  undereye: "Thin skin, fluid and tiredness, in some combination.",
};

function needsFromConcerns(ids: string[]): string[] {
  const out: string[] = [];
  const has = (x: string) => ids.includes(x);
  if (has("acne") || has("congestion") || has("oil") || has("pores"))
    out.push("Clear pores and settle oil, gently enough to keep the barrier intact");
  if (has("dryness")) out.push("Put water back in, then seal it with a barrier moisturiser");
  if (has("redness")) out.push("Calm the reactivity first, with fragrance-free formulas");
  if (has("dullness") || has("darkspots") || has("texture"))
    out.push("Brighten and smooth with slow, regular exfoliation");
  if (has("wrinkles") || has("firmness"))
    out.push("Back up collagen with a retinoid and an antioxidant");
  if (has("undereye")) out.push("Hydrate and brighten the eye area, gently");
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
    ? `In your own words: ${behaviourBits.join(", ")}. That pattern is a good fit for ${typeLabel.toLowerCase()} skin.`
    : "";

  const chosen = CONCERNS.filter((c) => concernIds.includes(c.id));
  const topIds = Array.isArray(topConcern) ? topConcern : topConcern ? [topConcern] : [];
  const tops = topIds.map((id) => chosen.find((c) => c.id === id)).filter(Boolean) as Concern[];
  if (!tops.length && chosen.length) tops.push(chosen[0]);
  let concernsPara = "";
  if (chosen.length) {
    const topIdSet = tops.map((c) => c.id);
    const others = chosen.filter((c) => !topIdSet.includes(c.id));
    let s = `What you flagged narrows it down. `;
    if (tops.length >= 2) {
      const labels = tops.map((c) => c.label.toLowerCase());
      const last = labels[labels.length - 1];
      const head = labels.slice(0, -1).join(", ");
      s += `Top of the list are ${head} and ${last}. ${CONCERN_NOTES[tops[0].id] ?? ""}`;
    } else if (tops.length === 1) {
      s += `Top of the list is ${tops[0].label.toLowerCase()}. ${CONCERN_NOTES[tops[0].id] ?? ""}`;
    }
    if (others.length === 1) {
      s += ` You also pointed to ${others[0].label.toLowerCase()}. ${CONCERN_NOTES[others[0].id] ?? ""}`;
    } else if (others.length > 1) {
      const list = others.map((c) => c.label.toLowerCase());
      const last = list.pop();
      s += ` You also flagged ${list.join(", ")} and ${last}. All of them are common alongside this skin type, and all of them are workable.`;
    }
    concernsPara = s.replace(/\s+/g, " ").trim();
  } else {
    concernsPara =
      "You didn\u2019t flag anything specific, which usually means your skin is in decent shape. The routine below is built to keep it there.";
  }

  const needs: string[] = [];
  if (type === "dry") needs.push("Put water back in, then seal it with a barrier moisturiser");
  if (type === "oily" || type === "combination") needs.push("Bring oil down and keep pores clear, gently");
  if (type === "normal") needs.push("Keep it steady with regular, light hydration");
  if (sensitivity === "high") needs.push("Start with soothing, fragrance-free formulas and add actives slowly");
  needsFromConcerns(concernIds).forEach((n) => needs.push(n));
  needs.push("Protect all of it with broad-spectrum SPF, every day");
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
