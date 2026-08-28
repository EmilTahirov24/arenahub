"use client";

import { useMemo, useState } from "react";
import { inputClass, labelClass, primaryButtonClass } from "@/components/admin/formStyles";
import type { Match, Team, Game, Tournament } from "@/app/generated/prisma/client";

const STATUSES = ["UPCOMING", "LIVE", "FINISHED", "POSTPONED", "CANCELLED"] as const;

function toLocalInputValue(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function MatchForm({
  match,
  games,
  teams,
  tournaments,
  action,
}: {
  match?: Match;
  games: Game[];
  teams: Team[];
  tournaments: Tournament[];
  action: (formData: FormData) => Promise<void>;
}) {
  const [gameId, setGameId] = useState(match?.gameId ?? "");

  const teamsForGame = useMemo(() => teams.filter((t) => !gameId || t.gameId === gameId), [teams, gameId]);
  const tournamentsForGame = useMemo(
    () => tournaments.filter((t) => !gameId || t.gameId === gameId),
    [tournaments, gameId],
  );

  return (
    <form action={action} className="max-w-lg space-y-4">
      <div>
        <label htmlFor="match-gameId" className={labelClass}>Oyun</label>
        <select
          id="match-gameId"
          name="gameId"
          required
          value={gameId}
          onChange={(e) => setGameId(e.target.value)}
          className={inputClass}
        >
          <option value="">Seçin</option>
          {games.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="match-tournamentId" className={labelClass}>Turnir (istəyə bağlı)</label>
        <select id="match-tournamentId" name="tournamentId" defaultValue={match?.tournamentId ?? ""} className={inputClass} disabled={!gameId}>
          <option value="">— yoxdur —</option>
          {tournamentsForGame.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        {!gameId && <p className="mt-1 text-xs text-foreground-muted">Əvvəlcə oyun seçin.</p>}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="match-teamAId" className={labelClass}>Komanda A</label>
          <select id="match-teamAId" name="teamAId" required defaultValue={match?.teamAId} className={inputClass} disabled={!gameId}>
            <option value="">Seçin</option>
            {teamsForGame.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="match-teamBId" className={labelClass}>Komanda B</label>
          <select id="match-teamBId" name="teamBId" required defaultValue={match?.teamBId} className={inputClass} disabled={!gameId}>
            <option value="">Seçin</option>
            {teamsForGame.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label htmlFor="match-scheduledAt" className={labelClass}>Tarix/vaxt</label>
        <input
          id="match-scheduledAt"
          name="scheduledAt"
          type="datetime-local"
          required
          defaultValue={match ? toLocalInputValue(match.scheduledAt) : ""}
          className={inputClass}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="match-bestOf" className={labelClass}>Best of</label>
          <select id="match-bestOf" name="bestOf" defaultValue={match?.bestOf ?? 3} className={inputClass}>
            {[1, 3, 5].map((n) => (
              <option key={n} value={n}>
                BO{n}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="match-starRating" className={labelClass}>Ulduz reytinqi</label>
          <select id="match-starRating" name="starRating" defaultValue={match?.starRating ?? 3} className={inputClass}>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label htmlFor="match-stage" className={labelClass}>Mərhələ</label>
        <input id="match-stage" name="stage" defaultValue={match?.stage ?? ""} className={inputClass} placeholder="Final, Semifinal..." />
      </div>
      <div>
        <label htmlFor="match-status" className={labelClass}>Status</label>
        <select id="match-status" name="status" defaultValue={match?.status ?? "UPCOMING"} className={inputClass}>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="match-streamUrl" className={labelClass}>Stream URL</label>
        <input id="match-streamUrl" name="streamUrl" defaultValue={match?.streamUrl ?? ""} className={inputClass} />
      </div>
      <button type="submit" className={primaryButtonClass}>
        Yadda saxla
      </button>
    </form>
  );
}
