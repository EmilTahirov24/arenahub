import "server-only";
import { prisma } from "@/lib/prisma";

export const PREDICTION_POINTS = 10;

export async function awardPredictionPoints(matchId: string, winnerId: string) {
  await prisma.fan.updateMany({
    where: { predictions: { some: { matchId, predictedWinnerId: winnerId } } },
    data: { points: { increment: PREDICTION_POINTS } },
  });
}
