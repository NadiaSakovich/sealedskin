import type { Concern } from "../types";

export const SKIN_CONCERNS: Concern[] = [
  { id: "acne", label: "Acne & breakouts", desc: "Spots and whiteheads", photo: "breakouts" },
  { id: "congestion", label: "Blackheads & congestion", desc: "Pores that feel bumpy", photo: "blackheads" },
  { id: "oil", label: "Excess oil & shine", desc: "Greasy by midday", photo: "oily shine" },
  { id: "dryness", label: "Dryness & dehydration", desc: "Tight and flaky", photo: "dry skin" },
  { id: "redness", label: "Redness & irritation", desc: "Flushing and reactivity", photo: "redness" },
  { id: "dullness", label: "Dullness & uneven tone", desc: "Looks tired and flat", photo: "dull tone" },
  { id: "darkspots", label: "Dark spots", desc: "Marks left by old spots", photo: "dark spots" },
  { id: "wrinkles", label: "Fine lines & wrinkles", desc: "Early signs of ageing", photo: "fine lines" },
  { id: "firmness", label: "Loss of firmness", desc: "Less bounce than it had", photo: "firmness" },
  { id: "pores", label: "Enlarged pores", desc: "Visible across the face", photo: "large pores" },
  { id: "texture", label: "Uneven texture", desc: "Rough or grainy", photo: "texture" },
  { id: "undereye", label: "Dark circles & puffiness", desc: "Tired-looking eyes", photo: "under-eye" },
];
