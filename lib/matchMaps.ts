import type { PrismaClient } from "../app/generated/prisma/client";
import type { ParsedMap } from "./liquipedia";

/**
 * Writes a finished match's map list.
 *
 * Two importers need this and they must agree: the live ticker writes maps when
 * it happens to carry them, and the backfill reads the tournament pages that
 * actually do. Keying on map order means either one can run second and correct
 * a score rather than adding the map twice.
 *
 * Rows left over from a longer earlier parse are removed — except where
 * somebody's statistics hang off them. An importer has no business deleting
 * those, and the cascade would take them with it.
 */
export async function syncMaps(
  prisma: PrismaClient,
  matchId: string,
  maps: ParsedMap[],
  teamAId: string,
  teamBId: string,
): Promise<number> {
  const stale = await prisma.matchMap.findMany({
    where: { matchId, mapOrder: { notIn: maps.map((m) => m.order) } },
    select: { id: true, _count: { select: { playerStats: true } } },
  });
  const removable = stale.filter((m) => m._count.playerStats === 0).map((m) => m.id);
  if (removable.length) await prisma.matchMap.deleteMany({ where: { id: { in: removable } } });

  for (const map of maps) {
    const row = {
      mapName: map.name,
      teamAScore: map.teamAScore,
      teamBScore: map.teamBScore,
      status: "FINISHED" as const,
      winnerId: map.winner === 1 ? teamAId : map.winner === 2 ? teamBId : null,
    };
    await prisma.matchMap.upsert({
      where: { matchId_mapOrder: { matchId, mapOrder: map.order } },
      create: { matchId, mapOrder: map.order, ...row },
      update: row,
    });
  }

  return maps.length;
}
