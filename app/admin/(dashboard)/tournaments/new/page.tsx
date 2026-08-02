import { prisma } from "@/lib/prisma";
import TournamentForm from "@/components/admin/TournamentForm";
import { createTournament } from "../actions";

export default async function NewTournamentPage() {
  const games = await prisma.game.findMany({ orderBy: { name: "asc" } });
  return (
    <div>
      <h1 className="font-display mb-6 text-2xl font-bold">Yeni turnir</h1>
      <TournamentForm games={games} action={createTournament} />
    </div>
  );
}
