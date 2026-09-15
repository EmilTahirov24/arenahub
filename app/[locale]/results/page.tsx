import type { Metadata } from "next";
import { activeGames, finishedMatches } from "@/lib/cachedQueries";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { groupBy } from "@/lib/group";
import PageShell from "@/components/layout/PageShell";
import MatchFilters from "@/components/matches/MatchFilters";
import MatchGroup from "@/components/matches/MatchGroup";
import Pagination from "@/components/common/Pagination";
import { localeAlternates } from "@/lib/localeAlternates";
import { isDateKey } from "@/lib/dates";

const RESULTS_PER_PAGE = 50;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  return {
    alternates: localeAlternates(locale, "/results"),
    title: t("nav.results"),
  };
}

export default async function ResultsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ game?: string; date?: string; page?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { game: gameSlug, date: dateParam, page: pageParam } = await searchParams;
  // A junk date does not count as a filter - the reason is in lib/dates.ts.
  const date = isDateKey(dateParam) ? dateParam : undefined;
  const t = await getTranslations();

  const games = await activeGames();

  // Pagination happens in the database, not in memory. This query used to
  // fetch EVERY finished match - invisible with the 23 matches in the seed,
  // but as the import ran the row count grew and the page climbed to 5
  // seconds. The counter keeps rising, so the unbounded version only gets
  // worse with time.
  //
  // The query goes through the cached helper in `lib/cachedQueries.ts`. The
  // same logic used to be repeated here without a cache, and measuring showed
  // the price: the shell arrived in 0.26 seconds while the streamed part took
  // 1-2, because the count and the list were read from the database on every
  // request.
  const requested = Math.max(1, Number(pageParam) || 1);
  const first = await finishedMatches(
    gameSlug,
    date,
    (requested - 1) * RESULTS_PER_PAGE,
    RESULTS_PER_PAGE,
  );
  const total = first.total;
  let matches = first.matches;

  const totalPages = Math.max(1, Math.ceil(total / RESULTS_PER_PAGE));
  // A page out of range does not 404, it clamps to the last one - somebody
  // parked on page 7 when the list shrinks should get the final page, not an
  // error. It is rare, so the second call costs nothing; it is cached too.
  const page = Math.min(requested, totalPages);
  if (page !== requested) {
    ({ matches } = await finishedMatches(
      gameSlug,
      date,
      (page - 1) * RESULTS_PER_PAGE,
      RESULTS_PER_PAGE,
    ));
  }
  const offset = (page - 1) * RESULTS_PER_PAGE;

  const groups = groupBy(matches, (m) => m.tournamentId ?? "none");

  // The filters have to travel in the address alongside the page number, or
  // moving to page two loses the chosen game and date.
  const pageQuery: Record<string, string> = {};
  if (gameSlug) pageQuery.game = gameSlug;
  if (date) pageQuery.date = date;

  return (
    <PageShell>
      <h1 className="font-display mb-4 text-2xl font-bold">{t("nav.results")}</h1>
      <MatchFilters games={games} basePath="/results" activeGame={gameSlug} activeDate={date} />

      {matches.length === 0 && (
        <p className="rounded-lg border border-border-subtle bg-surface p-6 text-center text-sm text-foreground-muted">
          {locale === "az" ? "Bu filtrə uyğun nəticə tapılmadı." : "No results found for this filter."}
        </p>
      )}

      {Array.from(groups.entries()).map(([key, groupMatches]) => (
        <MatchGroup key={key} tournament={groupMatches[0].tournament} matches={groupMatches} />
      ))}

      <Pagination
        page={page}
        totalPages={totalPages}
        pathname="/results"
        query={pageQuery}
        labels={{
          previous: locale === "az" ? "Əvvəlki" : "Previous",
          next: locale === "az" ? "Növbəti" : "Next",
          summary:
            locale === "az"
              ? `${total} nəticədən ${offset + 1}–${offset + matches.length}`
              : `${offset + 1}–${offset + matches.length} of ${total}`,
        }}
      />
    </PageShell>
  );
}
