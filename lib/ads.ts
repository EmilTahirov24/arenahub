import { prisma } from "@/lib/prisma";
import type { AdPlacement } from "@/app/generated/prisma/client";

export async function getAd(placement: AdPlacement) {
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
