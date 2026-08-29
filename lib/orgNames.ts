/**
 * Matching organisation names that are written differently in different places.
 *
 * Liquipedia titles its pages with the full legal name ("Lynn Vision Gaming",
 * "Team Vitality") while the site stores the name people actually use ("Lynn
 * Vision", "Vitality"). Exact comparison therefore misses teams we do have —
 * and an importer that misses a team silently drops real results.
 *
 * No database or framework imports, so scripts can use it directly.
 */

/**
 * A team name reduced to the part that identifies the organisation.
 *
 * Only the fixed decorative words below are removed; two names must still
 * agree exactly afterwards. This is deliberately a normalisation rather than
 * fuzzy or partial matching — anything looser would eventually file a real
 * match result under the wrong organisation.
 */
export function orgKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(team|esports?|esport|gaming|club|academy|the)\b/g, "")
    .replace(/[^a-z0-9]/g, "");
}

/**
 * An index from normalised name to team, with genuine collisions removed.
 *
 * When two teams in the same game share a key — a real possibility, since
 * "Legacy" and "Legacy Esports" are different organisations — neither is
 * returned, so one can never quietly absorb the other's matches. The dropped
 * keys are handed back so the caller can report them instead of hiding them.
 *
 * Rows that share a key AND the identical name are the exception, and leaving
 * them out was a bug with teeth. Measured in production on 2026-08-29: "WW
 * TEAM" existed 42 times in CS2, and the count was a function of how often the
 * importer had run.
 *
 * The loop is self-feeding. `orgKey("WW TEAM")` drops the word "team" and
 * yields "ww"; two rows with that key made it ambiguous; ambiguous keys left
 * the index; so the next import looked the name up, missed, and created row
 * 43 — which made the key no less ambiguous. Once a name entered this state it
 * could never leave, and every pass added one more.
 *
 * Identical names are not the case the guard was written for. "Legacy" and
 * "Legacy Esports" are two organisations that normalise together; "WW TEAM"
 * and "WW TEAM" are one organisation stored twice. Absorbing the second into
 * the first is the correct answer, not a risk — so those keys resolve, to the
 * first row given.
 *
 * That makes input order significant: callers should pass teams oldest-first,
 * so the original row wins and matches accumulate on it rather than migrating.
 */
export function indexByOrg<T extends { name: string }>(teams: T[]): {
  index: Map<string, T>;
  ambiguous: string[];
} {
  const grouped = new Map<string, T[]>();
  for (const team of teams) {
    const key = orgKey(team.name);
    if (!key) continue;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(team);
  }

  const index = new Map<string, T>();
  const ambiguous: string[] = [];
  for (const [key, rows] of grouped) {
    const distinct = new Set(rows.map((r) => r.name.trim().toLowerCase()));
    if (distinct.size === 1) index.set(key, rows[0]);
    else ambiguous.push(key);
  }
  return { index, ambiguous };
}
