"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getPlayerSession } from "@/lib/auth";
import { routing } from "@/i18n/routing";

export async function submitPrediction(matchId: string, teamId: string, matchSlug: string) {
  const session = await getPlayerSession();
  // A session running out is ordinary, not a programmer error - and since this
  // widget has nowhere to show a message, the person goes to sign-in rather
  // than to an error page.
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

  // This used to read `/[locale]/matches/${matchSlug}` - a literal `[locale]`
  // mixed with a resolved slug. No such route exists, so the call did nothing.
  // Each language's real path is named separately.
  for (const locale of routing.locales) {
    revalidatePath(`/${locale}/matches/${matchSlug}`);
  }
}
