import { Link } from "@/i18n/navigation";
import GameChip from "@/components/common/GameChip";
import MatchCard from "@/components/matches/MatchCard";
import type { Match, Team, Tournament, Game } from "@/app/generated/prisma/client";

type GroupMatch = Match & { teamA: Team; teamB: Team; tournament: (Tournament & { game: Game }) | null };

export default function MatchGroup({
  tournament,
  matches,
}: {
  tournament: (Tournament & { game: Game }) | null;
  matches: GroupMatch[];
}) {
  return (
    <div className="mb-6 overflow-hidden rounded-lg border border-border-subtle">
      <div className="flex items-center gap-2 bg-surface-raised px-3 py-2">
        {tournament ? (
          <>
            <GameChip name={tournament.game.shortName} color={tournament.game.accentColor} />
            <Link href={`/events/${tournament.slug}`} className="text-sm font-semibold hover:underline">
              {tournament.name}
            </Link>
          </>
        ) : (
          <span className="text-sm font-semibold text-foreground-muted">—</span>
        )}
      </div>
      <div className="space-y-2 bg-background p-2">
        {matches.map((match) => (
          // Ad qrupun başlığındadır; kartda təkrarı yalnız səs-küydür.
          <MatchCard key={match.id} match={match} showTournament={false} />
        ))}
      </div>
    </div>
  );
}
