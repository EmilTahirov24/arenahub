import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getTranslations, getLocale, setRequestLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { Link } from "@/i18n/navigation";
import PageShell from "@/components/layout/PageShell";
import TeamAvatar from "@/components/common/TeamAvatar";
import PlayerAvatar from "@/components/common/PlayerAvatar";
import GameChip from "@/components/common/GameChip";
import CountryFlag from "@/components/common/CountryFlag";
import MatchCard from "@/components/matches/MatchCard";

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

  const [roster, matches, entries] = await Promise.all([
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
  ]);

  return (
    <PageShell>
      <div className="mb-6 flex items-center gap-4 rounded-xl border border-border-subtle bg-surface p-6">
        <TeamAvatar name={team.name} logoUrl={team.logoUrl} color={team.primaryColor} size={72} />
        <div>
          <div className="mb-1 flex items-center gap-2">
            <GameChip name={team.game.shortName} color={team.game.accentColor} />
            {team.worldRanking && (
              <span className="text-xs text-foreground-muted">#{team.worldRanking} {locale === "az" ? "dünya" : "world"}</span>
            )}
          </div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-bold">
            <CountryFlag code={team.country} size={20} />
            {team.name}
          </h1>
        </div>
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
