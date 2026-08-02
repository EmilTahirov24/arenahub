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
  revalidatePath("/[locale]", "layout");
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
  revalidatePath("/[locale]", "layout");
  redirect("/admin/games");
}

export async function deleteGame(id: string) {
  await requireAdmin();
  await prisma.game.delete({ where: { id } });
  revalidatePath("/admin/games");
  revalidatePath("/[locale]", "layout");
}
