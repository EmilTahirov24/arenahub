"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireSuperAdmin } from "@/lib/adminAuth";
import { socialsFromFormData } from "@/lib/socials";
import type { PlayerStatus } from "@/app/generated/prisma/client";


function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

async function playerData(formData: FormData) {
  const nickname = String(formData.get("nickname") ?? "");
  const teamId = String(formData.get("teamId") ?? "") || null;
  let gameId = String(formData.get("gameId") ?? "") || null;
  if (teamId) {
    const team = await prisma.team.findUnique({ where: { id: teamId } });
    if (team) gameId = team.gameId;
  }
  if (!gameId) throw new Error("Oyun seçilməyib");

  return {
    data: {
      nickname,
      firstName: String(formData.get("firstName") ?? "") || null,
      lastName: String(formData.get("lastName") ?? "") || null,
      country: String(formData.get("country") ?? "") || null,
      role: String(formData.get("role") ?? "") || null,
      status: String(formData.get("status") ?? "ACTIVE") as PlayerStatus,
      photoUrl: String(formData.get("photoUrl") ?? "") || null,
      socials: socialsFromFormData(formData),
      gameId,
    },
    teamId,
  };
}

export async function createPlayer(formData: FormData) {
  await requireAdmin();
  const { data, teamId } = await playerData(formData);
  const slug = slugify(String(formData.get("slug") || data.nickname)) + "-" + Math.random().toString(36).slice(2, 6);
  const player = await prisma.player.create({ data: { ...data, slug } });
  if (teamId) {
    await prisma.teamMembership.create({ data: { teamId, playerId: player.id } });
  }
  revalidatePath("/admin/players");
  revalidatePath("/[locale]", "layout");
  redirect(teamId ? `/admin/teams/${teamId}` : "/admin/players");
}

export async function updatePlayer(id: string, formData: FormData) {
  await requireAdmin();
  const { data, teamId } = await playerData(formData);
  await prisma.player.update({ where: { id }, data });

  const currentMembership = await prisma.teamMembership.findFirst({ where: { playerId: id, leftAt: null } });
  if (teamId && currentMembership?.teamId !== teamId) {
    if (currentMembership) {
      await prisma.teamMembership.update({ where: { id: currentMembership.id }, data: { leftAt: new Date() } });
    }
    await prisma.teamMembership.create({ data: { teamId, playerId: id } });
  } else if (!teamId && currentMembership) {
    await prisma.teamMembership.update({ where: { id: currentMembership.id }, data: { leftAt: new Date() } });
  }

  revalidatePath("/admin/players");
  revalidatePath("/[locale]", "layout");
  redirect("/admin/players");
}

export async function deletePlayer(id: string) {
  await requireSuperAdmin();
  await prisma.teamMembership.deleteMany({ where: { playerId: id } });
  await prisma.playerMatchStat.deleteMany({ where: { playerId: id } });
  await prisma.player.delete({ where: { id } });
  revalidatePath("/admin/players");
  revalidatePath("/[locale]", "layout");
  redirect("/admin/players");
}
