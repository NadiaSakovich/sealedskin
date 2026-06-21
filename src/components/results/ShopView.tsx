import type { ReactNode } from "react";
import type { RegionId, Routine, RoutineStep } from "../../types";
import { productsForStep } from "../../data/products";
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
  if (!products.length) return null;
  return (
    <div>
      <div className="flex items-baseline gap-[7px] mb-[9px]">
        <span className="font-head font-semibold text-[15px] text-ss-ink tracking-[-0.01em]">{step.type}</span>
        {step.active && <span className="text-[13px] font-medium text-ss-accent-ink">· {step.active}</span>}
      </div>
      <div className="grid gap-[7px]">
        {products.map((p, i) => <ProductRow key={i} p={p} />)}
      </div>
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
  // Prefer grounded picks for a step; otherwise use the static regional catalog.
  const resolve = (step: RoutineStep): ShopProduct[] =>
    productsByType?.[step.type] ?? productsForStep(step, region);
  return (
    <div className="py-0.5">
      <ResultsEyebrow step={4} />
      <h1 className={resHeadlineClass}>Shop your routine</h1>
      <p className={resIntroClass}>
        Three picks at different budgets for every step
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
