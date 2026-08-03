import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { Link } from "@/i18n/navigation";
import PageShell from "@/components/layout/PageShell";
import TeamAvatar from "@/components/common/TeamAvatar";
import CountryFlag from "@/components/common/CountryFlag";
import { ratingDelta } from "@/lib/elo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  return { title: t("nav.teams") };
}

export default async function TeamsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ game?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { game: gameSlug } = await searchParams;
  const t = await getTranslations();

  const games = await prisma.game.findMany({ where: { isActive: true } });
  const activeGame = gameSlug ?? games[0]?.slug;

  const teams = await prisma.team.findMany({
    where: { isActive: true, game: { slug: activeGame } },
    orderBy: [{ rating: "desc" }, { name: "asc" }],
    include: {
      _count: {
        select: {
          wonMatches: true,
          homeMatches: { where: { status: "FINISHED" } },
          awayMatches: { where: { status: "FINISHED" } },
        },
      },
    },
  });

  // A team with no finished match has no evidence behind its rating, so it is
  // listed separately instead of sitting in the table on the default value —
  // otherwise a team that never played outranks one that played and lost.
  const withPlayed = teams.map((team) => ({
    team,
    played: team._count.homeMatches + team._count.awayMatches,
  }));
  const ranked = withPlayed.filter((t) => t.played > 0);
  const unranked = withPlayed.filter((t) => t.played === 0);

  return (
    <PageShell>
      <h1 className="font-display mb-4 text-2xl font-bold">{t("nav.teams")}</h1>

      <div className="mb-6 flex flex-wrap gap-2">
        {games.map((game) => (
          <Link
            key={game.id}
            href={{ pathname: "/teams", query: { game: game.slug } }}
            className="rounded-full border px-3 py-1 text-xs font-medium transition-colors"
            style={
              activeGame === game.slug
                ? { backgroundColor: game.accentColor, borderColor: game.accentColor, color: "#0a0b10" }
                : undefined
            }
          >
            <span className={activeGame === game.slug ? "" : "text-foreground-muted hover:text-foreground"}>
              {game.shortName}
            </span>
          </Link>
        ))}
      </div>

      <div className="overflow-hidden rounded-lg border border-border-subtle">
        {ranked.map(({ team, played }, i) => {
          const wins = team._count.wonMatches;
          const delta = ratingDelta(team);
          return (
            <Link
              key={team.id}
              href={`/teams/${team.slug}`}
              className="flex items-center gap-3 border-b border-border-subtle bg-surface px-4 py-3 last:border-b-0 hover:bg-surface-raised"
            >
              <span className="w-6 shrink-0 text-sm font-semibold text-foreground-muted">#{i + 1}</span>
              <TeamAvatar name={team.name} logoUrl={team.logoUrl} color={team.primaryColor} size={36} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 truncate font-medium">
                  <CountryFlag code={team.country} />
                  {team.name}
                  {played < 3 && (
                    <span
                      title={
                        locale === "az"
                          ? "Az matç oynanılıb — reytinq hələ dəqiq deyil"
                          : "Few matches played — rating is not settled yet"
                      }
                      className="rounded-full border border-border-subtle px-1.5 text-[10px] font-normal text-foreground-muted"
                    >
                      {locale === "az" ? "təxmini" : "provisional"}
                    </span>
                  )}
                </div>
                <div className="text-xs text-foreground-muted tabular-nums">
                  {wins}–{played - wins}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="font-display font-bold tabular-nums">{Math.round(team.rating)}</div>
                {delta !== 0 && (
                  <div className={`text-xs tabular-nums ${delta > 0 ? "text-emerald-400" : "text-live"}`}>
                    {delta > 0 ? "▲" : "▼"} {Math.abs(delta)}
                  </div>
                )}
              </div>
            </Link>
          );
        })}
        {ranked.length === 0 && (
          <p className="p-6 text-center text-sm text-foreground-muted">
            {locale === "az"
              ? "Hələ heç bir matç oynanılmayıb — nəticələr əlavə olunduqca reytinq cədvəli buradan formalaşacaq."
              : "No matches played yet — the ranking builds here as results are added."}
          </p>
        )}
      </div>

      {unranked.length > 0 && (
        <>
          <h2 className="font-display mb-1 mt-8 text-lg font-bold">
            {locale === "az" ? "Reytinqsiz komandalar" : "Unranked teams"}
          </h2>
          <p className="mb-3 text-sm text-foreground-muted">
            {locale === "az"
              ? "Hələ matçı olmayan komandalar. İlk nəticə yazılan kimi yuxarıdakı cədvələ qoşulurlar."
              : "Teams with no matches yet. They join the table above as soon as a result is recorded."}
          </p>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {unranked.map(({ team }) => (
              <Link
                key={team.id}
                href={`/teams/${team.slug}`}
                className="flex items-center gap-3 rounded-lg border border-border-subtle bg-surface px-3 py-2 hover:bg-surface-raised"
              >
                <TeamAvatar name={team.name} logoUrl={team.logoUrl} color={team.primaryColor} size={28} />
                <span className="flex min-w-0 items-center gap-1.5 truncate text-sm font-medium">
                  <CountryFlag code={team.country} />
                  {team.name}
                </span>
              </Link>
            ))}
          </div>
        </>
      )}
    </PageShell>
  );
}
