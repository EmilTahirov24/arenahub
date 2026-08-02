import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getFanSession } from "@/lib/auth";
import CountryFlag from "@/components/common/CountryFlag";

export const dynamic = "force-dynamic";

export default async function FanHomePage() {
  const session = await getFanSession();
  if (!session) redirect("/fan/login");
  const fan = await prisma.fan.findUnique({ where: { id: session.id } });
  if (!fan) redirect("/fan/login");

  const [aheadCount, predictions] = await Promise.all([
    prisma.fan.count({ where: { points: { gt: fan.points } } }),
    prisma.matchPrediction.findMany({
      where: { fanId: fan.id },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: {
        predictedWinner: true,
        match: { include: { teamA: true, teamB: true } },
      },
    }),
  ]);

  const rank = aheadCount + 1;

  return (
    <div>
      <h1 className="font-display mb-1 text-2xl font-bold">{fan.username}</h1>
      <p className="mb-6 text-sm text-foreground-muted">{fan.email}</p>

      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-border-subtle bg-surface p-4 text-center">
          <div className="font-display text-3xl font-bold text-brand-via">{fan.points}</div>
          <div className="text-xs text-foreground-muted">Xal</div>
        </div>
        <div className="rounded-lg border border-border-subtle bg-surface p-4 text-center">
          <div className="font-display text-3xl font-bold text-brand-via">#{rank}</div>
          <div className="text-xs text-foreground-muted">Sıralama</div>
        </div>
      </div>

      <h2 className="font-display mb-3 text-lg font-bold">Proqnoz tarixçəsi</h2>
      {predictions.length === 0 ? (
        <p className="text-sm text-foreground-muted">Hələ heç bir proqnoz verməmisiniz.</p>
      ) : (
        <div className="space-y-2">
          {predictions.map((p) => {
            const isFinished = p.match.status === "FINISHED";
            const isCorrect = isFinished && p.match.winnerId === p.predictedWinnerId;
            return (
              <div
                key={p.id}
                className="flex items-center justify-between rounded-lg border border-border-subtle bg-surface px-4 py-3"
              >
                <div className="text-sm">
                  {p.match.teamA.name} <span className="text-foreground-muted">vs</span> {p.match.teamB.name}
                  <div className="mt-0.5 flex items-center gap-1.5 text-xs text-foreground-muted">
                    Seçim: <CountryFlag code={p.predictedWinner.country} size={12} />
                    {p.predictedWinner.name}
                  </div>
                </div>
                {isFinished ? (
                  <span className={`text-xs font-bold ${isCorrect ? "text-emerald-400" : "text-live"}`}>
                    {isCorrect ? "Düz ✓" : "Səhv ✗"}
                  </span>
                ) : (
                  <span className="text-xs text-foreground-muted">Gözlənilir</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
