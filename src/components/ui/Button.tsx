import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "ghost";

const VARIANTS: Record<Variant, string> = {
  primary:
    "inline-flex items-center gap-[9px] px-[22px] py-[13px] rounded-full border-none bg-ss-accent text-ss-on-accent font-body text-[15.5px] font-semibold tracking-[-0.01em] cursor-pointer whitespace-nowrap transition-[transform,opacity] duration-150 disabled:opacity-40 disabled:cursor-not-allowed",
  ghost:
    "inline-flex items-center gap-[7px] px-4 py-[11px] rounded-full border border-ss-hairline-strong bg-transparent text-ss-ink-soft font-body text-[14.5px] font-medium cursor-pointer whitespace-nowrap",
};

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

export function Button({ variant = "primary", className = "", ...rest }: Props) {
  return <button type="button" className={`${VARIANTS[variant]} ${className}`} {...rest} />;
}
