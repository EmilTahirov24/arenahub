"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getTeamSession } from "@/lib/auth";
import type { PlayerStatus } from "@/app/generated/prisma/client";

async function requireTeam() {
  const session = await getTeamSession();
  if (!session) throw new Error("Unauthorized");
  return session;
}

async function assertOwnsPlayer(teamId: string, playerId: string) {
  const membership = await prisma.teamMembership.findFirst({ where: { teamId, playerId, leftAt: null } });
  if (!membership) throw new Error("Forbidden");
}

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export async function createOwnPlayer(formData: FormData) {
  const session = await requireTeam();
  const team = await prisma.team.findUniqueOrThrow({ where: { id: session.id } });
  const nickname = String(formData.get("nickname") ?? "");

  const player = await prisma.player.create({
    data: {
      nickname,
      slug: slugify(nickname) + "-" + Math.random().toString(36).slice(2, 6),
      firstName: String(formData.get("firstName") ?? "") || null,
      lastName: String(formData.get("lastName") ?? "") || null,
      country: String(formData.get("country") ?? "") || null,
      role: String(formData.get("role") ?? "") || null,
      photoUrl: String(formData.get("photoUrl") ?? "") || null,
      gameId: team.gameId,
    },
  });
  await prisma.teamMembership.create({ data: { teamId: team.id, playerId: player.id } });

  revalidatePath("/team/roster");
  revalidatePath("/[locale]", "layout");
  redirect("/team/roster");
}

export async function updateOwnPlayer(playerId: string, formData: FormData) {
  const session = await requireTeam();
  await assertOwnsPlayer(session.id, playerId);

  await prisma.player.update({
    where: { id: playerId },
    data: {
      nickname: String(formData.get("nickname") ?? ""),
      firstName: String(formData.get("firstName") ?? "") || null,
      lastName: String(formData.get("lastName") ?? "") || null,
      country: String(formData.get("country") ?? "") || null,
      role: String(formData.get("role") ?? "") || null,
      status: String(formData.get("status") ?? "ACTIVE") as PlayerStatus,
      photoUrl: String(formData.get("photoUrl") ?? "") || null,
    },
  });

  revalidatePath("/team/roster");
  revalidatePath("/[locale]", "layout");
  redirect("/team/roster");
}

export async function removeOwnPlayer(playerId: string) {
  const session = await requireTeam();
  await assertOwnsPlayer(session.id, playerId);

  await prisma.teamMembership.updateMany({
    where: { teamId: session.id, playerId, leftAt: null },
    data: { leftAt: new Date() },
  });

  revalidatePath("/team/roster");
  revalidatePath("/[locale]", "layout");
}
