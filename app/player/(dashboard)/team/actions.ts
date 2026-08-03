"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getPlayerSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export async function createTeam(formData: FormData) {
  const session = await getPlayerSession();
  if (!session) throw new Error("Unauthorized");

  const existing = await prisma.team.findFirst({ where: { ownerId: session.id } });
  if (existing) throw new Error("Artıq komandanız var");

  // Founding a team also puts you on its roster, so someone already playing for
  // another team would end up on two at once — they have to leave first.
  const membership = await prisma.teamMembership.findFirst({ where: { playerId: session.id, leftAt: null } });
  if (membership) throw new Error("Artıq bir komandanın tərkibindəsiniz — əvvəlcə oradan ayrılın");

  const name = String(formData.get("name") ?? "").trim();
  const gameId = String(formData.get("gameId") ?? "");
  if (!name || !gameId) return;

  const team = await prisma.team.create({
    data: {
      name,
      slug: `${slugify(name)}-${Math.random().toString(36).slice(2, 6)}`,
      gameId,
      country: String(formData.get("country") ?? "") || null,
      ownerId: session.id,
    },
  });

  const player = await prisma.player.findUniqueOrThrow({ where: { id: session.id } });
  await prisma.teamMembership.create({ data: { teamId: team.id, playerId: player.id } });

  revalidatePath("/player/team");
  revalidatePath("/[locale]", "layout");
  redirect("/player/team");
}

export async function updateOwnTeam(formData: FormData) {
  const session = await getPlayerSession();
  if (!session) throw new Error("Unauthorized");

  const team = await prisma.team.findFirst({ where: { ownerId: session.id } });
  if (!team) throw new Error("Forbidden");

  await prisma.team.update({
    where: { id: team.id },
    data: {
      name: String(formData.get("name") ?? ""),
      country: String(formData.get("country") ?? "") || null,
      primaryColor: String(formData.get("primaryColor") ?? "") || null,
      secondaryColor: String(formData.get("secondaryColor") ?? "") || null,
      logoUrl: String(formData.get("logoUrl") ?? "") || null,
      description: String(formData.get("description") ?? "") || null,
    },
  });
  revalidatePath("/player/team");
  revalidatePath("/[locale]", "layout");
}
