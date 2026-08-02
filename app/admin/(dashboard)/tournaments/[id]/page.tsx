import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import TournamentForm from "@/components/admin/TournamentForm";
import { updateTournament, deleteTournament, addParticipant, removeParticipant } from "../actions";
import { dangerButtonClass, inputClass, labelClass, secondaryButtonClass } from "@/components/admin/formStyles";

export default async function EditTournamentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [tournament, games] = await Promise.all([
    prisma.tournament.findUnique({ where: { id } }),
    prisma.game.findMany({ orderBy: { name: "asc" } }),
  ]);
  if (!tournament) notFound();

  const participants = await prisma.tournamentParticipant.findMany({
    where: { tournamentId: id },
    include: { team: true },
    orderBy: { seed: "asc" },
  });

  const participantTeamIds = participants.map((p) => p.teamId);
  const availableTeams = await prisma.team.findMany({
    where: { gameId: tournament.gameId, id: { notIn: participantTeamIds } },
    orderBy: { name: "asc" },
  });

  const updateWithId = updateTournament.bind(null, id);
  const deleteWithId = deleteTournament.bind(null, id);
  const addParticipantWithId = addParticipant.bind(null, id);
  const removeParticipantWithId = removeParticipant.bind(null, id);

  return (
    <div>
      <h1 className="font-display mb-6 text-2xl font-bold">{tournament.name}</h1>
      <TournamentForm tournament={tournament} games={games} action={updateWithId} />

      <div className="mt-10 max-w-lg">
        <h2 className="font-display mb-3 text-lg font-bold">Qatılanlar</h2>
        <div className="space-y-2">
          {participants.map((p) => (
            <div key={p.id} className="flex items-center justify-between rounded-lg border border-border-subtle bg-surface px-3 py-2">
              <span className="text-sm">
                {p.team.name} {p.seed != null && <span className="text-foreground-muted">· seed {p.seed}</span>}
              </span>
              <form action={removeParticipantWithId.bind(null, p.id)}>
                <button type="submit" className="text-xs text-live hover:underline">
                  çıxar
                </button>
              </form>
            </div>
          ))}
          {participants.length === 0 && <p className="text-sm text-foreground-muted">Qatılan komanda yoxdur.</p>}
        </div>

        <form action={addParticipantWithId} className="mt-4 flex items-end gap-2">
          <div className="flex-1">
            <label className={labelClass}>Komanda</label>
            <select name="teamId" required className={inputClass}>
              <option value="">Seçin</option>
              {availableTeams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div className="w-24">
            <label className={labelClass}>Seed</label>
            <input name="seed" type="number" className={inputClass} />
          </div>
          <button type="submit" className={secondaryButtonClass}>
            Əlavə et
          </button>
        </form>
      </div>

      <form action={deleteWithId} className="mt-8">
        <button type="submit" className={dangerButtonClass}>
          Turniri sil
        </button>
      </form>
    </div>
  );
}
