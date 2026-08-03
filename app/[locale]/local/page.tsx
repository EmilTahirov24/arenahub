import { getTranslations, setRequestLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import PageShell from "@/components/layout/PageShell";
import TeamAvatar from "@/components/common/TeamAvatar";
import PlayerAvatar from "@/components/common/PlayerAvatar";
import GameChip from "@/components/common/GameChip";
import CountryFlag from "@/components/common/CountryFlag";
import NewsCard from "@/components/news/NewsCard";
import { Link } from "@/i18n/navigation";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

const LOCAL_COUNTRY = "AZ";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  return { title: t("nav.local") };
}

export default async function LocalScenePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  const [teams, players, news] = await Promise.all([
    prisma.team.findMany({
      where: { country: LOCAL_COUNTRY, isActive: true },
      include: { game: true },
      orderBy: { rating: "desc" },
    }),
    prisma.player.findMany({
      where: { country: LOCAL_COUNTRY },
      include: {
        game: true,
        memberships: { where: { leftAt: null }, include: { team: true }, take: 1 },
      },
      orderBy: { nickname: "asc" },
    }),
    prisma.newsArticle.findMany({
      where: {
        publishedAt: { not: null },
        OR: [{ relatedTeam: { country: LOCAL_COUNTRY } }],
      },
      include: { game: true, translations: true },
      orderBy: { publishedAt: "desc" },
      take: 6,
    }),
  ]);

  return (
    <PageShell>
      <div className="mb-8 rounded-xl border border-brand-via/30 bg-gradient-to-br from-brand-via/10 to-transparent p-6">
        <h1 className="font-display text-3xl font-bold">
          🇦🇿 <span className="brand-gradient-text">{t("local.title")}</span>
        </h1>
        <p className="mt-2 text-foreground-muted">{t("local.subtitle")}</p>
      </div>

      <h2 className="font-display mb-3 text-lg font-bold">{t("local.teams")}</h2>
      {teams.length > 0 ? (
        <div className="mb-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {teams.map((team) => (
            <Link
              key={team.id}
              href={`/teams/${team.slug}`}
              className="flex items-center gap-3 rounded-lg border border-border-subtle bg-surface p-3 hover:bg-surface-raised"
            >
              <TeamAvatar name={team.name} logoUrl={team.logoUrl} color={team.primaryColor} size={40} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 truncate font-medium">
                  <CountryFlag code={team.country} />
                  {team.name}
                </div>
                <GameChip name={team.game.shortName} color={team.game.accentColor} />
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <p className="mb-8 text-sm text-foreground-muted">{t("local.empty")}</p>
      )}

      <h2 className="font-display mb-3 text-lg font-bold">{t("local.players")}</h2>
      {players.length > 0 ? (
        <div className="mb-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {players.map((player) => {
            const team = player.memberships[0]?.team;
            return (
              <Link
                key={player.id}
                href={`/players/${player.slug}`}
                className="flex items-center gap-3 rounded-lg border border-border-subtle bg-surface p-3 hover:bg-surface-raised"
              >
                <PlayerAvatar name={player.nickname} photoUrl={player.photoUrl} color={team?.primaryColor} size={40} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 truncate font-medium">
                    <CountryFlag code={player.country} />
                    {player.nickname}
                  </div>
                  <div className="truncate text-xs text-foreground-muted">
                    {team?.name ?? "—"} {player.role ? `· ${player.role}` : ""}
                  </div>
                </div>
                <GameChip name={player.game.shortName} color={player.game.accentColor} />
              </Link>
            );
          })}
        </div>
      ) : (
        <p className="mb-8 text-sm text-foreground-muted">{t("local.empty")}</p>
      )}

      <h2 className="font-display mb-3 text-lg font-bold">{t("local.news")}</h2>
      {news.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {news.map((article) => (
            <NewsCard key={article.id} article={article} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-foreground-muted">{t("local.empty")}</p>
      )}
    </PageShell>
  );
}
