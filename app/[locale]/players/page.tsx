import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { Link } from "@/i18n/navigation";
import PageShell from "@/components/layout/PageShell";
import GameAccent from "@/components/common/GameAccent";
import PlayerAvatar from "@/components/common/PlayerAvatar";
import TeamAvatar from "@/components/common/TeamAvatar";
import CountryFlag from "@/components/common/CountryFlag";
import PlayerSearch from "@/components/players/PlayerSearch";
import SortableHeader from "@/components/common/SortableHeader";
import Pagination from "@/components/common/Pagination";
import { scoreBarFraction } from "@/lib/playerScore";
import { playerStatRows } from "@/lib/playerStats";
import {
  PLAYERS_PER_PAGE,
  defaultDirection,
  filterPlayerRows,
  isPlayerSortKey,
  sortPlayerRows,
} from "@/lib/playerTable";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  return { title: t("nav.players") };
}

export default async function PlayersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ game?: string; q?: string; sort?: string; dir?: string; page?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { game: gameSlug, q, sort, dir, page: pageParam } = await searchParams;
  const t = await getTranslations();
  const az = locale === "az";

  const games = await prisma.game.findMany({ where: { isActive: true } });
  const activeGame = gameSlug ?? games[0]?.slug;

  // Shared with the stats leaderboard so a player never shows a different
  // score depending on which page you look at — see lib/playerStats.ts.
  const game = games.find((g) => g.slug === activeGame);
  const allRows = game ? await playerStatRows(game.id) : [];

  // The score bar and the coverage note describe the whole roster, not the
  // current page: a bar that rescaled itself as you paged through would make
  // the same player look stronger on page 4 than on page 1.
  const bestScore = Math.max(0, ...allRows.map((r) => r.score ?? 0));
  const scored = allRows.filter((r) => r.score != null).length;

  const search = (q ?? "").trim();
  const sortKey = isPlayerSortKey(sort) ? sort : "score";
  const sortDir = dir === "asc" || dir === "desc" ? dir : defaultDirection(sortKey);

  const matched = sortPlayerRows(filterPlayerRows(allRows, search), sortKey, sortDir);

  const totalPages = Math.max(1, Math.ceil(matched.length / PLAYERS_PER_PAGE));
  // Clamped rather than 404'd: landing on page 7 of a list that shrank to three
  // should show the last page, not an error.
  const page = Math.min(Math.max(1, Number(pageParam) || 1), totalPages);
  const offset = (page - 1) * PLAYERS_PER_PAGE;
  const rows = matched.slice(offset, offset + PLAYERS_PER_PAGE);

  // Carried onto every sort link and page link so one control never silently
  // discards another.
  const baseQuery: Record<string, string> = {};
  if (activeGame) baseQuery.game = activeGame;
  if (search) baseQuery.q = search;

  const sortQuery = { ...baseQuery };
  const pageQuery = { ...baseQuery, sort: sortKey, dir: sortDir };

  /** Clicking the active column flips it; any other column starts at its own default. */
  const nextDir = (key: Parameters<typeof defaultDirection>[0]) =>
    sortKey === key ? (sortDir === "asc" ? "desc" : "asc") : defaultDirection(key);
  const headCell = "px-3 py-2 text-[11px] font-normal uppercase tracking-wide text-foreground-muted";
  const num = (v: number | null, digits = 2) => (v == null ? "—" : v.toFixed(digits));

  return (
    <PageShell>
      <GameAccent color={game?.accentColor}>
      <h1 className="game-rule font-display mb-1 inline-block pb-1 text-2xl font-bold">{t("nav.players")}</h1>
      {/* States the coverage outright, so an empty cell reads as "not recorded"
          rather than as a broken table. */}
      {allRows.length > 0 && scored < allRows.length && (
        <p className="mb-4 text-sm text-foreground-muted">
          {az
            ? `${allRows.length} oyunçudan ${scored}-nin statistikası qeydə alınıb. Qalanları üçün hələ məlumat yoxdur — uydurma rəqəm yazılmır.`
            : `Statistics recorded for ${scored} of ${allRows.length} players. The rest have none yet — no placeholder numbers are shown.`}
        </p>
      )}

      <div className="mb-6 flex flex-wrap gap-2">
        {games.map((game) => (
          <Link
            key={game.id}
            href={{ pathname: "/players", query: { game: game.slug } }}
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

      <PlayerSearch
        game={activeGame}
        defaultValue={search}
        placeholder={az ? "Oyunçu və ya komanda axtar..." : "Search player or team..."}
        clearLabel={az ? "Təmizlə" : "Clear"}
      />

      <div className="game-edge overflow-x-auto rounded-lg border border-border-subtle bg-surface">
        <table className="w-full min-w-[620px]">
          <thead>
            <tr className="bg-surface-raised">
              <th className={`${headCell} text-center`}>#</th>
              <SortableHeader
                label={az ? "Oyunçu" : "Player"}
                sortKey="nickname"
                activeKey={sortKey}
                activeDir={sortDir}
                nextDir={nextDir("nickname")}
                query={sortQuery}
                pathname="/players"
                className={headCell}
              />
              <SortableHeader
                label={az ? "Komanda" : "Team"}
                sortKey="team"
                activeKey={sortKey}
                activeDir={sortDir}
                nextDir={nextDir("team")}
                query={sortQuery}
                pathname="/players"
                className={headCell}
              />
              <SortableHeader
                label={az ? "Bal" : "Score"}
                sortKey="score"
                activeKey={sortKey}
                activeDir={sortDir}
                nextDir={nextDir("score")}
                query={sortQuery}
                pathname="/players"
                className={headCell}
              />
              <SortableHeader
                label={az ? "Öldürmə" : "Kills"}
                sortKey="kills"
                activeKey={sortKey}
                activeDir={sortDir}
                nextDir={nextDir("kills")}
                query={sortQuery}
                pathname="/players"
                align="right"
                className={headCell}
              />
              <SortableHeader
                label={az ? "Ölüm" : "Deaths"}
                sortKey="deaths"
                activeKey={sortKey}
                activeDir={sortDir}
                nextDir={nextDir("deaths")}
                query={sortQuery}
                pathname="/players"
                align="right"
                className={headCell}
              />
              <SortableHeader
                label={az ? "Zərər" : "Damage"}
                sortKey="damage"
                activeKey={sortKey}
                activeDir={sortDir}
                nextDir={nextDir("damage")}
                query={sortQuery}
                pathname="/players"
                align="right"
                className={`${headCell} hidden sm:table-cell`}
              />
              <SortableHeader
                label={az ? "Xəritə" : "Maps"}
                sortKey="maps"
                activeKey={sortKey}
                activeDir={sortDir}
                nextDir={nextDir("maps")}
                query={sortQuery}
                pathname="/players"
                align="right"
                className={`${headCell} hidden sm:table-cell`}
              />
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.player.id} className="border-t border-border-subtle hover:bg-surface-raised">
                <td className="w-10 px-3 py-2 text-center text-sm text-foreground-muted tabular-nums">
                  {offset + i + 1}
                </td>
                <td className="px-3 py-2">
                  <Link href={`/players/${r.player.slug}`} className="flex items-center gap-2 group">
                    <PlayerAvatar
                      name={r.player.nickname}
                      photoUrl={r.player.photoUrl}
                      color={r.team?.primaryColor}
                      size={28}
                    />
                    <span className="flex items-center gap-1.5 truncate text-sm font-medium group-hover:underline">
                      <CountryFlag code={r.player.country} />
                      {r.player.nickname}
                    </span>
                  </Link>
                </td>
                <td className="px-3 py-2">
                  {r.team ? (
                    <Link href={`/teams/${r.team.slug}`} className="flex items-center gap-1.5 text-sm text-foreground-muted hover:text-foreground hover:underline">
                      <TeamAvatar name={r.team.name} logoUrl={r.team.logoUrl} color={r.team.primaryColor} size={18} />
                      <span className="truncate">{r.team.name}</span>
                    </Link>
                  ) : (
                    <span className="text-sm text-foreground-muted">—</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  {r.score == null ? (
                    <span className="text-sm text-foreground-muted">—</span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <span className="w-9 font-display text-sm font-bold tabular-nums">{r.score.toFixed(2)}</span>
                      <span className="hidden h-1.5 w-20 overflow-hidden rounded-full bg-border-subtle md:block">
                        <span
                          className="block h-full rounded-full bg-positive"
                          style={{ width: `${scoreBarFraction(r.score, bestScore) * 100}%` }}
                        />
                      </span>
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-right text-sm tabular-nums">{num(r.kills)}</td>
                <td className="px-3 py-2 text-right text-sm tabular-nums">{num(r.deaths)}</td>
                <td className="hidden px-3 py-2 text-right text-sm tabular-nums sm:table-cell">{num(r.damage)}</td>
                <td className="hidden px-3 py-2 text-right text-sm tabular-nums sm:table-cell">{r.maps ?? "—"}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="p-6 text-center text-sm text-foreground-muted">
                  {/* "Nothing matched your search" and "this game has no players
                      yet" are different facts and deserve different sentences. */}
                  {search
                    ? az
                      ? `«${search}» üzrə oyunçu tapılmadı.`
                      : `No players match “${search}”.`
                    : az
                      ? "Oyunçu tapılmadı."
                      : "No players found."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination
        page={page}
        totalPages={totalPages}
        pathname="/players"
        query={pageQuery}
        labels={{
          previous: az ? "Əvvəlki" : "Previous",
          next: az ? "Növbəti" : "Next",
          summary: az
            ? `${matched.length} oyunçudan ${offset + 1}–${offset + rows.length}`
            : `${offset + 1}–${offset + rows.length} of ${matched.length}`,
        }}
      />
      </GameAccent>
    </PageShell>
  );
}
