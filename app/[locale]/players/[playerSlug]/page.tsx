import { notFound } from "next/navigation";
import { cacheLife } from "next/cache";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { Link } from "@/i18n/navigation";
import { parseSocials } from "@/lib/socials";
import PageShell from "@/components/layout/PageShell";
import OwnerEditLink from "@/components/layout/OwnerEditLink";
import PlayerAvatar from "@/components/common/PlayerAvatar";
import TeamAvatar from "@/components/common/TeamAvatar";
import GameChip from "@/components/common/GameChip";
import CountryFlag from "@/components/common/CountryFlag";
import SocialLinks from "@/components/players/SocialLinks";
import { localeAlternates } from "@/lib/localeAlternates";

function average(values: number[]) {
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; playerSlug: string }>;
}): Promise<Metadata> {
  const { locale, playerSlug } = await params;
  const player = await prisma.player.findUnique({ where: { slug: playerSlug }, include: { game: true } });
  if (!player) return {};
  return {
    alternates: localeAlternates(locale, `/players/${playerSlug}`), title: `${player.nickname} — ${player.game.name}` };
}

export default async function PlayerProfilePage({
  params,
}: {
  params: Promise<{ locale: string; playerSlug: string }>;
}) {
  "use cache";
  // İdxal saatda bir dəfə işləyir, admin dəyişiklikləri isə revalidatePath ilə
  // dərhal ləğv olunur — ona görə bir dəqiqəlik pəncərə datanı köhnəltmir.
  cacheLife("minutes");

  const { locale, playerSlug } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  const player = await prisma.player.findUnique({
    where: { slug: playerSlug },
    include: { game: true },
  });
  if (!player) notFound();

  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

  const [currentMembership, recentStats, allTeamIds] = await Promise.all([
    prisma.teamMembership.findFirst({ where: { playerId: player.id, leftAt: null }, include: { team: true } }),
    prisma.playerMatchStat.findMany({
      where: { playerId: player.id, mapId: null },
      orderBy: { match: { scheduledAt: "desc" } },
      take: 10,
      include: { match: { include: { teamA: true, teamB: true } } },
    }),
    prisma.teamMembership.findMany({ where: { playerId: player.id }, select: { teamId: true } }),
  ]);

  const achievements = await prisma.tournamentParticipant.findMany({
    where: { teamId: { in: allTeamIds.map((m) => m.teamId) }, placement: { not: null } },
    include: { tournament: true, team: true },
    orderBy: { tournament: { endDate: "desc" } },
    take: 8,
  });

  const careerRatings = recentStats.map((s) => s.rating).filter((r): r is number => r != null);
  const careerRating = average(careerRatings);
  const last3MonthsRating = average(
    recentStats.filter((s) => s.rating != null && s.match.scheduledAt >= threeMonthsAgo).map((s) => s.rating!),
  );

  const socials = parseSocials(player.socials);

  return (
    <PageShell>
      <div className="mb-6 flex flex-wrap items-center gap-4 rounded-xl border border-border-subtle bg-surface p-6">
        <PlayerAvatar name={player.nickname} photoUrl={player.photoUrl} color={currentMembership?.team.primaryColor} size={72} />
        <div className="flex-1">
          <div className="mb-1 flex items-center gap-2">
            <GameChip name={player.game.shortName} color={player.game.accentColor} />
            {player.role && <span className="text-xs text-foreground-muted">{player.role}</span>}
          </div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-bold">
            <CountryFlag code={player.country} size={18} />
            {player.nickname}
          </h1>
          {(player.firstName || player.lastName) && (
            <p className="text-sm text-foreground-muted">
              {[player.firstName, player.lastName].filter(Boolean).join(" ")}
            </p>
          )}
          <div className="mt-2 flex items-center gap-3">
            {currentMembership && (
              <Link href={`/teams/${currentMembership.team.slug}`} className="inline-flex items-center gap-2 hover:underline">
                <TeamAvatar name={currentMembership.team.name} logoUrl={currentMembership.team.logoUrl} color={currentMembership.team.primaryColor} size={20} />
                <span className="text-sm">{currentMembership.team.name}</span>
              </Link>
            )}
            <SocialLinks socials={socials} />
          </div>
        </div>

        {/* Öz profilin elə public profildir; redaktə onun yanındadır. Kimin
            baxdığı client tərəfdə müəyyən edilir ki, səhifə keşlənə bilsin —
            bax components/layout/OwnerEditLink.tsx. */}
        <OwnerEditLink
          href="/player/edit"
          label={locale === "az" ? "Redaktə et" : "Edit"}
          match={{ kind: "player", slug: player.slug }}
          className="rounded-md border border-border-subtle px-4 py-2 text-sm text-foreground-muted transition-colors hover:border-brand-via/50 hover:text-foreground"
        />

        <div className="flex gap-6">
          {careerRating != null && (
            <div className="text-center">
              <div className="font-display text-3xl font-bold text-brand-via">{careerRating.toFixed(2)}</div>
              <div className="text-xs text-foreground-muted">{locale === "az" ? "karyera reytinqi" : "career rating"}</div>
            </div>
          )}
          {last3MonthsRating != null && (
            <div className="text-center">
              <div className="font-display text-3xl font-bold text-foreground">{last3MonthsRating.toFixed(2)}</div>
              <div className="text-xs text-foreground-muted">{locale === "az" ? "son 3 ay" : "last 3 months"}</div>
            </div>
          )}
        </div>
      </div>

      {achievements.length > 0 && (
        <>
          <h2 className="font-display mb-2 text-lg font-bold">{locale === "az" ? "Nailiyyətlər" : "Achievements"}</h2>
          <div className="mb-6 space-y-1">
            {achievements.map((a) => (
              <Link
                key={a.id}
                href={`/events/${a.tournament.slug}`}
                className="flex items-center justify-between rounded-lg border border-border-subtle bg-surface px-3 py-2 text-sm hover:bg-surface-raised"
              >
                <span>
                  {a.tournament.name} <span className="text-foreground-muted">· {a.team.name}</span>
                </span>
                <span className="font-display font-semibold text-brand-via">#{a.placement}</span>
              </Link>
            ))}
          </div>
        </>
      )}

      <h2 className="font-display mb-2 text-lg font-bold">{t("nav.stats")}</h2>
      {recentStats.length > 0 ? (
        <div className="overflow-hidden rounded-lg border border-border-subtle bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-foreground-muted">
                <th className="px-3 py-2 font-normal">{t("nav.matches")}</th>
                <th className="px-2 py-2 text-right font-normal">K</th>
                <th className="px-2 py-2 text-right font-normal">D</th>
                <th className="px-2 py-2 text-right font-normal">A</th>
                <th className="px-3 py-2 text-right font-normal">Rating</th>
              </tr>
            </thead>
            <tbody>
              {recentStats.map((s) => (
                <tr key={s.id} className="border-t border-border-subtle">
                  <td className="px-3 py-2">
                    <Link href={`/matches/${s.match.slug}`} className="hover:underline">
                      {s.match.teamA.name} vs {s.match.teamB.name}
                    </Link>
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">{s.kills}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{s.deaths}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{s.assists}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-semibold">{s.rating?.toFixed(2) ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-foreground-muted">
          {locale === "az"
            ? "Bu oyunçu üçün hələ matç statistikası qeydə alınmayıb — uydurma rəqəm yazılmır."
            : "No match statistics recorded for this player yet — no placeholder numbers are shown."}
        </p>
      )}
    </PageShell>
  );
}
