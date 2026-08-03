import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { dayRange } from "@/lib/dates";
import { groupBy } from "@/lib/group";
import PageShell from "@/components/layout/PageShell";
import MatchFilters from "@/components/matches/MatchFilters";
import MatchGroup from "@/components/matches/MatchGroup";
import type { Prisma } from "@/app/generated/prisma/client";

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
  searchParams: Promise<{ game?: string; date?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { game: gameSlug, date } = await searchParams;
  const t = await getTranslations();

  const games = await prisma.game.findMany({ where: { isActive: true } });

  const where: Prisma.MatchWhereInput = { status: "FINISHED" };
  if (gameSlug) where.game = { slug: gameSlug };
  if (date) {
    const { start, end } = dayRange(date);
    where.scheduledAt = { gte: start, lte: end };
  }

  const matches = await prisma.match.findMany({
    where,
    orderBy: { scheduledAt: "desc" },
    include: { teamA: true, teamB: true, tournament: { include: { game: true } } },
  });

  const groups = groupBy(matches, (m) => m.tournamentId ?? "none");

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
    </PageShell>
  );
}
