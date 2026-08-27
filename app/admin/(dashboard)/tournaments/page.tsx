import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { primaryButtonClass } from "@/components/admin/formStyles";

const TIER_COLOR: Record<string, string> = { S: "#facc15", A: "#22d3ee", B: "#a3a3a3", C: "#78716c" };

export default async function AdminTournamentsPage() {
  const tournaments = await prisma.tournament.findMany({
    orderBy: { startDate: "desc" },
    include: { game: true },
  });

  const dateFmt = new Intl.DateTimeFormat("az", { day: "2-digit", month: "short", year: "numeric" });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold">Turnirlər</h1>
        <Link href="/admin/tournaments/new" className={primaryButtonClass}>
          + Yeni turnir
        </Link>
      </div>

      <div className="overflow-hidden rounded-lg border border-border-subtle">
        {tournaments.map((tournament) => (
          <Link
            key={tournament.id}
            href={`/admin/tournaments/${tournament.id}`}
            className="flex items-center gap-3 border-b border-border-subtle bg-surface px-4 py-3 last:border-b-0 hover:bg-surface-raised"
          >
            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: TIER_COLOR[tournament.tier] }} />
            <span className="flex-1 font-medium">{tournament.name}</span>
            <span className="text-xs text-foreground-muted">{tournament.game.shortName}</span>
            <span className="text-xs text-foreground-muted">{tournament.tier}</span>
            <span className="text-xs text-foreground-muted">{tournament.status}</span>
            <span className="text-xs text-foreground-muted">
              {dateFmt.format(tournament.startDate)} – {dateFmt.format(tournament.endDate)}
            </span>
          </Link>
        ))}
        {tournaments.length === 0 && <p className="p-6 text-center text-sm text-foreground-muted">Turnir yoxdur.</p>}
      </div>
    </div>
  );
}
