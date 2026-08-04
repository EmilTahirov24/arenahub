import type { PlayerStatRow } from "@/lib/playerStats";

export const PLAYER_SORT_KEYS = ["score", "nickname", "team", "kills", "deaths", "damage", "maps"] as const;
export type PlayerSortKey = (typeof PLAYER_SORT_KEYS)[number];

export const PLAYERS_PER_PAGE = 50;

export function isPlayerSortKey(value: string | undefined): value is PlayerSortKey {
  return !!value && (PLAYER_SORT_KEYS as readonly string[]).includes(value);
}

/**
 * Which way a column runs when you first click it.
 *
 * Nobody opens a leaderboard wanting the lowest score, and nobody scans a name
 * column from Z. Deaths is the one column where less is better, so it starts
 * ascending — clicking it should surface who is hardest to kill, not who dies
 * most.
 */
export function defaultDirection(key: PlayerSortKey): "asc" | "desc" {
  if (key === "nickname" || key === "team") return "asc";
  if (key === "deaths") return "asc";
  return "desc";
}

function text(row: PlayerStatRow, key: "nickname" | "team"): string {
  return key === "nickname" ? row.player.nickname : (row.team?.name ?? "");
}

function numeric(row: PlayerStatRow, key: Exclude<PlayerSortKey, "nickname" | "team">): number | null {
  switch (key) {
    case "score":
      return row.score;
    case "kills":
      return row.kills;
    case "deaths":
      return row.deaths;
    case "damage":
      return row.damage;
    case "maps":
      return row.maps;
  }
}

/**
 * Sorts a copy, leaving the caller's array alone.
 *
 * Missing numbers sink to the bottom in **both** directions. A player with no
 * recorded statistics has not scored zero — the number is simply unknown, and
 * treating unknown as the smallest value would rank two thirds of the roster
 * above or below everyone else depending on which arrow you clicked. Names never
 * go missing, so they sort normally.
 */
export function sortPlayerRows(
  rows: PlayerStatRow[],
  key: PlayerSortKey,
  dir: "asc" | "desc",
): PlayerStatRow[] {
  const sign = dir === "asc" ? 1 : -1;

  return [...rows].sort((a, b) => {
    if (key === "nickname" || key === "team") {
      const cmp = text(a, key).localeCompare(text(b, key));
      // Players with no team keep a stable, alphabetical order among themselves
      // instead of clumping in whatever order the database returned them.
      return cmp !== 0 ? sign * cmp : a.player.nickname.localeCompare(b.player.nickname);
    }

    const av = numeric(a, key);
    const bv = numeric(b, key);
    if (av == null && bv == null) return a.player.nickname.localeCompare(b.player.nickname);
    if (av == null) return 1;
    if (bv == null) return -1;
    return av === bv ? a.player.nickname.localeCompare(b.player.nickname) : sign * (av - bv);
  });
}

/** Matches on nickname, real name or team — whichever the visitor remembers. */
export function filterPlayerRows(rows: PlayerStatRow[], query: string): PlayerStatRow[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return rows;

  return rows.filter((r) => {
    const haystack = [
      r.player.nickname,
      r.player.firstName,
      r.player.lastName,
      r.team?.name,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(needle);
  });
}
