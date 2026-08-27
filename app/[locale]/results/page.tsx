import type { Metadata } from "next";
import { activeGames } from "@/lib/cachedQueries";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { dayRange } from "@/lib/dates";
import { groupBy } from "@/lib/group";
import PageShell from "@/components/layout/PageShell";
import MatchFilters from "@/components/matches/MatchFilters";
import MatchGroup from "@/components/matches/MatchGroup";
import Pagination from "@/components/common/Pagination";
import type { Prisma } from "@/app/generated/prisma/client";

const RESULTS_PER_PAGE = 50;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  return { title: t("nav.results") };
}

export default async function ResultsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ game?: string; date?: string; page?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { game: gameSlug, date, page: pageParam } = await searchParams;
  const t = await getTranslations();

  const games = await activeGames();

  const where: Prisma.MatchWhereInput = { status: "FINISHED" };
  if (gameSlug) where.game = { slug: gameSlug };
  if (date) {
    const { start, end } = dayRange(date);
    where.scheduledAt = { gte: start, lte: end };
  }

  // Səhifələmə bazada aparılır, yaddaşda yox. Əvvəl bu sorğu BÜTÜN bitmiş
  // matçları çəkirdi — seed-dəki 23 matçla bu görünmürdü, amma idxal işlədikcə
  // sətir sayı artdı və səhifə 5 saniyəyə qalxdı. Sayğac artmağa davam edir,
  // yəni limitsiz variant vaxt keçdikcə yalnız pisləşir.
  const total = await prisma.match.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / RESULTS_PER_PAGE));
  const page = Math.min(Math.max(1, Number(pageParam) || 1), totalPages);
  const offset = (page - 1) * RESULTS_PER_PAGE;

  const matches = await prisma.match.findMany({
    where,
    orderBy: { scheduledAt: "desc" },
    include: { teamA: true, teamB: true, tournament: { include: { game: true } } },
    take: RESULTS_PER_PAGE,
    skip: offset,
  });

  const groups = groupBy(matches, (m) => m.tournamentId ?? "none");

  // Filtrlər səhifə nömrəsi ilə birlikdə ünvanda qalmalıdır, yoxsa ikinci
  // səhifəyə keçəndə seçilmiş oyun və tarix itir.
  const pageQuery: Record<string, string> = {};
  if (gameSlug) pageQuery.game = gameSlug;
  if (date) pageQuery.date = date;

  return (
    <PageShell>
      <h1 className="font-display mb-4 text-2xl font-bold">{t("nav.results")}</h1>
      <MatchFilters games={games} basePath="/results" activeGame={gameSlug} activeDate={date} />

      {matches.length === 0 && (
        <p className="rounded-lg border border-border-subtle bg-surface p-6 text-center text-sm text-foreground-muted">
          {locale === "az" ? "Bu filtrə uyğun nəticə tapılmadı." : "No results found for this filter."}
        </p>
      )}

      {Array.from(groups.entries()).map(([key, groupMatches]) => (
        <MatchGroup key={key} tournament={groupMatches[0].tournament} matches={groupMatches} />
      ))}

      <Pagination
        page={page}
        totalPages={totalPages}
        pathname="/results"
        query={pageQuery}
        labels={{
          previous: locale === "az" ? "Əvvəlki" : "Previous",
          next: locale === "az" ? "Növbəti" : "Next",
          summary:
            locale === "az"
              ? `${total} nəticədən ${offset + 1}–${offset + matches.length}`
              : `${offset + 1}–${offset + matches.length} of ${total}`,
        }}
      />
    </PageShell>
  );
}
