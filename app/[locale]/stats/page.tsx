import type { Metadata } from "next";
import { activeGames } from "@/lib/cachedQueries";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import PageShell from "@/components/layout/PageShell";
import GameAccent from "@/components/common/GameAccent";
import PlayerAvatar from "@/components/common/PlayerAvatar";
import TeamAvatar from "@/components/common/TeamAvatar";
import CountryFlag from "@/components/common/CountryFlag";
import { teamStatRows } from "@/lib/teamStats";
import { playerStatRows } from "@/lib/playerStats";
import { localeAlternates } from "@/lib/localeAlternates";
import { bestTextOn } from "@/lib/contrast";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  return {
    alternates: localeAlternates(locale, "/stats"),
    title: t("nav.stats"),
  };
}

export default async function StatsPage({
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
  const az = locale === "az";

  const games = await activeGames();
  const activeGame = games.find((g) => g.slug === gameSlug) ?? games[0];

  const [teams, players] = activeGame
    ? await Promise.all([teamStatRows(activeGame.id), playerStatRows(activeGame.id, { take: 15 })])
    : [[], []];

  const rankedTeams = teams.filter((r) => r.played > 0);
  const scoredPlayers = players.filter((r) => r.score != null);

  const head = "px-3 py-2 text-[11px] font-normal uppercase tracking-wide text-foreground-muted";
  const empty = az
    ? "Hələ matç yazılmayıb — nəticələr əlavə olunduqca statistika buradan formalaşacaq."
    : "No matches recorded yet — statistics build up here as results are added.";

  return (
    <PageShell>
      <GameAccent color={activeGame?.accentColor}>
      <h1 className="game-rule font-display mb-4 inline-block pb-1 text-2xl font-bold">{t("nav.stats")}</h1>

      <div className="mb-6 flex flex-wrap gap-2">
        {games.map((game) => (
          <Link
            key={game.id}
            href={{ pathname: "/stats", query: { game: game.slug } }}
            className="rounded-full border px-3 py-1 text-xs font-medium transition-colors"
            style={
              activeGame?.slug === game.slug
                ? { backgroundColor: game.accentColor, borderColor: game.accentColor, color: bestTextOn(game.accentColor) }
                : undefined
            }
          >
            <span className={activeGame?.slug === game.slug ? "" : "text-foreground-muted hover:text-foreground"}>
              {game.shortName}
            </span>
          </Link>
        ))}
      </div>

      {/* ---------- Teams ---------- */}
      <h2 className="game-bar font-display mb-2 text-lg font-bold">{az ? "Komanda statistikası" : "Team statistics"}</h2>
      <div className="game-edge mb-8 overflow-x-auto rounded-lg border border-border-subtle bg-surface">
        <table className="w-full min-w-[560px]">
          <thead>
            <tr className="bg-surface-raised">
              <th className={`${head} text-center`}>#</th>
              <th className={`${head} text-left`}>{az ? "Komanda" : "Team"}</th>
              <th className={`${head} text-right`}>{az ? "Matç" : "Matches"}</th>
              <th className={`${head} text-right`}>{az ? "Q–M" : "W–L"}</th>
              <th className={`${head} text-right`}>{az ? "Qazanma" : "Win rate"}</th>
              <th className={`${head} hidden text-right sm:table-cell`}>{az ? "Xəritə" : "Maps"}</th>
              <th className={`${head} hidden text-right sm:table-cell`}>{az ? "Xəritə %" : "Map %"}</th>
              <th className={`${head} text-right`}>{az ? "Reytinq" : "Rating"}</th>
            </tr>
          </thead>
          <tbody>
            {rankedTeams.map((r, i) => (
              <tr key={r.team.id} className="border-t border-border-subtle hover:bg-surface-raised">
                <td className="w-10 px-3 py-2 text-center text-sm text-foreground-muted tabular-nums">{i + 1}</td>
                <td className="px-3 py-2">
                  <Link href={`/teams/${r.team.slug}`} className="flex items-center gap-2 group">
                    <TeamAvatar name={r.team.name} logoUrl={r.team.logoUrl} color={r.team.primaryColor} size={26} />
                    <span className="flex items-center gap-1.5 truncate text-sm font-medium group-hover:underline">
                      <CountryFlag code={r.team.country} />
                      {r.team.name}
                    </span>
                  </Link>
                </td>
                <td className="px-3 py-2 text-right text-sm tabular-nums">{r.played}</td>
                <td className="px-3 py-2 text-right text-sm tabular-nums">
                  <span className="text-positive">{r.won}</span>
                  <span className="text-foreground-muted">–</span>
                  <span className="text-live">{r.lost}</span>
                </td>
                <td className="px-3 py-2 text-right text-sm tabular-nums">{r.winRate == null ? "—" : `${r.winRate}%`}</td>
                <td className="hidden px-3 py-2 text-right text-sm tabular-nums sm:table-cell">
                  {r.mapsPlayed === 0 ? "—" : `${r.mapsWon}–${r.mapsPlayed - r.mapsWon}`}
                </td>
                <td className="hidden px-3 py-2 text-right text-sm tabular-nums sm:table-cell">
                  {r.mapWinRate == null ? "—" : `${r.mapWinRate}%`}
                </td>
                <td className="px-3 py-2 text-right font-display text-sm font-bold tabular-nums">
                  {Math.round(r.team.rating)}
                </td>
              </tr>
            ))}
            {rankedTeams.length === 0 && (
              <tr>
                <td colSpan={8} className="p-6 text-center text-sm text-foreground-muted">
                  {empty}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ---------- Players ---------- */}
      <h2 className="game-bar font-display mb-2 text-lg font-bold">{az ? "Oyunçu statistikası" : "Player statistics"}</h2>
      <div className="game-edge overflow-x-auto rounded-lg border border-border-subtle bg-surface">
        <table className="w-full min-w-[560px]">
          <thead>
            <tr className="bg-surface-raised">
              <th className={`${head} text-center`}>#</th>
              <th className={`${head} text-left`}>{az ? "Oyunçu" : "Player"}</th>
              <th className={`${head} text-left`}>{az ? "Komanda" : "Team"}</th>
              <th className={`${head} text-right`}>{az ? "Bal" : "Score"}</th>
              <th className={`${head} text-right`}>{az ? "Öldürmə" : "Kills"}</th>
              <th className={`${head} text-right`}>{az ? "Ölüm" : "Deaths"}</th>
              <th className={`${head} hidden text-right sm:table-cell`}>{az ? "Zərər" : "Damage"}</th>
              <th className={`${head} hidden text-right sm:table-cell`}>{az ? "Xəritə" : "Maps"}</th>
            </tr>
          </thead>
          <tbody>
            {scoredPlayers.map((r, i) => (
              <tr key={r.player.id} className="border-t border-border-subtle hover:bg-surface-raised">
                <td className="w-10 px-3 py-2 text-center text-sm text-foreground-muted tabular-nums">{i + 1}</td>
                <td className="px-3 py-2">
                  <Link href={`/players/${r.player.slug}`} className="flex items-center gap-2 group">
                    <PlayerAvatar
                      name={r.player.nickname}
                      photoUrl={r.player.photoUrl}
                      color={r.team?.primaryColor}
                      size={26}
                    />
                    <span className="flex items-center gap-1.5 truncate text-sm font-medium group-hover:underline">
                      <CountryFlag code={r.player.country} />
                      {r.player.nickname}
                    </span>
                  </Link>
                </td>
                <td className="px-3 py-2 text-sm text-foreground-muted">
                  {r.team ? <span className="truncate">{r.team.name}</span> : "—"}
                </td>
                <td className="px-3 py-2 text-right font-display text-sm font-bold tabular-nums text-brand-via-fg">
                  {r.score?.toFixed(2)}
                </td>
                <td className="px-3 py-2 text-right text-sm tabular-nums">{r.kills?.toFixed(2) ?? "—"}</td>
                <td className="px-3 py-2 text-right text-sm tabular-nums">{r.deaths?.toFixed(2) ?? "—"}</td>
                <td className="hidden px-3 py-2 text-right text-sm tabular-nums sm:table-cell">
                  {r.damage?.toFixed(2) ?? "—"}
                </td>
                <td className="hidden px-3 py-2 text-right text-sm tabular-nums sm:table-cell">{r.maps ?? "—"}</td>
              </tr>
            ))}
            {scoredPlayers.length === 0 && (
              <tr>
                <td colSpan={8} className="p-6 text-center text-sm text-foreground-muted">
                  {empty}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {scoredPlayers.length > 0 && (
        <p className="mt-3 text-xs text-foreground-muted">
          {az
            ? "Bütün oyunçuların tam siyahısı Oyunçular səhifəsindədir."
            : "The full list of players is on the Players page."}
        </p>
      )}
      </GameAccent>
    </PageShell>
  );
}
