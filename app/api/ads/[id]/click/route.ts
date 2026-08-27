import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { rateLimit, clientIp } from "@/lib/rateLimit";

/**
 * Reklam kliki: sayğacı artırır və reklamçının ünvanına yönləndirir.
 *
 * Klik niyə server tərəfdən keçir: banner-in üstündəki linkə birbaşa basanda
 * biz heç nə bilmirik — istifadəçi saytdan çıxıb gedir və hadisə itir.
 * Aradakı bu marşrut isə həm sayır, həm də yönləndirir.
 *
 * Bu AÇIQ YÖNLƏNDİRMƏ (open redirect) deyil: hədəf sorğudan gəlmir, bazadakı
 * reklam sətrindən oxunur. Kənar adamın edə biləcəyi yeganə şey mövcud reklam
 * id-lərindən birini seçməkdir. Buna baxmayaraq protokol yoxlanılır — panelə
 * girişi olan redaktorun səhvən (və ya hesabı ələ keçirilibsə qəsdən)
 * `javascript:` yazması bu yoxlama olmadan bizim domenimizdən keçən hücuma
 * çevrilərdi.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? request.nextUrl.origin;

  const ad = await prisma.adBanner.findUnique({ where: { id }, select: { linkUrl: true } });
  if (!ad) return NextResponse.redirect(base);

  let target: URL;
  try {
    target = new URL(ad.linkUrl);
  } catch {
    return NextResponse.redirect(base);
  }
  if (target.protocol !== "http:" && target.protocol !== "https:") {
    return NextResponse.redirect(base);
  }

  // Sayğac yönləndirməni gözlətməməlidir: adam reklamçının saytına getməlidir,
  // bizim yazımızı gözləməməlidir. Səhv olsa da yönləndirmə baş verir — itmiş
  // bir klik, dayanmış keçiddən yaxşıdır.
  const ip = clientIp(request.headers);
  const allowed = !ip || rateLimit(`ad-click:${ip}:${id}`, 20, 60 * 60_000).ok;
  if (allowed) {
    prisma.adBanner
      .update({ where: { id }, data: { clicks: { increment: 1 } } })
      .catch(() => {});
  }

  return NextResponse.redirect(target.toString());
}
