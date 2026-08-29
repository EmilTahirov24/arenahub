import type { Metadata } from "next";
import { cacheLife } from "next/cache";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import PageShell from "@/components/layout/PageShell";
import CountryFlag from "@/components/common/CountryFlag";
import { localeAlternates } from "@/lib/localeAlternates";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  return {
    alternates: localeAlternates(locale, "/predictions"),
    title: t("predictions.title"),
  };
}

export default async function PredictionsLeaderboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  "use cache";
  // İdxal saatda bir dəfə işləyir, admin dəyişiklikləri isə revalidatePath ilə
  // dərhal ləğv olunur — ona görə bir dəqiqəlik pəncərə datanı köhnəltmir.
  cacheLife("minutes");

  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  const players = await prisma.player.findMany({
    where: { points: { gt: 0 } },
    orderBy: { points: "desc" },
    take: 50,
    select: { id: true, nickname: true, points: true, country: true },
  });

  return (
    <PageShell>
      <h1 className="font-display mb-1 text-2xl font-bold">{t("predictions.title")}</h1>
      <p className="mb-6 text-sm text-foreground-muted">{t("predictions.subtitle")}</p>

      {players.length === 0 ? (
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
              {players.map((player, i) => (
                <tr key={player.id} className="border-t border-border-subtle bg-surface">
                  <td className="px-4 py-3 font-semibold text-foreground-muted">#{i + 1}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 font-medium">
                      <CountryFlag code={player.country} />
                      {player.nickname}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-display font-bold text-brand-via-fg">{player.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PageShell>
  );
}
