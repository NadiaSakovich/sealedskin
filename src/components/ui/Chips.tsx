import type { ReactNode } from "react";

interface Item {
  id: string;
  label: string;
}

/** Pill chips, with optional "top priority" emphasis (starred + filled). */
export function Chips({ items, topIds = [] }: { items: Item[]; topIds?: string[] }) {
  return (
    <div className="flex flex-wrap gap-[7px]">
      {items.map((it) => {
        const isTop = topIds.includes(it.id);
        return (
          <span
            key={it.id}
            className={`inline-flex items-center gap-[5px] px-3 py-[6px] rounded-full text-[13px] font-body whitespace-nowrap ${
              isTop
                ? "font-semibold bg-ss-accent text-ss-on-accent border border-transparent"
                : "font-medium bg-ss-surface text-ss-ink-soft border border-ss-hairline"
            }`}
          >
            {isTop && (
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                <path d="M6 1l1.5 3.2 3.5.4-2.6 2.4.7 3.5L6 9.2 2.9 10.9l.7-3.5L1 5l3.5-.4z" fill="#f6faf8" />
              </svg>
            )}
            {it.label}
          </span>
        );
      })}
    </div>
  );
}

/** Single solid/outline chip used in results headers. */
export function MiniChip({ children, solid }: { children: ReactNode; solid?: boolean }) {
  return (
    <span
      className={`inline-flex items-center px-3 py-[6px] rounded-full text-[13px] font-body whitespace-nowrap ${
        solid
          ? "font-semibold bg-ss-accent text-ss-on-accent border border-transparent"
          : "font-medium bg-ss-surface text-ss-ink-soft border border-ss-hairline"
      }`}
    >
      {children}
    </span>
  );
}
