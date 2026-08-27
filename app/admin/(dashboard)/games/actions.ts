"use server";

import { revalidatePublicContent } from "@/lib/cacheTags";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireSuperAdmin } from "@/lib/adminAuth";


function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export async function createGame(formData: FormData) {
  await requireAdmin();
  const name = String(formData.get("name") ?? "");
  await prisma.game.create({
    data: {
      slug: slugify(String(formData.get("slug") || name)),
      name,
      shortName: String(formData.get("shortName") ?? ""),
      accentColor: String(formData.get("accentColor") ?? "#7c3aed"),
      logoUrl: String(formData.get("logoUrl") ?? "") || null,
      isActive: formData.get("isActive") === "on",
    },
  });
  revalidatePath("/admin/games");
  revalidatePublicContent();
  redirect("/admin/games");
}

export async function updateGame(id: string, formData: FormData) {
  await requireAdmin();
  const name = String(formData.get("name") ?? "");
  await prisma.game.update({
    where: { id },
    data: {
      slug: slugify(String(formData.get("slug") || name)),
      name,
      shortName: String(formData.get("shortName") ?? ""),
      accentColor: String(formData.get("accentColor") ?? "#7c3aed"),
      logoUrl: String(formData.get("logoUrl") ?? "") || null,
      isActive: formData.get("isActive") === "on",
    },
  });
  revalidatePath("/admin/games");
  revalidatePublicContent();
  redirect("/admin/games");
}

export async function deleteGame(id: string) {
  await requireSuperAdmin();
  await prisma.game.delete({ where: { id } });
  revalidatePath("/admin/games");
  revalidatePublicContent();
  // Every other delete in the admin sends you back to the list; this one did
  // not, leaving the browser on the detail page of a game that no longer
  // exists. Deleting looked like nothing happening, then broke on reload.
  redirect("/admin/games");
}
