import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getTeamSession } from "@/lib/auth";
import { primaryButtonClass } from "@/components/admin/formStyles";
import CountryFlag from "@/components/common/CountryFlag";
import { removeOwnPlayer } from "./actions";

export const dynamic = "force-dynamic";

export default async function TeamRosterPage() {
  const session = await getTeamSession();
  if (!session) redirect("/team/login");

  const roster = await prisma.teamMembership.findMany({
    where: { teamId: session.id, leftAt: null },
    include: { player: true },
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold">Tərkib</h1>
        <Link href="/team/roster/new" className={primaryButtonClass}>
          + Oyunçu əlavə et
        </Link>
      </div>

      <div className="space-y-2">
        {roster.map((m) => (
          <div key={m.id} className="flex items-center justify-between rounded-lg border border-border-subtle bg-surface px-4 py-3">
            <Link href={`/team/roster/${m.player.id}`} className="flex items-center gap-1.5 hover:underline">
              <CountryFlag code={m.player.country} />
              {m.player.nickname} {m.player.role && <span className="text-xs text-foreground-muted">· {m.player.role}</span>}
            </Link>
            <form action={removeOwnPlayer.bind(null, m.player.id)}>
              <button type="submit" className="text-xs text-live hover:underline">
                tərkibdən çıxar
              </button>
            </form>
          </div>
        ))}
        {roster.length === 0 && <p className="text-sm text-foreground-muted">Tərkib boşdur.</p>}
      </div>
    </div>
  );
}
