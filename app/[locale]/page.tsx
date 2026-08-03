import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { Link } from "@/i18n/navigation";
import PageShell from "@/components/layout/PageShell";
import MatchCard from "@/components/matches/MatchCard";
import NewsCard from "@/components/news/NewsCard";
import AdSlot from "@/components/ads/AdSlot";
import GameChip from "@/components/common/GameChip";
import AutoRefresh from "@/components/live/AutoRefresh";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  return { title: { absolute: t("site.name") } };
}

export default async function Home({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  const [games, matches, articles] = await Promise.all([
    prisma.game.findMany({ where: { isActive: true } }),
    prisma.match.findMany({
      where: { status: { in: ["LIVE", "UPCOMING"] } },
      orderBy: [{ status: "asc" }, { scheduledAt: "asc" }],
      take: 8,
      include: { teamA: true, teamB: true, tournament: true },
    }),
    prisma.newsArticle.findMany({
      where: { publishedAt: { not: null } },
      orderBy: { publishedAt: "desc" },
      take: 6,
      include: { game: true, translations: true },
    }),
  ]);

  const liveCount = matches.filter((m) => m.status === "LIVE").length;

  return (
    <>
      {liveCount > 0 && <AutoRefresh intervalMs={15000} />}
      <div className="border-b border-border-subtle bg-gradient-to-b from-surface to-background">
        {/* Matches are the product — keep the hero compact so the first card
            stays above the fold on a laptop screen. */}
        <div className="mx-auto max-w-[1400px] px-4 py-7">
          {liveCount > 0 && (
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-live/40 bg-live/10 px-3 py-1 text-xs font-semibold text-live">
              <span className="h-2 w-2 animate-glow-pulse rounded-full bg-live" />
              {liveCount} {t("nav.live")}
            </div>
          )}
          <h1 className="font-display max-w-2xl text-2xl font-bold tracking-tight sm:text-3xl">
            <span className="brand-gradient-text">{t("home.title")}</span>
          </h1>
          <p className="mt-1.5 max-w-xl text-sm text-foreground-muted">{t("home.subtitle")}</p>

          <div className="mt-4 flex flex-wrap gap-2">
            {games.map((game) => (
              <Link key={game.id} href={`/matches?game=${game.slug}`}>
                <GameChip name={game.name} color={game.accentColor} />
              </Link>
            ))}
          </div>
        </div>
      </div>

      <PageShell>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl font-bold">{t("nav.matches")}</h2>
          <Link href="/matches" className="text-sm text-brand-via hover:underline">
            {t("nav.matches")} →
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {matches.map((match) => (
            <MatchCard key={match.id} match={match} />
          ))}
        </div>
        {matches.length === 0 && (
          <p className="text-sm text-foreground-muted">{locale === "az" ? "Hazırda matç yoxdur." : "No matches right now."}</p>
        )}

        <div className="my-8 flex justify-center">
          <AdSlot placement="IN_CONTENT" />
        </div>

        <div className="mb-8 flex items-center justify-between">
          <h2 className="font-display text-xl font-bold">{t("nav.news")}</h2>
          <Link href="/news" className="text-sm text-brand-via hover:underline">
            {t("nav.news")} →
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {articles.map((article) => (
            <NewsCard key={article.id} article={article} />
          ))}
        </div>
      </PageShell>
    </>
  );
}
