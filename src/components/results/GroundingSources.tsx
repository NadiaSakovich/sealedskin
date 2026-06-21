import type { GroundingInfo } from "../../lib/ai/types";

/**
 * Shows the web sources the model grounded its answer in, plus Google's
 * "Search Suggestions" chip. Displaying the chip (`searchSuggestionHtml`) is
 * required by the Grounding with Google Search terms whenever a grounded answer
 * is shown to the user.
 */
export function GroundingSources({ grounding }: { grounding: GroundingInfo }) {
  const hasSources = grounding.sources.length > 0;
  const hasChip = Boolean(grounding.searchSuggestionHtml);
  if (!hasSources && !hasChip) return null;

  return (
    <div className="mt-6 px-[18px] py-4 rounded-[14px] bg-ss-surface border border-ss-hairline">
      <div className="font-mono text-[10.5px] tracking-[0.08em] uppercase text-ss-accent-ink mb-[10px]">
        Grounded with Google Search
      </div>

      {hasSources && (
        <ul className="list-none m-0 p-0 grid gap-[7px] mb-3">
          {grounding.sources.map((s, i) => (
            <li key={i} className="flex gap-[9px] items-start">
              <span aria-hidden="true" className="shrink-0 mt-2 w-1 h-1 rounded-full bg-ss-accent" />
              <a
                href={s.uri}
                target="_blank"
                rel="noreferrer"
                className="flex-1 block text-[13px] leading-[1.4] text-ss-accent-ink underline decoration-ss-hairline underline-offset-2 [text-wrap:pretty]"
              >
                {s.title || s.uri}
              </a>
            </li>
          ))}
        </ul>
      )}

      {hasChip && (
        <div
          className="text-[12px] [&_a]:text-ss-accent-ink"
          // Google-provided Search Suggestions markup; required for display.
          dangerouslySetInnerHTML={{ __html: grounding.searchSuggestionHtml }}
        />
      )}
    </div>
  );
}
