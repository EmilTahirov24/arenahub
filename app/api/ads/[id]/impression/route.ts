import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { rateLimit, clientIp } from "@/lib/rateLimit";

/**
 * Reklamın GÖRÜNMƏSİ (impression) sayğacı.
 *
 * Serverdə saymaq mümkün deyil və bu, qəsdən belədir. `getAd()` keşlənir
 * (`use cache: remote`), yəni render keşdən gəlir — orada saysaq, hər baxışı
 * yox, hər keş pəncərəsini sayardıq. Üstəlik hər səhifə render-ində bazaya
 * yazmaq keşləmə işinin bütün qazancını geri qaytarardı.
 *
 * Ona görə sayğac brauzerdən gəlir və bunun iki əlavə üstünlüyü var:
 *
 *   Yalnız həqiqətən EKRANDA görünən banner sayılır — səhifənin altında qalıb
 *   heç vaxt görünməyən reklam sayılmır. Reklamçıya deyilən rəqəm bu olmalıdır.
 *
 *   JavaScript işlətməyən crawler-lər sayğacı şişirtmir. Bot trafiki avtomatik
 *   kənarda qalır.
 *
 * Limit: eyni IP eyni banner üçün saatda 200. Adi adam bir saatda 30-40 səhifə
 * gəzə bilər və yan paneldəki banner hər dəfə düzgün sayılmalıdır, ona görə
 * hədd yüksəkdir — bu, dəqiq nəzarət yox, kobud sui-istifadə əleyhinə qoruyucudur.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const ip = clientIp(request.headers);
  if (ip && !rateLimit(`ad-view:${ip}:${id}`, 200, 60 * 60_000).ok) {
    return new NextResponse(null, { status: 204 });
  }

  // Olmayan id sadəcə nəzərə alınmır: bu marşrut cavab qaytarmır, ona görə
  // brauzerə səhv bildirməyin mənası yoxdur.
  await prisma.adBanner
    .update({ where: { id }, data: { impressions: { increment: 1 } } })
    .catch(() => {});

  return new NextResponse(null, { status: 204 });
}
