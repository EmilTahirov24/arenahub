import { getLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { dateStrip, toDateKey } from "@/lib/dates";
import type { Game } from "@/app/generated/prisma/client";

export default async function MatchFilters({
  games,
  basePath,
  activeGame,
  activeDate,
}: {
  games: Game[];
  basePath: string;
  activeGame?: string;
  activeDate?: string;
}) {
  const locale = await getLocale();
  const dayFmt = new Intl.DateTimeFormat(locale, { weekday: "short", day: "2-digit" });
  const days = dateStrip();
  const todayKey = toDateKey(new Date());

  function buildQuery(overrides: Record<string, string | undefined>) {
    const query: Record<string, string> = {};
    if (activeGame) query.game = activeGame;
    if (activeDate) query.date = activeDate;
    for (const [k, v] of Object.entries(overrides)) {
      if (v === undefined) delete query[k];
      else query[k] = v;
    }
    return query;
  }

  return (
    <div className="mb-6 space-y-3">
      <div className="flex flex-wrap gap-2">
        <Link
          href={{ pathname: basePath, query: buildQuery({ game: undefined }) }}
          className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
            !activeGame ? "brand-gradient-bg border-transparent text-white" : "border-border-subtle text-foreground-muted hover:text-foreground"
          }`}
        >
          {locale === "az" ? "Hamısı" : "All"}
        </Link>
        {games.map((game) => (
          <Link
            key={game.id}
            href={{ pathname: basePath, query: buildQuery({ game: game.slug }) }}
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

      <div className="flex gap-1 overflow-x-auto pb-1">
        <Link
          href={{ pathname: basePath, query: buildQuery({ date: undefined }) }}
          className={`shrink-0 rounded-md border px-3 py-2 text-center text-xs transition-colors ${
            !activeDate ? "border-brand-via bg-brand-via/10 text-foreground" : "border-border-subtle text-foreground-muted hover:text-foreground"
          }`}
        >
          {locale === "az" ? "Bütün tarixlər" : "All dates"}
        </Link>
        {days.map((d) => {
          const key = toDateKey(d);
          const isActive = activeDate === key;
          return (
            <Link
              key={key}
              href={{ pathname: basePath, query: buildQuery({ date: key }) }}
              className={`shrink-0 rounded-md border px-3 py-2 text-center text-xs transition-colors ${
                isActive ? "border-brand-via bg-brand-via/10 text-foreground" : "border-border-subtle text-foreground-muted hover:text-foreground"
              } ${key === todayKey && !isActive ? "border-border-subtle" : ""}`}
            >
              <div className="font-semibold">{dayFmt.format(d)}</div>
              {key === todayKey && <div className="text-[10px] text-brand-via">{locale === "az" ? "bu gün" : "today"}</div>}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
