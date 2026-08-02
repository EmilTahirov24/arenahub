import { prisma } from "@/lib/prisma";
import PlayerForm from "@/components/admin/PlayerForm";
import { createPlayer } from "../actions";

export default async function NewPlayerPage({
  searchParams,
}: {
  searchParams: Promise<{ teamId?: string }>;
}) {
  const { teamId } = await searchParams;
  const [teams, games] = await Promise.all([
    prisma.team.findMany({ orderBy: { name: "asc" } }),
    prisma.game.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div>
      <h1 className="font-display mb-6 text-2xl font-bold">Yeni oyunçu</h1>
      <PlayerForm teams={teams} games={games} currentTeamId={teamId} action={createPlayer} />
    </div>
  );
}
