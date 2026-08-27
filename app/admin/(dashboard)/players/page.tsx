import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { primaryButtonClass } from "@/components/admin/formStyles";
import CountryFlag from "@/components/common/CountryFlag";

export default async function AdminPlayersPage() {
  const players = await prisma.player.findMany({
    orderBy: { nickname: "asc" },
    include: { game: true, memberships: { where: { leftAt: null }, include: { team: true }, take: 1 } },
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold">Oyunçular</h1>
        <Link href="/admin/players/new" className={primaryButtonClass}>
          + Yeni oyunçu
        </Link>
      </div>

      <div className="overflow-hidden rounded-lg border border-border-subtle">
        {players.map((player) => (
          <Link
            key={player.id}
            href={`/admin/players/${player.id}`}
            className="flex items-center gap-3 border-b border-border-subtle bg-surface px-4 py-3 last:border-b-0 hover:bg-surface-raised"
          >
            <CountryFlag code={player.country} />
            <span className="flex-1 font-medium">{player.nickname}</span>
            <span className="text-xs text-foreground-muted">{player.memberships[0]?.team.name ?? "—"}</span>
            <span className="text-xs text-foreground-muted">{player.game.shortName}</span>
          </Link>
        ))}
        {players.length === 0 && <p className="p-6 text-center text-sm text-foreground-muted">Oyunçu yoxdur.</p>}
      </div>
    </div>
  );
}
