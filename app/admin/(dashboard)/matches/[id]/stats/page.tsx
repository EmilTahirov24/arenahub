import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { inputClass, primaryButtonClass } from "@/components/admin/formStyles";
import AdminRowForm from "@/components/admin/AdminRowForm";
import { upsertPlayerStat } from "./actions";

export default async function MatchStatsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const match = await prisma.match.findUnique({
    where: { id },
    include: { teamA: true, teamB: true },
  });
  if (!match) notFound();

  const [rosterA, rosterB, existingStats] = await Promise.all([
    prisma.teamMembership.findMany({ where: { teamId: match.teamAId, leftAt: null }, include: { player: true } }),
    prisma.teamMembership.findMany({ where: { teamId: match.teamBId, leftAt: null }, include: { player: true } }),
    prisma.playerMatchStat.findMany({ where: { matchId: match.id, mapId: null } }),
  ]);
  const statByPlayer = new Map(existingStats.map((s) => [s.playerId, s]));

  const save = upsertPlayerStat.bind(null, match.id);

  return (
    <div className="max-w-2xl">
      <h1 className="font-display mb-1 text-2xl font-bold">
        {match.teamA.name} vs {match.teamB.name}
      </h1>
      <p className="mb-6 text-sm text-foreground-muted">Matç-səviyyəli (aqreqat) oyunçu statistikası</p>

      {[
        { team: match.teamA, roster: rosterA },
        { team: match.teamB, roster: rosterB },
      ].map(({ team, roster }) => (
        <div key={team.id} className="mb-6">
          <h2 className="font-display mb-2 text-lg font-bold">{team.name}</h2>
          <div className="space-y-2">
            {roster.map((m) => {
              const stat = statByPlayer.get(m.playerId);
              return (
                <AdminRowForm
                  key={m.playerId}
                  action={save}
                  submitLabel="Saxla"
                  submitClassName={primaryButtonClass}
                  className="flex flex-wrap items-center gap-2 rounded-lg border border-border-subtle bg-surface p-2"
                >
                  <input type="hidden" name="playerId" value={m.playerId} />
                  <input type="hidden" name="teamId" value={team.id} />
                  <span className="w-32 shrink-0 text-sm">{m.player.nickname}</span>
                  <input name="kills" type="number" placeholder="K" defaultValue={stat?.kills ?? 0} className={`${inputClass} w-16`} />
                  <input name="deaths" type="number" placeholder="D" defaultValue={stat?.deaths ?? 0} className={`${inputClass} w-16`} />
                  <input name="assists" type="number" placeholder="A" defaultValue={stat?.assists ?? 0} className={`${inputClass} w-16`} />
                  <input
                    name="rating"
                    type="number"
                    step="0.01"
                    placeholder="Rating"
                    defaultValue={stat?.rating ?? ""}
                    className={`${inputClass} w-20`}
                  />
                </AdminRowForm>
              );
            })}
            {roster.length === 0 && <p className="text-sm text-foreground-muted">Tərkib boşdur.</p>}
          </div>
        </div>
      ))}
    </div>
  );
}
