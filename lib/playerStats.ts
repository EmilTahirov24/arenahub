import { cacheLife, cacheTag } from "next/cache";
import "server-only";
import { prisma } from "@/lib/prisma";
import { publiclyListedPlayer } from "@/lib/publicPlayers";
import { playerScore } from "@/lib/playerScore";
import type { Player, Team } from "@/app/generated/prisma/client";

export type PlayerStatRow = {
  player: Player;
  team: Team | undefined;
  maps: number | null;
  kills: number | null;
  deaths: number | null;
  damage: number | null;
  score: number | null;
};

/**
 * The one place a player's headline numbers are worked out.
 *
 * Shared by the player directory and the stats leaderboard: computing them
 * twice would let the same player show two different scores on two pages, since
 * one source is admin-entered period averages and the other is recorded match
 * data.
 *
 * Period averages win when present — they cover players whose individual
 * matches are not recorded here. Otherwise the numbers come from
 * PlayerMatchStat. A player with neither keeps nulls, which the UI renders as
 * "—" rather than as zeros they did not earn.
 */
export async function playerStatRows(gameId: string, opts: { take?: number } = {}): Promise<PlayerStatRow[]> {
  // Bütün ziyarətçilər üçün eynidir və oyun sayı dörddür, yəni açar sayı azdır —
  // hər oyunçunun matç statistikası yenidən yığılır. Keşin niyə `remote` olduğu barədə: lib/cachedQueries.ts.
  "use cache: remote";
  cacheLife("minutes");
  cacheTag("players", "matches");
  const players = await prisma.player.findMany({
    where: { AND: [publiclyListedPlayer, { status: "ACTIVE", gameId }] },
    orderBy: { nickname: "asc" },
    include: { memberships: { where: { leftAt: null }, include: { team: true }, take: 1 } },
  });

  const aggregates = await prisma.playerMatchStat.groupBy({
    by: ["playerId"],
    where: { mapId: null, playerId: { in: players.map((p) => p.id) } },
    _avg: { rating: true },
    _sum: { kills: true, deaths: true },
    _count: { _all: true },
  });
  const byPlayer = new Map(aggregates.map((a) => [a.playerId, a]));

  const rows: PlayerStatRow[] = players.map((player) => {
    const agg = byPlayer.get(player.id);
    const matchCount = agg?._count._all ?? 0;
    const hasPeriod = player.statKillsPerRound != null || player.statDamagePerRound != null;

    const maps = player.statMaps ?? (matchCount || null);
    const kills = player.statKillsPerRound ?? (agg?._sum.kills != null && matchCount ? agg._sum.kills / matchCount : null);
    const deaths = player.statDeathsPerRound ?? (agg?._sum.deaths != null && matchCount ? agg._sum.deaths / matchCount : null);
    const damage = player.statDamagePerRound ?? null;

    const score = hasPeriod
      ? playerScore({ killsPerRound: kills, deathsPerRound: deaths, damagePerRound: damage })
      : (agg?._avg.rating ?? null);

    return { player, team: player.memberships[0]?.team, maps, kills, deaths, damage, score };
  });

  rows.sort((a, b) => {
    if (a.score == null && b.score == null) return a.player.nickname.localeCompare(b.player.nickname);
    if (a.score == null) return 1;
    if (b.score == null) return -1;
    return b.score - a.score;
  });

  return opts.take ? rows.slice(0, opts.take) : rows;
}
