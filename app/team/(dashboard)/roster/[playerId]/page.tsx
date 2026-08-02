import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getTeamSession } from "@/lib/auth";
import OwnPlayerForm from "@/components/team/OwnPlayerForm";
import { updateOwnPlayer, removeOwnPlayer } from "../actions";
import { dangerButtonClass } from "@/components/admin/formStyles";

export default async function EditOwnPlayerPage({ params }: { params: Promise<{ playerId: string }> }) {
  const { playerId } = await params;
  const session = await getTeamSession();
  if (!session) redirect("/team/login");

  const membership = await prisma.teamMembership.findFirst({
    where: { teamId: session.id, playerId, leftAt: null },
    include: { player: true },
  });
  if (!membership) notFound();

  const updateWithId = updateOwnPlayer.bind(null, playerId);
  const removeWithId = removeOwnPlayer.bind(null, playerId);

  return (
    <div>
      <h1 className="font-display mb-6 text-2xl font-bold">{membership.player.nickname}</h1>
      <OwnPlayerForm player={membership.player} action={updateWithId} />
      <form action={removeWithId} className="mt-8">
        <button type="submit" className={dangerButtonClass}>
          Tərkibdən çıxar
        </button>
      </form>
    </div>
  );
}
