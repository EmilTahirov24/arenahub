"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth";

async function requireAdmin() {
  const session = await getAdminSession();
  if (!session) throw new Error("Unauthorized");
}

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function teamData(formData: FormData) {
  const name = String(formData.get("name") ?? "");
  return {
    name,
    slug: slugify(String(formData.get("slug") || name)),
    gameId: String(formData.get("gameId") ?? ""),
    country: String(formData.get("country") ?? "") || null,
    worldRanking: formData.get("worldRanking") ? Number(formData.get("worldRanking")) : null,
    primaryColor: String(formData.get("primaryColor") ?? "") || null,
    secondaryColor: String(formData.get("secondaryColor") ?? "") || null,
    logoUrl: String(formData.get("logoUrl") ?? "") || null,
    description: String(formData.get("description") ?? "") || null,
    isActive: formData.get("isActive") === "on",
  };
}

export async function createTeam(formData: FormData) {
  await requireAdmin();
  await prisma.team.create({ data: teamData(formData) });
  revalidatePath("/admin/teams");
  revalidatePath("/[locale]", "layout");
  redirect("/admin/teams");
}

export async function updateTeam(id: string, formData: FormData) {
  await requireAdmin();
  await prisma.team.update({ where: { id }, data: teamData(formData) });
  revalidatePath("/admin/teams");
  revalidatePath("/[locale]", "layout");
  redirect("/admin/teams");
}

export async function deleteTeam(id: string) {
  await requireAdmin();
  await prisma.team.delete({ where: { id } });
  revalidatePath("/admin/teams");
  revalidatePath("/[locale]", "layout");
  redirect("/admin/teams");
}

export async function removeFromRoster(teamId: string, membershipId: string) {
  await requireAdmin();
  await prisma.teamMembership.update({ where: { id: membershipId }, data: { leftAt: new Date() } });
  revalidatePath(`/admin/teams/${teamId}`);
  revalidatePath("/[locale]", "layout");
}
