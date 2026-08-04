import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { primaryButtonClass, secondaryButtonClass } from "@/components/admin/formStyles";

export const dynamic = "force-dynamic";

const STATUS_COLOR: Record<string, string> = {
  LIVE: "text-live",
  UPCOMING: "text-foreground-muted",
  FINISHED: "text-brand-via",
  POSTPONED: "text-warning",
  CANCELLED: "text-foreground-muted",
};

export default async function AdminMatchesPage() {
  const matches = await prisma.match.findMany({
    orderBy: { scheduledAt: "desc" },
    take: 100,
    include: { teamA: true, teamB: true, game: true },
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold">Matçlar</h1>
        <Link href="/admin/matches/new" className={primaryButtonClass}>
          + Yeni matç
        </Link>
      </div>

      <div className="overflow-hidden rounded-lg border border-border-subtle">
        {matches.map((m) => (
          <div key={m.id} className="flex items-center gap-3 border-b border-border-subtle bg-surface px-4 py-3 last:border-b-0">
            <Link href={`/admin/matches/${m.id}`} className="flex-1 hover:underline">
              {m.teamA.name} vs {m.teamB.name}
            </Link>
            <span className="text-xs text-foreground-muted">{m.game.shortName}</span>
            <span className={`text-xs font-semibold ${STATUS_COLOR[m.status]}`}>{m.status}</span>
            <span className="font-display text-sm font-semibold">{m.teamAScore}:{m.teamBScore}</span>
            <Link href={`/admin/matches/${m.id}/live`} className={secondaryButtonClass}>
              Canlı idarə
            </Link>
          </div>
        ))}
        {matches.length === 0 && <p className="p-6 text-center text-sm text-foreground-muted">Matç yoxdur.</p>}
      </div>
    </div>
  );
}
