/**
 * Player rating, computed from raw per-round numbers.
 *
 * Deliberately our own formula rather than a copied one: the raw inputs (kills
 * and deaths per round, damage per round) are facts about what happened, but the
 * single headline number every stats site shows is that site's own metric. We
 * compute ours the same way we compute team ratings — from the underlying
 * numbers — so it stays explainable and stays ours.
 *
 * No database and no framework imports, so scripts and pages can share it.
 */

/** Roughly the output of an average professional: ~1.0. */
const KILL_WEIGHT = 1.9;
const SURVIVAL_WEIGHT = 0.9;
const DAMAGE_WEIGHT = 0.006;

export type RawPlayerStats = {
  killsPerRound: number | null;
  deathsPerRound: number | null;
  damagePerRound: number | null;
};

/**
 * Weighted blend of output (kills), survival (the inverse of deaths) and
 * consistent damage. Returns null when there is nothing to compute from — an
 * unknown player scores nothing rather than a made-up zero.
 */
export function playerScore(stats: RawPlayerStats): number | null {
  const { killsPerRound: k, deathsPerRound: d, damagePerRound: adr } = stats;
  if (k == null && d == null && adr == null) return null;

  const kills = k ?? 0;
  const survival = 1 - (d ?? 0);
  const damage = adr ?? 0;

  const raw = kills * KILL_WEIGHT + survival * SURVIVAL_WEIGHT + damage * DAMAGE_WEIGHT;
  return Math.round(raw * 100) / 100;
}

/** Fraction of the bar to fill, relative to the best score on the page. */
export function scoreBarFraction(score: number, best: number) {
  if (best <= 0) return 0;
  return Math.max(0.08, Math.min(1, score / best));
}
