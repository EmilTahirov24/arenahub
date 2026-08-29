import Link from "next/link";
import CountryFlag from "@/components/common/CountryFlag";
import { submitPrediction } from "@/app/[locale]/matches/[matchSlug]/actions";

type Team = { id: string; name: string; country: string | null };

export default function PredictionWidget({
  matchId,
  matchSlug,
  status,
  teamA,
  teamB,
  winnerId,
  isLoggedIn,
  myPick,
  teamACount,
  teamBCount,
  locale,
}: {
  matchId: string;
  matchSlug: string;
  status: string;
  teamA: Team;
  teamB: Team;
  winnerId: string | null;
  isLoggedIn: boolean;
  myPick: string | null;
  teamACount: number;
  teamBCount: number;
  locale: string;
}) {
  const isAz = locale === "az";
  const total = teamACount + teamBCount;
  const pctA = total > 0 ? Math.round((teamACount / total) * 100) : 0;
  const pctB = total > 0 ? 100 - pctA : 0;
  const canPick = status === "UPCOMING";

  if (canPick) {
    if (!isLoggedIn) {
      return (
        <div className="mt-6 rounded-lg border border-border-subtle bg-surface p-4 text-center text-sm text-foreground-muted">
          {isAz ? "Matç proqnozu vermək üçün " : "To predict this match, "}
          <Link href="/player/login" className="text-brand-via-fg hover:underline">
            {isAz ? "daxil olun" : "log in"}
          </Link>
          .
        </div>
      );
    }

    return (
      <div className="mt-6 rounded-lg border border-border-subtle bg-surface p-4">
        <h3 className="mb-3 text-center text-sm font-semibold text-foreground-muted">
          {isAz ? "Kim udacaq?" : "Who will win?"}
        </h3>
        <div className="grid grid-cols-2 gap-3">
          {[teamA, teamB].map((team) => (
            <form key={team.id} action={submitPrediction.bind(null, matchId, team.id, matchSlug)}>
              <button
                type="submit"
                className={`flex w-full items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                  myPick === team.id
                    ? "border-brand-via bg-brand-via/15 text-foreground"
                    : "border-border-subtle text-foreground-muted hover:bg-surface-raised"
                }`}
              >
                <CountryFlag code={team.country} size={14} />
                {team.name}
                {myPick === team.id && <span className="text-brand-via-fg">✓</span>}
              </button>
            </form>
          ))}
        </div>
        <LeaderboardLink locale={locale} isAz={isAz} />
      </div>
    );
  }

  return (
    <div className="mt-6 rounded-lg border border-border-subtle bg-surface p-4">
      <h3 className="mb-3 text-center text-sm font-semibold text-foreground-muted">
        {isAz ? "İzləyici proqnozu" : "Fan predictions"}
      </h3>
      {total === 0 ? (
        <p className="text-center text-xs text-foreground-muted">
          {isAz ? "Bu matç üçün hələ proqnoz verilməyib." : "No predictions yet for this match."}
        </p>
      ) : (
        <>
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="flex items-center gap-1">
              <CountryFlag code={teamA.country} size={12} /> {teamA.name} {pctA}%
            </span>
            <span className="flex items-center gap-1">
              {pctB}% {teamB.name} <CountryFlag code={teamB.country} size={12} />
            </span>
          </div>
          <div className="flex h-2 overflow-hidden rounded-full bg-surface-raised">
            <div className="h-full bg-brand-via" style={{ width: `${pctA}%` }} />
            <div className="h-full bg-brand-to" style={{ width: `${pctB}%` }} />
          </div>
        </>
      )}
      {!isLoggedIn && (
        <p className="mt-3 text-center text-xs text-foreground-muted">
          <Link href="/player/login" className="text-brand-via-fg hover:underline">
            {isAz ? "Daxil olun" : "Log in"}
          </Link>{" "}
          {isAz ? "və öz proqnozunuzu izləyin." : "to track your own picks."}
        </p>
      )}
      {isLoggedIn && myPick && status === "FINISHED" && (
        <p
          className={`mt-3 text-center text-xs font-semibold ${
            myPick === winnerId ? "text-positive" : "text-live"
          }`}
        >
          {myPick === winnerId
            ? isAz
              ? "Proqnozunuz doğru çıxdı! ✓"
              : "Your prediction was correct! ✓"
            : isAz
              ? "Proqnozunuz səhv çıxdı ✗"
              : "Your prediction was wrong ✗"}
        </p>
      )}
      <LeaderboardLink locale={locale} isAz={isAz} />
    </div>
  );
}

/**
 * Lider cədvəlinin yeganə giriş nöqtəsi.
 *
 * `/[locale]/predictions` səhifəsi tərcüməsi və sitemap qeydi ilə birlikdə hazır
 * idi, amma nə menyuda, nə də başqa yerdə linki vardı — yalnız ünvanı əl ilə
 * yazmaqla açılırdı. Menyu xl-də onsuz da doludur, ona görə link proqnozun özünə,
 * yəni adamın onunla maraqlandığı yerə qoyulub.
 */
function LeaderboardLink({ locale, isAz }: { locale: string; isAz: boolean }) {
  return (
    <p className="mt-3 text-center text-xs">
      <Link href={`/${locale}/predictions`} className="text-brand-via-fg hover:underline">
        {isAz ? "Lider Cədvəli →" : "Leaderboard →"}
      </Link>
    </p>
  );
}
