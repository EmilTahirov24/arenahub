import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import TeamForm from "@/components/admin/TeamForm";
import { updateTeam, deleteTeam, removeFromRoster } from "../actions";
import { dangerButtonClass, secondaryButtonClass } from "@/components/admin/formStyles";

export default async function EditTeamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [team, games, roster] = await Promise.all([
    prisma.team.findUnique({ where: { id } }),
    prisma.game.findMany({ orderBy: { name: "asc" } }),
    prisma.teamMembership.findMany({ where: { teamId: id, leftAt: null }, include: { player: true } }),
  ]);
  if (!team) notFound();

  const updateWithId = updateTeam.bind(null, id);
  const deleteWithId = deleteTeam.bind(null, id);

  return (
    <div>
      <h1 className="font-display mb-6 text-2xl font-bold">{team.name}</h1>
      <TeamForm team={team} games={games} action={updateWithId} />

      <div className="mt-10 max-w-lg">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">Tərkib</h2>
          <Link href={`/admin/players/new?teamId=${team.id}`} className={secondaryButtonClass}>
            + Oyunçu əlavə et
          </Link>
        </div>
        <div className="space-y-2">
          {roster.map((m) => (
            <div key={m.id} className="flex items-center justify-between rounded-lg border border-border-subtle bg-surface px-3 py-2">
              <Link href={`/admin/players/${m.player.id}`} className="text-sm hover:underline">
                {m.player.nickname} {m.player.role && <span className="text-foreground-muted">· {m.player.role}</span>}
              </Link>
              <form action={removeFromRoster.bind(null, team.id, m.id)}>
                <button type="submit" className="text-xs text-live hover:underline">
                  tərkibdən çıxar
                </button>
              </form>
            </div>
          ))}
          {roster.length === 0 && <p className="text-sm text-foreground-muted">Tərkib boşdur.</p>}
        </div>
      </div>

      <form action={deleteWithId} className="mt-8">
        <button type="submit" className={dangerButtonClass}>
          Komandanı sil
        </button>
      </form>
    </div>
  );
}
