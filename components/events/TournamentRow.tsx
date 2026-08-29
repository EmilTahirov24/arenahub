import { getLocale } from "next-intl/server";
import Image from "next/image";
import { Link } from "@/i18n/navigation";
import GameChip from "@/components/common/GameChip";
import type { Game, Tournament } from "@/app/generated/prisma/client";
import { siteFormat } from "@/lib/dates";

/** Tier badge colours: gold for the majors, down to grey for the smallest. */
export const TIER_COLOR: Record<string, string> = { S: "#facc15", A: "#22d3ee", B: "#a3a3a3", C: "#78716c" };

const STATUS_LABEL: Record<string, { az: string; en: string }> = {
  UPCOMING: { az: "Qarşıda", en: "Upcoming" },
  ONGOING: { az: "Davam edir", en: "Ongoing" },
  FINISHED: { az: "Bitib", en: "Finished" },
};

/**
 * One tournament as a single row. Lifted out of the events page so the home
 * page can show the same thing rather than inventing a second look for it.
 */
export default async function TournamentRow({ tournament }: { tournament: Tournament & { game: Game } }) {
  const locale = await getLocale();
  const dateFmt = siteFormat(locale, { day: "2-digit", month: "short" });
  const status = STATUS_LABEL[tournament.status];

  return (
    <Link
      href={`/events/${tournament.slug}`}
      className="flex items-center gap-3 rounded-lg border border-border-subtle bg-surface p-4 hover:bg-surface-raised"
    >
      {/* Loqo admin paneldən yüklənirdi və heç yerdə göstərilmirdi. Səviyyə
          nişanı yerində qalır — o, rənglə birlikdə turnirin çəkisini bildirir və
          loqo onu əvəz etmir. Loqo yoxdursa sətir tam əvvəlki kimi görünür. */}
      {tournament.logoUrl && (
        <Image
          src={tournament.logoUrl}
          alt=""
          width={32}
          height={32}
          unoptimized
          className="h-8 w-8 shrink-0 rounded-md object-contain"
        />
      )}
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md font-display text-sm font-bold"
        style={{ color: TIER_COLOR[tournament.tier], backgroundColor: `${TIER_COLOR[tournament.tier]}1a` }}
      >
        {tournament.tier}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <GameChip name={tournament.game.shortName} color={tournament.game.accentColor} />
          <span className="text-xs text-foreground-muted">{locale === "az" ? status?.az : status?.en}</span>
        </div>
        <div className="truncate font-medium">{tournament.name}</div>
        <div className="text-xs text-foreground-muted">
          {dateFmt.format(tournament.startDate)} – {dateFmt.format(tournament.endDate)}
          {tournament.location ? ` · ${tournament.location}` : ""}
        </div>
      </div>
      {tournament.prizePool && (
        <span className="shrink-0 text-sm font-semibold text-brand-via-fg">{tournament.prizePool}</span>
      )}
    </Link>
  );
}
