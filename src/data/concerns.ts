import type { Concern } from "../types";

export const SKIN_CONCERNS: Concern[] = [
  { id: "acne", label: "Acne & breakouts", desc: "Pimples, whiteheads, spots", photo: "breakouts" },
  { id: "congestion", label: "Blackheads & congestion", desc: "Clogged, bumpy pores", photo: "blackheads" },
  { id: "oil", label: "Excess oil & shine", desc: "Greasy by midday", photo: "oily shine" },
  { id: "dryness", label: "Dryness & dehydration", desc: "Tight, flaky, rough", photo: "dry skin" },
  { id: "redness", label: "Redness & irritation", desc: "Flushing, reactive skin", photo: "redness" },
  { id: "dullness", label: "Dullness & uneven tone", desc: "Tired, lacklustre look", photo: "dull tone" },
  { id: "darkspots", label: "Dark spots", desc: "Post-acne marks, pigment", photo: "dark spots" },
  { id: "wrinkles", label: "Fine lines & wrinkles", desc: "Early signs of ageing", photo: "fine lines" },
  { id: "firmness", label: "Loss of firmness", desc: "Less bounce, sagging", photo: "firmness" },
  { id: "pores", label: "Enlarged pores", desc: "Visible across the face", photo: "large pores" },
  { id: "texture", label: "Uneven texture", desc: "Rough, grainy surface", photo: "texture" },
  { id: "undereye", label: "Dark circles & puffiness", desc: "Tired-looking eyes", photo: "under-eye" },
];
