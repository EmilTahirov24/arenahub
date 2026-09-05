/**
 * The site's time zone.
 *
 * Without this, every `Intl.DateTimeFormat` ran in the server's zone — on Vercel
 * that is UTC. A match starting at 13:00 in Baku was published as 09:00: four
 * hours early. On a site whose whole purpose is a fixture list this is the worst
 * possible bug, because the visitor arrives late and never learns why.
 *
 * Measured on the live site (2026-08-29): a match at `2026-08-29T09:00:00.000Z`
 * showed as "09:00" on the page and as "13:00" in the site's own share image —
 * because `opengraph-image.tsx` had already made this decision once and wrote
 * `Asia/Baku`. The two disagreed. Now every caller shares the same decision.
 *
 * Azerbaijan has not observed daylight saving since 2016, so the offset is
 * +04:00 all year. Formatting still goes through `timeZone` rather than a fixed
 * number: if the rule ever changes, it changes in one place.
 */
export const SITE_TIME_ZONE = "Asia/Baku";

/** `YYYY-MM-DD` for the Baku day the instant falls in. */
export function toDateKey(date: Date) {
  // `en-CA` is deliberate: it is the one widely available locale that formats
  // as exactly `YYYY-MM-DD`, so the parts never have to be assembled by hand.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: SITE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Whether the `?date=` parameter really names a day.
 *
 * Without this check, `?date=abc` reached `dayRange` as an Invalid Date, and
 * Prisma threw a `RangeError` converting it to ISO. The list section of
 * /results and /matches could therefore be broken from a public URL — and the
 * failure is invisible in the status code, because the prerendered shell still
 * returns 200 and the error only surfaces in the streamed part.
 *
 * Formatting the parsed date back and comparing is deliberate: `2026-02-31`
 * does not throw in Node, it slides silently to 3 March, and the visitor is
 * shown results for a day they did not ask for.
 *
 * There is a second benefit. The `upcomingMatches`/`finishedMatches` caches are
 * keyed by their arguments, so without validation every junk date would create
 * its own cache entry and the cache would grow without limit.
 */
export function isDateKey(value: string | undefined): value is string {
  if (!value || !DATE_KEY.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000+04:00`);
  return !Number.isNaN(parsed.getTime()) && toDateKey(parsed) === value;
}

/**
 * The start and end of that BAKU day, expressed as UTC instants.
 *
 * The bounds used to be taken from UTC midnight, which put matches played
 * between 00:00 and 04:00 Baku time into the previous day. Someone clicking
 * "today" did not see the match they had stayed up for.
 */
export function dayRange(dateKey: string) {
  const start = new Date(`${dateKey}T00:00:00.000+04:00`);
  const end = new Date(`${dateKey}T23:59:59.999+04:00`);
  return { start, end };
}

/** Days for the filter strip, centred on today in Baku. */
export function dateStrip(centerOffsetDays = 0, length = 7) {
  // Take today's Baku date first, then count from that day's Baku midnight.
  // `setUTCHours(0, ...)` did not work: it zeroed the UTC day, so before 04:00
  // in Baku the whole strip was a day behind.
  const todayKey = toDateKey(new Date());
  const anchor = dayRange(todayKey).start;

  return Array.from({ length }).map((_, i) => {
    const d = new Date(anchor);
    d.setUTCDate(d.getUTCDate() - Math.floor(length / 2) + centerOffsetDays + i);
    return d;
  });
}

/**
 * The site's standard date/time formatter.
 *
 * Used instead of writing `new Intl.DateTimeFormat(...)` directly, so that
 * forgetting `timeZone` is not possible — which is exactly how the four-hour
 * bug above came about.
 */
export function siteFormat(locale: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat(locale, { timeZone: SITE_TIME_ZONE, ...options });
}
