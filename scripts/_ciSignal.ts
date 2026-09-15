import fs from "node:fs";

/**
 * The "the ratings are stale" signal to CI.
 *
 * The workflow runs the rating recomputation only when this signal arrives.
 * The reason was measured: `recompute-ratings.ts` replays the Elo history of
 * every finished match and takes 28-58% of the run - 108 and 278 seconds on
 * two consecutive runs. It only grows as the match count does. If the import
 * wrote nothing, the ratings cannot have changed, so that time is pure waste.
 *
 * NOTE: the counter is NOT the number of rows written. It was in the first
 * version, and that was wrong: the ticket returns about 260 matches on every
 * run and all of them are rewritten, so the signal always fired and the saving
 * never happened. Only changes that affect a rating are counted now - a match's
 * status or its winner.
 *
 * Without `GITHUB_OUTPUT` the function does nothing, so a local run is
 * unaffected. It belongs to the scripts and is deliberately not in `lib/`: the
 * Next application imports from there, and a CI detail has no place in it.
 */
export function signalRatingsStale(changed: number): void {
  const out = process.env.GITHUB_OUTPUT;
  if (!out || changed <= 0) return;
  fs.appendFileSync(out, "ratings_stale=true\n");
}
