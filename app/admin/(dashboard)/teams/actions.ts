"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireSuperAdmin } from "@/lib/adminAuth";


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
    ownerId: String(formData.get("ownerId") ?? "") || null,
    primaryColor: String(formData.get("primaryColor") ?? "") || null,
    secondaryColor: String(formData.get("secondaryColor") ?? "") || null,
    logoUrl: String(formData.get("logoUrl") ?? "") || null,
    description: String(formData.get("description") ?? "") || null,
    isActive: formData.get("isActive") === "on",
  };
}

/**
 * A Player may own at most one team — the player-side create flow enforces it,
 * so the admin form must too, otherwise one account would end up with two
 * "Komandam" pages and no way to reach the second.
 */
async function assertOwnerFree(ownerId: string | null, exceptTeamId?: string) {
  if (!ownerId) return;
  const owner = await prisma.player.findUnique({ where: { id: ownerId }, select: { isClaimed: true } });
  if (!owner?.isClaimed) throw new Error("Sahib yalnız qeydiyyatlı hesab ola bilər");

  const other = await prisma.team.findFirst({
    where: { ownerId, ...(exceptTeamId ? { id: { not: exceptTeamId } } : {}) },
    select: { name: true },
  });
  if (other) throw new Error(`Bu oyunçu artıq "${other.name}" komandasının sahibidir`);
}

export async function createTeam(formData: FormData) {
  await requireAdmin();
  const data = teamData(formData);
  await assertOwnerFree(data.ownerId);
  await prisma.team.create({ data });
  revalidatePath("/admin/teams");
  revalidatePath("/[locale]", "layout");
  redirect("/admin/teams");
}

export async function updateTeam(id: string, formData: FormData) {
  await requireAdmin();
  const data = teamData(formData);
  await assertOwnerFree(data.ownerId, id);
  await prisma.team.update({ where: { id }, data });
  revalidatePath("/admin/teams");
  revalidatePath("/[locale]", "layout");
  redirect("/admin/teams");
}

/** Accounts the admin form may offer as owner: registered, and not already
 *  owning a different team. */
export async function loadTeamOwnerOptions(currentTeamId?: string) {
  // Everything exported from a "use server" file is a callable endpoint, and
  // this one returns account emails — it must check the caller itself.
  await requireAdmin();
  return prisma.player.findMany({
    where: {
      isClaimed: true,
      OR: [{ ownedTeams: { none: {} } }, ...(currentTeamId ? [{ ownedTeams: { some: { id: currentTeamId } } }] : [])],
    },
    select: { id: true, nickname: true, email: true },
    orderBy: { nickname: "asc" },
  });
}

export async function deleteTeam(id: string) {
  await requireSuperAdmin();
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
