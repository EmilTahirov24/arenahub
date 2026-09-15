import { cacheLife, cacheTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { AdPlacement } from "@/app/generated/prisma/client";

/**
 * The banner to show in one slot.
 *
 * Cached, because AdSlot sits on every public page: left outside the cache,
 * even a fully static page is tied to the database on every request.
 *
 * That has one consequence, accepted deliberately: the weighted rotation now
 * happens once per cache window rather than once per REQUEST. `new Date()`
 * and `Math.random()` are unstable values as far as prerendering is concerned
 * - keeping them per-request would mean giving up caching the whole page. For
 * an inventory of a few banners, rotating once a minute is enough.
 */
export async function getAd(placement: AdPlacement) {
  "use cache: remote";
  cacheLife("minutes");
  cacheTag("ads");

  const now = new Date();
  const candidates = await prisma.adBanner.findMany({
    where: {
      placement,
      isActive: true,
      startDate: { lte: now },
      OR: [{ endDate: null }, { endDate: { gte: now } }],
    },
  });
  if (candidates.length === 0) return null;

  const totalWeight = candidates.reduce((sum, ad) => sum + ad.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const ad of candidates) {
    roll -= ad.weight;
    if (roll <= 0) return ad;
  }
  return candidates[0];
}
