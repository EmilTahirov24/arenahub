/**
 * Formatting for a tournament's prize breakdown, which is published by place
 * range ("5-8th places") rather than per team.
 */

export type PrizeRow = { placeFrom: number; placeTo: number; amount: number; label?: string | null };

const EN_SUFFIX = (n: number) => {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return "th";
  return ["th", "st", "nd", "rd"][n % 10] ?? "th";
};

/** "1st place" / "5-8th places" — or "1-ci yer" / "5-8-ci yerlər" in Azerbaijani. */
export function placeRangeLabel(row: PrizeRow, locale: string) {
  const single = row.placeFrom === row.placeTo;
  if (locale === "az") {
    return single ? `${row.placeFrom}-ci yer` : `${row.placeFrom}-${row.placeTo}-ci yerlər`;
  }
  return single
    ? `${row.placeFrom}${EN_SUFFIX(row.placeFrom)} place`
    : `${row.placeFrom}-${row.placeTo}${EN_SUFFIX(row.placeTo)} places`;
}

export function formatMoney(amount: number) {
  return "$" + amount.toLocaleString("en-US").replace(/,/g, " ");
}

/**
 * The prize a given finishing position earns, or null if it is outside every range.
 *
 * When ranges overlap, the NARROWEST one wins. The reason is in how it is used:
 * someone who writes "2-4th places $5,000" and then adds "3rd place $7,000" has
 * made their intent plain — third place gets its own amount. Taking the first
 * match in order would defeat that, because rows are ordered by `placeFrom`, so
 * the wide range always comes first and hides the specific row: an amount typed
 * into the admin panel that could never appear on the site.
 */
export function prizeForPlacement(rows: PrizeRow[], placement: number | null) {
  if (placement == null) return null;
  let best: PrizeRow | null = null;
  for (const row of rows) {
    if (placement < row.placeFrom || placement > row.placeTo) continue;
    if (best === null || row.placeTo - row.placeFrom < best.placeTo - best.placeFrom) {
      best = row;
    }
  }
  return best?.amount ?? null;
}
