import { cacheLife, cacheTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { AdPlacement } from "@/app/generated/prisma/client";

/**
 * Bir yer üçün göstəriləcək banner.
 *
 * Keşlənir, çünki AdSlot hər public səhifədədir: keşdən kənarda qalsa, tam statik
 * səhifə belə hər sorğuda bazaya bağlanır.
 *
 * Bunun bir nəticəsi var və qəsdən qəbul edilib: çəkiyə görə rotasiya artıq hər
 * SORĞUDA deyil, hər keş pəncərəsində bir dəfə baş verir. `new Date()` və
 * `Math.random()` prerender üçün qeyri-sabit dəyərlərdir — onları hər sorğuda
 * saxlamaq bütün səhifənin keşlənməsindən imtina etmək demək olardı. Bir neçə
 * bannerlik inventar üçün dəqiqədə bir dəfə fırlanmaq kifayətdir.
 */
export async function getAd(placement: AdPlacement) {
  "use cache";
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
