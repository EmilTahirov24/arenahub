import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import PlayerForm from "@/components/admin/PlayerForm";
import { updatePlayer, deletePlayer } from "../actions";
import { dangerButtonClass } from "@/components/admin/formStyles";

export default async function EditPlayerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [player, teams, games, membership] = await Promise.all([
    prisma.player.findUnique({ where: { id } }),
    prisma.team.findMany({ orderBy: { name: "asc" } }),
    prisma.game.findMany({ orderBy: { name: "asc" } }),
    prisma.teamMembership.findFirst({ where: { playerId: id, leftAt: null } }),
  ]);
  if (!player) notFound();

  const updateWithId = updatePlayer.bind(null, id);
  const deleteWithId = deletePlayer.bind(null, id);

  return (
    <div>
      <h1 className="font-display mb-6 text-2xl font-bold">{player.nickname}</h1>
      <PlayerForm player={player} teams={teams} games={games} currentTeamId={membership?.teamId} action={updateWithId} />
      <form action={deleteWithId} className="mt-8">
        <button type="submit" className={dangerButtonClass}>
          Oyunçunu sil
        </button>
      </form>
    </div>
  );
}
