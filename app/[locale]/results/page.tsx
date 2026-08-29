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
  // Uydurma tarix filtr sayılmır — səbəb lib/dates.ts-də izah edilib.
  const date = isDateKey(dateParam) ? dateParam : undefined;
  const t = await getTranslations();

  const games = await activeGames();

  // Səhifələmə bazada aparılır, yaddaşda yox. Əvvəl bu sorğu BÜTÜN bitmiş
  // matçları çəkirdi — seed-dəki 23 matçla bu görünmürdü, amma idxal işlədikcə
  // sətir sayı artdı və səhifə 5 saniyəyə qalxdı. Sayğac artmağa davam edir,
  // yəni limitsiz variant vaxt keçdikcə yalnız pisləşir.
  //
  // Sorğu `lib/cachedQueries.ts`-dəki keşlənən köməkçidən keçir. Əvvəl eyni
  // məntiq burada keşsiz təkrarlanırdı və ölçmə bunun bahasını göstərdi: qabıq
  // 0.26 saniyəyə gəlirdi, amma axın hissəsi 1–2 saniyə çəkirdi, çünki hər
  // sorğuda sayğac və siyahı yenidən bazadan oxunurdu.
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
  // Diapazondan kənar səhifə 404 vermir, sonuncuya sıxılır — siyahı kiçiləndə
  // 7-ci səhifədə dayanmış adama xəta yox, son səhifə göstərilməlidir. Bu
  // nadir haldır, ona görə ikinci çağırışın bahası yoxdur; o da keşlənir.
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

  // Filtrlər səhifə nömrəsi ilə birlikdə ünvanda qalmalıdır, yoxsa ikinci
  // səhifəyə keçəndə seçilmiş oyun və tarix itir.
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
