/**
 * Renders JSON-LD structured data.
 *
 * The payload is our own object literal (never user input), and
 * `JSON.stringify` output is escaped so a `</script>` sequence cannot break out
 * of the tag - hence the `<` replacement rather than a sanitiser.
 */
export function JsonLd({ data }: { data: unknown }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}
