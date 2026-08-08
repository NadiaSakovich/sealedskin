import type { GroundingInfo } from "../../lib/ai/types";

/** How many source links to name inline before collapsing the rest into "+N". */
const MAX_SHOWN = 3;

/** Gemini sets a web chunk's `title` to the site domain; fall back to the URI host. */
function sourceLabel(title: string, uri: string) {
  if (title) return title;
  try {
    return new URL(uri).hostname.replace(/^www\./, "");
  } catch {
    return uri;
  }
}

/**
 * A single discreet line crediting the web sources the model grounded its answer
 * in, plus Google's "Search Suggestions" chip. Displaying the chip
 * (`searchSuggestionHtml`) is required by the Grounding with Google Search terms
 * whenever a grounded answer is shown to the user, so this stays visible — it is
 * just kept small, and rendered once (on the shop screen) rather than repeated
 * under every results screen.
 */
export function GroundingSources({ grounding }: { grounding: GroundingInfo }) {
  const shown = grounding.sources.slice(0, MAX_SHOWN);
  const extra = grounding.sources.length - shown.length;
  const hasChip = Boolean(grounding.searchSuggestionHtml);
  if (!shown.length && !hasChip) return null;

  return (
    <div className="mt-5 grid gap-2 text-[11.5px] leading-[1.5] text-ss-ink-faint">
      {shown.length > 0 && (
        <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
          <span className="font-mono text-[10px] tracking-[0.08em] uppercase">Sources</span>
          {shown.map((s, i) => (
            <span key={i} className="flex items-center gap-x-1.5">
              <span aria-hidden="true">·</span>
              <a
                href={s.uri}
                target="_blank"
                rel="noreferrer"
                className="underline decoration-ss-hairline-strong underline-offset-2 hover:text-ss-accent-ink"
              >
                {sourceLabel(s.title, s.uri)}
              </a>
            </span>
          ))}
          {extra > 0 && <span>· +{extra} more</span>}
        </span>
      )}

      {hasChip && (
        // `min-w-0` matters: Google's markup is a nowrap carousel that only
        // scrolls inside a width-constrained parent — without it the chip grows
        // past the reading column.
        <div
          className="min-w-0"
          // Google-provided Search Suggestions markup; required for display,
          // and rendered unmodified.
          dangerouslySetInnerHTML={{ __html: grounding.searchSuggestionHtml }}
        />
      )}
    </div>
  );
}
