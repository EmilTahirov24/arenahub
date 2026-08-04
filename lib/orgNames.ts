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
 * An index from normalised name to team, with collisions removed.
 *
 * When two teams in the same game share a key — a real possibility, since
 * "Legacy" and "Legacy Esports" are different organisations — neither is
 * returned, so one can never quietly absorb the other's matches. The dropped
 * keys are handed back so the caller can report them instead of hiding them.
 */
export function indexByOrg<T extends { name: string }>(teams: T[]): {
  index: Map<string, T>;
  ambiguous: string[];
} {
  const seen = new Map<string, T | null>();
  for (const team of teams) {
    const key = orgKey(team.name);
    if (!key) continue;
    seen.set(key, seen.has(key) ? null : team);
  }

  const index = new Map<string, T>();
  const ambiguous: string[] = [];
  for (const [key, team] of seen) {
    if (team) index.set(key, team);
    else ambiguous.push(key);
  }
  return { index, ambiguous };
}
