import { PRODUCTS } from "./products";
import type { RegionId } from "../types";

type KnownRegion = Exclude<RegionId, "none">;

/**
 * Where a skincare brand COMES FROM — the country it was founded in and is
 * identified with — not where it is sold. See the region note at the top of
 * `products.ts`.
 *
 * Why this exists: the region preference is enforced deterministically in
 * `lib/ai/result.ts`, because the prompt alone isn't reliable. `agent.ts`'s
 * REGION_RULES spells the rule out and got a European routine from "leaks most
 * runs" to "leaks some runs" — grounding is non-deterministic, and on a bad roll
 * the model still reaches for CeraVe or The Ordinary. Same division of labour as
 * the minimal-routine shape: the prompt gets the right products, the enforcement
 * guarantees the rule.
 *
 * The map is seeded from the catalog in `products.ts` (already tagged by origin,
 * so it stays in sync for free) and extended below with the brands grounded
 * searches actually return. Unknown brands are deliberately treated as ALLOWED —
 * plenty of legitimate small in-region brands will never be listed here, and
 * dropping them would be worse than the occasional miss.
 */
const EXTRA_BRANDS: Record<KnownRegion, string[]> = {
  asia: [
    "Abib", "Aestura", "Axis-Y", "Beplain", "Bioré", "Cetaphil Japan", "d'Alba",
    "Dr. Althea", "Dr.Ceuracle", "Dr. Ceuracle", "Etude", "Etude House", "Hanyul",
    "Haruharu Wonder", "I'm From", "Innisfree", "Iunik", "Klairs", "Kose", "Manyo",
    "Ma:nyo", "Ma:nyo Factory", "Missha", "Nacific", "One Thing", "Peach & Lily",
    "Peach and Lily", "Peach & Slices", "Purito", "Purito Seoul", "Pyunkang Yul",
    "Rohto", "Rovectin", "Senka", "Shiseido", "Skinfood", "Sulwhasoo",
    "The Face Shop", "The Lab by Blanc Doux", "Tirtir", "TIRTIR", "VT Cosmetics",
    "Hatomugi", "Melano CC", "Skin1004", "Cosrx", "Beauty of Joseon",
  ],
  us: [
    "Aveeno", "Bliss", "Bubble", "Burt's Bees", "Colorescience", "Curology",
    "Differin", "Eucerin US", "Hero Cosmetics", "La Roche-Posay US", "Pipette",
    "Skinfix", "SkinFix", "The Inkey List US", "Tower 28", "Tower 28 Beauty",
    "Versed", "Vanicream", "CeraVe", "The Ordinary", "Deciem", "Nécessaire",
    "Necessaire", "Topicals", "Krave Beauty", "Cocokind", "Kiehl's", "Kiehl’s",
    "Niod", "NIOD", "Hylamide", "The Inkey List Canada",
    "Paula's Choice", "Paula’s Choice", "Neutrogena", "Cetaphil", "Olay",
    "Round Lab US",
  ],
  eu: [
    "Altruist", "Apivita", "Balea", "Balea Med", "Beauty Pie", "Biotherm",
    "Caudalie", "Dr. Hauschka", "Ducray", "Elemis", "Embryolisse", "Eucerin",
    "Facetheory", "Filorga", "Isdin", "Korres", "L'Oréal Paris", "L'Oreal Paris",
    "Lierac", "Lush", "Medik8", "Mixa", "Nip+Fab", "Nivea", "Nuxe", "Q+A",
    "Rituals", "Sesderma", "Sisley Paris", "SVR", "The Body Shop", "Uriage",
    "Weleda", "Ziaja", "Ziaja Med", "Cerave EU placeholder", "Bioderma", "Avène",
    "Avene", "Vichy", "Garnier", "Clarins", "La Roche-Posay", "The INKEY List",
    "Geek & Gorgeous", "Pixi", "REN", "REN Clean Skincare", "Byoma", "Simple",
    "E45", "Cetaphil UK placeholder", "Klorane", "A-Derma", "Noreva", "Erborian",
    "Pai Skincare", "Pai", "Biologique Recherche", "Skin Rocks", "Dr Sam's",
    "Dr Sam's Skincare", "Facetheory UK", "La Roche Posay", "Rilastil",
    "Nivea Sun", "Nivea Men", "Eucerin Sun", "Vichy Capital Soleil", "Topialyse",
    "Bioderma Photoderm", "Avene Sun", "Lancome", "Lancôme",
    "Institut Esthederm", "Esthederm", "Payot", "Nuxe Sun", "Roche Posay",
  ],
};

/** Normalize a brand for lookup: fold accents/punctuation and drop a leading "the". */
function norm(brand: string): string {
  return brand
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/^the /, "");
}

const BRAND_REGION: Map<string, KnownRegion> = (() => {
  const map = new Map<string, KnownRegion>();
  // Seed from the catalog, which is already tagged by origin.
  for (const pool of Object.values(PRODUCTS)) {
    for (const p of pool) {
      map.set(norm(p.brand), p.region);
    }
  }
  // The curated extension wins, since it is written specifically for this test.
  for (const [region, brands] of Object.entries(EXTRA_BRANDS) as [KnownRegion, string[]][]) {
    for (const brand of brands) {
      if (/placeholder/i.test(brand)) continue;
      map.set(norm(brand), region);
    }
  }
  return map;
})();

/** The brand's country-of-origin region, or `null` when we don't know it. */
export function brandOrigin(brand: string): KnownRegion | null {
  return BRAND_REGION.get(norm(brand)) ?? null;
}

/**
 * True only when the brand's origin is KNOWN and differs from the requested
 * region. Unknown brands pass — see the note above.
 */
export function isOffRegion(brand: string, region: RegionId): boolean {
  if (!region || region === "none") return false;
  const origin = brandOrigin(brand);
  return origin !== null && origin !== region;
}
