import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import PageShell from "@/components/layout/PageShell";
import MatchCard from "@/components/matches/MatchCard";
import NextUp from "@/components/matches/NextUp";
import AutoRefresh from "@/components/live/AutoRefresh";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  return { title: t("nav.live") };
}

export default async function LivePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  const matches = await prisma.match.findMany({
    where: { status: "LIVE" },
    orderBy: { scheduledAt: "asc" },
    include: { teamA: true, teamB: true, tournament: true },
  });

  return (
    <PageShell>
      {/* Only poll when there is something to poll for. This used to refresh
          every 8 seconds forever, including on an empty page. */}
      {matches.length > 0 && <AutoRefresh intervalMs={60000} />}
      <div className="mb-4 flex items-center gap-2">
        <span className="h-2.5 w-2.5 animate-glow-pulse rounded-full bg-live" />
        <h1 className="font-display text-2xl font-bold">{t("nav.live")}</h1>
      </div>

      {matches.length === 0 ? (
        <NextUp reason="live" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {matches.map((match) => (
            <MatchCard key={match.id} match={match} />
          ))}
        </div>
      )}
    </PageShell>
  );
}
