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
};

export default async function MatchCard({ match }: MatchCardProps) {
  const t = await getTranslations();
  const locale = await getLocale();
  const isLive = match.status === "LIVE";
  const isFinished = match.status === "FINISHED";
  const isUpcoming = match.status === "UPCOMING";

  const time = new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }).format(match.scheduledAt);

  return (
    <Link
      href={`/matches/${match.slug}`}
      className={`block rounded-lg border bg-surface p-3 transition-colors hover:bg-surface-raised ${
        isLive ? "border-live/50" : "border-border-subtle"
      }`}
    >
      <div className="mb-2 flex items-center justify-between text-xs text-foreground-muted">
        <span className="truncate">{match.tournament?.name ?? t("nav.matches")}</span>
        {match.stage && <span className="ml-2 shrink-0">{match.stage}</span>}
      </div>

      <div className="flex items-center gap-3">
        <div className="flex flex-1 items-center gap-2">
          <TeamAvatar name={match.teamA.name} logoUrl={match.teamA.logoUrl} color={match.teamA.primaryColor} size={28} />
          <CountryFlag code={match.teamA.country} />
          <span
            className={`truncate text-sm ${
              isFinished && match.winnerId === match.teamAId ? "font-semibold text-foreground" : "text-foreground-muted"
            } ${isFinished && match.winnerId === match.teamAId ? "" : ""}`}
          >
            {match.teamA.name}
          </span>
        </div>

        <div className="flex shrink-0 flex-col items-center gap-1">
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

        <div className="flex flex-1 items-center justify-end gap-2">
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

      <div className="mt-2 flex justify-end">
        <StarRating value={match.starRating} />
      </div>
    </Link>
  );
}
