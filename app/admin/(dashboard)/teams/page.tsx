import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { primaryButtonClass } from "@/components/admin/formStyles";
import CountryFlag from "@/components/common/CountryFlag";

export const dynamic = "force-dynamic";

export default async function AdminTeamsPage() {
  const teams = await prisma.team.findMany({ orderBy: { name: "asc" }, include: { game: true } });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold">Komandalar</h1>
        <Link href="/admin/teams/new" className={primaryButtonClass}>
          + Yeni komanda
        </Link>
      </div>

      <div className="overflow-hidden rounded-lg border border-border-subtle">
        {teams.map((team) => (
          <Link
            key={team.id}
            href={`/admin/teams/${team.id}`}
            className="flex items-center gap-3 border-b border-border-subtle bg-surface px-4 py-3 last:border-b-0 hover:bg-surface-raised"
          >
            <CountryFlag code={team.country} />
            <span className="flex-1 font-medium">{team.name}</span>
            <span className="text-xs text-foreground-muted">{team.game.shortName}</span>
            {team.isClaimed && <span className="text-xs text-brand-via">self-service</span>}
            {!team.isActive && <span className="text-xs text-live">deaktiv</span>}
          </Link>
        ))}
        {teams.length === 0 && <p className="p-6 text-center text-sm text-foreground-muted">Komanda yoxdur.</p>}
      </div>
    </div>
  );
}
