/**
 * Saytdakı oyunun Liquipedia-dakı wiki adı.
 *
 * Bu uyğunluq əvvəl scripts/import-live.ts-in içində idi. İkinci idxal skripti
 * eyni siyahıya ehtiyac duyanda bura çıxarıldı: iki nüsxə saxlamaq o deməkdir
 * ki, gələcəkdə beşinci oyun əlavə olunanda biri yenilənəcək, digəri səssizcə
 * köhnə qalacaq.
 *
 * Baza və framework idxalı yoxdur, ona görə həm Next, həm də skriptlər
 * birbaşa işlədə bilir.
 */
export const WIKIS: { slug: string; wiki: string }[] = [
  { slug: "cs2", wiki: "counterstrike" },
  { slug: "dota2", wiki: "dota2" },
  { slug: "valorant", wiki: "valorant" },
  { slug: "lol", wiki: "leagueoflegends" },
];

/** Oyunun slug-ından wiki adı; tanınmayan oyun üçün null. */
export function wikiForGame(slug: string): string | null {
  return WIKIS.find((w) => w.slug === slug)?.wiki ?? null;
}
