"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth";
import { awardPredictionPoints } from "@/lib/predictions";
import type { MatchStatus, MapStatus, VetoAction } from "@/app/generated/prisma/client";

async function requireAdmin() {
  const session = await getAdminSession();
  if (!session) throw new Error("Unauthorized");
}

async function recomputeMatchScore(matchId: string) {
  const match = await prisma.match.findUniqueOrThrow({ where: { id: matchId } });
  const maps = await prisma.matchMap.findMany({ where: { matchId, status: "FINISHED" } });
  const teamAScore = maps.filter((m) => m.winnerId === match.teamAId).length;
  const teamBScore = maps.filter((m) => m.winnerId === match.teamBId).length;
  const majority = Math.ceil(match.bestOf / 2);

  const data: { teamAScore: number; teamBScore: number; status?: MatchStatus; winnerId?: string } = {
    teamAScore,
    teamBScore,
  };
  const justFinished = match.status !== "FINISHED" && (teamAScore >= majority || teamBScore >= majority);
  if (justFinished) {
    data.status = "FINISHED";
    data.winnerId = teamAScore >= majority ? match.teamAId : match.teamBId;
  }
  await prisma.match.update({ where: { id: matchId }, data });
  if (justFinished && data.winnerId) {
    await awardPredictionPoints(matchId, data.winnerId);
  }
}

function revalidateMatch(matchId: string) {
  revalidatePath(`/admin/matches/${matchId}/live`);
  revalidatePath("/admin/matches");
  revalidatePath("/[locale]", "layout");
}

export async function setMatchStatus(matchId: string, formData: FormData) {
  await requireAdmin();
  const status = String(formData.get("status") ?? "") as MatchStatus;
  const match = await prisma.match.findUniqueOrThrow({ where: { id: matchId } });

  const data: { status: MatchStatus; winnerId?: string | null } = { status };
  if (status === "FINISHED" && !match.winnerId) {
    data.winnerId = match.teamAScore >= match.teamBScore ? match.teamAId : match.teamBId;
  }
  if (status !== "FINISHED") {
    data.winnerId = null;
  }
  const wasFinished = match.status === "FINISHED";
  await prisma.match.update({ where: { id: matchId }, data });
  revalidateMatch(matchId);

  if (!wasFinished && status === "FINISHED") {
    const winnerId = data.winnerId ?? match.winnerId;
    if (winnerId) await awardPredictionPoints(matchId, winnerId);
  }
}

export async function upsertMap(matchId: string, formData: FormData) {
  await requireAdmin();
  const mapId = String(formData.get("mapId") ?? "") || null;
  const teamAScore = Number(formData.get("teamAScore") ?? 0);
  const teamBScore = Number(formData.get("teamBScore") ?? 0);
  const status = String(formData.get("status") ?? "LIVE") as MapStatus;
  const mapName = String(formData.get("mapName") ?? "");

  const match = await prisma.match.findUniqueOrThrow({ where: { id: matchId } });
  let winnerId: string | null = null;
  if (status === "FINISHED") {
    winnerId = teamAScore >= teamBScore ? match.teamAId : match.teamBId;
  }

  if (mapId) {
    await prisma.matchMap.update({ where: { id: mapId }, data: { mapName, teamAScore, teamBScore, status, winnerId } });
  } else {
    const count = await prisma.matchMap.count({ where: { matchId } });
    await prisma.matchMap.create({
      data: { matchId, mapOrder: count + 1, mapName, teamAScore, teamBScore, status, winnerId },
    });
  }

  await recomputeMatchScore(matchId);
  revalidateMatch(matchId);
}

export async function deleteMap(matchId: string, mapId: string) {
  await requireAdmin();
  await prisma.matchMap.delete({ where: { id: mapId } });
  await recomputeMatchScore(matchId);
  revalidateMatch(matchId);
}

export async function addVetoStep(matchId: string, formData: FormData) {
  await requireAdmin();
  const teamId = String(formData.get("teamId") ?? "") || null;
  const action = String(formData.get("action") ?? "BAN") as VetoAction;
  const mapName = String(formData.get("mapName") ?? "");
  const count = await prisma.matchVetoStep.count({ where: { matchId } });
  await prisma.matchVetoStep.create({ data: { matchId, order: count + 1, teamId, action, mapName } });
  revalidateMatch(matchId);
}

export async function deleteVetoStep(matchId: string, stepId: string) {
  await requireAdmin();
  await prisma.matchVetoStep.delete({ where: { id: stepId } });
  revalidateMatch(matchId);
}
