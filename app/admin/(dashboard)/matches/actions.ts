"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireSuperAdmin } from "@/lib/adminAuth";
import { recomputeTeamRatings } from "@/lib/rating";
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
    streamUrl: String(formData.get("streamUrl") ?? "") || null,
    status: String(formData.get("status") ?? "UPCOMING") as MatchStatus,
    isFeatured: formData.get("isFeatured") === "on",
  };
}

function matchSlug(teamASlug: string, teamBSlug: string) {
  return `${teamASlug}-vs-${teamBSlug}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function createMatch(formData: FormData) {
  await requireAdmin();
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
  revalidatePath("/[locale]", "layout");
  redirect(`/admin/matches/${match.id}`);
}

export async function updateMatch(id: string, formData: FormData) {
  await requireAdmin();
  await prisma.match.update({ where: { id }, data: matchData(formData) });
  await recomputeTeamRatings();
  revalidatePath("/admin/matches");
  revalidatePath("/[locale]", "layout");
  redirect("/admin/matches");
}

export async function deleteMatch(id: string) {
  await requireSuperAdmin();
  await prisma.match.delete({ where: { id } });
  await recomputeTeamRatings();
  revalidatePath("/admin/matches");
  revalidatePath("/[locale]", "layout");
  redirect("/admin/matches");
}
