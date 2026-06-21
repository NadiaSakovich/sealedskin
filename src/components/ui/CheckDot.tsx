export function CheckDot({ selected }: { selected: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center transition-all duration-150 ${
        selected ? "border border-ss-accent bg-ss-accent" : "border-[1.5px] border-ss-hairline-strong bg-transparent"
      }`}
    >
      {selected && (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M2.5 6.2L5 8.5L9.5 3.5" stroke="#f6faf8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </span>
  );
}
