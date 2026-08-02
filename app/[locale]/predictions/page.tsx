import { getTranslations, setRequestLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import PageShell from "@/components/layout/PageShell";

export const dynamic = "force-dynamic";

export default async function PredictionsLeaderboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  const fans = await prisma.fan.findMany({
    where: { points: { gt: 0 } },
    orderBy: { points: "desc" },
    take: 50,
    select: { id: true, username: true, points: true },
  });

  return (
    <PageShell>
      <h1 className="font-display mb-1 text-2xl font-bold">{t("predictions.title")}</h1>
      <p className="mb-6 text-sm text-foreground-muted">{t("predictions.subtitle")}</p>

      {fans.length === 0 ? (
        <p className="text-sm text-foreground-muted">{t("predictions.empty")}</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border-subtle">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-raised text-left text-xs text-foreground-muted">
                <th className="px-4 py-2 font-normal">{t("predictions.rank")}</th>
                <th className="px-4 py-2 font-normal">{t("predictions.username")}</th>
                <th className="px-4 py-2 text-right font-normal">{t("predictions.points")}</th>
              </tr>
            </thead>
            <tbody>
              {fans.map((fan, i) => (
                <tr key={fan.id} className="border-t border-border-subtle bg-surface">
                  <td className="px-4 py-3 font-semibold text-foreground-muted">#{i + 1}</td>
                  <td className="px-4 py-3 font-medium">{fan.username}</td>
                  <td className="px-4 py-3 text-right font-display font-bold text-brand-via">{fan.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PageShell>
  );
}
