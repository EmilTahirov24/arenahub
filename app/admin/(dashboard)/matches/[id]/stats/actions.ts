"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth";

async function requireAdmin() {
  const session = await getAdminSession();
  if (!session) throw new Error("Unauthorized");
}

export async function upsertPlayerStat(matchId: string, formData: FormData) {
  await requireAdmin();
  const playerId = String(formData.get("playerId") ?? "");
  const teamId = String(formData.get("teamId") ?? "");
  const kills = Number(formData.get("kills") ?? 0);
  const deaths = Number(formData.get("deaths") ?? 0);
  const assists = Number(formData.get("assists") ?? 0);
  const ratingRaw = String(formData.get("rating") ?? "");
  const rating = ratingRaw ? Number(ratingRaw) : null;

  const existing = await prisma.playerMatchStat.findFirst({ where: { matchId, playerId, mapId: null } });
  if (existing) {
    await prisma.playerMatchStat.update({ where: { id: existing.id }, data: { kills, deaths, assists, rating } });
  } else {
    await prisma.playerMatchStat.create({ data: { matchId, playerId, teamId, kills, deaths, assists, rating } });
  }

  revalidatePath(`/admin/matches/${matchId}/stats`);
  revalidatePath("/[locale]", "layout");
}
