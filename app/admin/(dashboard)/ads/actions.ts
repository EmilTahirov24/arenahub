"use server";

import { revalidatePublicContent } from "@/lib/cacheTags";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireSuperAdmin } from "@/lib/adminAuth";
import type { AdPlacement } from "@/app/generated/prisma/client";


function adData(formData: FormData) {
  const imageUrl = String(formData.get("imageUrl") ?? "");
  if (!imageUrl) throw new Error("Şəkil tələb olunur");

  return {
    name: String(formData.get("name") ?? ""),
    // Default HEADER idi, amma o yeri heç bir AdSlot render etmir — belə banner
    // yaradılırdı və heç yerdə görünmürdü. Formanın öz siyahısındakı birinci
    // yer götürülür.
    placement: String(formData.get("placement") ?? "SIDEBAR_LEFT") as AdPlacement,
    imageUrl,
    linkUrl: String(formData.get("linkUrl") ?? ""),
    altText: String(formData.get("altText") ?? "") || null,
    startDate: new Date(String(formData.get("startDate") ?? "")),
    endDate: formData.get("endDate") ? new Date(String(formData.get("endDate"))) : null,
    weight: formData.get("weight") ? Number(formData.get("weight")) : 1,
    isActive: formData.get("isActive") === "on",
  };
}

export async function createAd(formData: FormData) {
  await requireAdmin();
  await prisma.adBanner.create({ data: adData(formData) });
  revalidatePath("/admin/ads");
  revalidatePublicContent();
  redirect("/admin/ads");
}

export async function updateAd(id: string, formData: FormData) {
  await requireAdmin();
  await prisma.adBanner.update({ where: { id }, data: adData(formData) });
  revalidatePath("/admin/ads");
  revalidatePublicContent();
  redirect("/admin/ads");
}

export async function deleteAd(id: string) {
  await requireSuperAdmin();
  await prisma.adBanner.delete({ where: { id } });
  revalidatePath("/admin/ads");
  revalidatePublicContent();
  redirect("/admin/ads");
}
