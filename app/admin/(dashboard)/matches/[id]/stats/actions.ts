"use server";

import { revalidatePublicContent } from "@/lib/cacheTags";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminAuth";
import type { AdminSaveState } from "@/lib/adminFormState";


export async function upsertPlayerStat(
  matchId: string,
  _prev: AdminSaveState,
  formData: FormData,
): Promise<AdminSaveState> {
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
  revalidatePublicContent();
  return { ok: true };
}
