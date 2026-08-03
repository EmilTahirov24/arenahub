import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { Link } from "@/i18n/navigation";
import PageShell from "@/components/layout/PageShell";
import TeamAvatar from "@/components/common/TeamAvatar";
import PlayerAvatar from "@/components/common/PlayerAvatar";
import GameChip from "@/components/common/GameChip";
import CountryFlag from "@/components/common/CountryFlag";
import MatchCard from "@/components/matches/MatchCard";
import { ratingDelta } from "@/lib/elo";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ teamSlug: string }>;
}): Promise<Metadata> {
  const { teamSlug } = await params;
  const team = await prisma.team.findUnique({ where: { slug: teamSlug }, include: { game: true } });
  if (!team) return {};

  const title = `${team.name} — ${team.game.name}`;
  const description = team.description ?? `${team.name} ${team.game.name} komandasının profili, tərkibi və matçları.`;
  return {
    title,
    description,
    openGraph: { title, description, type: "profile" },
    twitter: { card: "summary", title, description },
  };
}

export default async function TeamProfilePage({
  params,
}: {
  params: Promise<{ locale: string; teamSlug: string }>;
}) {
  const { locale, teamSlug } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  const team = await prisma.team.findUnique({
    where: { slug: teamSlug },
    include: { game: true },
  });
  if (!team) notFound();

  const [roster, matches, entries, finishedMatches, teamsAbove] = await Promise.all([
    prisma.teamMembership.findMany({ where: { teamId: team.id, leftAt: null }, include: { player: true } }),
    prisma.match.findMany({
      where: { OR: [{ teamAId: team.id }, { teamBId: team.id }] },
      orderBy: { scheduledAt: "desc" },
      take: 8,
      include: { teamA: true, teamB: true, tournament: true },
    }),
    prisma.tournamentParticipant.findMany({
      where: { teamId: team.id, placement: { not: null } },
      orderBy: { tournament: { endDate: "desc" } },
      include: { tournament: true },
    }),
    prisma.match.findMany({
      where: { status: "FINISHED", OR: [{ teamAId: team.id }, { teamBId: team.id }] },
      orderBy: { scheduledAt: "desc" },
      select: { winnerId: true },
    }),
    // Rank is derived from the rating rather than stored, so it can never drift
    // out of sync with the ranking table on /teams.
    prisma.team.count({
      where: { isActive: true, gameId: team.gameId, rating: { gt: team.rating } },
    }),
  ]);

  const rank = teamsAbove + 1;
  const delta = ratingDelta(team);
  const wins = finishedMatches.filter((m) => m.winnerId === team.id).length;
  const losses = finishedMatches.length - wins;
  const winRate = finishedMatches.length > 0 ? Math.round((wins / finishedMatches.length) * 100) : null;
  // Most recent first, as a W/L streak strip.
  const recentForm = finishedMatches.slice(0, 5).map((m) => m.winnerId === team.id);

  return (
    <PageShell>
      <div className="mb-6 rounded-xl border border-border-subtle bg-surface p-6">
        <div className="flex flex-wrap items-center gap-4">
          <TeamAvatar name={team.name} logoUrl={team.logoUrl} color={team.primaryColor} size={72} />
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center gap-2">
              <GameChip name={team.game.shortName} color={team.game.accentColor} />
              {team.isActive && (
                <span className="flex items-center gap-1.5 text-xs text-foreground-muted">
                  <span>
                    #{rank} · {Math.round(team.rating)} {locale === "az" ? "reytinq" : "rating"}
                  </span>
                  {delta !== 0 && (
                    <span className={delta > 0 ? "text-emerald-400" : "text-live"}>
                      {delta > 0 ? "▲" : "▼"} {Math.abs(delta)}
                    </span>
                  )}
                </span>
              )}
            </div>
            <h1 className="flex items-center gap-2 font-display text-2xl font-bold">
              <CountryFlag code={team.country} size={20} />
              {team.name}
            </h1>
          </div>

          {finishedMatches.length > 0 && (
            <div className="flex shrink-0 items-center gap-6">
              <div className="text-center">
                <div className="font-display text-2xl font-bold tabular-nums">
                  <span className="text-emerald-400">{wins}</span>
                  <span className="text-foreground-muted"> — </span>
                  <span className="text-live">{losses}</span>
                </div>
                <div className="text-xs text-foreground-muted">
                  {locale === "az" ? "qalib — məğlub" : "win — loss"}
                </div>
              </div>
              <div className="text-center">
                <div className="font-display text-2xl font-bold tabular-nums text-brand-via">{winRate}%</div>
                <div className="text-xs text-foreground-muted">{locale === "az" ? "qazanma" : "win rate"}</div>
              </div>
              <div className="text-center">
                <div className="flex items-center gap-1">
                  {recentForm.map((won, i) => (
                    <span
                      key={i}
                      title={won ? (locale === "az" ? "Qalib" : "Win") : locale === "az" ? "Məğlub" : "Loss"}
                      className={`flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold ${
                        won ? "bg-emerald-400/15 text-emerald-400" : "bg-live/15 text-live"
                      }`}
                    >
                      {won ? (locale === "az" ? "Q" : "W") : locale === "az" ? "M" : "L"}
                    </span>
                  ))}
                </div>
                <div className="mt-1 text-xs text-foreground-muted">{locale === "az" ? "son form" : "recent form"}</div>
              </div>
            </div>
          )}
        </div>

        {team.description && (
          <p className="mt-4 max-w-3xl border-t border-border-subtle pt-4 text-sm leading-relaxed text-foreground-muted">
            {team.description}
          </p>
        )}
      </div>

      <h2 className="font-display mb-2 text-lg font-bold">{locale === "az" ? "Tərkib" : "Roster"}</h2>
      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        {roster.map((m) => (
          <Link
            key={m.playerId}
            href={`/players/${m.player.slug}`}
            className="flex items-center gap-3 rounded-lg border border-border-subtle bg-surface p-3 hover:bg-surface-raised"
          >
            <PlayerAvatar name={m.player.nickname} photoUrl={m.player.photoUrl} color={team.primaryColor} size={40} />
            <div>
              <div className="flex items-center gap-1.5 font-medium">
                <CountryFlag code={m.player.country} />
                {m.player.nickname}
              </div>
              {m.player.role && <div className="text-xs text-foreground-muted">{m.player.role}</div>}
            </div>
          </Link>
        ))}
        {roster.length === 0 && <p className="text-sm text-foreground-muted">—</p>}
      </div>

      {entries.length > 0 && (
        <>
          <h2 className="font-display mb-2 text-lg font-bold">{locale === "az" ? "Nailiyyətlər" : "Achievements"}</h2>
          <ul className="mb-6 space-y-1">
            {entries.map((e) => (
              <li key={e.id} className="flex items-center justify-between rounded-lg border border-border-subtle bg-surface px-3 py-2 text-sm">
                <Link href={`/events/${e.tournament.slug}`} className="hover:underline">
                  {e.tournament.name}
                </Link>
                <span className="font-display font-semibold text-brand-via">#{e.placement}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      <h2 className="font-display mb-2 text-lg font-bold">{t("nav.matches")}</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {matches.map((match) => (
          <MatchCard key={match.id} match={match} />
        ))}
        {matches.length === 0 && <p className="text-sm text-foreground-muted">—</p>}
      </div>
    </PageShell>
  );
}
