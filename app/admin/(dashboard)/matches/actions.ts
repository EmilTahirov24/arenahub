"use server";

import { revalidatePublicContent } from "@/lib/cacheTags";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireSuperAdmin } from "@/lib/adminAuth";
import { recomputeTeamRatings } from "@/lib/rating";
import type { AdminSaveState } from "@/lib/adminFormState";
import { normaliseStreamUrl } from "@/lib/streams";
import type { MatchStatus } from "@/app/generated/prisma/client";


function matchData(formData: FormData) {
  return {
    gameId: String(formData.get("gameId") ?? ""),
    tournamentId: String(formData.get("tournamentId") ?? "") || null,
    teamAId: String(formData.get("teamAId") ?? ""),
    teamBId: String(formData.get("teamBId") ?? ""),
    scheduledAt: new Date(String(formData.get("scheduledAt") ?? "")),
    bestOf: Number(formData.get("bestOf") ?? 1),
    stage: String(formData.get("stage") ?? "") || null,
    starRating: Number(formData.get("starRating") ?? 1),
    // Yoxlanmış ünvan: sahə birbaşa <a href>-ə düşür və panelə EDITOR rolu
    // da girə bilir. javascript: və data: sxemləri kənarlaşdırılır.
    streamUrl: normaliseStreamUrl(String(formData.get("streamUrl") ?? "")),
    status: String(formData.get("status") ?? "UPCOMING") as MatchStatus,
  };
}

function matchSlug(teamASlug: string, teamBSlug: string) {
  return `${teamASlug}-vs-${teamBSlug}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Yazılan yayım linki oxunmayan ünvandırsa, səbəbi deyilir. */
function streamError(formData: FormData): string | null {
  const typed = String(formData.get("streamUrl") ?? "").trim();
  if (typed && !normaliseStreamUrl(typed)) {
    return "Yayım linki tam ünvan olmalıdır — https:// ilə başlamalıdır";
  }
  return null;
}

export async function createMatch(_prev: AdminSaveState, formData: FormData): Promise<AdminSaveState> {
  await requireAdmin();
  const bad = streamError(formData);
  if (bad) return { error: bad };
  const data = matchData(formData);
  const [teamA, teamB] = await Promise.all([
    prisma.team.findUniqueOrThrow({ where: { id: data.teamAId } }),
    prisma.team.findUniqueOrThrow({ where: { id: data.teamBId } }),
  ]);
  const match = await prisma.match.create({
    data: { ...data, slug: matchSlug(teamA.slug, teamB.slug) },
  });
  await recomputeTeamRatings();
  revalidatePath("/admin/matches");
  revalidatePublicContent();
  redirect(`/admin/matches/${match.id}`);
}

export async function updateMatch(
  id: string,
  _prev: AdminSaveState,
  formData: FormData,
): Promise<AdminSaveState> {
  await requireAdmin();
  const bad = streamError(formData);
  if (bad) return { error: bad };
  await prisma.match.update({ where: { id }, data: matchData(formData) });
  await recomputeTeamRatings();
  revalidatePath("/admin/matches");
  revalidatePublicContent();
  redirect("/admin/matches");
}

export async function deleteMatch(id: string) {
  await requireSuperAdmin();
  await prisma.match.delete({ where: { id } });
  await recomputeTeamRatings();
  revalidatePath("/admin/matches");
  revalidatePublicContent();
  redirect("/admin/matches");
}
