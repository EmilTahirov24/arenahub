import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getPlayerSession } from "@/lib/auth";
import { parseSocials } from "@/lib/socials";
import CountryFlag from "@/components/common/CountryFlag";
import PlayerAvatar from "@/components/common/PlayerAvatar";
import TeamAvatar from "@/components/common/TeamAvatar";
import GameChip from "@/components/common/GameChip";
import SocialLinks from "@/components/players/SocialLinks";
import PendingInvites from "@/components/team/PendingInvites";
import { primaryButtonClass, secondaryButtonClass } from "@/components/admin/formStyles";

/**
 * Your own profile, shown the way a visitor sees it.
 *
 * This page used to open straight into the edit form, so the one place you go
 * to look at yourself was the one place that never showed you. The card below
 * mirrors the public profile header (app/[locale]/players/[playerSlug]) and
 * editing is a button beside it rather than the page itself.
 */
export default async function PlayerHomePage() {
  const session = await getPlayerSession();
  if (!session) redirect("/player/login");
  const player = await prisma.player.findUnique({ where: { id: session.id }, include: { game: true } });
  if (!player) redirect("/player/login");
  const socials = parseSocials(player.socials);

  const [aheadCount, membership, predictions] = await Promise.all([
    prisma.player.count({ where: { points: { gt: player.points } } }),
    prisma.teamMembership.findFirst({
      where: { playerId: player.id, leftAt: null },
      include: { team: true },
    }),
    prisma.matchPrediction.findMany({
      where: { playerId: player.id },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { predictedWinner: true, match: { include: { teamA: true, teamB: true } } },
    }),
  ]);
  const rank = aheadCount + 1;

  return (
    <div>
      <PendingInvites playerId={player.id} />

      <div className="mb-6 flex flex-wrap items-center gap-4 rounded-xl border border-border-subtle bg-surface p-6">
        <PlayerAvatar
          name={player.nickname}
          photoUrl={player.photoUrl}
          color={membership?.team.primaryColor}
          size={72}
        />
        <div className="min-w-48 flex-1">
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
          <div className="mt-2 flex flex-wrap items-center gap-3">
            {membership && (
              <Link
                href={`/az/teams/${membership.team.slug}`}
                className="inline-flex items-center gap-2 hover:underline"
              >
                <TeamAvatar
                  name={membership.team.name}
                  logoUrl={membership.team.logoUrl}
                  color={membership.team.primaryColor}
                  size={20}
                />
                <span className="text-sm">{membership.team.name}</span>
              </Link>
            )}
            <SocialLinks socials={socials} />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Link href="/player/edit" className={`${primaryButtonClass} text-center`}>
            Redaktə et
          </Link>
          {/* The real page, not this rendering of it — the only way to be sure
              what strangers actually see. */}
          <Link href={`/az/players/${player.slug}`} className={`${secondaryButtonClass} text-center`}>
            Açıq səhifəm →
          </Link>
        </div>
      </div>

      <h2 className="font-display mb-3 mt-10 text-lg font-bold">Proqnozlarım</h2>
      <div className="mb-6 grid max-w-lg grid-cols-2 gap-3">
        <div className="rounded-lg border border-border-subtle bg-surface p-4 text-center">
          <div className="font-display text-3xl font-bold text-brand-via-fg">{player.points}</div>
          <div className="text-xs text-foreground-muted">Xal</div>
        </div>
        <div className="rounded-lg border border-border-subtle bg-surface p-4 text-center">
          <div className="font-display text-3xl font-bold text-brand-via-fg">#{rank}</div>
          <div className="text-xs text-foreground-muted">Sıralama (oyunçular arası)</div>
        </div>
      </div>

      <p className="mb-6 max-w-lg text-sm">
        <Link href="/az/predictions" className="text-brand-via-fg hover:underline">
          Bütün lider cədvəlinə bax →
        </Link>
      </p>

      {predictions.length === 0 ? (
        <p className="max-w-lg text-sm text-foreground-muted">Hələ heç bir proqnoz verməmisiniz.</p>
      ) : (
        <div className="max-w-lg space-y-2">
          {predictions.map((p) => {
            const isFinished = p.match.status === "FINISHED";
            const isCorrect = isFinished && p.match.winnerId === p.predictedWinnerId;
            return (
              <div
                key={p.id}
                className="flex items-center justify-between rounded-lg border border-border-subtle bg-surface px-4 py-3"
              >
                <div className="text-sm">
                  {p.match.teamA.name} <span className="text-foreground-muted">vs</span> {p.match.teamB.name}
                  <div className="mt-0.5 flex items-center gap-1.5 text-xs text-foreground-muted">
                    Seçim: <CountryFlag code={p.predictedWinner.country} size={12} />
                    {p.predictedWinner.name}
                  </div>
                </div>
                {isFinished ? (
                  <span className={`text-xs font-bold ${isCorrect ? "text-positive" : "text-live"}`}>
                    {isCorrect ? "Düz ✓" : "Səhv ✗"}
                  </span>
                ) : (
                  <span className="text-xs text-foreground-muted">Gözlənilir</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
