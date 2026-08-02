import { getTranslations, getLocale, setRequestLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { Link } from "@/i18n/navigation";
import PageShell from "@/components/layout/PageShell";
import TeamAvatar from "@/components/common/TeamAvatar";
import CountryFlag from "@/components/common/CountryFlag";

export default async function TeamsPage({
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
  const activeGame = gameSlug ?? games[0]?.slug;

  const teams = await prisma.team.findMany({
    where: { isActive: true, game: { slug: activeGame } },
    orderBy: { worldRanking: "asc" },
  });

  return (
    <PageShell>
      <h1 className="font-display mb-4 text-2xl font-bold">{t("nav.teams")}</h1>

      <div className="mb-6 flex flex-wrap gap-2">
        {games.map((game) => (
          <Link
            key={game.id}
            href={{ pathname: "/teams", query: { game: game.slug } }}
            className="rounded-full border px-3 py-1 text-xs font-medium transition-colors"
            style={
              activeGame === game.slug
                ? { backgroundColor: game.accentColor, borderColor: game.accentColor, color: "#0a0b10" }
                : undefined
            }
          >
            <span className={activeGame === game.slug ? "" : "text-foreground-muted hover:text-foreground"}>
              {game.shortName}
            </span>
          </Link>
        ))}
      </div>

      <div className="overflow-hidden rounded-lg border border-border-subtle">
        {teams.map((team, i) => (
          <Link
            key={team.id}
            href={`/teams/${team.slug}`}
            className="flex items-center gap-3 border-b border-border-subtle bg-surface px-4 py-3 last:border-b-0 hover:bg-surface-raised"
          >
            <span className="w-6 text-sm font-semibold text-foreground-muted">#{i + 1}</span>
            <TeamAvatar name={team.name} logoUrl={team.logoUrl} color={team.primaryColor} size={36} />
            <div className="flex-1">
              <div className="flex items-center gap-1.5 font-medium">
                <CountryFlag code={team.country} />
                {team.name}
              </div>
            </div>
          </Link>
        ))}
        {teams.length === 0 && (
          <p className="p-6 text-center text-sm text-foreground-muted">
            {locale === "az" ? "Komanda tapılmadı." : "No teams found."}
          </p>
        )}
      </div>
    </PageShell>
  );
}
