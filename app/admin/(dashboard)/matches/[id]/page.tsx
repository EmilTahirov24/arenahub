import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import MatchForm from "@/components/admin/MatchForm";
import { updateMatch, deleteMatch } from "../actions";
import { dangerButtonClass, secondaryButtonClass } from "@/components/admin/formStyles";

export default async function EditMatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [match, games, teams, tournaments] = await Promise.all([
    prisma.match.findUnique({ where: { id } }),
    prisma.game.findMany({ orderBy: { name: "asc" } }),
    prisma.team.findMany({ orderBy: { name: "asc" } }),
    prisma.tournament.findMany({ orderBy: { name: "asc" } }),
  ]);
  if (!match) notFound();

  const updateWithId = updateMatch.bind(null, id);
  const deleteWithId = deleteMatch.bind(null, id);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold">Matç redaktəsi</h1>
        <div className="flex gap-2">
          <Link href={`/admin/matches/${id}/live`} className={secondaryButtonClass}>
            Canlı idarə otağı
          </Link>
          <Link href={`/admin/matches/${id}/stats`} className={secondaryButtonClass}>
            Statistika
          </Link>
        </div>
      </div>
      <MatchForm match={match} games={games} teams={teams} tournaments={tournaments} action={updateWithId} />
      <form action={deleteWithId} className="mt-8">
        <button type="submit" className={dangerButtonClass}>
          Matçı sil
        </button>
      </form>
    </div>
  );
}
