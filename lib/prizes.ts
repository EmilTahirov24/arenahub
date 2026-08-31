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
 * Aralıqlar üst-üstə düşəndə ƏN DAR olan qazanır. Səbəb istifadə şəklindədir:
 * «1-4-cü yerlər $20 000» yazıb sonra «2-ci yer $50 000» əlavə edən adamın
 * niyyəti açıqdır — 2-ci yerə ayrıca məbləğ verir. Sıra ilə ilk uyğun gələni
 * götürsəydik, sətirlər `placeFrom` üzrə düzüldüyü üçün geniş aralıq həmişə
 * birinci gələr və konkret sətri gizlədərdi: admin panelə yazılan məbləğ
 * saytda heç vaxt görünməzdi.
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
