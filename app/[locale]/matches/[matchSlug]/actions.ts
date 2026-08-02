"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getFanSession } from "@/lib/auth";

export async function submitPrediction(matchId: string, teamId: string, matchSlug: string) {
  const session = await getFanSession();
  if (!session) throw new Error("Unauthorized");

  const match = await prisma.match.findUniqueOrThrow({ where: { id: matchId } });
  if (match.status !== "UPCOMING") {
    return;
  }
  if (teamId !== match.teamAId && teamId !== match.teamBId) {
    return;
  }

  await prisma.matchPrediction.upsert({
    where: { matchId_fanId: { matchId, fanId: session.id } },
    update: { predictedWinnerId: teamId },
    create: { matchId, fanId: session.id, predictedWinnerId: teamId },
  });

  revalidatePath(`/[locale]/matches/${matchSlug}`, "page");
}
