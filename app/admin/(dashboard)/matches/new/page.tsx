import { prisma } from "@/lib/prisma";
import MatchForm from "@/components/admin/MatchForm";
import { createMatch } from "../actions";

export default async function NewMatchPage() {
  const [games, teams, tournaments] = await Promise.all([
    prisma.game.findMany({ orderBy: { name: "asc" } }),
    prisma.team.findMany({ orderBy: { name: "asc" } }),
    prisma.tournament.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div>
      <h1 className="font-display mb-6 text-2xl font-bold">Yeni matç</h1>
      <MatchForm games={games} teams={teams} tournaments={tournaments} action={createMatch} />
    </div>
  );
}
