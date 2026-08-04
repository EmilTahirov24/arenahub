import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { Link } from "@/i18n/navigation";
import PageShell from "@/components/layout/PageShell";
import TeamAvatar from "@/components/common/TeamAvatar";
import CountryFlag from "@/components/common/CountryFlag";
import GameAccent from "@/components/common/GameAccent";
import { countryName } from "@/lib/countries";
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

function formatEarnings(amount: number | null) {
  if (amount == null) return null;
  return "$" + amount.toLocaleString("en-US").replace(/,/g, " ");
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
  const az = locale === "az";

  const games = await prisma.game.findMany({ where: { isActive: true } });
  const activeGame = gameSlug ?? games[0]?.slug;

  const teams = await prisma.team.findMany({
    where: { isActive: true, game: { slug: activeGame } },
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

  // A team with no finished match has no evidence behind its rating, so it is
  // listed separately instead of sitting in the table on the default value —
  // otherwise a team that never played outranks one that played and lost.
  const withPlayed = teams.map((team) => ({
    team,
    played: team._count.homeMatches + team._count.awayMatches,
  }));
  const ranked = withPlayed.filter((r) => r.played > 0);
  // Every unplayed team sits on the same default rating, so ordering them by it
  // would fall through to alphabetical and bury the biggest names at the bottom.
  // Earnings is the only signal we have for them until they play.
  const unranked = withPlayed
    .filter((r) => r.played === 0)
    .sort((a, b) => (b.team.earnings ?? -1) - (a.team.earnings ?? -1) || a.team.name.localeCompare(b.team.name));

  const headCell = "px-3 py-2 text-left text-[11px] font-normal uppercase tracking-wide text-foreground-muted";

  const row = ({ team, played }: (typeof withPlayed)[number], place: number | null) => {
    const wins = team._count.wonMatches;
    const delta = ratingDelta(team);
    const earnings = formatEarnings(team.earnings);

    return (
      <tr key={team.id} className="border-t border-border-subtle hover:bg-surface-raised">
        <td className="w-12 px-3 py-2.5 text-center text-sm font-semibold text-foreground-muted tabular-nums">
          {place ?? "—"}
        </td>
        <td className="px-3 py-2.5">
          <Link href={`/teams/${team.slug}`} className="flex items-center gap-2.5 group">
            <TeamAvatar name={team.name} logoUrl={team.logoUrl} color={team.primaryColor} size={32} />
            <span className="min-w-0">
              <span className="flex items-center gap-1.5 truncate font-semibold group-hover:underline">
                <CountryFlag code={team.country} />
                {team.name}
              </span>
              <span className="block truncate text-xs text-foreground-muted">
                {countryName(team.country) ?? "—"}
              </span>
            </span>
          </Link>
        </td>
        <td className="hidden px-3 py-2.5 text-sm tabular-nums sm:table-cell">
          {earnings ? <span className="text-emerald-400">{earnings}</span> : <span className="text-foreground-muted">—</span>}
        </td>
        <td className="px-3 py-2.5 text-right">
          {played > 0 ? (
            <>
              <span className="font-display font-bold tabular-nums">{Math.round(team.rating)}</span>
              {delta !== 0 && (
                <span className={`ml-1.5 text-xs tabular-nums ${delta > 0 ? "text-emerald-400" : "text-live"}`}>
                  {delta > 0 ? "▲" : "▼"}
                  {Math.abs(delta)}
                </span>
              )}
              <span className="block text-xs text-foreground-muted tabular-nums">
                {wins}–{played - wins}
                {played < 3 && <span className="ml-1">· {az ? "təxmini" : "prov."}</span>}
              </span>
            </>
          ) : (
            <span className="text-sm text-foreground-muted">—</span>
          )}
        </td>
        <td className="hidden px-3 py-2.5 lg:table-cell">
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {team.memberships.map((m) => (
              <Link
                key={m.id}
                href={`/players/${m.player.slug}`}
                className="text-xs text-foreground-muted hover:text-foreground hover:underline"
              >
                {m.player.nickname}
              </Link>
            ))}
            {team.memberships.length === 0 && <span className="text-xs text-foreground-muted">—</span>}
          </span>
        </td>
      </tr>
    );
  };

  const accent = games.find((g) => g.slug === activeGame)?.accentColor;

  return (
    <PageShell>
      <GameAccent color={accent}>
      <h1 className="game-rule font-display mb-4 inline-block pb-1 text-2xl font-bold">{t("nav.teams")}</h1>

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

      <div className="game-edge overflow-x-auto rounded-lg border border-border-subtle bg-surface">
        <table className="w-full min-w-[520px]">
          <thead>
            <tr className="bg-surface-raised">
              <th className={`${headCell} text-center`}>{az ? "Yer" : "Place"}</th>
              <th className={headCell}>{az ? "Komanda" : "Team"}</th>
              <th className={`${headCell} hidden sm:table-cell`}>{az ? "Qazanc" : "Earnings"}</th>
              <th className={`${headCell} text-right`}>{az ? "Reytinq" : "Rating"}</th>
              <th className={`${headCell} hidden lg:table-cell`}>{az ? "Oyunçular" : "Players"}</th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((entry, i) => row(entry, i + 1))}
            {ranked.length === 0 && (
              <tr className="border-t border-border-subtle">
                <td colSpan={5} className="p-6 text-center text-sm text-foreground-muted">
                  {az
                    ? "Hələ heç bir matç oynanılmayıb — nəticələr əlavə olunduqca reytinq cədvəli buradan formalaşacaq."
                    : "No matches played yet — the ranking builds here as results are added."}
                </td>
              </tr>
            )}

            {unranked.length > 0 && (
              <>
                <tr className="border-t border-border-subtle bg-surface-raised">
                  <td colSpan={5} className="px-3 py-2">
                    <span className="font-display text-sm font-bold">
                      {az ? "Reytinqsiz komandalar" : "Unranked teams"}
                    </span>
                    <span className="ml-2 text-xs text-foreground-muted">
                      {az
                        ? "hələ matçı yoxdur — ilk nəticə ilə yuxarı qalxırlar"
                        : "no matches yet — they move up on their first result"}
                    </span>
                  </td>
                </tr>
                {unranked.map((entry) => row(entry, null))}
              </>
            )}
          </tbody>
        </table>
      </div>
      </GameAccent>
    </PageShell>
  );
}
