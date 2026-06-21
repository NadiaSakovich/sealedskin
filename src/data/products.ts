import type { Product, RegionId, RoutineStep } from "../types";

export const PRODUCTS: Record<string, Product[]> = {
  "cleanser-gel": [
    { region: "asia", tier: "Budget", brand: "COSRX", name: "Low pH Good Morning Gel Cleanser", price: "$12" },
    { region: "asia", tier: "Mid", brand: "Anua", name: "Heartleaf Quenched Cleansing Foam", price: "$19" },
    { region: "us", tier: "Budget", brand: "CeraVe", name: "Foaming Facial Cleanser", price: "$16" },
    { region: "us", tier: "Premium", brand: "Youth to the People", name: "Superfood Antioxidant Cleanser", price: "$39" },
    { region: "eu", tier: "Mid", brand: "La Roche-Posay", name: "Toleriane Purifying Foaming Cleanser", price: "$16" },
  ],
  "cleanser-cream": [
    { region: "asia", tier: "Budget", brand: "Beauty of Joseon", name: "Green Plum Refreshing Cleanser", price: "$17" },
    { region: "asia", tier: "Mid", brand: "Round Lab", name: "1025 Dokdo Cleanser", price: "$19" },
    { region: "us", tier: "Budget", brand: "CeraVe", name: "Hydrating Facial Cleanser", price: "$16" },
    { region: "us", tier: "Premium", brand: "Fresh", name: "Soy Face Cleanser", price: "$39" },
    { region: "eu", tier: "Mid", brand: "La Roche-Posay", name: "Toleriane Hydrating Gentle Cleanser", price: "$16" },
  ],
  "cleanser-oil": [
    { region: "asia", tier: "Budget", brand: "Banila Co", name: "Clean It Zero Cleansing Balm", price: "$19" },
    { region: "asia", tier: "Mid", brand: "DHC", name: "Deep Cleansing Oil", price: "$30" },
    { region: "eu", tier: "Budget", brand: "The INKEY List", name: "Oat Cleansing Balm", price: "$13" },
    { region: "us", tier: "Premium", brand: "Clinique", name: "Take The Day Off Cleansing Balm", price: "$37" },
  ],
  spf: [
    { region: "asia", tier: "Budget", brand: "Beauty of Joseon", name: "Relief Sun SPF 50+", price: "$18" },
    { region: "asia", tier: "Mid", brand: "Round Lab", name: "Birch Juice Moisturizing Sun Cream", price: "$24" },
    { region: "us", tier: "Budget", brand: "Neutrogena", name: "Ultra Sheer Dry-Touch SPF 55", price: "$11" },
    { region: "us", tier: "Premium", brand: "EltaMD", name: "UV Clear Broad-Spectrum SPF 46", price: "$41" },
    { region: "eu", tier: "Mid", brand: "La Roche-Posay", name: "Anthelios Melt-in Milk SPF 60", price: "$30" },
  ],
  vitc: [
    { region: "eu", tier: "Budget", brand: "The Ordinary", name: "Vitamin C Suspension 23%", price: "$8" },
    { region: "asia", tier: "Mid", brand: "Some By Mi", name: "Galactomyces Pure Vitamin C Serum", price: "$20" },
    { region: "us", tier: "Mid", brand: "Maelove", name: "Glow Maker Vitamin C Serum", price: "$30" },
    { region: "us", tier: "Premium", brand: "SkinCeuticals", name: "C E Ferulic", price: "$182" },
  ],
  niacinamide: [
    { region: "eu", tier: "Budget", brand: "The Ordinary", name: "Niacinamide 10% + Zinc 1%", price: "$6" },
    { region: "asia", tier: "Mid", brand: "Anua", name: "Niacinamide 10% + TXA 4% Serum", price: "$20" },
    { region: "us", tier: "Mid", brand: "Glossier", name: "Super Pure Niacinamide + Zinc", price: "$28" },
    { region: "us", tier: "Premium", brand: "Paula\u2019s Choice", name: "10% Niacinamide Booster", price: "$49" },
  ],
  ha: [
    { region: "eu", tier: "Budget", brand: "The Ordinary", name: "Hyaluronic Acid 2% + B5", price: "$9" },
    { region: "asia", tier: "Mid", brand: "Isntree", name: "Hyaluronic Acid Water Essence", price: "$22" },
    { region: "us", tier: "Mid", brand: "Neutrogena", name: "Hydro Boost Hydrating Serum", price: "$22" },
    { region: "eu", tier: "Premium", brand: "Vichy", name: "Min\u00e9ral 89 Booster", price: "$30" },
  ],
  salicylic: [
    { region: "eu", tier: "Budget", brand: "The Ordinary", name: "Salicylic Acid 2% Solution", price: "$8" },
    { region: "asia", tier: "Mid", brand: "COSRX", name: "BHA Blackhead Power Liquid", price: "$25" },
    { region: "us", tier: "Budget", brand: "Stridex", name: "Maximum Strength Pads", price: "$6" },
    { region: "us", tier: "Premium", brand: "Paula\u2019s Choice", name: "Skin Perfecting 2% BHA Liquid", price: "$35" },
  ],
  aha: [
    { region: "eu", tier: "Budget", brand: "The Ordinary", name: "Glycolic Acid 7% Toning Solution", price: "$13" },
    { region: "asia", tier: "Budget", brand: "Some By Mi", name: "AHA-BHA-PHA 30 Days Miracle Toner", price: "$17" },
    { region: "eu", tier: "Mid", brand: "Pixi", name: "Glow Tonic", price: "$29" },
    { region: "us", tier: "Premium", brand: "Drunk Elephant", name: "T.L.C. Framboos Glycolic Serum", price: "$90" },
  ],
  retinoid: [
    { region: "eu", tier: "Budget", brand: "The Ordinary", name: "Retinol 0.5% in Squalane", price: "$8" },
    { region: "asia", tier: "Mid", brand: "COSRX", name: "The Retinol 0.1 Cream", price: "$28" },
    { region: "us", tier: "Mid", brand: "CeraVe", name: "Resurfacing Retinol Serum", price: "$20" },
    { region: "us", tier: "Premium", brand: "Paula\u2019s Choice", name: "1% Retinol Treatment", price: "$58" },
    { region: "eu", tier: "Premium", brand: "La Roche-Posay", name: "Retinol B3 Pure Serum", price: "$45" },
  ],
  azelaic: [
    { region: "eu", tier: "Budget", brand: "The Ordinary", name: "Azelaic Acid Suspension 10%", price: "$12" },
    { region: "us", tier: "Mid", brand: "Naturium", name: "Azelaic Topical Acid 10%", price: "$20" },
    { region: "us", tier: "Premium", brand: "Paula\u2019s Choice", name: "10% Azelaic Acid Booster", price: "$39" },
  ],
  cica: [
    { region: "asia", tier: "Budget", brand: "SKIN1004", name: "Madagascar Centella Ampoule", price: "$23" },
    { region: "asia", tier: "Mid", brand: "Anua", name: "Heartleaf 77% Soothing Toner", price: "$22" },
    { region: "asia", tier: "Premium", brand: "Dr. Jart+", name: "Cicapair Tiger Grass Cream", price: "$52" },
    { region: "eu", tier: "Budget", brand: "La Roche-Posay", name: "Cicaplast Baume B5", price: "$20" },
  ],
  benzoyl: [
    { region: "us", tier: "Budget", brand: "PanOxyl", name: "Acne Foaming Wash 4%", price: "$10" },
    { region: "us", tier: "Mid", brand: "Paula\u2019s Choice", name: "CLEAR 2.5% Benzoyl Peroxide Treatment", price: "$23" },
    { region: "eu", tier: "Premium", brand: "La Roche-Posay", name: "Effaclar Duo Acne Treatment", price: "$30" },
  ],
  squalane: [
    { region: "eu", tier: "Budget", brand: "The Ordinary", name: "100% Plant-Derived Squalane", price: "$9" },
    { region: "asia", tier: "Mid", brand: "Mixsoon", name: "Bean Squalane Oil", price: "$22" },
    { region: "us", tier: "Mid", brand: "Indeed Labs", name: "Squalane Facial Oil", price: "$20" },
    { region: "us", tier: "Premium", brand: "Biossance", name: "100% Squalane Oil", price: "$32" },
  ],
  "moist-rich": [
    { region: "asia", tier: "Budget", brand: "Round Lab", name: "1025 Dokdo Cream", price: "$23" },
    { region: "asia", tier: "Mid", brand: "Illiyoon", name: "Ceramide Ato Concentrate Cream", price: "$22" },
    { region: "us", tier: "Budget", brand: "CeraVe", name: "Moisturizing Cream", price: "$17" },
    { region: "us", tier: "Premium", brand: "First Aid Beauty", name: "Ultra Repair Cream", price: "$38" },
    { region: "eu", tier: "Mid", brand: "La Roche-Posay", name: "Toleriane Double Repair Moisturizer", price: "$20" },
  ],
  "moist-gel": [
    { region: "asia", tier: "Mid", brand: "Belif", name: "The True Cream Aqua Bomb", price: "$38" },
    { region: "asia", tier: "Premium", brand: "Laneige", name: "Water Bank Blue Hyaluronic Cream", price: "$38" },
    { region: "us", tier: "Budget", brand: "Neutrogena", name: "Hydro Boost Water Gel", price: "$20" },
    { region: "us", tier: "Premium", brand: "Clinique", name: "Dramatically Different Hydrating Gel", price: "$32" },
    { region: "eu", tier: "Mid", brand: "Vichy", name: "Aqualia Thermal Rich Gel", price: "$30" },
  ],
  "moist-light": [
    { region: "asia", tier: "Budget", brand: "COSRX", name: "Oil-Free Ultra-Moisturizing Lotion", price: "$20" },
    { region: "asia", tier: "Mid", brand: "Beauty of Joseon", name: "Dynasty Cream", price: "$24" },
    { region: "us", tier: "Budget", brand: "CeraVe", name: "Daily Moisturizing Lotion", price: "$15" },
    { region: "us", tier: "Premium", brand: "Kiehl\u2019s", name: "Ultra Facial Cream", price: "$35" },
    { region: "eu", tier: "Mid", brand: "La Roche-Posay", name: "Toleriane Sensitive Fluid", price: "$20" },
  ],
  nightcream: [
    { region: "asia", tier: "Mid", brand: "Beauty of Joseon", name: "Dynasty Cream", price: "$24" },
    { region: "asia", tier: "Premium", brand: "Mediheal", name: "N.M.F Aquaring Night Cream", price: "$28" },
    { region: "us", tier: "Budget", brand: "CeraVe", name: "Skin Renewing Night Cream", price: "$18" },
    { region: "us", tier: "Mid", brand: "Olay", name: "Regenerist Night Recovery Cream", price: "$29" },
    { region: "us", tier: "Premium", brand: "Drunk Elephant", name: "Lala Retro Whipped Cream", price: "$60" },
  ],
};

export function slotForStep(step: RoutineStep): string | null {
  const a = (step.active || "").toLowerCase();
  const ty = (step.type || "").toLowerCase();
  if (step.spf || ty.includes("sunscreen") || a.includes("spf")) return "spf";
  if (a.includes("vitamin c")) return "vitc";
  if (a.includes("niacinamide")) return "niacinamide";
  if (a.includes("hyaluronic")) return "ha";
  if (a.includes("salicylic")) return "salicylic";
  if (a.includes("glycolic") || a.includes("lactic") || a.includes("aha")) return "aha";
  if (a.includes("retin")) return "retinoid";
  if (a.includes("azelaic")) return "azelaic";
  if (a.includes("centella") || a.includes("cica")) return "cica";
  if (a.includes("benzoyl")) return "benzoyl";
  if (a.includes("squalane") || ty.includes("facial oil")) return "squalane";
  if (ty.includes("oil cleanser") || ty.includes("balm")) return "cleanser-oil";
  if (ty.includes("cleanser")) return ty.includes("cream") || ty.includes("milk") ? "cleanser-cream" : "cleanser-gel";
  if (ty.includes("night cream")) return "nightcream";
  if (ty.includes("gel")) return "moist-gel";
  if (ty.includes("rich") || ty.includes("barrier")) return "moist-rich";
  if (ty.includes("lotion") || ty.includes("light")) return "moist-light";
  if (ty.includes("moistur") || ty.includes("cream")) return "moist-rich";
  return null;
}

export function selectProducts(pool: Product[] | undefined, region: RegionId): Product[] {
  if (!pool || !pool.length) return [];
  if (region && region !== "none") {
    const match = pool.filter((p) => p.region === region);
    const rest = pool.filter((p) => p.region !== region);
    return [...match, ...rest].slice(0, 3);
  }
  const order: Array<Exclude<RegionId, "none">> = ["asia", "us", "eu"];
  const picked: Product[] = [];
  const used = new Set<Product>();
  order.forEach((r) => {
    const p = pool.find((x) => x.region === r && !used.has(x));
    if (p) { picked.push(p); used.add(p); }
  });
  pool.forEach((p) => {
    if (picked.length < 3 && !used.has(p)) { picked.push(p); used.add(p); }
  });
  return picked.slice(0, 3);
}

export function productsForStep(step: RoutineStep, region: RegionId): Product[] {
  const slot = slotForStep(step);
  return slot && PRODUCTS[slot] ? selectProducts(PRODUCTS[slot], region) : [];
}
