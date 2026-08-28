import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getPlayerSession } from "@/lib/auth";
import CountrySelect from "@/components/forms/CountrySelect";
import TeamAvatar from "@/components/common/TeamAvatar";
import CountryFlag from "@/components/common/CountryFlag";
import {
  inputClass,
  labelClass,
  primaryButtonClass,
  secondaryButtonClass,
  dangerButtonClass,
} from "@/components/admin/formStyles";
import { leaveTeam } from "../invites/actions";
import { createTeam } from "./actions";

export default async function PlayerTeamPage() {
  const session = await getPlayerSession();
  if (!session) redirect("/player/login");

  const team = await prisma.team.findFirst({ where: { ownerId: session.id } });

  if (!team) {
    // Owning a team and merely playing for one are different things — before the
    // invite flow existed this page only checked ownership, so a rostered player
    // was told they had no team and nudged into founding a second one.
    const membership = await prisma.teamMembership.findFirst({
      where: { playerId: session.id, leftAt: null },
      include: { team: { include: { game: true, memberships: { where: { leftAt: null }, include: { player: true } } } } },
    });

    if (membership) {
      const myTeam = membership.team;
      return (
        <div className="max-w-lg">
          <h1 className="font-display mb-6 text-2xl font-bold">Komandam</h1>

          <div className="mb-6 flex items-center gap-3 rounded-lg border border-border-subtle bg-surface p-4">
            <TeamAvatar name={myTeam.name} logoUrl={myTeam.logoUrl} color={myTeam.primaryColor} size={48} />
            <div>
              <div className="flex items-center gap-1.5 font-display text-lg font-bold">
                <CountryFlag code={myTeam.country} />
                {myTeam.name}
              </div>
              <p className="text-xs text-foreground-muted">{myTeam.game.name}</p>
            </div>
          </div>

          <h2 className="font-display mb-2 text-sm font-bold uppercase tracking-wide text-foreground-muted">Tərkib</h2>
          <div className="mb-6 space-y-2">
            {myTeam.memberships.map((m) => (
              <div
                key={m.id}
                className="flex items-center gap-1.5 rounded-lg border border-border-subtle bg-surface px-4 py-2 text-sm"
              >
                <CountryFlag code={m.player.country} />
                {m.player.nickname}
                {m.playerId === session.id && <span className="text-xs text-brand-via">· siz</span>}
                {m.isCoach && <span className="text-xs text-foreground-muted">· məşqçi</span>}
                {m.isStandin && <span className="text-xs text-foreground-muted">· stand-in</span>}
              </div>
            ))}
          </div>

          <Link href={`/az/teams/${myTeam.slug}`} className="text-sm text-brand-via hover:underline">
            Komandanın public səhifəsi →
          </Link>

          <form action={leaveTeam} className="mt-8">
            <button type="submit" className={dangerButtonClass}>
              Komandadan ayrıl
            </button>
          </form>
        </div>
      );
    }

    const games = await prisma.game.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });
    return (
      <div>
        <h1 className="font-display mb-1 text-2xl font-bold">Komanda qur</h1>
        <p className="mb-6 text-sm text-foreground-muted">Hələ heç bir komandanız yoxdur — öz komandanızı burada yarada bilərsiniz.</p>

        <form action={createTeam} className="max-w-lg space-y-4">
          <div>
            <label htmlFor="dashboard-team-name" className={labelClass}>Komanda adı</label>
            <input id="dashboard-team-name" name="name" required className={inputClass} />
          </div>
          <div>
            <label htmlFor="dashboard-team-gameId" className={labelClass}>Oyun</label>
            <select id="dashboard-team-gameId" name="gameId" required defaultValue="" className={inputClass}>
              <option value="">Seçin</option>
              {games.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="dashboard-team-country" className={labelClass}>Ölkə</label>
            <CountrySelect id="dashboard-team-country" className={inputClass} />
          </div>
          <button type="submit" className={primaryButtonClass}>
            Komanda yarat
          </button>
        </form>
      </div>
    );
  }

  // The owner used to land straight in the settings form — the one member of the
  // team who could never simply look at it. Same card as the member view above,
  // with the editing behind a button.
  const ownedGame = await prisma.game.findUnique({ where: { id: team.gameId }, select: { name: true } });
  const roster = await prisma.teamMembership.findMany({
    where: { teamId: team.id, leftAt: null },
    include: { player: true },
  });

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-4 rounded-xl border border-border-subtle bg-surface p-6">
        <TeamAvatar name={team.name} logoUrl={team.logoUrl} color={team.primaryColor} size={64} />
        <div className="min-w-48 flex-1">
          <h1 className="flex items-center gap-2 font-display text-2xl font-bold">
            <CountryFlag code={team.country} size={18} />
            {team.name}
          </h1>
          <p className="text-xs text-foreground-muted">{ownedGame?.name}</p>
          {team.description && (
            <p className="mt-2 max-w-prose text-sm text-foreground-muted">{team.description}</p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Link href="/player/team/edit" className={`${primaryButtonClass} text-center`}>
            Redaktə et
          </Link>
          <Link href={`/az/teams/${team.slug}`} className={`${secondaryButtonClass} text-center`}>
            Açıq səhifə →
          </Link>
        </div>
      </div>

      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-display text-sm font-bold uppercase tracking-wide text-foreground-muted">Tərkib</h2>
        <Link href="/player/team/roster" className="text-sm text-brand-via hover:underline">
          Tərkibi idarə et →
        </Link>
      </div>
      <div className="mb-6 max-w-lg space-y-2">
        {roster.length === 0 ? (
          <p className="text-sm text-foreground-muted">Tərkibdə hələ heç kim yoxdur.</p>
        ) : (
          roster.map((m) => (
            <div
              key={m.id}
              className="flex items-center gap-1.5 rounded-lg border border-border-subtle bg-surface px-4 py-2 text-sm"
            >
              <CountryFlag code={m.player.country} />
              {m.player.nickname}
              {m.playerId === session.id && <span className="text-xs text-brand-via">· siz</span>}
              {m.isCoach && <span className="text-xs text-foreground-muted">· məşqçi</span>}
              {m.isStandin && <span className="text-xs text-foreground-muted">· stand-in</span>}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
