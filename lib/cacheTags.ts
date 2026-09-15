import { revalidatePath, updateTag } from "next/cache";

/** The tags on the cached queries - see lib/cachedQueries.ts. */
export const CONTENT_TAGS = ["games", "teams", "players", "matches", "tournaments", "news", "ads"] as const;

/**
 * Public content changed: clears the route cache and the cached queries both.
 *
 * There are two separate mechanisms, and not knowing that leads to a silent
 * bug: `revalidatePath` is for the ROUTE cache and does not touch QUERIES
 * cached with `use cache`. Call only one and the change lands in the database
 * but never shows on the site.
 *
 * `updateTag` (not revalidateTag) is deliberate: it treats the cache as
 * expired immediately, so the next request waits for fresh data. An admin has
 * to see their own change at once - the same reasoning as the rule in
 * AGENTS.md.
 *
 * The tags are taken broadly. Picking precisely is possible, but across 14
 * separate action files the risk of getting it half right outweighs the gain;
 * admin actions are rare, and over-invalidating costs a few repeat queries.
 */
export function revalidatePublicContent() {
  revalidatePath("/[locale]", "layout");
  for (const tag of CONTENT_TAGS) updateTag(tag);
}
