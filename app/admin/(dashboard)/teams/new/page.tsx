import { prisma } from "@/lib/prisma";
import TeamForm from "@/components/admin/TeamForm";
import { createTeam, loadTeamOwnerOptions } from "../actions";

export default async function NewTeamPage() {
  const [games, owners] = await Promise.all([
    prisma.game.findMany({ orderBy: { name: "asc" } }),
    loadTeamOwnerOptions(),
  ]);
  return (
    <div>
      <h1 className="font-display mb-6 text-2xl font-bold">Yeni komanda</h1>
      <TeamForm games={games} owners={owners} action={createTeam} />
    </div>
  );
}
