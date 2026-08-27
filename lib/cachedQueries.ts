import { cacheLife, cacheTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { dayRange } from "@/lib/dates";
import { publiclyListedPlayer } from "@/lib/publicPlayers";
import type { Prisma } from "@/app/generated/prisma/client";

/**
 * Siyahı səhifələrinin bazaya getməyən variantı.
 *
 * Cache Components qabığı prerender edir, amma dinamik hissə hələ də hər
 * sorğuda bazaya gedirdi — ölçmə göstərdi ki, TTFB 0.23 saniyəyə düşsə də tam
 * yüklənmə ~1.2 saniyədə qalır və həmin saniyə uzaqdakı Neon bazasındadır.
 * Bu funksiyalar sorğunun ÖZÜNÜ keşləyir.
 *
 * Ləğvetmə teqlərlədir: `revalidatePath` marşrut keşi üçündür və `use cache`
 * sahələrinə toxunmur, ona görə admin əməliyyatları `revalidateTag` çağırmalıdır
 * — bax lib/cacheTags.ts. İdxal isə ayrı prosesdə (GitHub Actions) işlədiyi üçün
 * heç nəyi ləğv edə bilmir; onun təzəliyi `cacheLife` müddətinə bağlıdır və
 * idxal saatda bir dəfə qaçdığı üçün bir dəqiqəlik pəncərə kifayətdir.
 */

/** Bütün siyahı səhifələri eyni sorğu ilə başlayırdı — dörd sətir, hər dəfə. */
export async function activeGames() {
  "use cache";
  cacheLife("hours");
  cacheTag("games");
  return prisma.game.findMany({ where: { isActive: true } });
}

/**
 * Komanda cədvəli.
 *
 * Ən bahalı siyahı sorğusudur: hər komanda üçün tərkib və üç ayrıca sayğac
 * çıxarılır. Qalibiyyət sayları matç nəticələrindən asılıdır, ona görə həm
 * "teams", həm də "matches" teqi ilə işarələnir.
 */
export async function teamsForGame(gameSlug: string) {
  "use cache";
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

/** Qarşıdakı və canlı matçlar. Filtrlər arqumentdir, yəni hər kombinasiyanın öz qeydi olur. */
export async function upcomingMatches(gameSlug?: string, date?: string) {
  "use cache";
  cacheLife("minutes");
  cacheTag("matches");

  const where: Prisma.MatchWhereInput = { status: { in: ["UPCOMING", "LIVE"] } };
  if (gameSlug) where.game = { slug: gameSlug };
  if (date) {
    const { start, end } = dayRange(date);
    where.scheduledAt = { gte: start, lte: end };
  }

  return prisma.match.findMany({
    where,
    orderBy: [{ status: "asc" }, { scheduledAt: "asc" }],
    include: { teamA: true, teamB: true, tournament: { include: { game: true } } },
  });
}

/** Bitmiş matçlar, səhifələnmiş. */
export async function finishedMatches(gameSlug: string | undefined, date: string | undefined, skip: number, take: number) {
  "use cache";
  cacheLife("minutes");
  cacheTag("matches");

  const where: Prisma.MatchWhereInput = { status: "FINISHED" };
  if (gameSlug) where.game = { slug: gameSlug };
  if (date) {
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
 * Səhifə qabığının sayğacları.
 *
 * PageShell hər public səhifədədir və yalnız yan panelləri göstərib-göstərməmək
 * üçün üç sayğac çəkirdi. Ölçmə göstərdi ki, siyahı sorğularını keşləmək tək
 * başına kifayət etmir: bu sayğaclar keşdən kənarda qaldığı üçün səhifə yenə də
 * bazaya bağlanırdı və hər dinamik səhifədə ~0.8 saniyəlik döşəmə yaranırdı.
 */
export async function railCounts(showDefaultWidgets: boolean) {
  "use cache";
  cacheLife("minutes");
  cacheTag("ads", "news", "players");

  const [ads, transfers, articles] = await Promise.all([
    prisma.adBanner.count({ where: { isActive: true } }),
    showDefaultWidgets ? prisma.teamMembership.count({ where: { team: { isActive: true } } }) : 0,
    showDefaultWidgets ? prisma.newsArticle.count({ where: { publishedAt: { not: null } } }) : 0,
  ]);
  return { ads, transfers, articles };
}

/** Yan paneldəki son xəbərlər. */
export async function recentNews(locale: string) {
  "use cache";
  cacheLife("minutes");
  cacheTag("news");
  return prisma.newsArticle.findMany({
    where: { publishedAt: { not: null } },
    orderBy: [{ isFeatured: "desc" }, { publishedAt: "desc" }],
    take: 6,
    include: { game: true, translations: { where: { locale } } },
  });
}

/** Yan paneldəki son transferlər. */
export async function recentTransfers() {
  "use cache";
  cacheLife("minutes");
  cacheTag("players", "teams");
  return prisma.teamMembership.findMany({
    where: { player: publiclyListedPlayer, team: { isActive: true } },
    orderBy: { joinedAt: "desc" },
    take: 6,
    include: { team: true, player: true },
  });
}
