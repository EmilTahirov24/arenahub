import type { Metadata } from "next";
import { activeGames, upcomingMatches } from "@/lib/cachedQueries";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { groupBy } from "@/lib/group";
import PageShell from "@/components/layout/PageShell";
import MatchFilters from "@/components/matches/MatchFilters";
import MatchGroup from "@/components/matches/MatchGroup";
import NextUp from "@/components/matches/NextUp";
import { localeAlternates } from "@/lib/localeAlternates";
import { isDateKey } from "@/lib/dates";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  return {
    alternates: localeAlternates(locale, "/matches"),
    title: t("nav.matches"),
  };
}

export default async function MatchesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ game?: string; date?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { game: gameSlug, date: dateParam } = await searchParams;
  // Uydurma tarix filtr kimi qəbul edilmir: sorğu onsuz da onu nəzərə almır
  // (lib/dates.ts), amma normallaşdırmasaq, filtr zolağında heç bir gün seçili
  // görünmür və uydurma dəyər bütün linklərə daşınır.
  const date = isDateKey(dateParam) ? dateParam : undefined;
  const t = await getTranslations();

  const games = await activeGames();

  const matches = await upcomingMatches(gameSlug, date);

  const groups = groupBy(matches, (m) => m.tournamentId ?? "none");

  return (
    <PageShell>
      <h1 className="font-display mb-4 text-2xl font-bold">{t("nav.matches")}</h1>
      <MatchFilters games={games} basePath="/matches" activeGame={gameSlug} activeDate={date} />

      {/* With a filter on, "nothing matched" is the honest answer. With no
          filter, the list is empty because no schedule has been published —
          a different thing, and worth saying properly. */}
      {matches.length === 0 &&
        (gameSlug || date ? (
          <p className="rounded-lg border border-border-subtle bg-surface p-6 text-center text-sm text-foreground-muted">
            {locale === "az" ? "Bu filtrə uyğun matç tapılmadı." : "No matches found for this filter."}
          </p>
        ) : (
          <NextUp reason="matches" />
        ))}

      {Array.from(groups.entries()).map(([key, groupMatches]) => (
        <MatchGroup key={key} tournament={groupMatches[0].tournament} matches={groupMatches} />
      ))}
    </PageShell>
  );
}
