import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const [teams, players, matches, liveMatches, news, ads] = await Promise.all([
    prisma.team.count(),
    prisma.player.count(),
    prisma.match.count(),
    prisma.match.findMany({
      where: { status: "LIVE" },
      include: { teamA: true, teamB: true, game: true },
      orderBy: { scheduledAt: "asc" },
    }),
    prisma.newsArticle.count(),
    prisma.adBanner.count({ where: { isActive: true } }),
  ]);

  const stats = [
    { label: "Komandalar", value: teams, href: "/admin/teams" },
    { label: "Oyunçular", value: players, href: "/admin/players" },
    { label: "Matçlar", value: matches, href: "/admin/matches" },
    { label: "Xəbərlər", value: news, href: "/admin/news" },
    { label: "Aktiv reklamlar", value: ads, href: "/admin/ads" },
  ];

  return (
    <div>
      <h1 className="font-display mb-6 text-2xl font-bold">Dashboard</h1>

      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className="rounded-lg border border-border-subtle bg-surface p-4 hover:bg-surface-raised">
            <div className="font-display text-2xl font-bold">{s.value}</div>
            <div className="text-xs text-foreground-muted">{s.label}</div>
          </Link>
        ))}
      </div>

      <h2 className="font-display mb-3 text-lg font-bold">Canlı matçlar</h2>
      {liveMatches.length === 0 ? (
        <p className="text-sm text-foreground-muted">Hazırda canlı matç yoxdur.</p>
      ) : (
        <div className="space-y-2">
          {liveMatches.map((m) => (
            <Link
              key={m.id}
              href={`/admin/matches/${m.id}/live`}
              className="flex items-center justify-between rounded-lg border border-live/40 bg-live/5 px-4 py-3 hover:bg-live/10"
            >
              <span className="text-sm">
                {m.teamA.name} vs {m.teamB.name} · {m.game.shortName}
              </span>
              <span className="font-display font-semibold">{m.teamAScore} : {m.teamBScore}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
