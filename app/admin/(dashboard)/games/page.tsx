import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { primaryButtonClass } from "@/components/admin/formStyles";

export default async function AdminGamesPage() {
  const games = await prisma.game.findMany({ orderBy: { name: "asc" } });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold">Oyunlar</h1>
        <Link href="/admin/games/new" className={primaryButtonClass}>
          + Yeni oyun
        </Link>
      </div>

      <div className="overflow-hidden rounded-lg border border-border-subtle">
        {games.map((game) => (
          <Link
            key={game.id}
            href={`/admin/games/${game.id}`}
            className="flex items-center gap-3 border-b border-border-subtle bg-surface px-4 py-3 last:border-b-0 hover:bg-surface-raised"
          >
            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: game.accentColor }} />
            <span className="flex-1 font-medium">{game.name}</span>
            <span className="text-xs text-foreground-muted">{game.slug}</span>
            {!game.isActive && <span className="text-xs text-live">deaktiv</span>}
          </Link>
        ))}
        {games.length === 0 && <p className="p-6 text-center text-sm text-foreground-muted">Oyun yoxdur.</p>}
      </div>
    </div>
  );
}
