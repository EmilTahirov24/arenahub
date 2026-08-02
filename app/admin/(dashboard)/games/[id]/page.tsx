import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import GameForm from "@/components/admin/GameForm";
import { updateGame, deleteGame } from "../actions";
import { dangerButtonClass } from "@/components/admin/formStyles";

export default async function EditGamePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const game = await prisma.game.findUnique({ where: { id } });
  if (!game) notFound();

  const updateWithId = updateGame.bind(null, id);
  const deleteWithId = deleteGame.bind(null, id);

  return (
    <div>
      <h1 className="font-display mb-6 text-2xl font-bold">{game.name}</h1>
      <GameForm game={game} action={updateWithId} />
      <form action={deleteWithId} className="mt-6">
        <button type="submit" className={dangerButtonClass}>
          Oyunu sil
        </button>
      </form>
    </div>
  );
}
