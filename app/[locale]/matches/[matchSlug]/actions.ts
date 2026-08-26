"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getPlayerSession } from "@/lib/auth";
import { routing } from "@/i18n/routing";

export async function submitPrediction(matchId: string, teamId: string, matchSlug: string) {
  const session = await getPlayerSession();
  // Sessiyanın bitməsi adi haldır, proqramçı səhvi deyil — bu vidcetin mesaj
  // göstərəcək yeri olmadığı üçün adamı girişə göndəririk, xəta səhifəsinə yox.
  if (!session) redirect("/player/login");

  const match = await prisma.match.findUniqueOrThrow({ where: { id: matchId } });
  if (match.status !== "UPCOMING") {
    return;
  }
  if (teamId !== match.teamAId && teamId !== match.teamBId) {
    return;
  }

  await prisma.matchPrediction.upsert({
    where: { matchId_playerId: { matchId, playerId: session.id } },
    update: { predictedWinnerId: teamId },
    create: { matchId, playerId: session.id, predictedWinnerId: teamId },
  });

  // Əvvəl burada `/[locale]/matches/${matchSlug}` yazılmışdı — hərfi `[locale]`
  // ilə həll olunmuş slug qarışdırılmışdı və belə marşrut olmadığı üçün çağırış
  // boşa gedirdi. Hər dilin öz həqiqi yolu ayrıca göstərilir.
  for (const locale of routing.locales) {
    revalidatePath(`/${locale}/matches/${matchSlug}`);
  }
}
