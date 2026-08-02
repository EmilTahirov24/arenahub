import { getTranslations, getLocale, setRequestLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { Link } from "@/i18n/navigation";
import PageShell from "@/components/layout/PageShell";
import GameChip from "@/components/common/GameChip";

const TIER_COLOR: Record<string, string> = { S: "#facc15", A: "#22d3ee", B: "#a3a3a3", C: "#78716c" };

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

  const games = await prisma.game.findMany({ where: { isActive: true } });

  const tournaments = await prisma.tournament.findMany({
    where: gameSlug ? { game: { slug: gameSlug } } : {},
    orderBy: { startDate: "desc" },
    include: { game: true },
  });

  const dateFmt = new Intl.DateTimeFormat(locale, { day: "2-digit", month: "short" });
  const statusLabel: Record<string, string> = {
    ONGOING: locale === "az" ? "Davam edir" : "Ongoing",
    UPCOMING: locale === "az" ? "Qarşıda" : "Upcoming",
    FINISHED: locale === "az" ? "Bitib" : "Finished",
  };

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
          <Link
            key={tour.id}
            href={`/events/${tour.slug}`}
            className="flex items-center gap-3 rounded-lg border border-border-subtle bg-surface p-4 hover:bg-surface-raised"
          >
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md font-display text-sm font-bold"
              style={{ color: TIER_COLOR[tour.tier], backgroundColor: `${TIER_COLOR[tour.tier]}1a` }}
            >
              {tour.tier}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <GameChip name={tour.game.shortName} color={tour.game.accentColor} />
                <span className="text-xs text-foreground-muted">{statusLabel[tour.status]}</span>
              </div>
              <div className="truncate font-medium">{tour.name}</div>
              <div className="text-xs text-foreground-muted">
                {dateFmt.format(tour.startDate)} – {dateFmt.format(tour.endDate)}
                {tour.location ? ` · ${tour.location}` : ""}
              </div>
            </div>
            {tour.prizePool && <span className="shrink-0 text-sm font-semibold text-brand-via">{tour.prizePool}</span>}
          </Link>
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
