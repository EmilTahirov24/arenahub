import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { getMyPrediction } from "@/lib/predictions";
import { getPlayerSession } from "@/lib/auth";
import PageShell from "@/components/layout/PageShell";
import AdSlot from "@/components/ads/AdSlot";
import TeamAvatar from "@/components/common/TeamAvatar";
import PlayerAvatar from "@/components/common/PlayerAvatar";
import GameChip from "@/components/common/GameChip";
import CountryFlag from "@/components/common/CountryFlag";
import StarRating from "@/components/common/StarRating";
import AutoRefresh from "@/components/live/AutoRefresh";
import Countdown from "@/components/matches/Countdown";
import MapCard from "@/components/matches/MapCard";
import PredictionWidget from "@/components/matches/PredictionWidget";
import { Link } from "@/i18n/navigation";

export const dynamic = "force-dynamic";

/**
 * What a map card prints where the game has no score of its own.
 *
 * A League or Dota game is won outright — the source records a winner and
 * leaves both numbers at zero. "0 : 0" would read as a game nobody won, so the
 * winner's name takes that place; where even the winner is unknown, a dash is
 * more honest than a number that means nothing.
 */
function mapScoreLabel(
  map: { teamAScore: number; teamBScore: number; winnerId: string | null },
  match: {
    teamAId: string;
    teamBId: string;
    teamA: { name: string };
    teamB: { name: string };
  },
  locale: string,
): string | undefined {
  if (map.teamAScore !== 0 || map.teamBScore !== 0) return undefined;
  const winner =
    map.winnerId === match.teamAId
      ? match.teamA.name
      : map.winnerId === match.teamBId
        ? match.teamB.name
        : null;
  if (!winner) return "—";
  return `${locale === "az" ? "Qalib" : "Winner"}: ${winner}`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ matchSlug: string }>;
}): Promise<Metadata> {
  const { matchSlug } = await params;
  const match = await prisma.match.findUnique({
    where: { slug: matchSlug },
    include: { teamA: true, teamB: true, tournament: true },
  });
  if (!match) return {};

  const title = `${match.teamA.name} vs ${match.teamB.name}${match.tournament ? ` — ${match.tournament.name}` : ""}`;
  const description =
    match.status === "FINISHED"
      ? `${match.teamA.name} ${match.teamAScore} : ${match.teamBScore} ${match.teamB.name}`
      : `BO${match.bestOf} · ${match.status}`;

  return {
    title,
    description,
    openGraph: { title, description, type: "website" },
    twitter: { card: "summary", title, description },
  };
}

export default async function MatchDetailPage({
  params,
}: {
  params: Promise<{ locale: string; matchSlug: string }>;
}) {
  const { locale, matchSlug } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  const match = await prisma.match.findUnique({
    where: { slug: matchSlug },
    include: {
      game: true,
      teamA: true,
      teamB: true,
      tournament: true,
      maps: { orderBy: { mapOrder: "asc" } },
      vetoSteps: { orderBy: { order: "asc" }, include: { team: true } },
      playerStats: { include: { player: true, team: true }, orderBy: { rating: "desc" } },
    },
  });

  if (!match) notFound();

  const predictor = await getPlayerSession();

  const [rosterA, rosterB, headToHead, predictionCounts, myPrediction] = await Promise.all([
    prisma.teamMembership.findMany({ where: { teamId: match.teamAId, leftAt: null }, include: { player: true } }),
    prisma.teamMembership.findMany({ where: { teamId: match.teamBId, leftAt: null }, include: { player: true } }),
    prisma.match.findMany({
      where: {
        status: "FINISHED",
        id: { not: match.id },
        OR: [
          { teamAId: match.teamAId, teamBId: match.teamBId },
          { teamAId: match.teamBId, teamBId: match.teamAId },
        ],
      },
    }),
    prisma.matchPrediction.groupBy({ by: ["predictedWinnerId"], where: { matchId: match.id }, _count: true }),
    getMyPrediction(match.id),
  ]);

  const teamACount = predictionCounts.find((p) => p.predictedWinnerId === match.teamAId)?._count ?? 0;
  const teamBCount = predictionCounts.find((p) => p.predictedWinnerId === match.teamBId)?._count ?? 0;

  const h2hA = headToHead.filter((m) => m.winnerId === match.teamAId).length;
  const h2hB = headToHead.filter((m) => m.winnerId === match.teamBId).length;

  const isLive = match.status === "LIVE";
  const isUpcoming = match.status === "UPCOMING";
  const isFinished = match.status === "FINISHED";

  const dateTimeFmt = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" });

  const statsByTeam = new Map<string, typeof match.playerStats>();
  for (const stat of match.playerStats) {
    if (stat.mapId) continue; // show aggregate/match-level rows only
    const arr = statsByTeam.get(stat.teamId) ?? [];
    arr.push(stat);
    statsByTeam.set(stat.teamId, arr);
  }
  // Fall back to any stats (map-level) if no match-level aggregate rows exist
  if (statsByTeam.size === 0 && match.playerStats.length > 0) {
    for (const stat of match.playerStats) {
      const arr = statsByTeam.get(stat.teamId) ?? [];
      if (!arr.find((s) => s.playerId === stat.playerId)) arr.push(stat);
      statsByTeam.set(stat.teamId, arr);
    }
  }

  const allStats = Array.from(statsByTeam.values()).flat();
  const mvp = allStats.reduce<(typeof allStats)[number] | null>((best, s) => {
    if (s.rating == null) return best;
    if (!best || (best.rating ?? -Infinity) < s.rating) return s;
    return best;
  }, null);
  const mvpTeam = mvp ? (mvp.teamId === match.teamAId ? match.teamA : match.teamB) : null;

  return (
    <PageShell showDefaultWidgets={false}>
      {isLive && <AutoRefresh intervalMs={8000} />}
      <div className="mb-4 flex justify-center">
        <AdSlot placement="MATCH_PAGE_TOP" />
      </div>

      <div className="mb-4 flex items-center gap-2 text-sm text-foreground-muted">
        <GameChip name={match.game.shortName} color={match.game.accentColor} />
        {match.tournament && (
          <Link href={`/events/${match.tournament.slug}`} className="hover:underline">
            {match.tournament.name}
          </Link>
        )}
        {match.stage && <span>· {match.stage}</span>}
        <StarRating value={match.starRating} />
      </div>

      <div className="rounded-xl border border-border-subtle bg-surface p-6">
        {isLive && (
          <div className="mb-4 flex justify-center">
            <span className="inline-flex items-center gap-2 rounded-full bg-live/15 px-3 py-1 text-xs font-bold text-live">
              <span className="h-2 w-2 animate-glow-pulse rounded-full bg-live" />
              {t("nav.live")}
            </span>
          </div>
        )}

        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-1 flex-col items-center gap-2">
            <TeamAvatar name={match.teamA.name} logoUrl={match.teamA.logoUrl} color={match.teamA.primaryColor} size={64} />
            <Link
              href={`/teams/${match.teamA.slug}`}
              className="flex items-center gap-1.5 text-center font-display font-semibold hover:underline"
            >
              <CountryFlag code={match.teamA.country} size={16} />
              {match.teamA.name}
            </Link>
          </div>

          <div className="flex shrink-0 flex-col items-center gap-1">
            {isUpcoming ? (
              <>
                <Countdown target={match.scheduledAt.toISOString()} locale={locale} />
                <span className="text-xs text-foreground-muted">{dateTimeFmt.format(match.scheduledAt)}</span>
                <span className="text-xs text-foreground-muted">BO{match.bestOf}</span>
              </>
            ) : (
              <>
                <span className="font-display tabular-nums text-4xl font-bold">
                  {match.teamAScore} : {match.teamBScore}
                </span>
                <span className="text-xs text-foreground-muted">BO{match.bestOf}</span>
              </>
            )}
            {/* The hover deepens the border rather than the wash: at 20% the
                red text on its own tint drops to 4.29:1. */}
            {match.streamUrl && (
              <a
                href={match.streamUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-live/40 bg-live/10 px-3 py-1 text-xs font-semibold text-live hover:border-live/80 hover:bg-live/15"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-live" />
                {locale === "az" ? "İzlə" : "Watch"}
              </a>
            )}
          </div>

          <div className="flex flex-1 flex-col items-center gap-2">
            <TeamAvatar name={match.teamB.name} logoUrl={match.teamB.logoUrl} color={match.teamB.primaryColor} size={64} />
            <Link
              href={`/teams/${match.teamB.slug}`}
              className="flex items-center gap-1.5 text-center font-display font-semibold hover:underline"
            >
              <CountryFlag code={match.teamB.country} size={16} />
              {match.teamB.name}
            </Link>
          </div>
        </div>

        {isFinished && headToHead.length + 1 > 0 && (
          <p className="mt-4 text-center text-xs text-foreground-muted">
            H2H: {match.teamA.name} {h2hA + (match.winnerId === match.teamAId ? 1 : 0)} — {h2hB + (match.winnerId === match.teamBId ? 1 : 0)} {match.teamB.name}
          </p>
        )}
      </div>

      <PredictionWidget
        matchId={match.id}
        matchSlug={match.slug}
        status={match.status}
        teamA={match.teamA}
        teamB={match.teamB}
        winnerId={match.winnerId}
        isLoggedIn={!!predictor}
        myPick={myPrediction?.predictedWinnerId ?? null}
        teamACount={teamACount}
        teamBCount={teamBCount}
        locale={locale}
      />

      {(match.maps.length > 0 || isUpcoming) && (
        <div className="mt-6">
          <h2 className="font-display mb-2 text-lg font-bold">{locale === "az" ? "Xəritələr" : "Maps"}</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {match.maps.length > 0
              ? match.maps.map((map) => (
                  <MapCard
                    key={map.id}
                    order={map.mapOrder}
                    mapName={map.mapName}
                    teamAScore={map.teamAScore}
                    teamBScore={map.teamBScore}
                    status={map.status}
                    accentColor={match.game.accentColor}
                    scoreLabel={mapScoreLabel(map, match, locale)}
                  />
                ))
              : Array.from({ length: match.bestOf }).map((_, i) => (
                  <MapCard
                    key={i}
                    order={i + 1}
                    mapName="TBA"
                    accentColor={match.game.accentColor}
                    tba
                    label={locale === "az" ? "Seçim gözlənilir" : "To be decided"}
                  />
                ))}
          </div>
        </div>
      )}

      {match.vetoSteps.length > 0 && (
        <div className="mt-6">
          <h2 className="font-display mb-2 text-lg font-bold">{locale === "az" ? "Veto" : "Veto"}</h2>
          <ul className="space-y-1 text-sm text-foreground-muted">
            {match.vetoSteps.map((step) => (
              <li key={step.id}>
                {step.team ? step.team.name : locale === "az" ? "Qalan" : "Decider"}{" "}
                {step.action === "BAN" ? (locale === "az" ? "sıradan çıxardı:" : "banned") : step.action === "PICK" ? (locale === "az" ? "seçdi:" : "picked") : locale === "az" ? "qalıq:" : "decider:"}{" "}
                <span className="font-medium text-foreground">{step.mapName}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {[
          { team: match.teamA, roster: rosterA },
          { team: match.teamB, roster: rosterB },
        ].map(({ team, roster }) => (
          <div key={team.id} className="rounded-lg border border-border-subtle bg-surface p-4">
            <h3 className="font-display mb-3 font-semibold">{team.name}</h3>
            <ul className="space-y-2">
              {roster.map((m) => (
                <li key={m.playerId}>
                  <Link href={`/players/${m.player.slug}`} className="flex items-center gap-2 hover:underline">
                    <PlayerAvatar name={m.player.nickname} photoUrl={m.player.photoUrl} color={team.primaryColor} size={28} />
                    <CountryFlag code={m.player.country} />
                    <span className="text-sm">{m.player.nickname}</span>
                    {m.player.role && <span className="text-xs text-foreground-muted">{m.player.role}</span>}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {statsByTeam.size > 0 && (
        <div className="mt-6">
          <h2 className="font-display mb-2 text-lg font-bold">{t("nav.stats")}</h2>

          {mvp && mvpTeam && (
            <Link
              href={`/players/${mvp.player.slug}`}
              className="mb-4 flex items-center gap-3 rounded-lg border border-warning/40 bg-warning/10 p-4 hover:bg-warning/15"
            >
              <PlayerAvatar name={mvp.player.nickname} photoUrl={mvp.player.photoUrl} color={mvpTeam.primaryColor} size={44} />
              <div>
                <div className="flex items-center gap-1.5 text-xs font-bold text-warning">
                  <span>⭐</span>
                  {t("match.mvp")}
                </div>
                <div className="font-display font-semibold">
                  {mvp.player.nickname} <span className="font-normal text-foreground-muted">· {mvpTeam.name}</span>
                </div>
              </div>
              <div className="font-display ml-auto text-2xl font-bold text-warning">{mvp.rating?.toFixed(2)}</div>
            </Link>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            {[match.teamA, match.teamB].map((team) => {
              const stats = statsByTeam.get(team.id) ?? [];
              if (stats.length === 0) return null;
              return (
                <div key={team.id} className="overflow-hidden rounded-lg border border-border-subtle bg-surface">
                  <div className="bg-surface-raised px-3 py-2 text-sm font-semibold">{team.name}</div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-foreground-muted">
                        <th className="px-3 py-1 font-normal">{locale === "az" ? "Oyunçu" : "Player"}</th>
                        <th className="px-2 py-1 text-right font-normal">K</th>
                        <th className="px-2 py-1 text-right font-normal">D</th>
                        <th className="px-2 py-1 text-right font-normal">A</th>
                        <th className="px-3 py-1 text-right font-normal">Rating</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.map((s) => (
                        <tr key={s.id} className="border-t border-border-subtle">
                          <td className="px-3 py-1.5">
                            {s.player.nickname}
                            {mvp?.id === s.id && <span className="ml-1.5">⭐</span>}
                          </td>
                          <td className="px-2 py-1.5 text-right tabular-nums">{s.kills}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums">{s.deaths}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums">{s.assists}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums font-semibold">{s.rating?.toFixed(2) ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="my-8 flex justify-center">
        <AdSlot placement="IN_CONTENT" />
      </div>
    </PageShell>
  );
}
