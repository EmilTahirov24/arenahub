import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import TournamentForm from "@/components/admin/TournamentForm";
import { updateTournament, deleteTournament, addParticipant, removeParticipant, setParticipantPlacement, addPrize, removePrize } from "../actions";
import { placeRangeLabel, formatMoney } from "@/lib/prizes";
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

  const prizes = await prisma.tournamentPrize.findMany({
    where: { tournamentId: id },
    orderBy: { placeFrom: "asc" },
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
  const setPlacementWithId = setParticipantPlacement.bind(null, id);
  const addPrizeWithId = addPrize.bind(null, id);
  const removePrizeWithId = removePrize.bind(null, id);

  return (
    <div>
      <h1 className="font-display mb-6 text-2xl font-bold">{tournament.name}</h1>
      <TournamentForm tournament={tournament} games={games} action={updateWithId} />

      <div className="mt-10 max-w-lg">
        <h2 className="font-display mb-3 text-lg font-bold">Qatılanlar</h2>
        <div className="space-y-2">
          {participants.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-border-subtle bg-surface px-3 py-2">
              <span className="flex-1 truncate text-sm">
                {p.team.name} {p.seed != null && <span className="text-foreground-muted">· seed {p.seed}</span>}
              </span>
              {/* Placement drives the prize each team is shown, via the breakdown below. */}
              <form action={setPlacementWithId.bind(null, p.id)} className="flex items-center gap-1">
                <input
                  name="placement"
                  type="number"
                  min="1"
                  placeholder="yer"
                  defaultValue={p.placement ?? ""}
                  className="w-20 rounded-md border border-border-subtle bg-background px-2 py-1 text-sm"
                />
                <button type="submit" className="text-xs text-brand-via hover:underline">
                  yaz
                </button>
              </form>
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

      <div className="mt-10 max-w-lg">
        <h2 className="font-display mb-1 text-lg font-bold">Mükafat bölgüsü</h2>
        <p className="mb-3 text-xs text-foreground-muted">
          Məbləğ yer aralığına yazılır — məsələn 5-dən 8-ə qədər $60 000. Komandanın mükafatı öz yerindən
          avtomatik çıxır, ayrıca yazılmır.
        </p>
        <div className="space-y-2">
          {prizes.map((prize) => (
            <div key={prize.id} className="flex items-center justify-between rounded-lg border border-border-subtle bg-surface px-3 py-2">
              <span className="text-sm">
                {placeRangeLabel(prize, "az")}
                {prize.label && <span className="text-foreground-muted"> · {prize.label}</span>}
              </span>
              <span className="flex items-center gap-3">
                <span className="text-sm tabular-nums text-emerald-400">{formatMoney(prize.amount)}</span>
                <form action={removePrizeWithId.bind(null, prize.id)}>
                  <button type="submit" className="text-xs text-live hover:underline">
                    sil
                  </button>
                </form>
              </span>
            </div>
          ))}
          {prizes.length === 0 && <p className="text-sm text-foreground-muted">Bölgü yazılmayıb.</p>}
        </div>

        <form action={addPrizeWithId} className="mt-4 flex flex-wrap items-end gap-2">
          <div className="w-20">
            <label className={labelClass}>Yerdən</label>
            <input name="placeFrom" type="number" min="1" required className={inputClass} />
          </div>
          <div className="w-20">
            <label className={labelClass}>Yerə</label>
            <input name="placeTo" type="number" min="1" required className={inputClass} />
          </div>
          <div className="w-32">
            <label className={labelClass}>Məbləğ ($)</label>
            <input name="amount" type="number" min="0" required className={inputClass} />
          </div>
          <div className="w-28">
            <label className={labelClass}>Qeyd</label>
            <input name="label" placeholder="Winner" className={inputClass} />
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
