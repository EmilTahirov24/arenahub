import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getPlayerSession } from "@/lib/auth";
import OwnPlayerForm from "@/components/team/OwnPlayerForm";
import MembershipFields from "@/components/team/MembershipFields";
import CountryFlag from "@/components/common/CountryFlag";
import PlayerAvatar from "@/components/common/PlayerAvatar";
import { updateShellPlayer, updateMembership, removeOwnPlayer } from "../actions";
import { dangerButtonClass, primaryButtonClass } from "@/components/admin/formStyles";

export default async function EditOwnPlayerPage({ params }: { params: Promise<{ playerId: string }> }) {
  const { playerId } = await params;
  const session = await getPlayerSession();
  if (!session) redirect("/player/login");

  const team = await prisma.team.findFirst({ where: { ownerId: session.id } });
  if (!team) redirect("/player/team");

  const membership = await prisma.teamMembership.findFirst({
    where: { teamId: team.id, playerId, leftAt: null },
    include: { player: true },
  });
  if (!membership) notFound();

  const { player } = membership;
  const isSelf = playerId === session.id;

  return (
    <div>
      <h1 className="font-display mb-6 text-2xl font-bold">{player.nickname}</h1>

      {player.isClaimed ? (
        <div className="max-w-lg space-y-4">
          <div className="flex items-center gap-3 rounded-lg border border-border-subtle bg-surface p-4">
            <PlayerAvatar name={player.nickname} photoUrl={player.photoUrl} size={44} />
            <div>
              <div className="flex items-center gap-1.5 font-medium">
                <CountryFlag code={player.country} />
                {player.nickname}
              </div>
              <p className="text-xs text-foreground-muted">
                {isSelf
                  ? "Bu sizin profilinizdir — Profil səhifəsindən redaktə edin."
                  : "Bu oyunçunun öz hesabı var, profilini yalnız o dəyişə bilər. Siz yalnız komandadakı yerini idarə edirsiniz."}
              </p>
            </div>
          </div>

          <form action={updateMembership.bind(null, playerId)} className="space-y-4">
            <MembershipFields membership={membership} />
            <button type="submit" className={primaryButtonClass}>
              Yadda saxla
            </button>
          </form>
        </div>
      ) : (
        <OwnPlayerForm player={player} membership={membership} action={updateShellPlayer.bind(null, playerId)} />
      )}

      {!isSelf && (
        <form action={removeOwnPlayer.bind(null, playerId)} className="mt-8">
          <button type="submit" className={dangerButtonClass}>
            Tərkibdən çıxar
          </button>
        </form>
      )}
    </div>
  );
}
