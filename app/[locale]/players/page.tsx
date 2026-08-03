import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { Link } from "@/i18n/navigation";
import PageShell from "@/components/layout/PageShell";
import PlayerAvatar from "@/components/common/PlayerAvatar";
import CountryFlag from "@/components/common/CountryFlag";
import { publiclyListedPlayer } from "@/lib/publicPlayers";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  return { title: t("nav.players") };
}

export default async function PlayersPage({
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

  const players = await prisma.player.findMany({
    where: { AND: [publiclyListedPlayer, { status: "ACTIVE", game: { slug: activeGame } }] },
    orderBy: { nickname: "asc" },
    include: {
      memberships: { where: { leftAt: null }, include: { team: true }, take: 1 },
    },
  });

  return (
    <PageShell>
      <h1 className="font-display mb-4 text-2xl font-bold">{t("nav.players")}</h1>

      <div className="mb-6 flex flex-wrap gap-2">
        {games.map((game) => (
          <Link
            key={game.id}
            href={{ pathname: "/players", query: { game: game.slug } }}
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

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {players.map((player) => {
          const team = player.memberships[0]?.team;
          return (
            <Link
              key={player.id}
              href={`/players/${player.slug}`}
              className="flex items-center gap-3 rounded-lg border border-border-subtle bg-surface p-3 hover:bg-surface-raised"
            >
              <PlayerAvatar name={player.nickname} photoUrl={player.photoUrl} color={team?.primaryColor} size={40} />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 truncate font-medium">
                  <CountryFlag code={player.country} />
                  {player.nickname}
                </div>
                <div className="truncate text-xs text-foreground-muted">
                  {team?.name ?? "—"} {player.role ? `· ${player.role}` : ""}
                </div>
              </div>
            </Link>
          );
        })}
        {players.length === 0 && (
          <p className="text-sm text-foreground-muted">{locale === "az" ? "Oyunçu tapılmadı." : "No players found."}</p>
        )}
      </div>
    </PageShell>
  );
}
