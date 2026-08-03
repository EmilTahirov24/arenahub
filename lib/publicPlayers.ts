import type { Prisma } from "@/app/generated/prisma/client";

/**
 * Who belongs in the public player directory, the sitemap and search.
 *
 * Since Team/Fan accounts were merged into Player, a `Player` row is now two
 * different things: a competitive profile (seeded, admin-created, or added to a
 * roster — these never self-register, so `isClaimed` stays false), and a person
 * who signed up to predict matches. Only the former should be listed next to
 * pros and indexed by Google; a self-registered user becomes listable once they
 * actually join or create a team.
 *
 * Their profile page itself stays reachable by direct link — this only controls
 * listing/indexing.
 */
export const publiclyListedPlayer = {
  OR: [{ isClaimed: false }, { memberships: { some: { leftAt: null } } }],
} satisfies Prisma.PlayerWhereInput;
