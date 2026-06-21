import type { Goal, OptionLevel } from "../types";

export const SKIN_GOALS: Goal[] = [
  { id: "clear", label: "Clear, blemish-free skin", desc: "Fewer breakouts & spots" },
  { id: "calm", label: "Calm, less reactive skin", desc: "Less redness & irritation" },
  { id: "hydration", label: "Deep, lasting hydration", desc: "Plump, comfortable skin" },
  { id: "bright", label: "Brighter, even tone", desc: "Less dullness & patchiness" },
  { id: "smooth", label: "Smoother texture", desc: "Refined, soft surface" },
  { id: "pores", label: "Smaller-looking pores", desc: "Tighter, cleaner pores" },
  { id: "firm", label: "Firmer, younger look", desc: "More bounce & resilience" },
  { id: "balance", label: "Balanced, less oily", desc: "Shine under control" },
  { id: "glow", label: "A healthy glow", desc: "Radiant, lit-from-within" },
  { id: "protect", label: "Prevent future damage", desc: "Guard against ageing & sun" },
  { id: "fade", label: "Fade dark spots", desc: "Even out marks & pigment" },
  { id: "simple", label: "A simple routine", desc: "Effective, low effort" },
];

export const COMMITMENT_LEVELS: OptionLevel[] = [
  { id: "minimal", label: "Keep it minimal", desc: "2–3 steps — in and out, every day", meta: "Essentials only" },
  { id: "balanced", label: "A balanced routine", desc: "4–5 steps — a proper morning & evening", meta: "Most popular" },
  { id: "thorough", label: "Go thorough", desc: "6+ steps — I enjoy the full ritual", meta: "Maximum results" },
];

export const REGIONS: OptionLevel[] = [
  { id: "asia", label: "Korean & Asian", desc: "K-beauty, J-beauty and Asian brands", meta: "K-beauty", region: "asia" },
  { id: "us", label: "US & Canada", desc: "North American brands", meta: "Local", region: "us" },
  { id: "eu", label: "European", desc: "European pharmacy & heritage brands", meta: "Pharmacy", region: "eu" },
  { id: "none", label: "No preference", desc: "Show me the best mix from everywhere", meta: "Best mix", region: "none" },
];
