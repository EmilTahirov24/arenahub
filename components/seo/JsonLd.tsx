/**
 * The page's structured description (schema.org / JSON-LD).
 *
 * The site holds over 2,000 matches, over 800 teams and 600 players, and none
 * of it was machine-readable: a search engine saw only text on the page, not
 * the fact that "this is a sports fixture played on such a date".
 *
 * SECURITY. The names are not text we wrote - they are imported from
 * Liquipedia. `JSON.stringify` does not escape HTML, so a `</script>` inside a
 * name could close this tag early and inject code into the page. Replacing `<`
 * with its unicode escape prevents that; Next's own documentation recommends
 * exactly this.
 *
 * THE RULE: only fields we ACTUALLY know are written. An empty or unknown
 * value is not passed - feeding schema.org invented data is no different from
 * printing an invented number on the site.
 */
export default function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}

/** Drops empty, null and undefined fields, so no half value reaches the schema. */
export function compact<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === null || v === undefined || v === "") continue;
    if (Array.isArray(v) && v.length === 0) continue;
    out[k] = v;
  }
  return out;
}
