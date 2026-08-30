import Image from "next/image";
import { getLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { dateStrip, toDateKey, siteFormat } from "@/lib/dates";
import type { Game } from "@/app/generated/prisma/client";
import { bestTextOn } from "@/lib/contrast";

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
  const dayFmt = siteFormat(locale, { weekday: "short", day: "2-digit" });
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
                ? { backgroundColor: game.accentColor, borderColor: game.accentColor, color: bestTextOn(game.accentColor) }
                : undefined
            }
          >
            <span className={`inline-flex items-center gap-1.5 ${activeGame === game.slug ? "" : "text-foreground-muted hover:text-foreground"}`}>
              {/* Oyun loqosu admin paneldən yüklənirdi və heç yerdə
                  görünmürdü. Filtr pili onun yeganə təbii yeridir — GameChip
                  11 piksellik mətn pilidir, orada loqo səs-küy olardı. */}
              {game.logoUrl && (
                <Image src={game.logoUrl} alt="" width={14} height={14} unoptimized className="h-3.5 w-3.5 object-contain" />
              )}
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
              {key === todayKey && <div className="text-[10px] text-brand-via-fg">{locale === "az" ? "bu gün" : "today"}</div>}
            </Link>
          );
        })}
      </div>

      {/* Siyahıdakı hər saat bu zonadadır. Yazılmasa rəqəm yalan danışır:
          xaricdən baxan onu öz saatı sanır. Gün zolağı da Bakı günləri ilə
          bölünür — «bu gün» gecə 04:00-da deyil, yarımgecədə dəyişir. */}
      <p className="text-[11px] text-foreground-muted">
        {locale === "az" ? "Bütün vaxtlar Bakı vaxtı ilə (UTC+4)." : "All times are Baku time (UTC+4)."}
      </p>
    </div>
  );
}
