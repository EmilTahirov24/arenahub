"use server";

import { revalidatePublicContent } from "@/lib/cacheTags";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/adminAuth";
import { approveProfileClaim, rejectProfileClaim } from "@/lib/profileClaims";

export async function approveClaim(claimId: string, formData: FormData) {
  const admin = await requireAdmin();
  await approveProfileClaim(claimId, admin.id, String(formData.get("note") ?? ""));
  revalidatePath("/admin/claims");
  revalidatePath("/admin/players");
  revalidatePublicContent();
}

export async function rejectClaim(claimId: string, formData: FormData) {
  const admin = await requireAdmin();
  await rejectProfileClaim(claimId, admin.id, String(formData.get("note") ?? ""));
  revalidatePath("/admin/claims");
}
