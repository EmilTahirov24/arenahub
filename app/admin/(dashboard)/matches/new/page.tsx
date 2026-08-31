import { prisma } from "@/lib/prisma";
import MatchForm from "@/components/admin/MatchForm";
import { createMatch } from "../actions";

export default async function NewMatchPage({
  searchParams,
}: {
  searchParams: Promise<{ tournamentId?: string }>;
}) {
  // Turnir səhifəsindəki «matç əlavə et» buradan gəlir. Oyun və turnir
  // öncədən dolur — yoxsa admin eyni iki seçimi hər matç üçün təkrarlayır.
  const { tournamentId } = await searchParams;

  const [games, teams, tournaments, defaultTournament] = await Promise.all([
    prisma.game.findMany({ orderBy: { name: "asc" } }),
    prisma.team.findMany({ orderBy: { name: "asc" } }),
    prisma.tournament.findMany({ orderBy: { name: "asc" } }),
    tournamentId ? prisma.tournament.findUnique({ where: { id: tournamentId } }) : null,
  ]);

  return (
    <div>
      <h1 className="font-display mb-6 text-2xl font-bold">
        {defaultTournament ? `Yeni matç — ${defaultTournament.name}` : "Yeni matç"}
      </h1>
      <MatchForm
        games={games}
        teams={teams}
        tournaments={tournaments}
        defaultTournament={defaultTournament ?? undefined}
        action={createMatch}
      />
    </div>
  );
}
