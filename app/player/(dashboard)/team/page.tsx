import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getPlayerSession } from "@/lib/auth";
import ImageUpload from "@/components/forms/ImageUpload";
import CountrySelect from "@/components/forms/CountrySelect";
import TeamAvatar from "@/components/common/TeamAvatar";
import CountryFlag from "@/components/common/CountryFlag";
import { inputClass, labelClass, primaryButtonClass, dangerButtonClass } from "@/components/admin/formStyles";
import { leaveTeam } from "../invites/actions";
import { createTeam, updateOwnTeam } from "./actions";

export const dynamic = "force-dynamic";

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
            <label className={labelClass}>Komanda adı</label>
            <input name="name" required className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Oyun</label>
            <select name="gameId" required defaultValue="" className={inputClass}>
              <option value="">Seçin</option>
              {games.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Ölkə</label>
            <CountrySelect className={inputClass} />
          </div>
          <button type="submit" className={primaryButtonClass}>
            Komanda yarat
          </button>
        </form>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold">Komandam</h1>
        <Link href="/player/team/roster" className="text-sm text-brand-via hover:underline">
          Tərkibə bax →
        </Link>
      </div>

      <form action={updateOwnTeam} className="max-w-lg space-y-4">
        <div>
          <label className={labelClass}>Ad</label>
          <input name="name" required defaultValue={team.name} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Ölkə</label>
          <CountrySelect defaultValue={team.country} className={inputClass} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Əsas rəng</label>
            <input name="primaryColor" type="color" defaultValue={team.primaryColor ?? "#7c3aed"} className="h-10 w-full rounded-md border border-border-subtle bg-background" />
          </div>
          <div>
            <label className={labelClass}>İkinci rəng</label>
            <input name="secondaryColor" type="color" defaultValue={team.secondaryColor ?? "#0a0b10"} className="h-10 w-full rounded-md border border-border-subtle bg-background" />
          </div>
        </div>
        <ImageUpload name="logoUrl" label="Loqo" defaultValue={team.logoUrl} />
        <div>
          <label className={labelClass}>Təsvir</label>
          <textarea name="description" defaultValue={team.description ?? ""} rows={4} className={inputClass} />
        </div>
        <button type="submit" className={primaryButtonClass}>
          Yadda saxla
        </button>
      </form>
    </div>
  );
}
