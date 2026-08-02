import { Link } from "@/i18n/navigation";
import TeamAvatar from "@/components/common/TeamAvatar";
import type { Match, Team } from "@/app/generated/prisma/client";

type BracketMatch = Match & { teamA: Team; teamB: Team };

const STAGE_ORDER = ["Round of 16", "Quarterfinal", "Semifinal", "3rd Place Decider", "Final"];

function stageRank(stage: string | null) {
  const idx = STAGE_ORDER.findIndex((s) => s.toLowerCase() === (stage ?? "").toLowerCase());
  return idx === -1 ? STAGE_ORDER.length : idx;
}

function BracketSlot({ match }: { match: BracketMatch }) {
  const isFinished = match.status === "FINISHED";
  const isLive = match.status === "LIVE";
  const aWon = isFinished && match.winnerId === match.teamAId;
  const bWon = isFinished && match.winnerId === match.teamBId;

  return (
    <Link
      href={`/matches/${match.slug}`}
      className={`block w-56 shrink-0 rounded-lg border bg-surface transition-colors hover:bg-surface-raised ${
        isLive ? "border-live/50" : "border-border-subtle"
      }`}
    >
      {[
        { team: match.teamA, score: match.teamAScore, won: aWon },
        { team: match.teamB, score: match.teamBScore, won: bWon },
      ].map(({ team, score, won }, i) => (
        <div
          key={team.id}
          className={`flex items-center gap-2 px-2 py-1.5 ${i === 0 ? "border-b border-border-subtle" : ""} ${
            won ? "bg-brand-via/10" : ""
          }`}
        >
          <TeamAvatar name={team.name} logoUrl={team.logoUrl} color={team.primaryColor} size={20} />
          <span className={`min-w-0 flex-1 truncate text-xs ${won ? "font-semibold text-foreground" : "text-foreground-muted"}`}>
            {team.name}
          </span>
          <span className="font-display shrink-0 text-xs font-bold tabular-nums">{isFinished || isLive ? score : ""}</span>
        </div>
      ))}
    </Link>
  );
}

export default function Bracket({ matches }: { matches: BracketMatch[] }) {
  const columns = new Map<string, BracketMatch[]>();
  for (const match of matches) {
    const stage = match.stage ?? "—";
    const arr = columns.get(stage) ?? [];
    arr.push(match);
    columns.set(stage, arr);
  }

  const sortedStages = Array.from(columns.keys()).sort((a, b) => stageRank(a) - stageRank(b));

  return (
    <div className="flex gap-6 overflow-x-auto pb-4">
      {sortedStages.map((stage) => (
        <div key={stage} className="flex shrink-0 flex-col gap-4">
          <h3 className="font-display text-center text-xs font-bold uppercase tracking-wide text-foreground-muted">{stage}</h3>
          <div className="flex flex-1 flex-col justify-around gap-6">
            {columns.get(stage)!.map((match) => (
              <BracketSlot key={match.id} match={match} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
