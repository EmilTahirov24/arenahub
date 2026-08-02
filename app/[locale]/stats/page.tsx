import { getTranslations, setRequestLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { Link } from "@/i18n/navigation";
import PageShell from "@/components/layout/PageShell";
import PlayerAvatar from "@/components/common/PlayerAvatar";
import TeamAvatar from "@/components/common/TeamAvatar";

export const dynamic = "force-dynamic";

export default async function StatsPage({
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
  const activeGame = games.find((g) => g.slug === gameSlug) ?? games[0];

  const grouped = activeGame
    ? await prisma.playerMatchStat.groupBy({
        by: ["playerId"],
        where: { mapId: null, player: { gameId: activeGame.id } },
        _avg: { rating: true },
        _sum: { kills: true, deaths: true, assists: true },
        _count: { _all: true },
        orderBy: { _avg: { rating: "desc" } },
        take: 15,
      })
    : [];

  const players = activeGame
    ? await prisma.player.findMany({
        where: { id: { in: grouped.map((g) => g.playerId) } },
        include: { memberships: { where: { leftAt: null }, include: { team: true }, take: 1 } },
      })
    : [];
  const playerById = new Map(players.map((p) => [p.id, p]));

  return (
    <PageShell>
      <h1 className="font-display mb-4 text-2xl font-bold">{t("nav.stats")}</h1>

      <div className="mb-6 flex flex-wrap gap-2">
        {games.map((game) => (
          <Link
            key={game.id}
            href={{ pathname: "/stats", query: { game: game.slug } }}
            className="rounded-full border px-3 py-1 text-xs font-medium transition-colors"
            style={activeGame?.slug === game.slug ? { backgroundColor: game.accentColor, borderColor: game.accentColor, color: "#0a0b10" } : undefined}
          >
            <span className={activeGame?.slug === game.slug ? "" : "text-foreground-muted hover:text-foreground"}>{game.shortName}</span>
          </Link>
        ))}
      </div>

      <div className="overflow-hidden rounded-lg border border-border-subtle bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface-raised text-left text-xs text-foreground-muted">
              <th className="px-3 py-2 font-normal">#</th>
              <th className="px-3 py-2 font-normal">{locale === "az" ? "Oyunçu" : "Player"}</th>
              <th className="px-2 py-2 text-right font-normal">{locale === "az" ? "Matç" : "Maps"}</th>
              <th className="px-2 py-2 text-right font-normal">K</th>
              <th className="px-2 py-2 text-right font-normal">D</th>
              <th className="px-2 py-2 text-right font-normal">A</th>
              <th className="px-3 py-2 text-right font-normal">Rating</th>
            </tr>
          </thead>
          <tbody>
            {grouped.map((row, i) => {
              const player = playerById.get(row.playerId);
              if (!player) return null;
              const team = player.memberships[0]?.team;
              return (
                <tr key={row.playerId} className="border-t border-border-subtle">
                  <td className="px-3 py-2 text-foreground-muted">{i + 1}</td>
                  <td className="px-3 py-2">
                    <Link href={`/players/${player.slug}`} className="flex items-center gap-2 hover:underline">
                      <PlayerAvatar name={player.nickname} photoUrl={player.photoUrl} color={team?.primaryColor} size={24} />
                      <span className="font-medium">{player.nickname}</span>
                      {team && <TeamAvatar name={team.name} logoUrl={team.logoUrl} color={team.primaryColor} size={18} />}
                    </Link>
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">{row._count._all}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{row._sum.kills}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{row._sum.deaths}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{row._sum.assists}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-semibold text-brand-via">
                    {row._avg.rating?.toFixed(2) ?? "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {grouped.length === 0 && (
          <p className="p-6 text-center text-sm text-foreground-muted">{locale === "az" ? "Statistika yoxdur." : "No stats yet."}</p>
        )}
      </div>
    </PageShell>
  );
}
