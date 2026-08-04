import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getPlayerSession } from "@/lib/auth";
import { primaryButtonClass } from "@/components/admin/formStyles";
import CountryFlag from "@/components/common/CountryFlag";
import { removeOwnPlayer, cancelTeamInvite } from "./actions";

export const dynamic = "force-dynamic";

export default async function PlayerTeamRosterPage() {
  const session = await getPlayerSession();
  if (!session) redirect("/player/login");

  const team = await prisma.team.findFirst({ where: { ownerId: session.id } });
  if (!team) redirect("/player/team");

  const [roster, invites] = await Promise.all([
    prisma.teamMembership.findMany({
      where: { teamId: team.id, leftAt: null },
      include: { player: true },
      orderBy: { joinedAt: "asc" },
    }),
    prisma.teamInvite.findMany({
      where: { teamId: team.id, status: "PENDING", expiresAt: { gt: new Date() } },
      include: { player: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold">Tərkib — {team.name}</h1>
        <Link href="/player/team/roster/new" className={primaryButtonClass}>
          + Oyunçu əlavə et
        </Link>
      </div>

      <div className="space-y-2">
        {roster.map((m) => (
          <div
            key={m.id}
            className="flex items-center justify-between gap-3 rounded-lg border border-border-subtle bg-surface px-4 py-3"
          >
            <Link href={`/player/team/roster/${m.player.id}`} className="flex items-center gap-1.5 hover:underline">
              <CountryFlag code={m.player.country} />
              {m.player.nickname}
              {m.player.role && <span className="text-xs text-foreground-muted">· {m.player.role}</span>}
              {m.isCoach && <span className="text-xs text-foreground-muted">· məşqçi</span>}
              {m.isStandin && <span className="text-xs text-foreground-muted">· stand-in</span>}
              {m.player.isClaimed ? (
                <span
                  title="Bu oyunçunun öz hesabı var — profilini yalnız o redaktə edə bilər"
                  className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-positive"
                >
                  hesab ✓
                </span>
              ) : (
                <span className="rounded-full border border-border-subtle px-2 py-0.5 text-[10px] text-foreground-muted">
                  hesabsız
                </span>
              )}
            </Link>
            {m.playerId === session.id ? (
              <span className="text-xs text-foreground-muted">sahib</span>
            ) : (
              <form action={removeOwnPlayer.bind(null, m.player.id)}>
                <button type="submit" className="text-xs text-live hover:underline">
                  tərkibdən çıxar
                </button>
              </form>
            )}
          </div>
        ))}
        {roster.length === 0 && <p className="text-sm text-foreground-muted">Tərkib boşdur.</p>}
      </div>

      {invites.length > 0 && (
        <>
          <h2 className="font-display mb-3 mt-8 text-lg font-bold">Gözləyən dəvətlər</h2>
          <div className="space-y-2">
            {invites.map((invite) => (
              <div
                key={invite.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-border-subtle bg-surface px-4 py-3"
              >
                <span className="flex items-center gap-1.5 text-sm">
                  <CountryFlag code={invite.player.country} />
                  {invite.player.nickname}
                  <span className="text-xs text-foreground-muted">· cavab gözlənilir</span>
                </span>
                <form action={cancelTeamInvite.bind(null, invite.id)}>
                  <button type="submit" className="text-xs text-foreground-muted hover:underline">
                    ləğv et
                  </button>
                </form>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
