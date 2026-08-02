import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { inputClass, labelClass, primaryButtonClass, secondaryButtonClass, dangerButtonClass } from "@/components/admin/formStyles";
import { setMatchStatus, upsertMap, deleteMap, addVetoStep, deleteVetoStep } from "./actions";

export const dynamic = "force-dynamic";

const STATUS_ACTIONS: { status: string; label: string }[] = [
  { status: "LIVE", label: "Canlı et" },
  { status: "FINISHED", label: "Bitir" },
  { status: "POSTPONED", label: "Təxirə sal" },
  { status: "CANCELLED", label: "Ləğv et" },
  { status: "UPCOMING", label: "Qarşıdakı et" },
];

const MAP_STATUSES = ["UPCOMING", "LIVE", "FINISHED"] as const;

export default async function MatchLiveControlPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const match = await prisma.match.findUnique({
    where: { id },
    include: {
      teamA: true,
      teamB: true,
      game: true,
      maps: { orderBy: { mapOrder: "asc" } },
      vetoSteps: { orderBy: { order: "asc" }, include: { team: true } },
    },
  });
  if (!match) notFound();

  const setStatus = setMatchStatus.bind(null, match.id);
  const saveMap = upsertMap.bind(null, match.id);
  const removeMap = deleteMap.bind(null, match.id);
  const addVeto = addVetoStep.bind(null, match.id);
  const removeVeto = deleteVetoStep.bind(null, match.id);

  return (
    <div className="max-w-2xl">
      <h1 className="font-display mb-1 text-2xl font-bold">
        {match.teamA.name} vs {match.teamB.name}
      </h1>
      <p className="mb-6 text-sm text-foreground-muted">
        {match.game.shortName} · BO{match.bestOf} · status: <span className="font-semibold text-foreground">{match.status}</span> · skor:{" "}
        <span className="font-display font-semibold text-foreground">{match.teamAScore} : {match.teamBScore}</span>
      </p>

      <div className="mb-8 flex flex-wrap gap-2">
        {STATUS_ACTIONS.map((a) => (
          <form key={a.status} action={setStatus}>
            <input type="hidden" name="status" value={a.status} />
            <button type="submit" className={match.status === a.status ? primaryButtonClass : secondaryButtonClass}>
              {a.label}
            </button>
          </form>
        ))}
      </div>

      <h2 className="font-display mb-3 text-lg font-bold">Xəritələr</h2>
      <div className="mb-4 space-y-3">
        {match.maps.map((map) => (
          <form key={map.id} action={saveMap} className="rounded-lg border border-border-subtle bg-surface p-3">
            <input type="hidden" name="mapId" value={map.id} />
            <div className="mb-2 flex items-center gap-2">
              <input name="mapName" defaultValue={map.mapName} className={`${inputClass} min-w-0 flex-1`} />
              <select name="status" defaultValue={map.status} className={`${inputClass} w-32 shrink-0`}>
                {MAP_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="mb-2 flex items-center gap-2">
              <input name="teamAScore" type="number" min={0} defaultValue={map.teamAScore} className={`${inputClass} w-20`} />
              <span className="text-xs text-foreground-muted">{match.teamA.name}</span>
              <span className="mx-2 text-foreground-muted">—</span>
              <input name="teamBScore" type="number" min={0} defaultValue={map.teamBScore} className={`${inputClass} w-20`} />
              <span className="text-xs text-foreground-muted">{match.teamB.name}</span>
            </div>
            <div className="flex gap-2">
              <button type="submit" className={primaryButtonClass}>
                Yadda saxla
              </button>
              <button type="submit" formAction={removeMap.bind(null, map.id)} className={dangerButtonClass}>
                Sil
              </button>
            </div>
          </form>
        ))}
      </div>

      <form action={saveMap} className="mb-8 rounded-lg border border-dashed border-border-subtle p-3">
        <p className={labelClass}>Yeni xəritə əlavə et</p>
        <div className="mb-2 flex items-center gap-2">
          <input name="mapName" placeholder="Mirage, Game 1..." required className={`${inputClass} min-w-0 flex-1`} />
          <select name="status" defaultValue="LIVE" className={`${inputClass} w-32 shrink-0`}>
            {MAP_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="mb-2 flex items-center gap-2">
          <input name="teamAScore" type="number" min={0} defaultValue={0} className={`${inputClass} w-20`} />
          <span className="mx-2 text-foreground-muted">—</span>
          <input name="teamBScore" type="number" min={0} defaultValue={0} className={`${inputClass} w-20`} />
        </div>
        <button type="submit" className={secondaryButtonClass}>
          + Əlavə et
        </button>
      </form>

      <h2 className="font-display mb-3 text-lg font-bold">Veto</h2>
      <div className="mb-4 space-y-1">
        {match.vetoSteps.map((step) => (
          <div key={step.id} className="flex items-center justify-between rounded-md border border-border-subtle bg-surface px-3 py-2 text-sm">
            <span>
              {step.order}. {step.team ? step.team.name : "Decider"} — {step.action} — {step.mapName}
            </span>
            <form action={removeVeto.bind(null, step.id)}>
              <button type="submit" className="text-xs text-live hover:underline">
                sil
              </button>
            </form>
          </div>
        ))}
      </div>
      <form action={addVeto} className="mb-8 flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-border-subtle p-3">
        <select name="teamId" className={inputClass}>
          <option value="">Decider</option>
          <option value={match.teamAId}>{match.teamA.name}</option>
          <option value={match.teamBId}>{match.teamB.name}</option>
        </select>
        <select name="action" defaultValue="BAN" className={inputClass}>
          <option value="BAN">BAN</option>
          <option value="PICK">PICK</option>
          <option value="DECIDER">DECIDER</option>
        </select>
        <input name="mapName" placeholder="Map adı" required className={inputClass} />
        <button type="submit" className={secondaryButtonClass}>
          + Əlavə et
        </button>
      </form>
    </div>
  );
}
