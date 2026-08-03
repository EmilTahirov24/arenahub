/**
 * The rating maths, with no database and no framework imports.
 *
 * Kept separate from lib/rating.ts (which is server-only and talks to Prisma)
 * so that both the app and standalone maintenance scripts can share exactly the
 * same formula — a script that reimplemented it would silently drift.
 */

export const BASE_RATING = 1000;

/**
 * How much a single result can move a rating. Beating a strong team at a Tier-S
 * event should count for more than winning a Tier-C qualifier, so K scales with
 * the tournament tier; matches outside a tournament use the middle value.
 */
export const K_BY_TIER: Record<"S" | "A" | "B" | "C", number> = { S: 40, A: 32, B: 24, C: 16 };
export const K_NO_TOURNAMENT = 24;

/** Standard Elo expectation: how likely a team on `a` is to beat one on `b`. */
export function expectedScore(a: number, b: number) {
  return 1 / (1 + 10 ** ((b - a) / 400));
}

export function kFactor(tier: "S" | "A" | "B" | "C" | null | undefined) {
  return tier ? K_BY_TIER[tier] : K_NO_TOURNAMENT;
}

/** New ratings for both sides after one decided match. */
export function applyResult(ratingA: number, ratingB: number, aWon: boolean, k: number) {
  const scoreA = aWon ? 1 : 0;
  return {
    a: ratingA + k * (scoreA - expectedScore(ratingA, ratingB)),
    b: ratingB + k * (1 - scoreA - expectedScore(ratingB, ratingA)),
  };
}

export function roundRating(n: number) {
  return Math.round(n * 100) / 100;
}

/** Rating points gained (+) or lost (-) in this team's most recent result. */
export function ratingDelta(team: { rating: number; previousRating: number }) {
  return Math.round(team.rating - team.previousRating);
}

type ReplayMatch = {
  teamAId: string;
  teamBId: string;
  winnerId: string | null;
  tournament: { tier: "S" | "A" | "B" | "C" } | null;
};

/**
 * Replays decided matches in the given order and returns each team's final
 * rating plus the rating it held before its most recent match.
 */
export function replayRatings(matches: ReplayMatch[]) {
  const rating = new Map<string, number>();
  const previous = new Map<string, number>();
  const get = (id: string) => rating.get(id) ?? BASE_RATING;

  for (const match of matches) {
    if (!match.winnerId) continue;
    const ra = get(match.teamAId);
    const rb = get(match.teamBId);
    const next = applyResult(ra, rb, match.winnerId === match.teamAId, kFactor(match.tournament?.tier));

    previous.set(match.teamAId, ra);
    previous.set(match.teamBId, rb);
    rating.set(match.teamAId, next.a);
    rating.set(match.teamBId, next.b);
  }

  return { rating, previous };
}
