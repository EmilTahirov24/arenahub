import "server-only";
import { prisma } from "@/lib/prisma";
import { getPlayerSession } from "@/lib/auth";

export const PREDICTION_POINTS = 10;

export async function getMyPrediction(matchId: string) {
  const session = await getPlayerSession();
  if (!session) return null;
  return prisma.matchPrediction.findUnique({ where: { matchId_playerId: { matchId, playerId: session.id } } });
}

export async function awardPredictionPoints(matchId: string, winnerId: string) {
  await prisma.player.updateMany({
    where: { predictions: { some: { matchId, predictedWinnerId: winnerId } } },
    data: { points: { increment: PREDICTION_POINTS } },
  });
}
