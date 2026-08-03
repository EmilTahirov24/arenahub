"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireSuperAdmin } from "@/lib/adminAuth";
import type { TournamentTier, TournamentStatus } from "@/app/generated/prisma/client";


function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function tournamentData(formData: FormData) {
  const name = String(formData.get("name") ?? "");
  return {
    name,
    slug: slugify(String(formData.get("slug") || name)),
    gameId: String(formData.get("gameId") ?? ""),
    logoUrl: String(formData.get("logoUrl") ?? "") || null,
    tier: String(formData.get("tier") ?? "B") as TournamentTier,
    startDate: new Date(String(formData.get("startDate") ?? "")),
    endDate: new Date(String(formData.get("endDate") ?? "")),
    location: String(formData.get("location") ?? "") || null,
    prizePool: String(formData.get("prizePool") ?? "") || null,
    format: String(formData.get("format") ?? "") || null,
    status: String(formData.get("status") ?? "UPCOMING") as TournamentStatus,
  };
}

export async function createTournament(formData: FormData) {
  await requireAdmin();
  await prisma.tournament.create({ data: tournamentData(formData) });
  revalidatePath("/admin/tournaments");
  revalidatePath("/[locale]", "layout");
  redirect("/admin/tournaments");
}

export async function updateTournament(id: string, formData: FormData) {
  await requireAdmin();
  await prisma.tournament.update({ where: { id }, data: tournamentData(formData) });
  revalidatePath("/admin/tournaments");
  revalidatePath("/[locale]", "layout");
  redirect("/admin/tournaments");
}

export async function deleteTournament(id: string) {
  await requireSuperAdmin();
  await prisma.tournament.delete({ where: { id } });
  revalidatePath("/admin/tournaments");
  revalidatePath("/[locale]", "layout");
  redirect("/admin/tournaments");
}

export async function addParticipant(tournamentId: string, formData: FormData) {
  await requireAdmin();
  const teamId = String(formData.get("teamId") ?? "");
  if (!teamId) throw new Error("Komanda seçilməyib");
  const seed = formData.get("seed") ? Number(formData.get("seed")) : null;
  await prisma.tournamentParticipant.create({ data: { tournamentId, teamId, seed } });
  revalidatePath(`/admin/tournaments/${tournamentId}`);
  revalidatePath("/[locale]", "layout");
}

export async function removeParticipant(tournamentId: string, participantId: string) {
  await requireAdmin();
  await prisma.tournamentParticipant.delete({ where: { id: participantId } });
  revalidatePath(`/admin/tournaments/${tournamentId}`);
  revalidatePath("/[locale]", "layout");
}
