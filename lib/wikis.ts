/**
 * Which Liquipedia wiki a game on this site lives in.
 *
 * This mapping used to sit inside scripts/import-live.ts. When a second import
 * script needed the same list it was lifted here: keeping two copies means
 * that when a fifth game is added one of them gets updated and the other goes
 * quietly stale.
 *
 * It imports neither the database nor the framework, so Next and the scripts
 * can both use it directly.
 */
export const WIKIS: { slug: string; wiki: string }[] = [
  { slug: "cs2", wiki: "counterstrike" },
  { slug: "dota2", wiki: "dota2" },
  { slug: "valorant", wiki: "valorant" },
  { slug: "lol", wiki: "leagueoflegends" },
];

/** The wiki name for a game slug; null for a game we do not know. */
export function wikiForGame(slug: string): string | null {
  return WIKIS.find((w) => w.slug === slug)?.wiki ?? null;
}
