import type { Metadata } from "next";
import { activeGames } from "@/lib/cachedQueries";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { Link } from "@/i18n/navigation";
import PageShell from "@/components/layout/PageShell";
import TournamentRow from "@/components/events/TournamentRow";
import { localeAlternates } from "@/lib/localeAlternates";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  return {
    alternates: localeAlternates(locale, "/events"),
    title: t("nav.events"),
  };
}
export default async function EventsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ game?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { game: gameSlug } = await searchParams;
  const t = await getTranslations();
  const games = await activeGames();
  const tournaments = await prisma.tournament.findMany({
    where: gameSlug ? { game: { slug: gameSlug } } : {},
    orderBy: { startDate: "desc" },
    include: { game: true },
  });
  return (
    <PageShell>
      <h1 className="font-display mb-4 text-2xl font-bold">{t("nav.events")}</h1>
      <div className="mb-6 flex flex-wrap gap-2">
        <Link
          href="/events"
          className={`rounded-full border px-3 py-1 text-xs font-medium ${!gameSlug ? "brand-gradient-bg border-transparent text-white" : "border-border-subtle text-foreground-muted hover:text-foreground"}`}
        >
          {locale === "az" ? "Hamısı" : "All"}
        </Link>
        {games.map((game) => (
          <Link
            key={game.id}
            href={{ pathname: "/events", query: { game: game.slug } }}
            className="rounded-full border px-3 py-1 text-xs font-medium transition-colors"
            style={gameSlug === game.slug ? { backgroundColor: game.accentColor, borderColor: game.accentColor, color: "#0a0b10" } : undefined}
          >
            <span className={gameSlug === game.slug ? "" : "text-foreground-muted hover:text-foreground"}>{game.shortName}</span>
          </Link>
        ))}
      </div>
      <div className="space-y-2">
        {tournaments.map((tour) => (
          <TournamentRow key={tour.id} tournament={tour} />
        ))}
        {tournaments.length === 0 && (
          <p className="rounded-lg border border-border-subtle bg-surface p-6 text-center text-sm text-foreground-muted">
            {locale === "az" ? "Turnir tapılmadı." : "No events found."}
          </p>
        )}
      </div>
    </PageShell>
  );
}
