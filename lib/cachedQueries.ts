import { cacheLife, cacheTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { dayRange, isDateKey } from "@/lib/dates";
import { publiclyListedPlayer } from "@/lib/publicPlayers";
import type { Prisma } from "@/app/generated/prisma/client";

/**
 * The list pages, without the trip to the database.
 *
 * Cache Components prerenders the shell, but the dynamic part still went to
 * the database on every request. Measured: TTFB fell to 0.23s while a full
 * load stayed near 1.2s, and that second was spent in the remote Neon
 * database. These functions cache the QUERY itself.
 *
 * Invalidation is by tag: `revalidatePath` belongs to the route cache and
 * does not touch `use cache` regions, so admin actions have to call
 * `revalidateTag` - see lib/cacheTags.ts. The importer runs in a separate
 * process (GitHub Actions) and can invalidate nothing at all; its freshness
 * rides on `cacheLife`, and since the import runs hourly a one-minute window
 * is enough.
 */

/** Every list page opened with this same query - four lines, every time. */
export async function activeGames() {
  "use cache: remote";
  cacheLife("hours");
  cacheTag("games");
  return prisma.game.findMany({ where: { isActive: true } });
}

/**
 * The team table.
 *
 * The most expensive list query there is: for every team it pulls the roster
 * and three separate counts. Win totals depend on match results, so this
 * carries both the "teams" and the "matches" tag.
 */
export async function teamsForGame(gameSlug: string) {
  "use cache: remote";
  cacheLife("minutes");
  cacheTag("teams", "matches");
  return prisma.team.findMany({
    where: { isActive: true, game: { slug: gameSlug } },
    orderBy: [{ rating: "desc" }, { name: "asc" }],
    include: {
      memberships: {
        where: { leftAt: null },
        orderBy: { joinedAt: "asc" },
        include: { player: { select: { nickname: true, slug: true } } },
      },
      _count: {
        select: {
          wonMatches: true,
          homeMatches: { where: { status: "FINISHED" } },
          awayMatches: { where: { status: "FINISHED" } },
        },
      },
    },
  });
}

/** Upcoming and live matches. The filters are arguments, so every combination gets its own entry. */
export async function upcomingMatches(gameSlug?: string, date?: string) {
  "use cache: remote";
  cacheLife("minutes");
  cacheTag("matches");

  const where: Prisma.MatchWhereInput = { status: { in: ["UPCOMING", "LIVE"] } };
  if (gameSlug) where.game = { slug: gameSlug };
  // Without the check, a junk date threw a RangeError inside Prisma - see lib/dates.ts.
  if (isDateKey(date)) {
    const { start, end } = dayRange(date);
    where.scheduledAt = { gte: start, lte: end };
  }

  return prisma.match.findMany({
    where,
    orderBy: [{ status: "asc" }, { scheduledAt: "asc" }],
    include: { teamA: true, teamB: true, tournament: { include: { game: true } } },
  });
}

/** Finished matches, paginated. */
export async function finishedMatches(gameSlug: string | undefined, date: string | undefined, skip: number, take: number) {
  "use cache: remote";
  cacheLife("minutes");
  cacheTag("matches");

  const where: Prisma.MatchWhereInput = { status: "FINISHED" };
  if (gameSlug) where.game = { slug: gameSlug };
  if (isDateKey(date)) {
    const { start, end } = dayRange(date);
    where.scheduledAt = { gte: start, lte: end };
  }

  const [total, matches] = await Promise.all([
    prisma.match.count({ where }),
    prisma.match.findMany({
      where,
      orderBy: { scheduledAt: "desc" },
      include: { teamA: true, teamB: true, tournament: { include: { game: true } } },
      take,
      skip,
    }),
  ]);

  return { total, matches };
}

/**
 * The counts behind the page shell.
 *
 * PageShell sits on every public page and was pulling three counts for nothing
 * more than deciding whether to show the side rails. Measuring showed that
 * caching the list queries alone was not enough: these counts stayed outside
 * the cache, so the page was still tied to the database and every dynamic page
 * carried a floor of about 0.8 seconds.
 */
export async function railCounts(showDefaultWidgets: boolean) {
  "use cache: remote";
  cacheLife("minutes");
  cacheTag("ads", "news", "players");

  const [ads, transfers, articles] = await Promise.all([
    prisma.adBanner.count({ where: { isActive: true } }),
    showDefaultWidgets ? prisma.teamMembership.count({ where: { team: { isActive: true } } }) : 0,
    showDefaultWidgets ? prisma.newsArticle.count({ where: { publishedAt: { not: null } } }) : 0,
  ]);
  return { ads, transfers, articles };
}

/** The latest news in the side rail. */
export async function recentNews(locale: string) {
  "use cache: remote";
  cacheLife("minutes");
  cacheTag("news");
  return prisma.newsArticle.findMany({
    where: { publishedAt: { not: null } },
    orderBy: [{ isFeatured: "desc" }, { publishedAt: "desc" }],
    take: 6,
    include: { game: true, translations: { where: { locale } } },
  });
}

/** The latest transfers in the side rail. */
export async function recentTransfers() {
  "use cache: remote";
  cacheLife("minutes");
  cacheTag("players", "teams");
  return prisma.teamMembership.findMany({
    where: { player: publiclyListedPlayer, team: { isActive: true } },
    orderBy: { joinedAt: "desc" },
    take: 6,
    include: { team: true, player: true },
  });
}
