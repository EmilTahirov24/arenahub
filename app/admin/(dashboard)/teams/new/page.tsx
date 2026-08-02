import { prisma } from "@/lib/prisma";
import TeamForm from "@/components/admin/TeamForm";
import { createTeam } from "../actions";

export default async function NewTeamPage() {
  const games = await prisma.game.findMany({ orderBy: { name: "asc" } });
  return (
    <div>
      <h1 className="font-display mb-6 text-2xl font-bold">Yeni komanda</h1>
      <TeamForm games={games} action={createTeam} />
    </div>
  );
}
