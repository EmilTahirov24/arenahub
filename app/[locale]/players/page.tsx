import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { Link } from "@/i18n/navigation";
import PageShell from "@/components/layout/PageShell";
import PlayerAvatar from "@/components/common/PlayerAvatar";
import TeamAvatar from "@/components/common/TeamAvatar";
import CountryFlag from "@/components/common/CountryFlag";
import { scoreBarFraction } from "@/lib/playerScore";
import { playerStatRows } from "@/lib/playerStats";

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
  searchParams: Promise<{ game?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { game: gameSlug } = await searchParams;
  const t = await getTranslations();
  const az = locale === "az";

  const games = await prisma.game.findMany({ where: { isActive: true } });
  const activeGame = gameSlug ?? games[0]?.slug;

  // Shared with the stats leaderboard so a player never shows a different
  // score depending on which page you look at — see lib/playerStats.ts.
  const game = games.find((g) => g.slug === activeGame);
  const rows = game ? await playerStatRows(game.id) : [];

  const bestScore = Math.max(0, ...rows.map((r) => r.score ?? 0));
  const scored = rows.filter((r) => r.score != null).length;
  const headCell = "px-3 py-2 text-[11px] font-normal uppercase tracking-wide text-foreground-muted";
  const num = (v: number | null, digits = 2) => (v == null ? "—" : v.toFixed(digits));

  return (
    <PageShell>
      <h1 className="font-display mb-1 text-2xl font-bold">{t("nav.players")}</h1>
      {/* States the coverage outright, so an empty cell reads as "not recorded"
          rather than as a broken table. */}
      {rows.length > 0 && scored < rows.length && (
        <p className="mb-4 text-sm text-foreground-muted">
          {az
            ? `${rows.length} oyunçudan ${scored}-nin statistikası qeydə alınıb. Qalanları üçün hələ məlumat yoxdur — uydurma rəqəm yazılmır.`
            : `Statistics recorded for ${scored} of ${rows.length} players. The rest have none yet — no placeholder numbers are shown.`}
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

      <div className="overflow-x-auto rounded-lg border border-border-subtle bg-surface">
        <table className="w-full min-w-[620px]">
          <thead>
            <tr className="bg-surface-raised">
              <th className={`${headCell} text-center`}>#</th>
              <th className={`${headCell} text-left`}>{az ? "Oyunçu" : "Player"}</th>
              <th className={`${headCell} text-left`}>{az ? "Komanda" : "Team"}</th>
              <th className={`${headCell} text-left`}>{az ? "Bal" : "Score"}</th>
              <th className={`${headCell} text-right`}>{az ? "Öldürmə" : "Kills"}</th>
              <th className={`${headCell} text-right`}>{az ? "Ölüm" : "Deaths"}</th>
              <th className={`${headCell} hidden text-right sm:table-cell`}>{az ? "Zərər" : "Damage"}</th>
              <th className={`${headCell} hidden text-right sm:table-cell`}>{az ? "Xəritə" : "Maps"}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.player.id} className="border-t border-border-subtle hover:bg-surface-raised">
                <td className="w-10 px-3 py-2 text-center text-sm text-foreground-muted tabular-nums">{i + 1}</td>
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
                          className="block h-full rounded-full bg-emerald-400"
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
                  {az ? "Oyunçu tapılmadı." : "No players found."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </PageShell>
  );
}
