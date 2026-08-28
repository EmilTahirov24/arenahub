import { getTranslations, getLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import TeamAvatar from "@/components/common/TeamAvatar";
import StarRating from "@/components/common/StarRating";
import CountryFlag from "@/components/common/CountryFlag";
import type { Match, Team, Tournament } from "@/app/generated/prisma/client";

type MatchCardProps = {
  match: Match & {
    teamA: Team;
    teamB: Team;
    tournament: Tournament | null;
  };
  /**
   * Turnir adının kartda göstərilib-göstərilməməsi.
   *
   * MatchGroup adı onsuz da qrupun başlığında yazır, kart isə həmin adı hər
   * sətirdə təkrar edirdi — bir qrupda dörd matç varsa, eyni uzun ad beş dəfə
   * görünürdü. Ana səhifə kimi qruplaşdırma olmayan yerlərdə isə ad lazımdır,
   * ona görə defolt true qalır.
   */
  showTournament?: boolean;
};

export default async function MatchCard({ match, showTournament = true }: MatchCardProps) {
  const t = await getTranslations();
  const locale = await getLocale();
  const isLive = match.status === "LIVE";
  const isFinished = match.status === "FINISHED";
  const isUpcoming = match.status === "UPCOMING";

  const time = new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }).format(match.scheduledAt);

  return (
    <Link
      href={`/matches/${match.slug}`}
      /* min-w-0: as a grid/flex item this card defaults to min-width:auto, and
         the nowrap text inside makes that minimum the full untruncated string,
         which pushed the card past the viewport on narrow screens. */
      className={`block min-w-0 rounded-lg border bg-surface p-3 transition-colors hover:bg-surface-raised ${
        isLive ? "border-live/50" : "border-border-subtle"
      }`}
    >
      {/* Meta sətri yalnız DOLU olanda çəkilir. Ulduz artıq defolt qiymətdə
          heç nə qaytarmır və qrupun içində turnir adı da gizlədilir — ikisi də
          boş olanda sətir tamamilə lazımsızdır və kart bir az nəfəs alır. */}
      {(showTournament || match.stage || match.starRating > 1) && (
        <div className="mb-2 flex items-center justify-between gap-2 text-xs text-foreground-muted">
          <span className="min-w-0 truncate">
            {showTournament ? (match.tournament?.name ?? t("nav.matches")) : ""}
          </span>
          <span className="flex shrink-0 items-center gap-2">
            {match.stage && <span>{match.stage}</span>}
            <StarRating value={match.starRating} />
          </span>
        </div>
      )}

      <div className="flex items-center gap-2">
        <div className="flex flex-1 items-center gap-1.5 overflow-hidden">
          <TeamAvatar name={match.teamA.name} logoUrl={match.teamA.logoUrl} color={match.teamA.primaryColor} size={28} />
          <CountryFlag code={match.teamA.country} />
          <span
            className={`truncate text-sm ${
              isFinished && match.winnerId === match.teamAId ? "font-semibold text-foreground" : "text-foreground-muted"
            }`}
          >
            {match.teamA.name}
          </span>
        </div>

        {/* Fixed width so the time/score column lands at the same x on every
            card — otherwise varying team-name lengths make the list unscannable. */}
        <div className="flex w-14 shrink-0 flex-col items-center gap-1">
          {isUpcoming ? (
            <span className="font-display tabular-nums text-sm font-semibold">{time}</span>
          ) : (
            <span className="font-display tabular-nums text-base font-bold">
              {match.teamAScore} : {match.teamBScore}
            </span>
          )}
          {isLive ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-live/15 px-2 py-0.5 text-[10px] font-bold text-live">
              <span className="h-1.5 w-1.5 animate-glow-pulse rounded-full bg-live" />
              {t("nav.live")}
            </span>
          ) : (
            <span className="text-[10px] uppercase text-foreground-muted">BO{match.bestOf}</span>
          )}
        </div>

        <div className="flex flex-1 items-center justify-end gap-2 overflow-hidden">
          <span
            className={`truncate text-right text-sm ${
              isFinished && match.winnerId === match.teamBId ? "font-semibold text-foreground" : "text-foreground-muted"
            }`}
          >
            {match.teamB.name}
          </span>
          <CountryFlag code={match.teamB.country} />
          <TeamAvatar name={match.teamB.name} logoUrl={match.teamB.logoUrl} color={match.teamB.primaryColor} size={28} />
        </div>
      </div>
    </Link>
  );
}
