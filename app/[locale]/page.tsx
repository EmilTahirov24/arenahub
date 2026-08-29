import type { Metadata } from "next";
import { cacheLife } from "next/cache";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { Link } from "@/i18n/navigation";
import PageShell from "@/components/layout/PageShell";
import MatchCard from "@/components/matches/MatchCard";
import NewsCard from "@/components/news/NewsCard";
import TournamentRow from "@/components/events/TournamentRow";
import TeamAvatar from "@/components/common/TeamAvatar";
import CountryFlag from "@/components/common/CountryFlag";
import GameChip from "@/components/common/GameChip";
import AutoRefresh from "@/components/live/AutoRefresh";
import { ratingDelta } from "@/lib/elo";
import { localeAlternates } from "@/lib/localeAlternates";
import JsonLd from "@/components/seo/JsonLd";
import { siteJsonLd } from "@/lib/structuredData";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  return {
    alternates: localeAlternates(locale, ""),
    title: { absolute: t("site.name") },
  };
}

/** Heading with its "see all" link, repeated by every section below. */
function SectionHead({ title, href, label }: { title: string; href: string; label: string }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="font-display text-xl font-bold">{title}</h2>
      <Link href={href} className="shrink-0 text-sm text-brand-via-fg hover:underline">
        {label} →
      </Link>
    </div>
  );
}

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  "use cache";
  // İdxal saatda bir dəfə işləyir, admin dəyişiklikləri isə revalidatePath ilə
  // dərhal ləğv olunur — ona görə bir dəqiqəlik pəncərə datanı köhnəltmir.
  cacheLife("minutes");

  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const az = locale === "az";

  const matchInclude = { teamA: true, teamB: true, tournament: true } as const;

  const [games, live, upcoming, results, tournaments, articles] = await Promise.all([
    prisma.game.findMany({ where: { isActive: true } }),
    prisma.match.findMany({
      where: { status: "LIVE" },
      orderBy: { scheduledAt: "asc" },
      take: 6,
      include: matchInclude,
    }),
    prisma.match.findMany({
      where: { status: "UPCOMING" },
      orderBy: { scheduledAt: "asc" },
      take: 6,
      include: matchInclude,
    }),
    prisma.match.findMany({
      where: { status: "FINISHED" },
      orderBy: { scheduledAt: "desc" },
      take: 8,
      include: matchInclude,
    }),
    prisma.tournament.findMany({
      // Ongoing first, then what is coming, then what just finished — the same
      // order someone scanning for "what is on" would want.
      orderBy: [{ status: "asc" }, { startDate: "desc" }],
      take: 5,
      include: { game: true },
    }),
    prisma.newsArticle.findMany({
      where: { publishedAt: { not: null } },
      // Seçilmiş xəbər birinci gəlir. Sahə əvvəl yazılırdı, amma heç bir sorğu
      // ona baxmırdı — admin qutunu işarələyirdi və heç nə dəyişmirdi.
      orderBy: [{ isFeatured: "desc" }, { publishedAt: "desc" }],
      take: 6,
      include: { game: true, translations: true },
    }),
  ]);

  // The ranking table shows whichever game has the most finished matches rather
  // than a hardcoded one, so it follows the data as more games fill up.
  const byGame = await prisma.match.groupBy({
    by: ["gameId"],
    where: { status: "FINISHED" },
    _count: { _all: true },
    orderBy: { _count: { id: "desc" } },
    take: 1,
  });
  const rankedGame = games.find((g) => g.id === byGame[0]?.gameId);
  const topTeams = rankedGame
    ? await prisma.team.findMany({
        where: { gameId: rankedGame.id, isActive: true },
        orderBy: [{ rating: "desc" }, { name: "asc" }],
        take: 10,
      })
    : [];

  const headCell = "px-3 py-2 text-left text-[11px] font-normal uppercase tracking-wide text-foreground-muted";

  return (
    <>
      {live.length > 0 && <AutoRefresh intervalMs={60000} />}
      <JsonLd data={siteJsonLd(locale)} />

      {/* No background of its own — the ambient light in globals.css shows
          through here, which is where it is strongest. */}
      <div className="border-b border-border-subtle">
        <div className="mx-auto max-w-[1400px] px-4 py-7">
          {live.length > 0 && (
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-live/40 bg-live/10 px-3 py-1 text-xs font-semibold text-live-fg">
              <span className="h-2 w-2 animate-glow-pulse rounded-full bg-live" />
              {live.length} {t("nav.live")}
            </div>
          )}
          <h1 className="font-display max-w-2xl text-2xl font-bold tracking-tight sm:text-3xl">
            <span className="brand-gradient-text">{t("home.title")}</span>
          </h1>
          <p className="mt-1.5 max-w-xl text-sm text-foreground-muted">{t("home.subtitle")}</p>

          <div className="mt-4 flex flex-wrap gap-2">
            {games.map((game) => (
              <Link key={game.id} href={`/teams?game=${game.slug}`}>
                <GameChip name={game.name} color={game.accentColor} />
              </Link>
            ))}
          </div>
        </div>
      </div>

      <PageShell>
        {live.length > 0 && (
          <section className="mb-10">
            <SectionHead title={t("nav.live")} href="/live" label={t("nav.live")} />
            <div className="grid gap-3 sm:grid-cols-2">
              {live.map((match) => (
                <MatchCard key={match.id} match={match} />
              ))}
            </div>
          </section>
        )}

        {/* Results lead, because 700-odd of them exist and nothing else on the
            site is this complete. */}
        {results.length > 0 && (
          <section className="mb-10">
            <SectionHead
              title={az ? "Son nəticələr" : "Latest results"}
              href="/results"
              label={az ? "Bütün nəticələr" : "All results"}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              {results.map((match) => (
                <MatchCard key={match.id} match={match} />
              ))}
            </div>
          </section>
        )}

        {topTeams.length > 0 && rankedGame && (
          <section className="mb-10">
            <SectionHead
              title={`${rankedGame.shortName} ${az ? "reytinqi" : "ranking"}`}
              href={`/teams?game=${rankedGame.slug}`}
              label={az ? "Bütün reytinq" : "Full ranking"}
            />
            <div className="overflow-x-auto rounded-lg border border-border-subtle bg-surface">
              <table className="w-full min-w-[420px] text-sm">
                <thead>
                  <tr className="bg-surface-raised">
                    <th className={`${headCell} w-10 text-center`}>#</th>
                    <th className={headCell}>{az ? "Komanda" : "Team"}</th>
                    <th className={`${headCell} text-right`}>{az ? "Reytinq" : "Rating"}</th>
                  </tr>
                </thead>
                <tbody>
                  {topTeams.map((team, i) => {
                    const delta = ratingDelta(team);
                    return (
                      <tr key={team.id} className="border-t border-border-subtle hover:bg-surface-raised">
                        <td className="px-3 py-2 text-center text-foreground-muted tabular-nums">{i + 1}</td>
                        <td className="px-3 py-2">
                          <Link href={`/teams/${team.slug}`} className="flex items-center gap-2 hover:underline">
                            <TeamAvatar name={team.name} logoUrl={team.logoUrl} color={team.primaryColor} size={22} />
                            <CountryFlag code={team.country} />
                            <span className="truncate font-medium">{team.name}</span>
                          </Link>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          <span className="font-display font-bold">{Math.round(team.rating)}</span>
                          {delta !== 0 && (
                            <span className={`ml-1.5 text-xs ${delta > 0 ? "text-positive" : "text-live"}`}>
                              {delta > 0 ? `+${delta}` : delta}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {tournaments.length > 0 && (
          <section className="mb-10">
            <SectionHead title={t("nav.events")} href="/events" label={t("nav.events")} />
            <div className="space-y-2">
              {tournaments.map((tour) => (
                <TournamentRow key={tour.id} tournament={tour} />
              ))}
            </div>
          </section>
        )}

        {/* The sections below appear only once they have something in them. A
            heading with an empty grid under it reads as a broken page. */}
        {upcoming.length > 0 && (
          <section className="mb-10">
            <SectionHead title={t("nav.matches")} href="/matches" label={t("nav.matches")} />
            <div className="grid gap-3 sm:grid-cols-2">
              {upcoming.map((match) => (
                <MatchCard key={match.id} match={match} />
              ))}
            </div>
          </section>
        )}

        {articles.length > 0 && (
          <section>
            <SectionHead title={t("nav.news")} href="/news" label={t("nav.news")} />
            <div className="grid gap-4 sm:grid-cols-2">
              {articles.map((article) => (
                <NewsCard key={article.id} article={article} />
              ))}
            </div>
          </section>
        )}
      </PageShell>
    </>
  );
}
