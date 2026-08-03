import "server-only";
import { prisma } from "@/lib/prisma";
import { BASE_RATING, replayRatings, roundRating } from "@/lib/elo";

/**
 * Recomputes every team's rating by replaying all finished matches in
 * chronological order.
 *
 * Deliberately a full replay rather than an incremental update at each result:
 * Elo is order-dependent, so if an admin later corrects or deletes an old
 * result, incrementally-updated ratings would stay wrong forever. Replaying is
 * idempotent, immune to a missed call site, and at this data size (tens to
 * thousands of matches) costs one query and an in-memory loop.
 *
 * Returns how many teams actually moved.
 */
export async function recomputeTeamRatings() {
  const matches = await prisma.match.findMany({
    where: { status: "FINISHED", winnerId: { not: null } },
    orderBy: [{ scheduledAt: "asc" }, { id: "asc" }],
    select: {
      teamAId: true,
      teamBId: true,
      winnerId: true,
      tournament: { select: { tier: true } },
    },
  });

  const { rating, previous } = replayRatings(matches);

  const teams = await prisma.team.findMany({ select: { id: true, rating: true, previousRating: true } });
  const updates = teams
    .map((team) => ({
      id: team.id,
      current: team,
      rating: roundRating(rating.get(team.id) ?? BASE_RATING),
      previousRating: roundRating(previous.get(team.id) ?? BASE_RATING),
    }))
    .filter((u) => u.current.rating !== u.rating || u.current.previousRating !== u.previousRating);

  if (updates.length > 0) {
    await prisma.$transaction(
      updates.map((u) =>
        prisma.team.update({ where: { id: u.id }, data: { rating: u.rating, previousRating: u.previousRating } }),
      ),
    );
  }

  return updates.length;
}
