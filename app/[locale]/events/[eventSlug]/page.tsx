import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { Link } from "@/i18n/navigation";
import PageShell from "@/components/layout/PageShell";
import TeamAvatar from "@/components/common/TeamAvatar";
import GameChip from "@/components/common/GameChip";
import MatchCard from "@/components/matches/MatchCard";
import Bracket from "@/components/events/Bracket";

const BRACKET_STAGES = new Set(["round of 16", "quarterfinal", "semifinal", "3rd place decider", "final"]);

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ eventSlug: string }>;
}): Promise<Metadata> {
  const { eventSlug } = await params;
  const tournament = await prisma.tournament.findUnique({ where: { slug: eventSlug }, include: { game: true } });
  if (!tournament) return {};
  return { title: `${tournament.name} — ${tournament.game.name}` };
}

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ locale: string; eventSlug: string }>;
}) {
  const { locale, eventSlug } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  const tournament = await prisma.tournament.findUnique({
    where: { slug: eventSlug },
    include: { game: true },
  });
  if (!tournament) notFound();

  const [participants, matches] = await Promise.all([
    prisma.tournamentParticipant.findMany({
      where: { tournamentId: tournament.id },
      orderBy: [{ placement: "asc" }, { seed: "asc" }],
      include: { team: true },
    }),
    prisma.match.findMany({
      where: { tournamentId: tournament.id },
      orderBy: { scheduledAt: "asc" },
      include: { teamA: true, teamB: true, tournament: true },
    }),
  ]);

  const dateFmt = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });

  return (
    <PageShell>
      <div className="mb-6 rounded-xl border border-border-subtle bg-surface p-6">
        <div className="mb-2 flex items-center gap-2">
          <GameChip name={tournament.game.shortName} color={tournament.game.accentColor} />
          <span className="text-xs text-foreground-muted">{locale === "az" ? "Tier" : "Tier"} {tournament.tier}</span>
        </div>
        <h1 className="font-display text-2xl font-bold">{tournament.name}</h1>
        <p className="mt-1 text-sm text-foreground-muted">
          {dateFmt.format(tournament.startDate)} – {dateFmt.format(tournament.endDate)}
          {tournament.location ? ` · ${tournament.location}` : ""}
          {tournament.prizePool ? ` · ${tournament.prizePool}` : ""}
        </p>
      </div>

      <h2 className="font-display mb-2 text-lg font-bold">{t("nav.teams")}</h2>
      <div className="mb-6 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {participants.map((p) => (
          <Link
            key={p.id}
            href={`/teams/${p.team.slug}`}
            className="flex items-center gap-2 rounded-lg border border-border-subtle bg-surface p-2 hover:bg-surface-raised"
          >
            {p.placement && (
              <span className="w-6 text-center text-xs font-semibold text-brand-via">#{p.placement}</span>
            )}
            <TeamAvatar name={p.team.name} logoUrl={p.team.logoUrl} color={p.team.primaryColor} size={28} />
            <span className="truncate text-sm">{p.team.name}</span>
          </Link>
        ))}
      </div>

      {(() => {
        const bracketMatches = matches.filter((m) => BRACKET_STAGES.has((m.stage ?? "").toLowerCase()));
        const otherMatches = matches.filter((m) => !BRACKET_STAGES.has((m.stage ?? "").toLowerCase()));
        return (
          <>
            {bracketMatches.length > 0 && (
              <div className="mb-6">
                <h2 className="font-display mb-3 text-lg font-bold">{locale === "az" ? "Bracket" : "Bracket"}</h2>
                <Bracket matches={bracketMatches} />
              </div>
            )}

            <h2 className="font-display mb-2 text-lg font-bold">
              {otherMatches.length > 0 && bracketMatches.length > 0
                ? locale === "az"
                  ? "Qrup mərhələsi"
                  : "Group stage"
                : t("nav.matches")}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {otherMatches.map((match) => (
                <MatchCard key={match.id} match={match} />
              ))}
              {matches.length === 0 && <p className="text-sm text-foreground-muted">—</p>}
            </div>
          </>
        );
      })()}
    </PageShell>
  );
}
