import { cacheLife, cacheTag } from "next/cache";
import "server-only";
import { prisma } from "@/lib/prisma";
import type { Team } from "@/app/generated/prisma/client";

export type TeamStatRow = {
  team: Team;
  played: number;
  won: number;
  lost: number;
  winRate: number | null;
  mapsPlayed: number;
  mapsWon: number;
  mapWinRate: number | null;
};

/**
 * Match and map records for every team in a game.
 *
 * Maps are tallied in memory from a single query rather than counted per team
 * with one query each: a map row only knows its winner, so working out who
 * *played* it means looking at the parent match either way, and one pass over
 * the rows is both simpler and cheaper than N round trips.
 *
 * Ordered by rating, with teams that have never played last — an unplayed team
 * sits on the default rating and would otherwise outrank teams with a real record.
 */
export async function teamStatRows(gameId: string): Promise<TeamStatRow[]> {
  // Bütün ziyarətçilər üçün eynidir və oyun sayı dörddür, yəni açar sayı azdır —
  // bütün bitmiş matçlar və xəritələr oxunur. Keşin niyə `remote` olduğu barədə: lib/cachedQueries.ts.
  "use cache: remote";
  cacheLife("minutes");
  cacheTag("teams", "matches");
  const [teams, matches, maps] = await Promise.all([
    prisma.team.findMany({ where: { gameId, isActive: true } }),
    prisma.match.findMany({
      where: { gameId, status: "FINISHED" },
      select: { teamAId: true, teamBId: true, winnerId: true },
    }),
    prisma.matchMap.findMany({
      where: { status: "FINISHED", match: { gameId, status: "FINISHED" } },
      select: { winnerId: true, match: { select: { teamAId: true, teamBId: true } } },
    }),
  ]);

  const tally = new Map<string, { played: number; won: number; mapsPlayed: number; mapsWon: number }>();
  const get = (id: string) => {
    let row = tally.get(id);
    if (!row) {
      row = { played: 0, won: 0, mapsPlayed: 0, mapsWon: 0 };
      tally.set(id, row);
    }
    return row;
  };

  for (const match of matches) {
    get(match.teamAId).played++;
    get(match.teamBId).played++;
    if (match.winnerId) get(match.winnerId).won++;
  }

  for (const map of maps) {
    get(map.match.teamAId).mapsPlayed++;
    get(map.match.teamBId).mapsPlayed++;
    if (map.winnerId) get(map.winnerId).mapsWon++;
  }

  const pct = (part: number, total: number) => (total > 0 ? Math.round((part / total) * 100) : null);

  return teams
    .map((team) => {
      const t = tally.get(team.id) ?? { played: 0, won: 0, mapsPlayed: 0, mapsWon: 0 };
      return {
        team,
        played: t.played,
        won: t.won,
        lost: t.played - t.won,
        winRate: pct(t.won, t.played),
        mapsPlayed: t.mapsPlayed,
        mapsWon: t.mapsWon,
        mapWinRate: pct(t.mapsWon, t.mapsPlayed),
      };
    })
    .sort((a, b) => {
      if (a.played === 0 && b.played === 0) return a.team.name.localeCompare(b.team.name);
      if (a.played === 0) return 1;
      if (b.played === 0) return -1;
      return b.team.rating - a.team.rating;
    });
}
