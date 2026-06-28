import type { ReactNode } from "react";
import type { RegionId, Routine, RoutineStep } from "../../types";
import { productsForStep, slotForStep } from "../../data/products";
import type { ShopProduct } from "../../lib/ai/result";
import { Button } from "../ui/Button";
import { Arrow } from "../ui/Arrow";
import { ResultsEyebrow, resHeadlineClass, resIntroClass } from "./NeedsSummary";

function ProductRow({ p }: { p: ShopProduct }) {
  const name = p.url ? (
    <a
      href={p.url}
      target="_blank"
      rel="noreferrer"
      className="block text-[12.5px] leading-[1.35] text-ss-accent-ink underline decoration-ss-hairline underline-offset-2"
    >
      {p.name}
    </a>
  ) : (
    <span className="block text-[12.5px] leading-[1.35] text-ss-ink-soft">{p.name}</span>
  );
  return (
    <div className="flex items-center gap-3 px-[13px] py-[10px] rounded-[11px] bg-ss-surface border border-ss-hairline">
      <span className="shrink-0 w-[62px] font-mono text-[9.5px] tracking-[0.05em] uppercase text-ss-accent-ink bg-ss-accent-tint px-[7px] py-1 rounded-full text-center">
        {p.tier}
      </span>
      <span className="flex-1 min-w-0 block">
        <span className="block text-[14px] font-semibold text-ss-ink tracking-[-0.01em]">{p.brand}</span>
        {name}
      </span>
      <span className="shrink-0 font-mono text-[13px] font-medium text-ss-ink">{p.price}</span>
    </div>
  );
}

function ShopStep({ step, products }: { step: RoutineStep; products: ShopProduct[] }) {
  return (
    <div>
      <div className="flex items-baseline gap-[7px] mb-[9px]">
        <span className="font-head font-semibold text-[15px] text-ss-ink tracking-[-0.01em]">{step.type}</span>
        {step.active && <span className="text-[13px] font-medium text-ss-accent-ink">· {step.active}</span>}
      </div>
      {products.length ? (
        <div className="grid gap-[7px]">
          {products.map((p, i) => <ProductRow key={i} p={p} />)}
        </div>
      ) : (
        // The step still belongs in the routine, so never silently drop it — say so
        // plainly when no current picks came back for it.
        <p className="text-[12.5px] leading-[1.45] text-ss-ink-faint m-0 px-[13px] py-[10px] rounded-[11px] bg-ss-surface border border-ss-hairline [text-wrap:pretty]">
          No current picks to show for this step — any well-formulated {step.type.toLowerCase()} suited to your skin works here.
        </p>
      )}
    </div>
  );
}

function ShopBlock({
  title, tag, steps, resolve,
}: {
  title: string;
  tag: string;
  steps: RoutineStep[];
  resolve: (step: RoutineStep) => ShopProduct[];
}) {
  return (
    <div>
      <div className="flex items-center gap-[10px] mb-4">
        <span className="font-head font-semibold text-[19px] text-ss-ink tracking-[-0.015em]">{title}</span>
        <span className="font-mono text-[11px] tracking-[0.08em] uppercase text-ss-on-accent bg-ss-accent px-[9px] py-[3px] rounded-full">{tag}</span>
      </div>
      <div className="grid gap-5">
        {steps.map((s, i) => <ShopStep key={i} step={s} products={resolve(s)} />)}
      </div>
    </div>
  );
}

export function ShopView({
  routine, region, regionLabel, onBack, onRestart, saveSlot, productsByType,
}: {
  routine: Routine;
  region: RegionId;
  regionLabel: string | null;
  onBack: () => void;
  onRestart: () => void;
  /** Optional account/save prompt rendered above the bottom navigation. */
  saveSlot?: ReactNode;
  /** Grounded products keyed by step `type`; falls back to the static catalog. */
  productsByType?: Record<string, ShopProduct[]>;
}) {
  // Match a routine step to the AI's products. The model keys products by a
  // `stepType` string that SHOULD equal the routine step's `type`, but it often
  // drifts ("Gentle Cleanser" / "Cleansing" vs "Cleanser"), which would silently
  // drop that step's picks on an exact lookup. So match tolerantly: exact
  // (normalised) first, then by product "slot" (cleanser/spf/active family), using
  // the key string as its own active so active-specific slots resolve too.
  const aiKeys = productsByType ? Object.keys(productsByType) : [];
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  // Collapse the catalog's fine slots into coarse step families, so a "Moisturizer"
  // step matches any moisturiser-type key and a "Cleanser" any cleanser, while
  // actives (vitc/niacinamide/…) stay their own family — a Vitamin C step never
  // grabs niacinamide products.
  const family = (slot: string | null): string | null =>
    !slot ? null
      : slot.startsWith("cleanser") ? "cleanser"
      : slot.startsWith("moist") || slot === "nightcream" ? "moisturizer"
      : slot;
  const matchAiProducts = (step: RoutineStep): ShopProduct[] => {
    const map = productsByType!;
    const target = norm(step.type);
    let key = aiKeys.find((k) => norm(k) === target);
    if (!key) {
      const fam = family(slotForStep(step));
      if (fam) key = aiKeys.find((k) => family(slotForStep({ type: k, active: k, note: "" })) === fam);
    }
    return key ? map[key] : [];
  };

  // Product picks must be REAL-TIME: a live AI routine shows ONLY the grounded
  // picks the model just researched — never the static catalog. The static
  // catalog (`productsForStep`) is the OFFLINE fallback, used only when the AI was
  // unavailable, which is exactly the case where `productsByType` is absent.
  const resolve = (step: RoutineStep): ShopProduct[] => {
    const source = productsByType
      ? matchAiProducts(step)
      : productsForStep(step, region).map((p) => ({ tier: p.tier, brand: p.brand, name: p.name, price: p.price }));
    const out: ShopProduct[] = [];
    const seen = new Set<string>();
    for (const p of source) {
      const key = `${p.brand}|${p.name}`.toLowerCase().trim();
      if (out.length >= 3 || key === "|" || seen.has(key)) continue;
      seen.add(key);
      out.push(p);
    }
    return out;
  };
  return (
    <div className="py-0.5">
      <ResultsEyebrow step={4} />
      <h1 className={resHeadlineClass}>Shop your routine</h1>
      <p className={resIntroClass}>
        A few picks at different budgets for every step
        {region && region !== "none" && regionLabel ? `, leaning toward ${regionLabel.toLowerCase()} brands` : " — a mix from around the world"}. Brands are
        examples of the right <em>type</em> of product, not endorsements, and prices are approximate.
      </p>

      <div className="grid gap-[30px]">
        <ShopBlock title="Morning" tag="AM" steps={routine.am} resolve={resolve} />
        <ShopBlock title="Evening" tag="PM" steps={routine.pm} resolve={resolve} />
      </div>

      <div className="mt-[22px] text-[12.5px] leading-[1.5] text-ss-ink-faint font-mono [text-wrap:pretty]">
        Always patch-test new products and check the full ingredient list against any sensitivities.
      </div>

      {saveSlot}

      <div className="flex items-center justify-between mt-6">
        <Button variant="ghost" onClick={onBack}><Arrow back /> Back</Button>
        <Button onClick={onRestart}>Start over</Button>
      </div>
    </div>
  );
}
