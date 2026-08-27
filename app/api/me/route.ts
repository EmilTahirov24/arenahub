import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPlayerSession } from "@/lib/auth";

/**
 * Header-in hesab menyusu üçün cari oyunçu.
 *
 * Bu marşrut ona görə var ki, Header-in özü sessiyanı oxumasın. `cookies()`
 * oxumaq marşrutu dinamik edir və Header hər səhifədə render olunduğu üçün
 * bütün public sayt keşlənə bilməz hala düşürdü — hər ziyarətçi və hər crawler
 * bazaya gedirdi. Sessiya buraya köçürüldükdən sonra səhifələr keşlənir, bu
 * kiçik sorğu isə keşdən kənarda qalır.
 *
 * Yalnız görünüşə lazım olan sahələr qaytarılır — e-poçt, xal və qalanı yox,
 * çünki bu cavab hər səhifə yüklənişində alınır. `slug` və `ownedTeamSlug`
 * oyunçu və komanda səhifələrindəki "Redaktə et" linki üçündür: onlar da eyni
 * səbəbdən sessiyanı serverdə oxumağı dayandırdı.
 */
export async function GET() {
  const session = await getPlayerSession();
  if (!session) {
    return NextResponse.json({ player: null }, { headers: { "Cache-Control": "no-store" } });
  }

  const player = await prisma.player.findUnique({
    where: { id: session.id },
    select: {
      nickname: true,
      photoUrl: true,
      slug: true,
      ownedTeams: { select: { slug: true }, take: 1 },
    },
  });

  const body = player
    ? {
        nickname: player.nickname,
        photoUrl: player.photoUrl,
        slug: player.slug,
        ownedTeamSlug: player.ownedTeams[0]?.slug ?? null,
      }
    : null;

  return NextResponse.json({ player: body }, { headers: { "Cache-Control": "no-store" } });
}
